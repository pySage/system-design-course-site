import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { authenticateLearner, ensureUserForAccount, findUser, publicUserState, resetUserProgress, updateUser, recordAttempt } from "./personalization_store.mjs";
import {
  applyProbeEvaluation,
  applyQuizEvidence,
  clearActiveProbe,
  evaluateMcqProbe,
  evaluateTextProbeHeuristic,
  sanitizeProbeForClient,
  selectNextProbeTarget,
  setActiveProbe,
} from "./personalization_engine.mjs";
import {
  answerCourseQuestionWithCodex,
  clearLearnerCodexSession,
  generateAdaptiveProbe,
  generateContextualProbeWithCodex,
  primeLearnerCodexSession,
  reviewTextWithCodex,
  warmCodexReviewTransport,
} from "./personalization_agent.mjs";
import { CHAT_SCOPE_COURSE, chapterCoachStageLabel, getChapterCoach } from "./chapter_coach_catalog.mjs";
import {
  appendCoachChatTurn,
  chapterCoachPublicState,
  coachChatHistory,
  applyChapterCoachEvaluation,
  ensureUserCoachState,
  nextChapterMilestone,
  setChapterCoachActiveProbe,
} from "./chapter_coach_state.mjs";
import { SKILLS } from "./personalization_catalog.mjs";
import { arenaReadiness, productionCaseAnchorsForSkill } from "./practice_arena_catalog.mjs";
import {
  applyArenaTurn,
  arenaPublicState,
  arenaRoundPlan,
  setArenaActiveRound,
  startArenaSession,
} from "./practice_arena_state.mjs";
import {
  applyMockInterviewTurn,
  mockInterviewPlan,
  mockInterviewPublicState,
  setMockInterviewActiveProbe,
  startMockInterview,
} from "./mock_interview_state.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteDir = path.join(rootDir, "site");
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 9999);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

function json(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(`${JSON.stringify(payload)}\n`);
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function notFound(response) {
  json(response, 404, { error: "Not found." });
}

async function evaluateTextProbe(user, probe, answer) {
  try {
    const { review, threadId } = await reviewTextWithCodex({ user, probe, answer });
    return { review, threadId };
  } catch (error) {
    return {
      review: evaluateTextProbeHeuristic(probe, answer),
      threadId: user.codexThreadId ?? null,
      fallbackReason: error.message,
    };
  }
}

async function evaluateChapterTextProbe(user, slug, milestone, probe, answer) {
  const chapterContext = [
    `- chapter: ${slug}`,
    `- chapter coach title: ${getChapterCoach(slug)?.title ?? slug}`,
    `- chapter milestone: ${milestone.label}`,
    `- chapter objective: ${milestone.objective}`,
  ].join("\n");

  try {
    const { review, threadId } = await reviewTextWithCodex({
      user,
      probe,
      answer,
      chapterContext,
    });
    return { review, threadId };
  } catch (error) {
    return {
      review: evaluateTextProbeHeuristic(probe, answer),
      threadId: user.codexThreadId ?? null,
      fallbackReason: error.message,
    };
  }
}

function doubtChatState(user, scopeKey, placeholder) {
  return {
    scopeKey,
    placeholder,
    history: coachChatHistory(ensureUserCoachState(user), scopeKey),
  };
}

function fallbackTeachingReply(scopeSlug, question) {
  const coach = scopeSlug && scopeSlug !== CHAT_SCOPE_COURSE ? getChapterCoach(scopeSlug) : null;
  const hint =
    coach?.title ??
    "the course coach";

  return {
    answer: `The live ${hint.toLowerCase()} is unavailable right now. Stay with the chapter's own language, explain one concrete example in your own words, and ask again once the coach is back.`,
    checkBack: `What is the one concrete distinction in your question that still feels fuzzy?`,
    suggestedLessonSlug: scopeSlug && scopeSlug !== CHAT_SCOPE_COURSE ? scopeSlug : null,
    followups: [
      coach ? `What is the chapter's main distinction here?` : "Which lesson owns this idea most directly?",
      `Can you explain it on one concrete system instead of in abstract words?`,
    ],
    fallbackReason: `Fallback teaching reply used for question: ${String(question ?? "").trim().slice(0, 80)}`,
  };
}

function chapterPromptConstraint(slug, milestone, feedback = null) {
  const coach = getChapterCoach(slug);
  const lines = [
    `This probe belongs to chapter ${slug}: ${coach?.title ?? slug}.`,
    `Stay inside the chapter's taught scope: ${coach?.masteryIntro ?? ""}`,
    `Current milestone: ${milestone.label}.`,
    `Milestone objective: ${milestone.objective}.`,
    `Prompt hint: ${milestone.promptHint}.`,
  ];

  if (feedback?.misses?.length) {
    lines.push(`The learner just missed these ideas: ${feedback.misses.join("; ")}.`);
    lines.push("Aim the next question directly at those gaps while using a different wording and, if possible, a different concrete angle.");
  }

  return lines.join("\n");
}

function fallbackChapterProbe(slug, milestone) {
  return {
    id: `chapter-${crypto.randomUUID()}`,
    source: "chapter-fallback",
    format: "text",
    coachMode: "chapter-mastery",
    chapterSlug: slug,
    milestoneId: milestone.id,
    skillId: milestone.skillId,
    level: milestone.level,
    skillLabel: SKILLS[milestone.skillId].label,
    stage: SKILLS[milestone.skillId].owningStage,
    stageLabel: chapterCoachStageLabel(milestone.skillId),
    summary: milestone.summary,
    systemAnchor: milestone.systemAnchor,
    prompt: milestone.fallbackPrompt,
    rationale: milestone.objective,
    expectedConcepts: milestone.expectedConcepts ?? [],
    qualitySignals: milestone.qualitySignals ?? [],
    antiPatterns: milestone.antiPatterns ?? [],
  };
}

async function generateChapterProbe(user, slug, milestone, feedback = null) {
  const target = {
    skillId: milestone.skillId,
    level: milestone.level,
    levelGuidance: milestone.promptHint,
    skillLabel: SKILLS[milestone.skillId].label,
    stage: SKILLS[milestone.skillId].owningStage,
    stageLabel: chapterCoachStageLabel(milestone.skillId),
    summary: milestone.summary,
  };

  try {
    const { probe, threadId } = await generateContextualProbeWithCodex({
      user,
      target,
      extraConstraint: chapterPromptConstraint(slug, milestone, feedback),
    });
    return {
      probe: {
        ...probe,
        coachMode: "chapter-mastery",
        chapterSlug: slug,
        milestoneId: milestone.id,
      },
      threadId,
      generationFallbackReason: null,
    };
  } catch (error) {
    return {
      probe: fallbackChapterProbe(slug, milestone),
      threadId: user.codexThreadId ?? null,
      generationFallbackReason: error.message,
    };
  }
}

function arenaPromptConstraint(plan, feedback = null) {
  const caseAnchors = productionCaseAnchorsForSkill(plan.target.skillId);
  const lines = [
    "This probe belongs to the final practice arena, which behaves like a mental gym rather than a one-off quiz card.",
    `Arena track: ${plan.track?.label ?? plan.session.trackId}. ${plan.track?.description ?? ""}`,
    `Arena phase: ${plan.phase.label}. ${plan.phase.guidance}`,
    `Round number inside this set: ${plan.session.roundNumber}.`,
    `Focus skill: ${plan.target.skillLabel}.`,
    `Focus reason: ${plan.session.focusReason}`,
    "Keep the answer in spoken interview language and demand real understanding instead of memorized wording.",
    "Ask exactly one question and keep it answerable in roughly 2-6 sentences.",
    "Do not reward or solicit component lists without a why.",
  ];

  if (caseAnchors.length > 0) {
    lines.push("When a production case helps, use one of these cited source anchors. If you use one, include the source link in the question so the learner can open it after answering:");
    caseAnchors.forEach((anchor) => {
      lines.push(`- ${anchor.label}: ${anchor.useFor}. Source: ${anchor.sourceLabel} (${anchor.sourceUrl})`);
    });
    lines.push("Use these as decision simulations, not passive article summaries: give the situation, ask the learner to decide, then let feedback compare reasoning to the source.");
  }

  if ((plan.session.systemAnchors ?? []).length > 0) {
    lines.push(`Recently used system anchors in this set: ${plan.session.systemAnchors.join("; ")}.`);
  }

  if (plan.phase.id === "move") {
    lines.push("Use a different system or path than the previous round so the learner has to transfer the idea instead of replaying it.");
  }

  if (plan.phase.id === "pressure") {
    lines.push("Add one concrete edge case, tradeoff pressure, or failure condition, then ask what changes or what breaks first.");
  }

  if (plan.phase.id === "crossfire") {
    lines.push("Phrase the question like interviewer pushback. Force the learner to defend the choice, represent the strongest alternative, or name the first failure.");
  }

  if (plan.repairLessonSlug) {
    lines.push(`The owning repair lesson for this focus is ${plan.repairLessonSlug}. Stay within what that lesson plus completed lessons should support.`);
  }

  if (feedback?.misses?.length) {
    lines.push(`The learner just missed these ideas: ${feedback.misses.join("; ")}.`);
    lines.push("Aim the next round directly at those misses while changing the wording and, when useful, the system angle.");
  }

  return lines.join("\n");
}

function fallbackArenaProbe(user, plan) {
  const fallback = generateAdaptiveProbe({ user, target: plan.target });
  const caseAnchor = productionCaseAnchorsForSkill(plan.target.skillId, 1)[0] ?? null;
  const phasePrefix = {
    settle: "Start with one clean explanation before tools. ",
    move: "Move the same idea into a different system or path. ",
    pressure: "Add one concrete constraint or failure condition. ",
    crossfire: "Treat this as interviewer pushback and defend the choice. ",
  }[plan.phase.id] ?? "";

  return {
    ...fallback,
    source: "arena-fallback",
    summary: `${plan.phase.label}. ${fallback.summary}`,
    prompt: caseAnchor
      ? `${phasePrefix}${fallback.prompt}\n\nIf you want the production source after answering: ${caseAnchor.sourceLabel} (${caseAnchor.sourceUrl})`
      : `${phasePrefix}${fallback.prompt}`,
    coachMode: "practice-arena",
    arenaSessionId: plan.session.id,
    arenaPhaseId: plan.phase.id,
    arenaTrackId: plan.track?.id ?? plan.session.trackId,
  };
}

async function generateArenaRound(user, feedback = null) {
  const plan = arenaRoundPlan(user);
  if (!plan) {
    throw new Error("The practice arena is not ready for this learner yet.");
  }

  try {
    const { probe, threadId } = await generateContextualProbeWithCodex({
      user,
      target: plan.target,
      extraConstraint: arenaPromptConstraint(plan, feedback),
    });

    return {
      probe: {
        ...probe,
        coachMode: "practice-arena",
        arenaSessionId: plan.session.id,
        arenaPhaseId: plan.phase.id,
        arenaTrackId: plan.track?.id ?? plan.session.trackId,
      },
      threadId,
      generationFallbackReason: null,
    };
  } catch (error) {
    return {
      probe: fallbackArenaProbe(user, plan),
      threadId: user.codexThreadId ?? null,
      generationFallbackReason: error.message,
    };
  }
}

async function evaluateArenaTextProbe(user, probe, answer) {
  const plan = arenaRoundPlan(user);
  const arenaContext = [
    `- arena track: ${plan?.track?.label ?? user.arena?.activeSession?.trackId ?? "arena"}`,
    `- arena phase: ${plan?.phase?.label ?? user.arena?.activeSession?.arenaPhaseId ?? "set"}`,
    `- arena focus reason: ${plan?.session?.focusReason ?? "adaptive arena set"}`,
    `- arena repair lesson: ${plan?.repairLessonSlug ?? "none"}`,
  ].join("\n");

  try {
    const { review, threadId } = await reviewTextWithCodex({
      user,
      probe,
      answer,
      chapterContext: arenaContext,
    });
    return { review, threadId };
  } catch (error) {
    return {
      review: evaluateTextProbeHeuristic(probe, answer),
      threadId: user.codexThreadId ?? null,
      fallbackReason: error.message,
    };
  }
}

function mockInterviewTranscriptSummary(session) {
  const turns = (session.transcript ?? [])
    .slice(-8)
    .map((turn) => {
      const label =
        turn.role === "user"
          ? "candidate"
          : turn.type === "feedback"
            ? "coach feedback"
            : "interviewer";
      return `- ${label}: ${String(turn.content ?? "").replace(/\s+/g, " ").trim().slice(0, 260)}`;
    })
    .join("\n");

  return turns || "- no turns yet";
}

function mockInterviewPromptConstraint(plan, feedback = null) {
  const lines = [
    "This probe belongs to a proper AI-native system design mock interview, not a static drill card.",
    `Mock problem: ${plan.session.problemPrompt}`,
    `Current phase: ${plan.phase.label}. ${plan.phase.summary}`,
    `Turn number: ${plan.session.turnNumber}.`,
    `Primary adaptation reason: ${plan.session.focusReason}`,
    "Play the interviewer. Ask exactly one natural follow-up question.",
    "Do not give the answer. Do not summarize the course. Do not ask for a generic component list.",
    "Adapt to the transcript: if the candidate already clarified well, push architecture or tradeoff; if they skipped the opening, pull them back.",
    "The candidate should answer in spoken interview style, roughly 3-8 sentences.",
    "Use realistic interviewer pressure: clarification, interruption, constraint change, failure, or tradeoff defense.",
    `Recent transcript:\n${mockInterviewTranscriptSummary(plan.session)}`,
  ];

  if (feedback?.misses?.length) {
    lines.push(`The last answer missed: ${feedback.misses.join("; ")}.`);
    lines.push("Aim the next interviewer question at the earliest missed layer instead of blindly making the mock harder.");
  }

  return lines.join("\n");
}

function fallbackMockInterviewProbe(user, plan) {
  const fallback = generateAdaptiveProbe({ user, target: plan.target });
  return {
    ...fallback,
    source: "mock-fallback",
    coachMode: "mock-interview",
    mockSessionId: plan.session.id,
    mockPhaseId: plan.phase.id,
    summary: `${plan.phase.label}. ${fallback.summary}`,
    prompt: `${plan.phase.label}: ${fallback.prompt}`,
  };
}

async function generateMockInterviewProbe(user, feedback = null) {
  const plan = mockInterviewPlan(user);
  if (!plan) {
    throw new Error("No active mock interview is ready for another turn.");
  }

  try {
    const { probe, threadId } = await generateContextualProbeWithCodex({
      user,
      target: plan.target,
      extraConstraint: mockInterviewPromptConstraint(plan, feedback),
    });

    return {
      probe: {
        ...probe,
        coachMode: "mock-interview",
        mockSessionId: plan.session.id,
        mockPhaseId: plan.phase.id,
      },
      threadId,
      generationFallbackReason: null,
    };
  } catch (error) {
    return {
      probe: fallbackMockInterviewProbe(user, plan),
      threadId: user.codexThreadId ?? null,
      generationFallbackReason: error.message,
    };
  }
}

async function evaluateMockInterviewTextProbe(user, probe, answer) {
  const plan = mockInterviewPlan(user);
  const mockContext = [
    `- mock problem: ${plan?.session?.problemPrompt ?? "active mock"}`,
    `- mock phase: ${plan?.phase?.label ?? "unknown"}`,
    `- adaptation reason: ${plan?.session?.focusReason ?? "adaptive mock interview"}`,
    `- transcript:`,
    mockInterviewTranscriptSummary(plan?.session ?? {}),
  ].join("\n");

  try {
    const { review, threadId } = await reviewTextWithCodex({
      user,
      probe,
      answer,
      chapterContext: mockContext,
    });
    return { review, threadId };
  } catch (error) {
    return {
      review: evaluateTextProbeHeuristic(probe, answer),
      threadId: user.codexThreadId ?? null,
      fallbackReason: error.message,
    };
  }
}

async function chapterCoachPayload(user, slug) {
  const coach = getChapterCoach(slug);
  if (!coach) {
    return null;
  }

  const normalized = ensureUserCoachState(user);
  return {
    doubtChat: doubtChatState(normalized, slug, coach.doubtPlaceholder),
    mastery: chapterCoachPublicState(normalized, slug),
  };
}

function primeLearnerSessionInBackground(user, retriesRemaining = 1) {
  if (user?.isOnboarding) {
    return;
  }

  void primeLearnerCodexSession(user)
    .then(async (result) => {
      if (result?.ready) {
        if (result.threadId) {
          await updateUser(user.id, (current) => ({ codexThreadId: result.threadId ?? current.codexThreadId }));
        }
        return;
      }

      if (result?.threadId) {
        await updateUser(user.id, (current) => ({ codexThreadId: result.threadId ?? current.codexThreadId }));
        return;
      }

      if (retriesRemaining > 0) {
        setTimeout(() => {
          primeLearnerSessionInBackground(user, retriesRemaining - 1);
        }, 5000);
      }
    })
    .catch(() => {
      if (retriesRemaining > 0) {
        setTimeout(() => {
          primeLearnerSessionInBackground(user, retriesRemaining - 1);
        }, 5000);
      }
    });
}

async function ensureNextProbeForUser(user) {
  if (user.activeProbe) {
    return {
      user,
      nextProbe: sanitizeProbeForClient(user.activeProbe),
      generationFallbackReason: null,
    };
  }

  const target = selectNextProbeTarget(user);
  if (!target) {
    return {
      user,
      nextProbe: null,
      generationFallbackReason: null,
    };
  }

  const probe = generateAdaptiveProbe({ user, target });
  const updatedUser = await updateUser(user.id, (current) => setActiveProbe(current, probe));

  return {
    user: updatedUser,
    nextProbe: sanitizeProbeForClient(updatedUser.activeProbe),
    generationFallbackReason: null,
  };
}

async function handleApi(request, response, pathname) {
  if (pathname === "/api/health" && request.method === "GET") {
    json(response, 200, { ok: true });
    return true;
  }

  if (pathname === "/api/login" && request.method === "POST") {
    try {
      const body = await readBody(request);
      const account = authenticateLearner(body.username, body.password);

      if (!account) {
        json(response, 401, { error: "Unknown username/password pair." });
        return true;
      }

      const baseUser = await ensureUserForAccount(account);
      const { user, nextProbe } = await ensureNextProbeForUser(baseUser);
      primeLearnerSessionInBackground(user);
      json(response, 200, {
        user: publicUserState(user),
        nextProbe,
      });
    } catch (error) {
      json(response, 400, { error: error.message });
    }
    return true;
  }

  const resetMatch = pathname.match(/^\/api\/users\/([^/]+)\/reset-progress$/);
  if (resetMatch && request.method === "POST") {
    const user = await findUser(resetMatch[1]);
    if (!user) {
      notFound(response);
      return true;
    }

    try {
      const body = await readBody(request);
      const resetUser = await resetUserProgress(user.id, body.password);
      clearLearnerCodexSession(user);
      const { user: updatedUser, nextProbe } = await ensureNextProbeForUser(resetUser);
      primeLearnerSessionInBackground(updatedUser);
      json(response, 200, {
        user: publicUserState(updatedUser),
        nextProbe,
      });
    } catch (error) {
      json(response, 400, { error: error.message });
    }

    return true;
  }

  const stateMatch = pathname.match(/^\/api\/users\/([^/]+)\/state$/);
  if (stateMatch && request.method === "GET") {
    const user = await findUser(stateMatch[1]);
    if (!user) {
      notFound(response);
      return true;
    }

    const planned = await ensureNextProbeForUser(user);
    primeLearnerSessionInBackground(planned.user);
    json(response, 200, {
      user: publicUserState(planned.user),
      nextProbe: planned.nextProbe,
    });
    return true;
  }

  const courseChatStateMatch = pathname.match(/^\/api\/users\/([^/]+)\/course-chat\/state$/);
  if (courseChatStateMatch && request.method === "GET") {
    const user = await findUser(courseChatStateMatch[1]);
    if (!user) {
      notFound(response);
      return true;
    }

    json(response, 200, {
      chat: doubtChatState(user, CHAT_SCOPE_COURSE, "Ask about any lesson, comparison, or course term."),
    });
    return true;
  }

  const courseChatAskMatch = pathname.match(/^\/api\/users\/([^/]+)\/course-chat\/ask$/);
  if (courseChatAskMatch && request.method === "POST") {
    const user = await findUser(courseChatAskMatch[1]);
    if (!user) {
      notFound(response);
      return true;
    }

    try {
      const body = await readBody(request);
      const question = String(body.question ?? "").trim();
      const selectedText = String(body.selectedText ?? "").replace(/\s+/g, " ").trim();
      if (!question) {
        json(response, 400, { error: "Write a question first." });
        return true;
      }

      const history = [
        ...coachChatHistory(user, CHAT_SCOPE_COURSE),
        {
          role: "user",
          content: question,
          selectedText,
        },
      ];
      const reply = await answerCourseQuestionWithCodex({
        user,
        question,
        history,
        scopeSlug: CHAT_SCOPE_COURSE,
        selectedText,
      }).catch(() => fallbackTeachingReply(CHAT_SCOPE_COURSE, question));

      const updatedUser = await updateUser(user.id, (current) => {
        let next = appendCoachChatTurn(current, CHAT_SCOPE_COURSE, "user", question, {
          selectedText,
        });
        next = appendCoachChatTurn(next, CHAT_SCOPE_COURSE, "assistant", reply.answer, {
          checkBack: reply.checkBack,
          suggestedLessonSlug: reply.suggestedLessonSlug ?? null,
          followups: reply.followups ?? [],
        });
        return next;
      });

      json(response, 200, {
        chat: doubtChatState(
          updatedUser,
          CHAT_SCOPE_COURSE,
          "Ask about any lesson, comparison, or course term.",
        ),
      });
    } catch (error) {
      json(response, 400, { error: error.message });
    }

    return true;
  }

  const chapterCoachStateMatch = pathname.match(/^\/api\/users\/([^/]+)\/chapters\/([^/]+)\/coach-state$/);
  if (chapterCoachStateMatch && request.method === "GET") {
    const user = await findUser(chapterCoachStateMatch[1]);
    if (!user) {
      notFound(response);
      return true;
    }

    const coachPayload = await chapterCoachPayload(user, chapterCoachStateMatch[2]);
    if (!coachPayload) {
      notFound(response);
      return true;
    }

    json(response, 200, coachPayload);
    return true;
  }

  const chapterDoubtMatch = pathname.match(/^\/api\/users\/([^/]+)\/chapters\/([^/]+)\/doubt-turn$/);
  if (chapterDoubtMatch && request.method === "POST") {
    const user = await findUser(chapterDoubtMatch[1]);
    const slug = chapterDoubtMatch[2];
    const coach = getChapterCoach(slug);
    if (!user || !coach) {
      notFound(response);
      return true;
    }

    try {
      const body = await readBody(request);
      const question = String(body.question ?? "").trim();
      const selectedText = String(body.selectedText ?? "").replace(/\s+/g, " ").trim();
      if (!question) {
        json(response, 400, { error: "Write a question first." });
        return true;
      }

      const history = [
        ...coachChatHistory(user, slug),
        {
          role: "user",
          content: question,
          selectedText,
        },
      ];
      const reply = await answerCourseQuestionWithCodex({
        user,
        question,
        history,
        scopeSlug: slug,
        selectedText,
      }).catch(() => fallbackTeachingReply(slug, question));

      const updatedUser = await updateUser(user.id, (current) => {
        let next = appendCoachChatTurn(current, slug, "user", question, {
          selectedText,
        });
        next = appendCoachChatTurn(next, slug, "assistant", reply.answer, {
          checkBack: reply.checkBack,
          suggestedLessonSlug: reply.suggestedLessonSlug ?? null,
          followups: reply.followups ?? [],
        });
        return next;
      });

      json(response, 200, {
        doubtChat: doubtChatState(updatedUser, slug, coach.doubtPlaceholder),
      });
    } catch (error) {
      json(response, 400, { error: error.message });
    }

    return true;
  }

  const chapterMasteryStartMatch = pathname.match(/^\/api\/users\/([^/]+)\/chapters\/([^/]+)\/mastery-start$/);
  if (chapterMasteryStartMatch && request.method === "POST") {
    const user = await findUser(chapterMasteryStartMatch[1]);
    const slug = chapterMasteryStartMatch[2];
    const coach = getChapterCoach(slug);
    if (!user || !coach) {
      notFound(response);
      return true;
    }

    const currentState = chapterCoachPublicState(ensureUserCoachState(user), slug);
    if (!currentState.unlocked) {
      json(response, 400, { error: coach.masteryUnlockCopy });
      return true;
    }

    if (currentState.activeProbe || currentState.status === "mastered") {
      json(response, 200, { mastery: currentState });
      return true;
    }

    const milestone = nextChapterMilestone(ensureUserCoachState(user), slug);
    if (!milestone) {
      json(response, 200, { mastery: currentState });
      return true;
    }

    const generated = await generateChapterProbe(user, slug, milestone);
    const updatedUser = await updateUser(user.id, (current) => {
      const next = setChapterCoachActiveProbe(
        {
          ...current,
          codexThreadId: generated.threadId ?? current.codexThreadId,
        },
        slug,
        milestone,
        generated.probe,
      );

      return {
        ...next,
        codexThreadId: generated.threadId ?? next.codexThreadId,
      };
    });

    primeLearnerSessionInBackground(updatedUser);
    json(response, 200, {
      mastery: chapterCoachPublicState(updatedUser, slug),
      generationFallbackReason: generated.generationFallbackReason,
    });
    return true;
  }

  const chapterMasteryTurnMatch = pathname.match(/^\/api\/users\/([^/]+)\/chapters\/([^/]+)\/mastery-turn$/);
  if (chapterMasteryTurnMatch && request.method === "POST") {
    const user = await findUser(chapterMasteryTurnMatch[1]);
    const slug = chapterMasteryTurnMatch[2];
    const coach = getChapterCoach(slug);
    if (!user || !coach) {
      notFound(response);
      return true;
    }

    try {
      const body = await readBody(request);
      const normalized = ensureUserCoachState(user);
      const activeProbe = normalized.chapterCoach?.[slug]?.activeProbe;
      if (!activeProbe || activeProbe.id !== body.probeId) {
        json(response, 400, { error: "This chapter question is no longer current. Refresh and try again." });
        return true;
      }

      const milestone = coach.milestones.find((item) => item.id === activeProbe.milestoneId) ?? nextChapterMilestone(normalized, slug);
      if (!milestone) {
        json(response, 400, { error: "No chapter milestone is active right now." });
        return true;
      }

      const answer = String(body.answer ?? "").trim();
      if (!answer) {
        json(response, 400, { error: "Write an answer first." });
        return true;
      }

      const textResult = await evaluateChapterTextProbe(user, slug, milestone, activeProbe, answer);
      const evaluation = textResult.review;

      const afterFeedback = await updateUser(user.id, (current) => {
        const next = applyChapterCoachEvaluation(
          {
            ...current,
            codexThreadId: textResult.threadId ?? current.codexThreadId,
          },
          slug,
          milestone,
          activeProbe,
          answer,
          evaluation,
        );

        return {
          ...next,
          codexThreadId: textResult.threadId ?? next.codexThreadId,
        };
      });

      await recordAttempt(user.id, {
        type: "chapter-mastery",
        slug,
        probeId: activeProbe.id,
        milestoneId: milestone.id,
        skillId: activeProbe.skillId,
        level: activeProbe.level,
        prompt: activeProbe.prompt,
        answer,
        score: evaluation.score,
        evaluationMode: evaluation.mode,
        systemAnchor: activeProbe.systemAnchor ?? null,
        source: activeProbe.source ?? "chapter-mastery",
      });

      let finalUser = afterFeedback;
      let generationFallbackReason = null;
      const finalState = chapterCoachPublicState(afterFeedback, slug);

      if (finalState.status !== "mastered" && !finalState.activeProbe) {
        const nextMilestone = nextChapterMilestone(afterFeedback, slug);
        if (nextMilestone) {
          const generated = await generateChapterProbe(afterFeedback, slug, nextMilestone, evaluation);
          finalUser = await updateUser(user.id, (current) => {
            const next = setChapterCoachActiveProbe(
              {
                ...current,
                codexThreadId: generated.threadId ?? current.codexThreadId,
              },
              slug,
              nextMilestone,
              generated.probe,
            );

            return {
              ...next,
              codexThreadId: generated.threadId ?? next.codexThreadId,
            };
          });
          generationFallbackReason = generated.generationFallbackReason;
        }
      }

      primeLearnerSessionInBackground(finalUser);
      json(response, 200, {
        evaluation,
        fallbackReason: textResult.fallbackReason ?? null,
        generationFallbackReason,
        mastery: chapterCoachPublicState(finalUser, slug),
      });
    } catch (error) {
      json(response, 400, { error: error.message });
    }

    return true;
  }

  const arenaStateMatch = pathname.match(/^\/api\/users\/([^/]+)\/arena\/state$/);
  if (arenaStateMatch && request.method === "GET") {
    const user = await findUser(arenaStateMatch[1]);
    if (!user) {
      notFound(response);
      return true;
    }

    json(response, 200, { arena: arenaPublicState(user) });
    return true;
  }

  const arenaStartMatch = pathname.match(/^\/api\/users\/([^/]+)\/arena\/start$/);
  if (arenaStartMatch && request.method === "POST") {
    const user = await findUser(arenaStartMatch[1]);
    if (!user) {
      notFound(response);
      return true;
    }

    const readiness = arenaReadiness(user);
    if (!readiness.ready) {
      json(response, 400, { error: readiness.entryCopy });
      return true;
    }

    const existingArena = arenaPublicState(user);
    if (existingArena.activeSession?.status === "active" && existingArena.activeSession?.activeRound) {
      json(response, 200, { arena: existingArena });
      return true;
    }

    const plannedUser = startArenaSession(user);
    const generated = await generateArenaRound(plannedUser);
    const updatedUser = await updateUser(user.id, (current) => {
      const seeded = startArenaSession({
        ...current,
        codexThreadId: generated.threadId ?? current.codexThreadId,
      });
      const next = setArenaActiveRound(seeded, generated.probe);

      return {
        ...next,
        codexThreadId: generated.threadId ?? next.codexThreadId,
      };
    });

    primeLearnerSessionInBackground(updatedUser);
    json(response, 200, {
      arena: arenaPublicState(updatedUser),
      generationFallbackReason: generated.generationFallbackReason,
    });
    return true;
  }

  const arenaTurnMatch = pathname.match(/^\/api\/users\/([^/]+)\/arena\/turn$/);
  if (arenaTurnMatch && request.method === "POST") {
    const user = await findUser(arenaTurnMatch[1]);
    if (!user) {
      notFound(response);
      return true;
    }

    try {
      const body = await readBody(request);
      const activeProbe = user.arena?.activeSession?.activeRound;
      if (!activeProbe || activeProbe.id !== body.probeId) {
        json(response, 400, { error: "This arena round is no longer current. Refresh and try again." });
        return true;
      }

      const answer = String(body.answer ?? "").trim();
      if (!answer) {
        json(response, 400, { error: "Write an answer first." });
        return true;
      }

      const textResult = await evaluateArenaTextProbe(user, activeProbe, answer);
      const evaluation = textResult.review;

      const afterFeedback = await updateUser(user.id, (current) => {
        const next = applyArenaTurn(
          {
            ...current,
            codexThreadId: textResult.threadId ?? current.codexThreadId,
          },
          answer,
          evaluation,
        );

        return {
          ...next,
          codexThreadId: textResult.threadId ?? next.codexThreadId,
        };
      });

      const currentPlan = arenaRoundPlan(user);
      await recordAttempt(user.id, {
        type: "arena-round",
        trackId: currentPlan?.track?.id ?? user.arena?.activeSession?.trackId ?? null,
        phaseId: currentPlan?.phase?.id ?? user.arena?.activeSession?.arenaPhaseId ?? null,
        probeId: activeProbe.id,
        skillId: activeProbe.skillId,
        level: activeProbe.level,
        prompt: activeProbe.prompt,
        answer,
        score: evaluation.score,
        evaluationMode: evaluation.mode,
        systemAnchor: activeProbe.systemAnchor ?? null,
        source: activeProbe.source ?? "practice-arena",
      });

      let finalUser = afterFeedback;
      let generationFallbackReason = null;
      const currentArena = arenaPublicState(afterFeedback);

      if (currentArena.activeSession?.status === "active" && !currentArena.activeSession?.activeRound) {
        const generated = await generateArenaRound(afterFeedback, evaluation);
        finalUser = await updateUser(user.id, (current) => {
          const next = setArenaActiveRound(
            {
              ...current,
              codexThreadId: generated.threadId ?? current.codexThreadId,
            },
            generated.probe,
          );

          return {
            ...next,
            codexThreadId: generated.threadId ?? next.codexThreadId,
          };
        });
        generationFallbackReason = generated.generationFallbackReason;
      }

      primeLearnerSessionInBackground(finalUser);
      json(response, 200, {
        evaluation,
        fallbackReason: textResult.fallbackReason ?? null,
        generationFallbackReason,
        arena: arenaPublicState(finalUser),
      });
    } catch (error) {
      json(response, 400, { error: error.message });
    }

    return true;
  }

  const mockStateMatch = pathname.match(/^\/api\/users\/([^/]+)\/mock-interview\/state$/);
  if (mockStateMatch && request.method === "GET") {
    const user = await findUser(mockStateMatch[1]);
    if (!user) {
      notFound(response);
      return true;
    }

    json(response, 200, { mockInterview: mockInterviewPublicState(user) });
    return true;
  }

  const mockStartMatch = pathname.match(/^\/api\/users\/([^/]+)\/mock-interview\/start$/);
  if (mockStartMatch && request.method === "POST") {
    const user = await findUser(mockStartMatch[1]);
    if (!user) {
      notFound(response);
      return true;
    }

    const currentState = mockInterviewPublicState(user);
    if (!currentState.readiness.ready) {
      json(response, 400, { error: currentState.readiness.lockedCopy });
      return true;
    }

    if (currentState.activeSession?.status === "active" && currentState.activeSession?.activeProbe) {
      json(response, 200, { mockInterview: currentState });
      return true;
    }

    const plannedUser = startMockInterview(user);
    const generated = await generateMockInterviewProbe(plannedUser);
    const updatedUser = await updateUser(user.id, (current) => {
      const seeded = startMockInterview({
        ...current,
        codexThreadId: generated.threadId ?? current.codexThreadId,
      });
      const next = setMockInterviewActiveProbe(seeded, generated.probe);

      return {
        ...next,
        codexThreadId: generated.threadId ?? next.codexThreadId,
      };
    });

    primeLearnerSessionInBackground(updatedUser);
    json(response, 200, {
      mockInterview: mockInterviewPublicState(updatedUser),
      generationFallbackReason: generated.generationFallbackReason,
    });
    return true;
  }

  const mockTurnMatch = pathname.match(/^\/api\/users\/([^/]+)\/mock-interview\/turn$/);
  if (mockTurnMatch && request.method === "POST") {
    const user = await findUser(mockTurnMatch[1]);
    if (!user) {
      notFound(response);
      return true;
    }

    try {
      const body = await readBody(request);
      const activeProbe = user.mockInterviews?.activeSession?.activeProbe;
      if (!activeProbe || activeProbe.id !== body.probeId) {
        json(response, 400, { error: "This mock interview turn is no longer current. Refresh and try again." });
        return true;
      }

      const answer = String(body.answer ?? "").trim();
      if (!answer) {
        json(response, 400, { error: "Write an answer first." });
        return true;
      }

      const textResult = await evaluateMockInterviewTextProbe(user, activeProbe, answer);
      const evaluation = textResult.review;
      const currentPlan = mockInterviewPlan(user);

      const afterFeedback = await updateUser(user.id, (current) => {
        const next = applyMockInterviewTurn(
          {
            ...current,
            codexThreadId: textResult.threadId ?? current.codexThreadId,
          },
          answer,
          evaluation,
        );

        return {
          ...next,
          codexThreadId: textResult.threadId ?? next.codexThreadId,
        };
      });

      await recordAttempt(user.id, {
        type: "mock-interview-turn",
        mockSessionId: user.mockInterviews?.activeSession?.id ?? null,
        phaseId: currentPlan?.phase?.id ?? null,
        probeId: activeProbe.id,
        skillId: activeProbe.skillId,
        level: activeProbe.level,
        prompt: activeProbe.prompt,
        answer,
        score: evaluation.score,
        evaluationMode: evaluation.mode,
        systemAnchor: activeProbe.systemAnchor ?? currentPlan?.session?.problemLabel ?? null,
        source: activeProbe.source ?? "mock-interview",
      });

      let finalUser = afterFeedback;
      let generationFallbackReason = null;
      const currentMock = mockInterviewPublicState(afterFeedback);

      if (currentMock.activeSession?.status === "active" && !currentMock.activeSession?.activeProbe) {
        const generated = await generateMockInterviewProbe(afterFeedback, evaluation);
        finalUser = await updateUser(user.id, (current) => {
          const next = setMockInterviewActiveProbe(
            {
              ...current,
              codexThreadId: generated.threadId ?? current.codexThreadId,
            },
            generated.probe,
          );

          return {
            ...next,
            codexThreadId: generated.threadId ?? next.codexThreadId,
          };
        });
        generationFallbackReason = generated.generationFallbackReason;
      }

      primeLearnerSessionInBackground(finalUser);
      json(response, 200, {
        evaluation,
        fallbackReason: textResult.fallbackReason ?? null,
        generationFallbackReason,
        mockInterview: mockInterviewPublicState(finalUser),
      });
    } catch (error) {
      json(response, 400, { error: error.message });
    }

    return true;
  }

  const probeMatch = pathname.match(/^\/api\/users\/([^/]+)\/next-probe$/);
  if (probeMatch && request.method === "GET") {
    const user = await findUser(probeMatch[1]);
    if (!user) {
      notFound(response);
      return true;
    }

    const planned = await ensureNextProbeForUser(user);
    primeLearnerSessionInBackground(planned.user);
    json(response, 200, { nextProbe: planned.nextProbe });
    return true;
  }

  const probeAttemptMatch = pathname.match(/^\/api\/users\/([^/]+)\/probe-attempt$/);
  if (probeAttemptMatch && request.method === "POST") {
    const user = await findUser(probeAttemptMatch[1]);
    if (!user) {
      notFound(response);
      return true;
    }

    try {
      const body = await readBody(request);
      const probe = user.activeProbe;
      if (!probe || probe.id !== body.probeId) {
        json(response, 400, { error: "This probe is no longer current. Refresh and try again." });
        return true;
      }

      const answer = probe.format === "mcq" ? Number(body.answerIndex) : String(body.answer ?? "");
      const textResult = probe.format === "text" ? await evaluateTextProbe(user, probe, answer) : null;
      const evaluation = probe.format === "mcq" ? evaluateMcqProbe(probe, answer) : textResult.review;

      const storedUser = await updateUser(user.id, (current) => {
        const next = applyProbeEvaluation(
          {
            ...current,
            codexThreadId: probe.format === "text" ? textResult.threadId : current.codexThreadId,
          },
          probe,
          evaluation,
        );

        return next;
      });

      await recordAttempt(user.id, {
        type: "probe",
        probeId: probe.id,
        skillId: probe.skillId,
        level: probe.level,
        prompt: probe.prompt,
        answer,
        score: evaluation.score,
        evaluationMode: evaluation.mode,
        systemAnchor: probe.systemAnchor ?? null,
        source: probe.source ?? "catalog",
      });

      const { user: updatedUser, nextProbe, generationFallbackReason } = await ensureNextProbeForUser(storedUser);

      json(response, 200, {
        evaluation,
        fallbackReason: textResult?.fallbackReason ?? null,
        user: publicUserState(updatedUser),
        nextProbe,
        generationFallbackReason,
      });
    } catch (error) {
      json(response, 400, { error: error.message });
    }

    return true;
  }

  const quizAttemptMatch = pathname.match(/^\/api\/users\/([^/]+)\/quiz-attempt$/);
  if (quizAttemptMatch && request.method === "POST") {
    const user = await findUser(quizAttemptMatch[1]);
    if (!user) {
      notFound(response);
      return true;
    }

    try {
      const body = await readBody(request);
      const storedUser = await updateUser(user.id, (current) =>
        clearActiveProbe(applyQuizEvidence(current, body.slug, Number(body.correct), Number(body.total))),
      );

      await recordAttempt(user.id, {
        type: "quiz",
        slug: body.slug,
        correct: Number(body.correct),
        total: Number(body.total),
      });

      const { user: updatedUser, nextProbe, generationFallbackReason } = await ensureNextProbeForUser(storedUser);

      json(response, 200, {
        user: publicUserState(updatedUser),
        nextProbe,
        generationFallbackReason,
      });
    } catch (error) {
      json(response, 400, { error: error.message });
    }

    return true;
  }

  return false;
}

async function serveStatic(response, pathname) {
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const resolved = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(siteDir, resolved);

  try {
    const file = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[ext] ?? "application/octet-stream",
    });
    response.end(file);
  } catch (error) {
    if (error.code === "ENOENT") {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found.\n");
      return;
    }

    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Internal server error.\n");
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

    if (url.pathname.startsWith("/api/")) {
      const handled = await handleApi(request, response, url.pathname);
      if (!handled) {
        notFound(response);
      }
      return;
    }

    await serveStatic(response, url.pathname);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    response.end(`${JSON.stringify({ error: error.message })}\n`);
  }
});

server.listen(port, host, () => {
  console.log(`Course app server listening on http://${host}:${port}`);
  warmCodexReviewTransport().catch((error) => {
    console.warn(`Codex review transport warmup failed: ${error.message}`);
  });
});
