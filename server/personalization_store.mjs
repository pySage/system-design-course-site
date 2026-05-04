import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import {
  LESSON_INDEX_BY_SLUG,
  MAX_USERS,
  QUIZ_SKILL_TAGS,
  SKILLS,
  SKILL_IDS,
  STAGE_LABELS,
  countTrackedCompletedLessons,
  countsAsTrackedLearningEvidence,
  createDefaultSkills,
  highestTrackedLessonOrder,
  isTrackedLessonSlug,
  masteryForSkillState,
} from "./personalization_catalog.mjs";
import { findAccountByCredentials, findAccountById } from "./learner_accounts.mjs";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const runtimeDir = path.join(rootDir, "runtime", "personalization");
const usersPath = path.join(runtimeDir, "users.json");
const attemptsPath = path.join(runtimeDir, "attempts.json");
let mutationQueue = Promise.resolve();
const ONBOARDING_STAGE_LABEL = "Not started yet";
const ONBOARDING_NEXT_ACTION =
  "Read chapter 00, then complete lesson 01 and its quiz. The coach starts tracking your understanding after your first real lesson check.";

function nowIso() {
  return new Date().toISOString();
}

function isKnownAccountId(accountId) {
  return Boolean(findAccountById(accountId));
}

function hasCompletedLessons(chapterProgress = {}) {
  return Object.entries(chapterProgress).some(([slug, progress]) => isTrackedLessonSlug(slug) && Boolean(progress?.completedAt));
}

function hasAnsweredProbe(probeHistory = []) {
  return probeHistory.some((entry) => Boolean(entry?.answeredAt));
}

function learnedLessonOrder(chapterProgress = {}) {
  return highestTrackedLessonOrder(chapterProgress);
}

export function hasLearningSignals(user) {
  return (
    hasCompletedLessons(user.chapterProgress) ||
    (user.recentEvidence ?? []).some((item) => countsAsTrackedLearningEvidence(item)) ||
    hasAnsweredProbe(user.probeHistory)
  );
}

function onboardingUserState(user) {
  return {
    ...user,
    currentStage: null,
    stageLabel: ONBOARDING_STAGE_LABEL,
    strongestSkillId: null,
    weakestSkillId: null,
    weakSpots: [],
    nextAction: ONBOARDING_NEXT_ACTION,
    skills: createDefaultSkills(),
    activeProbe: null,
    probeHistory: [],
    recentEvidence: [],
    coachChats: user.coachChats ?? { course: [] },
    chapterCoach: user.chapterCoach ?? {},
    isOnboarding: true,
  };
}

function defaultUsersState() {
  return {
    version: 1,
    users: [],
  };
}

function defaultAttemptsState() {
  return {
    version: 1,
    attempts: [],
  };
}

async function ensureRuntime() {
  await fs.mkdir(runtimeDir, { recursive: true });
}

async function readJson(filePath, fallback) {
  await ensureRuntime();

  try {
    const raw = await fs.readFile(filePath, "utf8");
    try {
      return JSON.parse(raw);
    } catch (error) {
      if (error instanceof SyntaxError) {
        const backupPath = `${filePath}.corrupt-${Date.now()}`;
        await fs.copyFile(filePath, backupPath);
        const value = fallback();
        await writeJson(filePath, value);
        return value;
      }

      throw error;
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      const value = fallback();
      await writeJson(filePath, value);
      return value;
    }

    throw error;
  }
}

async function writeJson(filePath, value) {
  await ensureRuntime();
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, filePath);
}

function withMutation(task) {
  const result = mutationQueue.then(() => task());
  mutationQueue = result.catch(() => {});
  return result;
}

export async function loadUsersState() {
  const state = await readJson(usersPath, defaultUsersState);
  const users = state.users
    .filter((user) => isKnownAccountId(user.accountId ?? user.id))
    .map((user) => enrichUser(user));

  const normalized = {
    ...state,
    users,
  };

  if (JSON.stringify(normalized.users) !== JSON.stringify(state.users)) {
    await saveUsersState(normalized);
    return normalized;
  }

  return normalized;
}

export async function loadAttemptsState() {
  const state = await readJson(attemptsPath, defaultAttemptsState);
  const attempts = state.attempts.filter((attempt) => isKnownAccountId(attempt.userId));

  if (attempts.length === state.attempts.length) {
    return state;
  }

  const normalized = {
    ...state,
    attempts,
  };
  await saveAttemptsState(normalized);
  return normalized;
}

export async function saveUsersState(state) {
  return writeJson(usersPath, state);
}

export async function saveAttemptsState(state) {
  return writeJson(attemptsPath, state);
}

export async function listUsers() {
  const state = await loadUsersState();
  return state.users.map((user) => ({
    id: user.id,
    name: user.name,
    username: user.username ?? null,
    createdAt: user.createdAt,
    currentStage: user.currentStage,
    stageLabel: user.stageLabel ?? STAGE_LABELS[user.currentStage] ?? STAGE_LABELS[1],
    strongestSkillId: user.strongestSkillId,
    weakestSkillId: user.weakestSkillId,
  }));
}

function freshUserForAccount(account, createdAt = nowIso()) {
  return {
    id: account.id,
    accountId: account.id,
    name: account.name,
    username: account.username,
    createdAt,
    updatedAt: createdAt,
    currentStage: null,
    stageLabel: ONBOARDING_STAGE_LABEL,
    codexThreadId: null,
    strongestSkillId: null,
    weakestSkillId: null,
    weakSpots: [],
    nextAction: ONBOARDING_NEXT_ACTION,
    chapterProgress: {},
    skills: createDefaultSkills(),
    activeProbe: null,
    probeHistory: [],
    recentEvidence: [],
    coachChats: { course: [] },
    chapterCoach: {},
    isOnboarding: true,
  };
}

export function authenticateLearner(username, password) {
  return findAccountByCredentials(username, password);
}

export async function ensureUserForAccount(account) {
  return withMutation(async () => {
    const state = await loadUsersState();
    const index = state.users.findIndex((user) => user.id === account.id || user.accountId === account.id);

    if (index === -1) {
      if (state.users.length >= MAX_USERS) {
        throw new Error(`This local setup supports at most ${MAX_USERS} learners.`);
      }

      const createdUser = enrichUser(freshUserForAccount(account));
      state.users.push(createdUser);
      await saveUsersState(state);
      return createdUser;
    }

    const current = state.users[index];
    const updated = enrichUser({
      ...current,
      id: account.id,
      accountId: account.id,
      name: account.name,
      username: account.username,
    });
    state.users[index] = updated;
    await saveUsersState(state);
    return updated;
  });
}

export async function findUser(userId) {
  const state = await loadUsersState();
  return state.users.find((user) => user.id === userId) ?? null;
}

export async function updateUser(userId, updater) {
  return withMutation(async () => {
    const state = await loadUsersState();
    const index = state.users.findIndex((user) => user.id === userId);
    if (index === -1) {
      throw new Error("Learner not found.");
    }

    const current = state.users[index];
    const updated = enrichUser({
      ...current,
      ...updater(current),
      updatedAt: nowIso(),
    });
    state.users[index] = updated;
    await saveUsersState(state);
    return updated;
  });
}

export async function recordAttempt(userId, attempt) {
  return withMutation(async () => {
    const state = await loadAttemptsState();
    state.attempts.push({
      id: crypto.randomUUID(),
      userId,
      createdAt: nowIso(),
      ...attempt,
    });
    await saveAttemptsState(state);
  });
}

export async function resetUserProgress(userId, password) {
  return withMutation(async () => {
    const account = findAccountById(userId);
    if (!account || account.password !== String(password ?? "")) {
      throw new Error("Password does not match this reader profile.");
    }

    const state = await loadUsersState();
    const index = state.users.findIndex((user) => user.id === account.id || user.accountId === account.id);
    const createdAt = index === -1 ? nowIso() : state.users[index].createdAt;
    const resetUser = enrichUser(freshUserForAccount(account, createdAt));

    if (index === -1) {
      state.users.push(resetUser);
    } else {
      state.users[index] = resetUser;
    }

    await saveUsersState(state);

    const attemptsState = await loadAttemptsState();
    attemptsState.attempts = attemptsState.attempts.filter((attempt) => attempt.userId !== account.id);
    await saveAttemptsState(attemptsState);

    return resetUser;
  });
}

function masteryForSkill(skillId, skillState) {
  return masteryForSkillState(skillId, skillState);
}

function summarizeWeakSpots(skills, currentLessonOrder) {
  const openWeakSpots = [];

  for (const skillId of SKILL_IDS) {
    const skillMeta = SKILLS[skillId];
    if ((skillMeta.introducedInLesson ?? Number.POSITIVE_INFINITY) > currentLessonOrder) {
      continue;
    }
    const skillState = skills[skillId];
    const mastery = masteryForSkill(skillId, skillState);

    if (mastery < 0.58 || skillState.misses >= 2) {
      openWeakSpots.push({
        skillId,
        label: skillMeta.label,
        owningStage: skillMeta.owningStage,
        mastery,
        missCount: skillState.misses,
        summary: skillMeta.weakSpot,
        repair: skillMeta.nextAction,
      });
    }
  }

  return openWeakSpots.sort((left, right) => {
    if (left.owningStage !== right.owningStage) {
      return left.owningStage - right.owningStage;
    }
    return left.mastery - right.mastery;
  });
}

export function enrichUser(user) {
  if (!hasLearningSignals(user)) {
    return onboardingUserState(user);
  }

  const currentLessonOrder = learnedLessonOrder(user.chapterProgress);
  const visibleSkillIds = SKILL_IDS.filter(
    (skillId) => (SKILLS[skillId].introducedInLesson ?? Number.POSITIVE_INFINITY) <= currentLessonOrder,
  );
  const scopedSkillIds = visibleSkillIds.length > 0 ? visibleSkillIds : SKILL_IDS;
  const skillMastery = scopedSkillIds.map((skillId) => ({
    skillId,
    mastery: masteryForSkill(skillId, user.skills[skillId]),
  }));

  const weakest = [...skillMastery].sort((left, right) => left.mastery - right.mastery)[0];
  const strongest = [...skillMastery].sort((left, right) => right.mastery - left.mastery)[0];
  const weakSpots = summarizeWeakSpots(user.skills, currentLessonOrder);
  const currentStage = weakSpots[0]?.owningStage ?? (weakest.mastery >= 0.72 ? 5 : SKILLS[weakest.skillId].owningStage);
  const stageLabel = STAGE_LABELS[currentStage] ?? STAGE_LABELS[1];

  return {
    ...user,
    currentStage,
    stageLabel,
    strongestSkillId: strongest.skillId,
    weakestSkillId: weakest.skillId,
    weakSpots,
    isOnboarding: false,
    nextAction:
      weakSpots[0]?.repair ??
      `You are stable enough to take a deeper ${stageLabel.toLowerCase()} probe on ${SKILLS[weakest.skillId].label.toLowerCase()}.`,
  };
}

export function publicUserState(user) {
  const completedLessonCount = countTrackedCompletedLessons(user.chapterProgress ?? {});

  return {
    id: user.id,
    name: user.name,
    username: user.username ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    currentStage: user.currentStage,
    stageLabel: user.stageLabel,
    isOnboarding: Boolean(user.isOnboarding),
    completedLessonCount,
    strongestSkill: user.strongestSkillId
      ? {
          id: user.strongestSkillId,
          label: SKILLS[user.strongestSkillId].label,
          mastery: masteryForSkill(user.strongestSkillId, user.skills[user.strongestSkillId]),
        }
      : null,
    weakestSkill: user.weakestSkillId
      ? {
          id: user.weakestSkillId,
          label: SKILLS[user.weakestSkillId].label,
          mastery: masteryForSkill(user.weakestSkillId, user.skills[user.weakestSkillId]),
          nextAction: SKILLS[user.weakestSkillId].nextAction,
        }
      : null,
    nextAction: user.nextAction,
    weakSpots: user.weakSpots.slice(0, 3),
    chapterProgress: user.chapterProgress,
    chapterStatus: Object.fromEntries(
      Object.entries(user.chapterProgress ?? {}).map(([slug, progress]) => [
        slug,
        {
          completedAt: progress?.completedAt ?? null,
          masteryCompletedAt: user.chapterCoach?.[slug]?.completedAt ?? null,
        },
      ]),
    ),
    skillMastery: Object.fromEntries(
      SKILL_IDS.map((skillId) => [
        skillId,
        {
          label: SKILLS[skillId].label,
          mastery: masteryForSkill(skillId, user.skills[skillId]),
          confidence: user.skills[skillId].confidence,
          owningStage: SKILLS[skillId].owningStage,
        },
      ]),
    ),
    recentEvidence: user.recentEvidence.slice(0, 5),
  };
}
