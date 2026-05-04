import crypto from "node:crypto";
import { LESSON_ORDER } from "./personalization_catalog.mjs";
import { appendProbeHistory, applyProbeEvaluationToHistory, sanitizeProbeForClient } from "./personalization_engine.mjs";
import { getChapterCoach, milestoneStatus } from "./chapter_coach_catalog.mjs";

const MAX_CHAT_TURNS = 18;
const MAX_TRANSCRIPT_TURNS = 24;

function nowIso() {
  return new Date().toISOString();
}

function clone(value) {
  return structuredClone(value);
}

function defaultChatStore() {
  return { course: [] };
}

function defaultChapterCoachEntry() {
  return {
    status: "locked",
    activeProbe: null,
    milestones: {},
    transcript: [],
    unlockedAt: null,
    completedAt: null,
    lastUpdatedAt: null,
  };
}

function ensureChatStore(user) {
  if (!user.coachChats || typeof user.coachChats !== "object") {
    user.coachChats = defaultChatStore();
  }
  return user.coachChats;
}

function ensureChapterCoachStore(user) {
  if (!user.chapterCoach || typeof user.chapterCoach !== "object") {
    user.chapterCoach = {};
  }
  return user.chapterCoach;
}

function ensureChapterCoachEntry(user, slug) {
  const store = ensureChapterCoachStore(user);
  if (!store[slug]) {
    store[slug] = defaultChapterCoachEntry();
  }
  return store[slug];
}

function quizCompleted(user, slug) {
  return Boolean(user.chapterProgress?.[slug]?.completedAt);
}

function clipMessages(messages, limit = MAX_CHAT_TURNS) {
  return messages.slice(-limit);
}

function pushTranscript(entry, item) {
  entry.transcript = clipMessages([...(entry.transcript ?? []), item], MAX_TRANSCRIPT_TURNS);
}

function milestoneProgress(entry, milestoneId) {
  entry.milestones ??= {};
  entry.milestones[milestoneId] ??= {
    attempts: 0,
    bestScore: 0,
    lastScore: null,
    lastTriedAt: null,
    passedAt: null,
  };
  return entry.milestones[milestoneId];
}

function chapterMastered(entry, coach) {
  return coach.milestones.every((milestone) => milestoneStatus(entry, milestone) === "passed");
}

export function ensureUserCoachState(user) {
  const updated = clone(user);
  ensureChatStore(updated);
  const chapterStore = ensureChapterCoachStore(updated);

  for (const slug of LESSON_ORDER) {
    const coach = getChapterCoach(slug);
    if (!coach) {
      continue;
    }

    const entry = chapterStore[slug] ?? defaultChapterCoachEntry();
    if (quizCompleted(updated, slug) && !entry.unlockedAt) {
      entry.unlockedAt = updated.chapterProgress?.[slug]?.completedAt ?? nowIso();
    }
    if (!quizCompleted(updated, slug) && !entry.completedAt) {
      entry.status = "locked";
      entry.activeProbe = null;
    }
    chapterStore[slug] = entry;
  }

  return updated;
}

export function appendCoachChatTurn(user, scopeKey, role, content, metadata = {}) {
  const updated = ensureUserCoachState(user);
  const chats = ensureChatStore(updated);
  const history = Array.isArray(chats[scopeKey]) ? chats[scopeKey] : [];
  history.push({
    id: crypto.randomUUID(),
    role,
    content: String(content ?? "").trim(),
    createdAt: nowIso(),
    ...metadata,
  });
  chats[scopeKey] = clipMessages(history);
  return updated;
}

export function coachChatHistory(user, scopeKey) {
  return clipMessages(Array.isArray(user.coachChats?.[scopeKey]) ? user.coachChats[scopeKey] : []);
}

export function nextChapterMilestone(user, slug) {
  const coach = getChapterCoach(slug);
  if (!coach) {
    return null;
  }

  const entry = user.chapterCoach?.[slug] ?? defaultChapterCoachEntry();
  return coach.milestones.find((milestone) => milestoneStatus(entry, milestone) !== "passed") ?? null;
}

export function setChapterCoachActiveProbe(user, slug, milestone, probe) {
  const updated = appendProbeHistory(ensureUserCoachState(user), probe);
  const entry = ensureChapterCoachEntry(updated, slug);
  entry.status = "in_progress";
  entry.activeProbe = probe;
  entry.unlockedAt ??= nowIso();
  entry.lastUpdatedAt = nowIso();

  pushTranscript(entry, {
    id: crypto.randomUUID(),
    role: "assistant",
    type: "probe",
    milestoneId: milestone.id,
    probeId: probe.id,
    content: probe.prompt,
    summary: probe.summary ?? milestone.summary,
    createdAt: nowIso(),
  });

  return updated;
}

export function applyChapterCoachEvaluation(user, slug, milestone, probe, answer, evaluation) {
  const updated = applyProbeEvaluationToHistory(ensureUserCoachState(user), probe, evaluation);
  const entry = ensureChapterCoachEntry(updated, slug);
  const progress = milestoneProgress(entry, milestone.id);
  const triedAt = nowIso();

  progress.attempts += 1;
  progress.lastScore = evaluation.score;
  progress.bestScore = Math.max(progress.bestScore ?? 0, evaluation.score);
  progress.lastTriedAt = triedAt;
  if (evaluation.score >= milestone.successScore) {
    progress.passedAt ??= triedAt;
  }

  pushTranscript(entry, {
    id: crypto.randomUUID(),
    role: "user",
    type: "answer",
    milestoneId: milestone.id,
    probeId: probe.id,
    content: String(answer ?? "").trim(),
    createdAt: triedAt,
  });

  pushTranscript(entry, {
    id: crypto.randomUUID(),
    role: "assistant",
    type: "feedback",
    milestoneId: milestone.id,
    probeId: probe.id,
    content: evaluation.summary,
    repairExplanation: evaluation.repairExplanation ?? "",
    score: evaluation.score,
    strengths: evaluation.strengths ?? [],
    misses: evaluation.misses ?? [],
    createdAt: triedAt,
  });

  entry.activeProbe = null;
  entry.lastUpdatedAt = triedAt;

  const coach = getChapterCoach(slug);
  if (coach && chapterMastered(entry, coach)) {
    entry.status = "mastered";
    entry.completedAt ??= triedAt;
    pushTranscript(entry, {
      id: crypto.randomUUID(),
      role: "assistant",
      type: "completion",
      content: coach.masteryDoneCopy,
      createdAt: triedAt,
    });
  } else {
    entry.status = "ready";
  }

  return updated;
}

export function chapterCoachPublicState(user, slug) {
  const coach = getChapterCoach(slug);
  if (!coach) {
    return null;
  }

  const entry = user.chapterCoach?.[slug] ?? defaultChapterCoachEntry();
  const unlocked = quizCompleted(user, slug);
  const status = !unlocked ? "locked" : entry.completedAt ? "mastered" : entry.activeProbe ? "in_progress" : "ready";

  return {
    slug,
    title: coach.title,
    status,
    unlocked,
    intro: coach.masteryIntro,
    unlockCopy: coach.masteryUnlockCopy,
    doneCopy: coach.masteryDoneCopy,
    activeProbe: sanitizeProbeForClient(entry.activeProbe),
    transcript: clipMessages(entry.transcript ?? [], MAX_TRANSCRIPT_TURNS),
    milestones: coach.milestones.map((milestone) => {
      const progress = entry.milestones?.[milestone.id] ?? null;
      return {
        id: milestone.id,
        label: milestone.label,
        status: milestoneStatus(entry, milestone),
        attempts: progress?.attempts ?? 0,
        bestScore: progress?.bestScore ?? 0,
      };
    }),
    nextMilestone: nextChapterMilestone(user, slug)
      ? {
          id: nextChapterMilestone(user, slug).id,
          label: nextChapterMilestone(user, slug).label,
        }
      : null,
    completedAt: entry.completedAt ?? null,
  };
}
