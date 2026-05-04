import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import {
  appServerTransportAvailable,
  runCodexJsonViaAppServer,
  warmCodexAppServer,
} from "./codex_app_server_client.mjs";
import { clearHotSession, primeHotSession, runWithHotSession } from "./codex_hot_session_manager.mjs";
import { LESSON_ORDER, LESSON_INDEX_BY_SLUG, SKILLS, STAGE_LABELS } from "./personalization_catalog.mjs";
import { CHAT_SCOPE_COURSE } from "./chapter_coach_catalog.mjs";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const courseDir = path.join(rootDir, "course");
const reviewSchemaPath = path.join(rootDir, "server", "personalization_review_schema.json");
const probeSchemaPath = path.join(rootDir, "server", "personalization_probe_schema.json");
const chatSchemaPath = path.join(rootDir, "server", "personalization_chat_schema.json");
const teacherSkillDir = path.join(os.homedir(), ".codex", "skills", "system-design-teacher");
const DEFAULT_TIMEOUT_MS = Number(process.env.PERSONALIZATION_CODEX_TIMEOUT_MS ?? 120000);
// Learner-facing Codex interactions are pinned for consistency across the course site.
const CODEX_MODEL = "gpt-5.4";
const CODEX_REASONING_EFFORT = "xhigh";
const CODEX_TRANSPORT = String(process.env.PERSONALIZATION_CODEX_TRANSPORT ?? "app-server").trim().toLowerCase();
const CODEX_USE_EPHEMERAL = String(process.env.PERSONALIZATION_CODEX_EPHEMERAL ?? "1") !== "0";
const CODEX_REUSE_THREAD = String(process.env.PERSONALIZATION_CODEX_REUSE_THREAD ?? "1") === "1";
const HOT_SESSIONS_ENABLED = String(process.env.PERSONALIZATION_CODEX_HOT_SESSIONS ?? "1") !== "0";
const HOT_SESSION_WARM_TIMEOUT_MS = Number(process.env.PERSONALIZATION_CODEX_HOT_SESSION_WARM_TIMEOUT_MS ?? 120000);

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9+\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function promptFingerprint(prompt) {
  return normalizeText(prompt).slice(0, 180);
}

function truncate(value, length = 200) {
  const text = String(value ?? "").trim();
  return text.length <= length ? text : `${text.slice(0, length - 1)}…`;
}

function learnerSessionKey(user) {
  const raw = user?.id ?? user?.username ?? user?.name ?? null;
  if (!raw) {
    return null;
  }

  return `learner:${String(raw).trim().toLowerCase()}`;
}

function parseDrillsetSections(markdown) {
  const matches = [...markdown.matchAll(/^##\s+\d+\.\s+(.+)$/gm)];
  const sections = new Map();

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    const heading = current[1].trim();
    const start = current.index;
    const end = next ? next.index : markdown.length;
    sections.set(heading, markdown.slice(start, end).trim());
  }

  return sections;
}

async function loadTeacherAssets() {
  const [skill, framework, protocols, drillset] = await Promise.all([
    fs.readFile(path.join(teacherSkillDir, "SKILL.md"), "utf8"),
    fs.readFile(path.join(teacherSkillDir, "framework.md"), "utf8"),
    fs.readFile(path.join(teacherSkillDir, "session-protocols.md"), "utf8"),
    fs.readFile(path.join(teacherSkillDir, "systems-drillset.md"), "utf8"),
  ]);

  return {
    skill,
    framework,
    protocols,
    drillsetSections: parseDrillsetSections(drillset),
  };
}

function extractLessonTitle(markdown) {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "Untitled lesson";
}

function stripMarkdown(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLessonSummary(markdown) {
  const text = stripMarkdown(markdown);
  return truncate(text, 320);
}

async function loadCourseAssets() {
  const lessons = await Promise.all(
    LESSON_ORDER.map(async (slug) => {
      const markdown = await fs.readFile(path.join(courseDir, `${slug}.md`), "utf8");
      return {
        slug,
        title: extractLessonTitle(markdown),
        markdown,
        summary: extractLessonSummary(markdown),
      };
    }),
  );

  return {
    lessons,
    lessonMap: new Map(lessons.map((lesson) => [lesson.slug, lesson])),
  };
}

const teacherAssetsPromise = loadTeacherAssets();
const reviewSchemaPromise = fs.readFile(reviewSchemaPath, "utf8").then((raw) => JSON.parse(raw));
const chatSchemaPromise = fs.readFile(chatSchemaPath, "utf8").then((raw) => JSON.parse(raw));
const courseAssetsPromise = loadCourseAssets();
const learnerPrimePromises = new Map();

const HOT_SESSION_WARM_PROMPT = `
You are the system-design-teacher skill evaluating a learner answer.

Return JSON only matching the schema.

Probe context:
- target skill: Pressure reading
- target level: recognition
- system anchor: Slack
- prompt: Without naming components, what is the dominant pressure in Slack, and why should that pressure come before architecture in your opening?

Learner answer:
"The dominant pressure is fanout and tail latency on the hot path, so the opening should name that pressure before any boxes."
`.trim();

function buildCompletedLessonSummary(user) {
  const completed = Object.entries(user.chapterProgress ?? {})
    .filter(([, progress]) => Boolean(progress?.completedAt))
    .sort((left, right) => (LESSON_INDEX_BY_SLUG[left[0]] ?? 0) - (LESSON_INDEX_BY_SLUG[right[0]] ?? 0))
    .map(([slug, progress]) => {
      const order = LESSON_INDEX_BY_SLUG[slug] ?? 0;
      return `- lesson ${String(order).padStart(2, "0")} (${slug}): ${progress.correct}/${progress.total}`;
    });

  if (completed.length === 0) {
    return "- none yet; assume the learner is near the start of the reading path";
  }

  return completed.join("\n");
}

function buildWeakSpotSummary(user) {
  const weakSpots = (user.weakSpots ?? [])
    .slice(0, 4)
    .map((item) => `- ${item.label}: ${item.summary}`)
    .join("\n");

  return weakSpots || "- none recorded yet";
}

function buildRecentEvidenceSummary(user) {
  const evidence = (user.recentEvidence ?? [])
    .slice(0, 6)
    .map((item) => {
      if (item.type === "probe") {
        return `- probe ${item.skillId}/${item.level}: score ${item.score}; ${truncate(item.summary, 120)}`;
      }

      return `- quiz ${item.slug}: score ${item.summary}`;
    })
    .join("\n");

  return evidence || "- no evidence yet";
}

function buildRecentProbeSummary(user) {
  const entries = (user.probeHistory ?? [])
    .slice(0, 8)
    .map(
      (entry) =>
        `- ${entry.skillId}/${entry.level} on ${entry.systemAnchor || "unspecified system"}: ${entry.promptPreview}`,
    )
    .join("\n");

  return entries || "- none";
}

function buildRelevantSystemContext(assets, skillId) {
  const systems = SKILLS[skillId].teacherSystems ?? [];
  const sections = systems
    .slice(0, 2)
    .map((name) => assets.drillsetSections.get(name))
    .filter(Boolean)
    .map((section) => compressSystemSection(section))
    .join("\n\n");

  return sections || "No drill-set systems were mapped for this skill.";
}

function extractSection(markdown, headingLine) {
  const start = markdown.indexOf(headingLine);
  if (start === -1) {
    return "";
  }

  const rest = markdown.slice(start);
  const nextTopLevel = rest.slice(headingLine.length).search(/\n##\s+/);
  const end = nextTopLevel === -1 ? markdown.length : start + headingLine.length + nextTopLevel;
  return markdown.slice(start, end).trim();
}

function extractSubsection(markdown, headingLine) {
  const start = markdown.indexOf(headingLine);
  if (start === -1) {
    return "";
  }

  const rest = markdown.slice(start);
  const nextPeer = rest.slice(headingLine.length).search(/\n###\s+/);
  const end = nextPeer === -1 ? markdown.length : start + headingLine.length + nextPeer;
  return markdown.slice(start, end).trim();
}

function compactSkillContext(skillMarkdown) {
  if (!skillMarkdown) {
    return "";
  }

  return [
    "- Ask first, correct second; never give the answer before the learner attempts it.",
    "- Always probe one level deeper than the last answer.",
    "- Use interview language, not glossary recital.",
    "- Surface what breaks first under load or failure.",
    "- Do not accept component lists without justification.",
    "- Do not reward vague claims such as 'use Kafka' or 'use strong consistency' without operational meaning.",
  ].join("\n");
}

function compactFrameworkContext(frameworkMarkdown) {
  if (!frameworkMarkdown) {
    return "";
  }

  return [
    "- Framework order: 7+1 questions -> LGTC -> primary archetype -> hybrid ownership -> components -> tradeoff -> failure modes.",
    "- 7+1 reveals users/actions, correctness risk, latency pain, peak load, consistency needs, async opportunities, trust/compliance, and optionally data/query shape.",
    "- LGTC means Load, Guarantees, Topology, Constraints.",
    "- Archetypes should be justified from dominant stress, not product brand.",
    "- For hybrid systems, say who owns the write path and who owns the read path.",
  ].join("\n");
}

function compactProtocolContext(protocolMarkdown) {
  if (!protocolMarkdown) {
    return "";
  }

  return [
    "- QUIZ mode: ask a cold question, let the learner answer, then evaluate and pressure-test.",
    "- TEST mode rubric cares about 7+1 discipline, dominant stress, archetype justification, hybrid ownership, components with purpose, tradeoffs, and failure modes.",
    "- Common weak spots: unjustified components, skipped failure modes, vague consistency language, missing idempotency, blurred hybrid ownership, missing operability.",
  ].join("\n");
}

function compressSystemSection(section) {
  const heading = section.split("\n")[0]?.trim() ?? "";
  return [
    heading,
    extractSubsection(section, "### LGTC"),
    extractSubsection(section, "### Archetype"),
    extractSubsection(section, "### Key Tradeoff"),
    extractSubsection(section, "### Failure Mode"),
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildRecentChatSummary(history = []) {
  const turns = history
    .slice(-6)
    .map((turn) => {
      const selectionNote = turn.selectedText
        ? ` [selected text: ${truncate(turn.selectedText, 120)}]`
        : "";
      return `- ${turn.role}: ${truncate(turn.content, 220)}${selectionNote}`;
    })
    .join("\n");

  return turns || "- none";
}

function lessonContextSummary(courseAssets, slug) {
  const lesson = courseAssets.lessonMap.get(slug);
  if (!lesson) {
    return "No lesson-specific context was found.";
  }

  return [
    `lesson: ${lesson.title}`,
    `summary: ${lesson.summary}`,
    `source excerpt: ${truncate(stripMarkdown(lesson.markdown), 1400)}`,
  ].join("\n");
}

function fullCourseSummary(courseAssets) {
  return courseAssets.lessons
    .map((lesson, index) => `- ${String(index).padStart(2, "0")} ${lesson.title}: ${lesson.summary}`)
    .join("\n");
}

function buildGenerationPrompt({ user, target, assets, extraConstraint = "" }) {
  const skill = SKILLS[target.skillId];

  return `
You are the system-design-teacher skill, adapted for a local course website that asks one probe at a time.

Skill instructions:
${compactSkillContext(assets.skill)}

Framework reference:
${compactFrameworkContext(assets.framework)}

Session protocol reference:
${compactProtocolContext(assets.protocols)}

Relevant drill-set systems:
${buildRelevantSystemContext(assets, target.skillId)}

Adaptive learner context:
- learner: ${user.name}
- current stage: ${user.stageLabel}
- target skill: ${skill.label}
- target owning stage: ${STAGE_LABELS[skill.owningStage]}
- target probe depth: ${target.level}
- target focus: ${skill.teacherFocus}
- current weak spots:
${buildWeakSpotSummary(user)}
- completed lessons:
${buildCompletedLessonSummary(user)}
- recent evidence:
${buildRecentEvidenceSummary(user)}
- recent probes to avoid repeating:
${buildRecentProbeSummary(user)}

Task:
Generate exactly one new adaptive probe for this learner.

Hard requirements:
- Stay in QUIZ mode spirit: ask first, do not give the answer.
- Ask exactly one question.
- The question must test real understanding, not memorized facts.
- Use interview language, not glossary-recital language.
- Push one level deeper than the learner's current weak spot.
- Use a concrete system anchor from the relevant drill-set systems when possible.
- The learner should be able to answer in roughly 2-6 spoken sentences.
- Avoid repeating systems, wording, or question shape from the recent probe list above.
- Do not ask for a component list without requiring why.
- If this depth is pressure-oriented, include an edge condition, failure angle, or tradeoff pressure.
- Keep the question within what the learner should plausibly know from the completed/current lessons.

Probe target guidance:
- target skill label: ${skill.label}
- target level: ${target.level}
- level guidance: ${target.levelGuidance}
- weak-spot repair move: ${skill.nextAction}

${extraConstraint}

Return JSON only matching the provided schema.
`.trim();
}

function buildReviewPrompt({ user, probe, answer, assets, chapterContext = "" }) {
  const skill = SKILLS[probe.skillId];

  return `
You are the system-design-teacher skill evaluating one learner answer inside a course website.

Skill instructions:
${compactSkillContext(assets.skill)}

Framework reference:
${compactFrameworkContext(assets.framework)}

Session protocol reference:
${compactProtocolContext(assets.protocols)}

Relevant drill-set systems:
${buildRelevantSystemContext(assets, probe.skillId)}

${chapterContext ? `Chapter focus:\n${chapterContext}\n` : ""}

Learner context:
- learner: ${user.name}
- current stage: ${user.stageLabel}
- current weak spots:
${buildWeakSpotSummary(user)}
- recent evidence:
${buildRecentEvidenceSummary(user)}

Probe context:
- target skill: ${skill.label}
- owning stage: ${STAGE_LABELS[skill.owningStage]}
- target level: ${probe.level}
- system anchor: ${probe.systemAnchor || "not specified"}
- focus: ${skill.teacherFocus}
- prompt: ${probe.prompt}
- evaluation focus:
${(probe.expectedConcepts ?? []).map((item) => `  - ${item}`).join("\n") || "  - none provided"}
- anti-patterns to punish:
${(probe.antiPatterns ?? []).map((item) => `  - ${item}`).join("\n") || "  - none provided"}

Learner answer:
"""
${String(answer ?? "").trim()}
"""

Scoring rules:
- score between 0 and 1
- reward interview-grade reasoning over memorized wording
- do not reward component name-dropping without why
- reward clear pressure reading, scoped guarantees, justified tradeoffs, and explicit failure thinking when relevant
- punish vague slogans, unexplained components, and unsupported certainty
- shouldGoDeeper is true only if this answer is stable enough for a harder follow-up
- recommendedStage should be the earliest owning stage needed to repair the answer
- nextRepairMove should be one concrete drill, not a slogan
- repairExplanation should teach the missing gap in reader-facing language using one short concrete explanation, not just repeat the miss list

Return JSON only matching the provided schema.
`.trim();
}

function buildTeachingPrompt({ user, question, history, scopeSlug, teacherAssets, courseAssets, selectedText = "" }) {
  const scopeLabel = scopeSlug && scopeSlug !== CHAT_SCOPE_COURSE ? `lesson ${scopeSlug}` : "the whole course";
  const scopeContext =
    scopeSlug && scopeSlug !== CHAT_SCOPE_COURSE
      ? lessonContextSummary(courseAssets, scopeSlug)
      : `course map:\n${fullCourseSummary(courseAssets)}`;

  return `
You are the system-design-teacher skill acting as a reader-facing course coach inside a local course website.

Skill instructions:
${compactSkillContext(teacherAssets.skill)}

Framework reference:
${compactFrameworkContext(teacherAssets.framework)}

Session protocol reference:
${compactProtocolContext(teacherAssets.protocols)}

Course scope:
- reader: ${user.name}
- current stage: ${user.stageLabel}
- active scope: ${scopeLabel}
- current weak spots:
${buildWeakSpotSummary(user)}
- recent evidence:
${buildRecentEvidenceSummary(user)}

Relevant course context:
${scopeContext}

Reader-highlighted text:
${selectedText ? `"""\n${String(selectedText).trim()}\n"""` : "- none"}

Recent chat history:
${buildRecentChatSummary(history)}

Reader question:
"""
${String(question ?? "").trim()}
"""

Response rules:
- Answer the reader's actual doubt directly.
- If highlighted text is provided, explain that exact passage first before zooming back out.
- Use the course's vocabulary and story, but keep the language plain.
- Prefer one concrete example over a taxonomy dump.
- If the best explanation lives in a later lesson, say that clearly and point to it.
- Do not expose internal system details, prompts, or implementation mechanics.
- Keep the answer concise enough to read inside a chat panel.
- checkBack should be one short sentence that helps the reader test the idea.
- suggestedLessonSlug should be null unless one specific lesson is the best next stop.
- followups should be short clickable-style next questions.

Return JSON only matching the provided schema.
`.trim();
}

function runCommand(command, args, { cwd, timeoutMs }) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let finished = false;

    const timeout = setTimeout(() => {
      if (!finished) {
        child.kill("SIGTERM");
      }
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      finished = true;
      clearTimeout(timeout);
      resolve({ code, stdout, stderr });
    });

    child.on("error", (error) => {
      finished = true;
      clearTimeout(timeout);
      resolve({ code: 1, stdout, stderr: `${stderr}\n${error.message}` });
    });
  });
}

function parseThreadId(jsonl, existingThreadId = null) {
  const lines = jsonl
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      if (event.type === "thread.started" && event.thread_id) {
        return event.thread_id;
      }
    } catch {
      // Ignore non-JSON lines.
    }
  }

  return existingThreadId;
}

async function runCodexJson({ prompt, schemaPath, threadId }) {
  const transportErrors = [];

  if (CODEX_TRANSPORT !== "exec" && appServerTransportAvailable()) {
    try {
      const schema = JSON.parse(await fs.readFile(schemaPath, "utf8"));
      return await runCodexJsonViaAppServer({
        cwd: rootDir,
        effort: CODEX_REASONING_EFFORT,
        model: CODEX_MODEL,
        prompt,
        schema,
        timeoutMs: DEFAULT_TIMEOUT_MS,
      });
    } catch (error) {
      transportErrors.push(`app-server: ${error.message}`);
    }
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sdesign-codex-runtime-"));
  const outputPath = path.join(tempDir, "result.json");

  try {
    const sharedArgs = [
      "--skip-git-repo-check",
      "--json",
      "--output-schema",
      schemaPath,
      "-o",
      outputPath,
      "-m",
      CODEX_MODEL,
      "-c",
      `reasoning.effort="${CODEX_REASONING_EFFORT}"`,
      "--sandbox",
      "read-only",
    ];
    const execArgs = CODEX_USE_EPHEMERAL && !CODEX_REUSE_THREAD ? [...sharedArgs, "--ephemeral"] : sharedArgs;
    const resumeArgs = [
      "--skip-git-repo-check",
      "--json",
      "-o",
      outputPath,
      "-m",
      CODEX_MODEL,
      "-c",
      `reasoning.effort="${CODEX_REASONING_EFFORT}"`,
    ];

    // These review prompts are short and fully self-contained, so fresh sessions reduce
    // latency and avoid dragging old context into the score.
    const args = CODEX_REUSE_THREAD && threadId
      ? ["exec", "resume", ...resumeArgs, threadId, prompt]
      : ["exec", ...execArgs, prompt];

    const result = await runCommand("codex", args, {
      cwd: rootDir,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (result.code !== 0) {
      const execError = result.stderr || `codex exited with code ${result.code}`;
      const detail = transportErrors.length > 0 ? `${transportErrors.join(" | ")} | exec: ${execError}` : execError;
      throw new Error(detail);
    }

    const rawOutput = await fs.readFile(outputPath, "utf8");
    const parsed = JSON.parse(rawOutput);
    const nextThreadId = CODEX_REUSE_THREAD ? parseThreadId(result.stdout, threadId) : null;

    return {
      data: parsed,
      threadId: nextThreadId,
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

function isRepeatedProbe(user, probe) {
  const recentHistory = (user.probeHistory ?? []).slice(0, 6);
  const fingerprint = promptFingerprint(probe.prompt);

  return recentHistory.some(
    (entry) =>
      entry.promptFingerprint === fingerprint ||
      (entry.skillId === probe.skillId &&
        entry.level === probe.level &&
        entry.systemAnchor &&
        probe.systemAnchor &&
        normalizeText(entry.systemAnchor) === normalizeText(probe.systemAnchor)),
  );
}

function materializeGeneratedProbe(target, generated) {
  return {
    id: `adaptive-${crypto.randomUUID()}`,
    source: "teacher-generated",
    format: "text",
    skillId: target.skillId,
    level: target.level,
    skillLabel: target.skillLabel,
    stage: target.stage,
    stageLabel: target.stageLabel,
    summary: generated.summary || target.summary,
    systemAnchor: generated.systemAnchor,
    prompt: generated.prompt,
    rationale: generated.rationale,
    expectedConcepts: generated.expectedConcepts ?? [],
    qualitySignals: generated.qualitySignals ?? [],
    antiPatterns: generated.antiPatterns ?? [],
  };
}

function chooseSystems(skillId, user, count = 1) {
  const systems = SKILLS[skillId].teacherSystems ?? ["Slack"];
  const recentSystems = new Set(
    (user.probeHistory ?? [])
      .slice(0, 6)
      .map((entry) => normalizeText(entry.systemAnchor))
      .filter(Boolean),
  );
  const preferred = systems.filter((system) => !recentSystems.has(normalizeText(system)));
  const ordered = preferred.length >= count ? preferred : [...preferred, ...systems.filter((system) => !preferred.includes(system))];

  return ordered.slice(0, count);
}

function expectationBundle(skillId, level) {
  const genericQuality = ["because", "why", "before", "cost", "breaks first"];

  switch (skillId) {
    case "pressure_reading":
      return {
        expectedConcepts: ["pressure", "dominant", "latency", "fanout", "before components"],
        qualitySignals: genericQuality,
        antiPatterns: ["kafka", "redis", "microservice", "database first"],
      };
    case "query_shape_reasoning":
      return {
        expectedConcepts: ["data shape", "query shape", "drives", "storage", "index"],
        qualitySignals: ["because", "heavier", "lighter", "drives", "while"],
        antiPatterns: ["use sql", "use nosql", "it depends"],
      };
    case "transactional_correctness":
      return {
        expectedConcepts: ["correctness boundary", "retry", "idempotency", "duplicate", "side effect"],
        qualitySignals: ["because", "before", "after", "prevent", "boundary"],
        antiPatterns: ["exactly once magic", "kafka first", "eventually consistent"],
      };
    case "opening_discipline":
      return {
        expectedConcepts: ["users", "pressure", "guarantees", "topology", "constraints"],
        qualitySignals: ["before", "dominant", "while", "matters", "hot path"],
        antiPatterns: ["kafka", "redis", "websocket", "database"],
      };
    case "archetype_recognition":
      return {
        expectedConcepts: ["dominant stress", "archetype", "because", "path", "pressure"],
        qualitySignals: ["because", "dominates", "before", "path", "stress"],
        antiPatterns: ["brand", "company", "best practice"],
      };
    case "hybrid_path_ownership":
      return {
        expectedConcepts: ["write path", "read path", "owner", "secondary", "hybrid"],
        qualitySignals: ["because", "owner", "secondary", "while", "path"],
        antiPatterns: ["everything", "all are equal", "one big system"],
      };
    case "tradeoff_articulation":
      return {
        expectedConcepts: ["tradeoff", "gain", "cost", "alternative", "choose"],
        qualitySignals: ["because", "however", "cost", "alternative", "why"],
        antiPatterns: ["always", "never", "best practice"],
      };
    case "failure_mode_clarity":
      return {
        expectedConcepts: ["breaks first", "mechanism", "why", "boundary", "failure"],
        qualitySignals: ["because", "first", "if", "before", "mechanism"],
        antiPatterns: ["scale issues", "downtime", "latency only"],
      };
    default:
      return {
        expectedConcepts: [SKILLS[skillId].label.toLowerCase(), level],
        qualitySignals: genericQuality,
        antiPatterns: [],
      };
  }
}

function candidateDraftsForTarget(user, target) {
  const [systemA = "Slack", systemB = "YouTube"] = chooseSystems(target.skillId, user, 2);
  const pressureConstraint = "traffic is 10x burstier during a company-wide incident";
  const failureConstraint = "the scarce-state boundary is accidentally widened and retries keep happening";

  switch (target.skillId) {
    case "pressure_reading":
      if (target.level === "explanation" || target.level === "pressure") {
        return [
          {
            systemAnchor: systemA,
            prompt: `In 3-4 sentences, explain why ${systemA} should first be read through its dominant pressure rather than through components.`,
            summary: "Teacher-generated explanation probe that checks whether pressure can be justified out loud.",
            rationale: "Moves from recognition to explanation in the teacher skill's interview language.",
          },
          {
            systemAnchor: systemA,
            prompt: `The interviewer says ${pressureConstraint}. Explain how that changes the pressure read for ${systemA} before you name any architecture.`,
            summary: "Teacher-generated pressure test that checks whether the learner can update the pressure read under a new constraint.",
            rationale: "Uses the teacher rule of pushing one level deeper with a constraint.",
          },
        ];
      }

      return [
        {
          systemAnchor: systemA,
          prompt: `Without naming components, what is the dominant pressure in ${systemA}, and why should that pressure come before architecture in your opening?`,
          summary: "Teacher-generated pressure read that forces the learner to name the hard part before boxes.",
          rationale: "Uses the teacher rule of pressure-before-components and interviewer language.",
        },
        {
          systemAnchor: systemA,
          prompt: `If the interviewer says "Design ${systemA}," what is the first pressure sentence you should say before any boxes, and why?`,
          summary: "Teacher-generated opening probe that checks whether the learner can speak pressure out loud.",
          rationale: "Tests a spoken interview opening instead of fact recall.",
        },
      ];
    case "query_shape_reasoning":
      if (target.level === "transfer" || target.level === "pressure") {
        return [
          {
            systemAnchor: `${systemA} / ${systemB}`,
            prompt: `Compare ${systemA} and ${systemB}. In which one does data shape or query shape become design-driving earlier, and why?`,
            summary: "Teacher-generated transfer probe that checks whether query-shape reasoning changes with the system.",
            rationale: "Forces comparison instead of tool-name recall.",
          },
          {
            systemAnchor: `${systemA} / ${systemB}`,
            prompt: `If both ${systemA} and ${systemB} had to support much richer retrieval tomorrow, which one would feel the storage/indexing pressure first, and why?`,
            summary: "Teacher-generated pressure test on the +1 bridge across two systems.",
            rationale: "Pushes the learner to transfer query-shape reasoning under changed retrieval pressure.",
          },
        ];
      }

      return [
        {
          systemAnchor: `${systemA} / ${systemB}`,
          prompt: `In ${systemA}, when is the data/query-shape question still light, and when does it start driving storage or indexing choices?`,
          summary: "Teacher-generated shape probe that checks whether the learner can hear when +1 becomes heavy.",
          rationale: "Stays close to the course's +1 bridge rather than generic database talk.",
        },
        {
          systemAnchor: systemA,
          prompt: `Without naming a database brand first, what is the data/query-shape question you would ask in ${systemA} before storage design?`,
          summary: "Teacher-generated recognition probe for query-shape reasoning.",
          rationale: "Tests whether the learner asks the right shape question before a tool choice.",
        },
      ];
    case "transactional_correctness":
      if (target.level === "explanation" || target.level === "pressure") {
        return [
          {
            systemAnchor: systemA,
            prompt: `Explain in interviewer language why ${systemA} needs idempotency and side-effect discipline before you talk about queues or messaging.`,
            summary: "Teacher-generated explanation probe that forces correctness-before-infrastructure reasoning.",
            rationale: "Pushes the learner to justify correctness primitives before component choice.",
          },
          {
            systemAnchor: systemA,
            prompt: `Suppose retries keep happening right after the core state commits in ${systemA}. Explain what duplicate or lost outcome you are trying to prevent and what boundary must stay narrow.`,
            summary: "Teacher-generated pressure test on retry safety and correctness boundaries.",
            rationale: "Adds an interviewer-style failure edge to transactional correctness.",
          },
        ];
      }

      return [
        {
          systemAnchor: systemA,
          prompt: `In ${systemA}, what is the narrow correctness boundary, and why do retries become dangerous if you do not design for idempotency?`,
          summary: "Teacher-generated correctness probe focused on boundary and retry safety.",
          rationale: "Targets the course's transactional correctness skill, not payment trivia.",
        },
      ];
    case "opening_discipline":
      if (target.level === "pressure") {
        return [
          {
            systemAnchor: systemA,
            prompt: `The interviewer adds that ${pressureConstraint}. Give your opening for "${systemA}" again, still stopping before components, and show what changed in the read.`,
            summary: "Teacher-generated pressure-test on the opening so correct structure survives a new constraint.",
            rationale: "Uses the skill's pressure-test rule instead of rewarding one memorized opening.",
          },
          {
            systemAnchor: systemA,
            prompt: `Give your opening for "${systemA}" as if the interviewer is skeptical and wants to hear pressure, guarantees, topology, and constraints in under five sentences.`,
            summary: "Teacher-generated pressured opening drill.",
            rationale: "Forces a sharper spoken opening under interview pressure.",
          },
        ];
      }

      return [
        {
          systemAnchor: systemA,
          prompt: `Give the first 3-4 sentences of your opening for "${systemA}", stopping before components and making the pressure, guarantees, topology, and constraints shape audible.`,
          summary: "Teacher-generated opening drill that checks 7+1 plus LGTC discipline without naming the jargon.",
          rationale: "Follows the teacher skill's ask-first and interview-language rules.",
        },
      ];
    case "archetype_recognition":
      if (target.level === "explanation" || target.level === "pressure") {
        return [
          {
            systemAnchor: systemA,
            prompt: `Why does ${systemA} smell like one archetype before it smells like its strongest alternative? Answer with the pressure first.`,
            summary: "Teacher-generated archetype explanation that demands an explicit alternative.",
            rationale: "Uses the teacher rule of probing one level deeper on tradeoffs and alternatives.",
          },
          {
            systemAnchor: systemA,
            prompt: `If a teammate labels ${systemA} by brand-name intuition instead of pressure, what would you say to earn the archetype label properly?`,
            summary: "Teacher-generated pressure test against brand-driven archetype guessing.",
            rationale: "Checks whether the learner can defend the label instead of just naming it.",
          },
        ];
      }

      return [
        {
          systemAnchor: systemA,
          prompt: `What archetype owns the dominant path in ${systemA}, and what pressure makes that label earned rather than guessed?`,
          summary: "Teacher-generated archetype probe that requires pressure-first justification.",
          rationale: "Checks earned recognition instead of pattern matching by brand.",
        },
      ];
    case "hybrid_path_ownership":
      if (target.level === "transfer" || target.level === "pressure") {
        return [
          {
            systemAnchor: systemA,
            prompt: `Split ${systemA} into path owners. Who owns the write path, who owns the main read path, and what should stay secondary?`,
            summary: "Teacher-generated ownership probe that forces explicit write/read ownership.",
            rationale: "Directly applies the hybrid ownership rule from the teaching skill.",
          },
          {
            systemAnchor: systemA,
            prompt: `Suppose someone insists ${systemA} is 'just one system'. What path split would you use to prove that label is hiding important ownership differences?`,
            summary: "Teacher-generated hybrid pressure test that asks the learner to defend the split.",
            rationale: "Pushes beyond naming hybrid into justifying the ownership split.",
          },
        ];
      }

      return [
        {
          systemAnchor: systemA,
          prompt: `Why is ${systemA} not honestly described by one flat system label? Name the path split that makes it hybrid.`,
          summary: "Teacher-generated hybrid probe that checks whether the learner can hear the path split.",
          rationale: "Tests path ownership rather than technology counting.",
        },
      ];
    case "tradeoff_articulation":
      if (target.level === "pressure") {
        return [
          {
            systemAnchor: systemA,
            prompt: `Defend your chosen side of a tradeoff in ${systemA}, then name the strongest argument for the side you did not choose and what cost or failure it avoids.`,
            summary: "Teacher-generated pressure-test on tradeoff articulation.",
            rationale: "Checks whether the learner can represent the strongest alternative honestly.",
          },
          {
            systemAnchor: systemA,
            prompt: `In ${systemA}, what changes if the interviewer pushes back with the strongest case for the other side of your tradeoff?`,
            summary: "Teacher-generated tradeoff follow-up that adds interviewer pressure.",
            rationale: "Makes the learner defend a choice under objection, not just state a preference.",
          },
        ];
      }

      return [
        {
          systemAnchor: systemA,
          prompt: `Name one real tradeoff in ${systemA}. What do you gain on one side, what do you pay, and why might the other side still be reasonable?`,
          summary: "Teacher-generated tradeoff probe that forces both sides of the choice into the answer.",
          rationale: "Follows the teacher rule that a correct answer still gets pressure-tested.",
        },
      ];
    case "failure_mode_clarity":
      if (target.level === "pressure") {
        return [
          {
            systemAnchor: systemA,
            prompt: `Suppose ${failureConstraint}. What breaks first in ${systemA}, and what mechanism causes that failure?`,
            summary: "Teacher-generated failure pressure-test that adds an interviewer-style edge case.",
            rationale: "Uses the skill's pressure-test pattern to make failure thinking explicit.",
          },
          {
            systemAnchor: systemA,
            prompt: `The interviewer says '${systemA} just has scale issues.' Correct that answer by naming what actually breaks first and why.`,
            summary: "Teacher-generated correction probe for vague failure language.",
            rationale: "Directly attacks the weak pattern the teacher skill warns about.",
          },
        ];
      }

      return [
        {
          systemAnchor: systemA,
          prompt: `In ${systemA}, what is one concrete thing that breaks first under real load or failure, and why does it break before the rest?`,
          summary: "Teacher-generated failure probe that asks for a mechanism, not scale atmosphere.",
          rationale: "Directly applies the teacher rule to end with what breaks first.",
        },
      ];
    default:
      return [
        {
          systemAnchor: systemA,
          prompt: `Answer one interviewer-grade question about ${systemA} that reveals whether you really understand ${SKILLS[target.skillId].label.toLowerCase()}.`,
          summary: "Teacher-generated generic probe.",
          rationale: "Fallback template.",
        },
      ];
  }
}

export function generateAdaptiveProbe({ user, target }) {
  const drafts = candidateDraftsForTarget(user, target);
  const expectations = expectationBundle(target.skillId, target.level);
  const selected = drafts.find((draft) =>
    !isRepeatedProbe(user, {
      ...draft,
      skillId: target.skillId,
      level: target.level,
    }),
  ) ?? drafts[0];

  return {
    id: `adaptive-${crypto.randomUUID()}`,
    source: "teacher-generated",
    format: "text",
    skillId: target.skillId,
    level: target.level,
    skillLabel: target.skillLabel,
    stage: target.stage,
    stageLabel: target.stageLabel,
    summary: selected.summary || target.summary,
    systemAnchor: selected.systemAnchor,
    prompt: selected.prompt,
    rationale: selected.rationale,
    expectedConcepts: expectations.expectedConcepts,
    qualitySignals: expectations.qualitySignals,
    antiPatterns: expectations.antiPatterns,
  };
}

export function codexCliAvailable() {
  return Boolean(process.env.PATH);
}

export async function warmCodexReviewTransport() {
  if (!codexCliAvailable() || CODEX_TRANSPORT === "exec" || !appServerTransportAvailable()) {
    return false;
  }

  await warmCodexAppServer({
    cwd: rootDir,
    effort: CODEX_REASONING_EFFORT,
    model: CODEX_MODEL,
    timeoutMs: Math.max(DEFAULT_TIMEOUT_MS, 20000),
  });
  return true;
}

export async function primeLearnerCodexSession(user) {
  if (!codexCliAvailable()) {
    return null;
  }

  const sessionKey = learnerSessionKey(user);
  if (!sessionKey) {
    return null;
  }

  if (learnerPrimePromises.has(sessionKey)) {
    return learnerPrimePromises.get(sessionKey);
  }

  const primePromise = (async () => {
    if (HOT_SESSIONS_ENABLED && appServerTransportAvailable()) {
      const warmSchema = await reviewSchemaPromise;
      await primeHotSession({
        cwd: rootDir,
        effort: CODEX_REASONING_EFFORT,
        model: CODEX_MODEL,
        sessionKey,
        warmPrompt: HOT_SESSION_WARM_PROMPT,
        warmSchema,
        warmTimeoutMs: HOT_SESSION_WARM_TIMEOUT_MS,
      });
      return { threadId: null, transport: "app-server", ready: true };
    }

    const { threadId } = await runCodexJson({
      prompt: HOT_SESSION_WARM_PROMPT,
      schemaPath: reviewSchemaPath,
      threadId: user.codexThreadId ?? null,
    });

    return {
      threadId,
      transport: "exec",
      ready: Boolean(threadId),
    };
  })().finally(() => {
    learnerPrimePromises.delete(sessionKey);
  });

  learnerPrimePromises.set(sessionKey, primePromise);
  return primePromise;
}

export function clearLearnerCodexSession(user) {
  const sessionKey = learnerSessionKey(user);
  if (!sessionKey) {
    return false;
  }

  learnerPrimePromises.delete(sessionKey);
  clearHotSession(sessionKey);
  return true;
}

export async function generateContextualProbeWithCodex({ user, target, extraConstraint = "" }) {
  if (!codexCliAvailable()) {
    throw new Error("codex CLI is not available in PATH.");
  }

  const assets = await teacherAssetsPromise;
  let dynamicConstraint = extraConstraint;
  let lastError = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const prompt = buildGenerationPrompt({ user, target, assets, extraConstraint: dynamicConstraint });
      const { data, threadId } = await runCodexJson({
        prompt,
        schemaPath: probeSchemaPath,
        threadId: user.codexThreadId ?? null,
      });
      const probe = materializeGeneratedProbe(target, data);

      if (isRepeatedProbe(user, probe)) {
        dynamicConstraint =
          "The previous generated probe repeated recent history. You must choose a different system anchor and a different question stem from the recent probes above.";
        lastError = new Error("Generated probe repeated recent probe history.");
        continue;
      }

      return { probe, threadId };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("Could not generate an adaptive probe.");
}

export async function generateAdaptiveProbeWithCodex({ user, target }) {
  return generateContextualProbeWithCodex({ user, target });
}

export async function reviewTextWithCodex({ user, probe, answer, chapterContext = "" }) {
  if (!codexCliAvailable()) {
    throw new Error("codex CLI is not available in PATH.");
  }

  const assets = await teacherAssetsPromise;
  const prompt = buildReviewPrompt({ user, probe, answer, assets, chapterContext });
  const sessionKey = learnerSessionKey(user);

  if (HOT_SESSIONS_ENABLED && sessionKey && appServerTransportAvailable()) {
    try {
      const schema = await reviewSchemaPromise;
      const { data } = await runWithHotSession({
        effort: CODEX_REASONING_EFFORT,
        model: CODEX_MODEL,
        prompt,
        schema,
        sessionKey,
        timeoutMs: DEFAULT_TIMEOUT_MS,
      });

      return {
        review: {
          ...data,
          mode: "codex",
        },
        threadId: null,
      };
    } catch {
      void primeLearnerCodexSession(user).catch(() => {});
    }
  }

  const { data, threadId } = await runCodexJson({
    prompt,
    schemaPath: reviewSchemaPath,
    threadId: user.codexThreadId ?? null,
  });

  return {
    review: {
      ...data,
      mode: "codex",
    },
    threadId,
  };
}

export async function answerCourseQuestionWithCodex({
  user,
  question,
  history = [],
  scopeSlug = CHAT_SCOPE_COURSE,
  selectedText = "",
}) {
  if (!codexCliAvailable()) {
    throw new Error("codex CLI is not available in PATH.");
  }

  const [teacherAssets, courseAssets] = await Promise.all([teacherAssetsPromise, courseAssetsPromise]);
  const prompt = buildTeachingPrompt({
    user,
    question,
    history,
    scopeSlug,
    teacherAssets,
    courseAssets,
    selectedText,
  });
  const sessionKey = learnerSessionKey(user);

  if (HOT_SESSIONS_ENABLED && sessionKey && appServerTransportAvailable()) {
    try {
      const schema = await chatSchemaPromise;
      const { data } = await runWithHotSession({
        effort: CODEX_REASONING_EFFORT,
        model: CODEX_MODEL,
        prompt,
        schema,
        sessionKey,
        timeoutMs: DEFAULT_TIMEOUT_MS,
      });
      return data;
    } catch {
      void primeLearnerCodexSession(user).catch(() => {});
    }
  }

  const { data } = await runCodexJson({
    prompt,
    schemaPath: chatSchemaPath,
    threadId: user.codexThreadId ?? null,
  });

  return data;
}
