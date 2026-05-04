import {
  LESSON_ORDER,
  LESSON_INDEX_BY_SLUG,
  LEVEL_TARGETS,
  PROBE_BANK,
  PROBE_CONFIDENCE_GAINS,
  PROBE_LEVEL_GUIDANCE,
  PROBE_UPDATE_WEIGHTS,
  QUIZ_SIGNAL_WEIGHTS,
  QUIZ_SKILL_TAGS,
  REASONING_LEVELS,
  SKILLS,
  SKILL_IDS,
  SURFACE_LEVELS,
  countsAsTrackedLearningEvidence,
  findProbe,
  highestTrackedLessonOrder,
  isTrackedLessonSlug,
  levelsForSkill,
  masteryForSkillState,
} from "./personalization_catalog.mjs";
import { enrichUser } from "./personalization_store.mjs";

const LEVEL_DIMENSION = {
  recognition: "recognition",
  recall: "recall",
  explanation: "explanation",
  transfer: "transfer",
  pressure: "pressure",
};

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9+\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(haystack, needles) {
  return needles.some((needle) => haystack.includes(needle));
}

function promptFingerprint(prompt) {
  return normalizeText(prompt).slice(0, 180);
}

function bumpDimension(skillState, dimension, normalizedScore) {
  const current = skillState[dimension];
  const weight = PROBE_UPDATE_WEIGHTS[dimension] ?? 0.4;
  const confidenceDelta =
    normalizedScore >= 0.7
      ? PROBE_CONFIDENCE_GAINS[dimension] ?? 0.08
      : -(PROBE_CONFIDENCE_GAINS[dimension] ?? 0.08) * 0.45;
  skillState[dimension] = clamp(current * (1 - weight) + normalizedScore * weight);
  skillState.confidence = clamp(skillState.confidence + confidenceDelta);

  if (normalizedScore >= 0.7) {
    skillState.hits += 1;
    skillState.misses = Math.max(0, skillState.misses - 1);
  } else {
    skillState.misses += 1;
  }

  skillState.lastEvidenceAt = new Date().toISOString();
}

function softenLowerDimensions(skillState, dimension, normalizedScore) {
  const currentIndex = [...SURFACE_LEVELS, ...REASONING_LEVELS].indexOf(dimension);
  if (currentIndex <= 0 || normalizedScore < 0.7) {
    return;
  }

  for (const lowerDimension of [...SURFACE_LEVELS, ...REASONING_LEVELS].slice(0, currentIndex)) {
    skillState[lowerDimension] = clamp(skillState[lowerDimension] * 0.7 + normalizedScore * 0.3);
  }
}

function applyQuizSignal(skillState, normalizedScore) {
  skillState.recognition = clamp(
    skillState.recognition * (1 - QUIZ_SIGNAL_WEIGHTS.recognition) +
      normalizedScore * QUIZ_SIGNAL_WEIGHTS.recognition,
  );

  const recallSignal = normalizedScore >= 0.8 ? normalizedScore : normalizedScore * 0.75;
  skillState.recall = clamp(
    skillState.recall * (1 - QUIZ_SIGNAL_WEIGHTS.recall) + recallSignal * QUIZ_SIGNAL_WEIGHTS.recall,
  );

  const confidenceDelta =
    normalizedScore >= 0.75 ? QUIZ_SIGNAL_WEIGHTS.confidence : -QUIZ_SIGNAL_WEIGHTS.confidence * 0.5;
  skillState.confidence = clamp(skillState.confidence + confidenceDelta);
  skillState.lastEvidenceAt = new Date().toISOString();
}

function heuristicTextReview(probe, answer) {
  const normalized = normalizeText(answer);
  const words = normalized ? normalized.split(" ") : [];
  const conceptMatches = (probe.expectedConcepts ?? []).filter((concept) =>
    includesAny(normalized, [concept.toLowerCase()]),
  );
  const signalMatches = (probe.qualitySignals ?? []).filter((signal) =>
    includesAny(normalized, [signal.toLowerCase()]),
  );
  const antiMatches = (probe.antiPatterns ?? []).filter((pattern) =>
    includesAny(normalized, [pattern.toLowerCase()]),
  );

  let score = 0.15;
  if (words.length >= 18) score += 0.15;
  if (words.length >= 30) score += 0.1;
  score += Math.min(0.4, conceptMatches.length * 0.08);
  score += Math.min(0.2, signalMatches.length * 0.06);
  score -= Math.min(0.25, antiMatches.length * 0.08);

  const normalizedScore = clamp(Number(score.toFixed(2)));
  const strengths = [];
  const misses = [];

  if (conceptMatches.length >= 2) {
    strengths.push(`You touched the core ideas: ${conceptMatches.slice(0, 3).join(", ")}.`);
  } else {
    misses.push("The answer is still missing some of the course's core ideas for this probe.");
  }

  if (signalMatches.length > 0) {
    strengths.push("Your answer shows some causal language instead of just naming nouns.");
  } else {
    misses.push("The answer needs more justification language such as why, before, after, or because.");
  }

  if (antiMatches.length > 0) {
    misses.push("You slipped toward component or generic language before the reasoning was fully clear.");
  }

  if (words.length < 12) {
    misses.push("The answer is too short to show durable understanding yet.");
  }

  return {
    mode: "heuristic",
    score: normalizedScore,
    strengths: strengths.slice(0, 3),
    misses: misses.slice(0, 3),
    repairExplanation:
      normalizedScore >= 0.72
        ? "The answer is stable enough to push one level deeper."
        : "Repair the answer by naming the core pressure or boundary first, then justify it with because-language before you mention any tools or generic components.",
    recommendedStage: SKILLS[probe.skillId].owningStage,
    nextRepairMove: SKILLS[probe.skillId].nextAction,
    shouldGoDeeper: normalizedScore >= 0.72,
    summary:
      normalizedScore >= 0.72
        ? "The answer is stable enough for a deeper probe."
        : "The answer shows partial understanding, but the owning layer still needs repair.",
  };
}

export function evaluateMcqProbe(probe, answerIndex) {
  const correct = Number(answerIndex) === Number(probe.answerIndex);
  return {
    mode: "deterministic",
    score: correct ? 1 : 0,
    strengths: correct ? ["You chose the course-aligned answer."] : [],
    misses: correct ? [] : ["This answer missed the main distinction the course is trying to train."],
    repairExplanation: correct
      ? "Good. You caught the key distinction, so the next probe can demand a more spoken explanation."
      : "Repair the miss by restating the chapter's main distinction in plain language, then connect it to why the stronger answer changes the design reasoning.",
    recommendedStage: SKILLS[probe.skillId].owningStage,
    nextRepairMove: SKILLS[probe.skillId].nextAction,
    shouldGoDeeper: correct,
    summary: correct ? probe.explanation : `Not quite. ${probe.explanation}`,
  };
}

export function evaluateTextProbeHeuristic(probe, answer) {
  return heuristicTextReview(probe, answer);
}

export function applyProbeEvaluationToHistory(user, probe, evaluation, options = {}) {
  const { clearActiveProbe = true } = options;
  const updated = structuredClone(user);
  const skillState = updated.skills[probe.skillId];
  const dimension = LEVEL_DIMENSION[probe.level];
  const completedAt = new Date().toISOString();
  bumpDimension(skillState, dimension, evaluation.score);
  softenLowerDimensions(skillState, dimension, evaluation.score);
  skillState.lastProbeId = probe.id;
  if (clearActiveProbe) {
    updated.activeProbe = null;
  }
  updated.probeHistory = (updated.probeHistory ?? []).map((entry) =>
    entry.id === probe.id && !entry.answeredAt
      ? {
          ...entry,
          answeredAt: completedAt,
          score: evaluation.score,
        }
      : entry,
  );

  updated.recentEvidence = [
    {
      type: "probe",
      probeId: probe.id,
      skillId: probe.skillId,
      level: probe.level,
      score: evaluation.score,
      summary: evaluation.summary,
      createdAt: completedAt,
    },
    ...(updated.recentEvidence ?? []),
  ].slice(0, 12);

  return enrichUser(updated);
}

export function applyProbeEvaluation(user, probe, evaluation) {
  const updated = applyProbeEvaluationToHistory(user, probe, evaluation, { clearActiveProbe: true });
  updated.activeProbe = null;
  return enrichUser(updated);
}

export function applyQuizEvidence(user, slug, correct, total) {
  const updated = structuredClone(user);
  const normalized = total > 0 ? correct / total : 0;
  const skillIds = QUIZ_SKILL_TAGS[slug] ?? [];

  for (const skillId of skillIds) {
    const skillState = updated.skills[skillId];
    applyQuizSignal(skillState, normalized);
  }

  updated.chapterProgress = {
    ...updated.chapterProgress,
    [slug]: {
      correct,
      total,
      ratio: total > 0 ? Number((correct / total).toFixed(2)) : 0,
      completedAt: new Date().toISOString(),
    },
  };

  updated.recentEvidence = [
    {
      type: "quiz",
      slug,
      score: normalized,
      summary: `Quiz score ${correct}/${total}`,
      createdAt: new Date().toISOString(),
    },
    ...(updated.recentEvidence ?? []),
  ].slice(0, 12);

  return enrichUser(updated);
}

export function clearActiveProbe(user) {
  const updated = structuredClone(user);
  updated.activeProbe = null;
  return enrichUser(updated);
}

export function appendProbeHistory(user, probe) {
  const updated = structuredClone(user);
  const askedAt = new Date().toISOString();

  updated.probeHistory = [
    {
      id: probe.id,
      skillId: probe.skillId,
      level: probe.level,
      systemAnchor: probe.systemAnchor ?? null,
      source: probe.source ?? "catalog",
      promptPreview: probe.prompt.slice(0, 160),
      promptFingerprint: promptFingerprint(probe.prompt),
      askedAt,
      answeredAt: null,
      score: null,
    },
    ...(updated.probeHistory ?? []).filter((entry) => entry.id !== probe.id),
  ].slice(0, 24);

  return updated;
}

export function setActiveProbe(user, probe) {
  const updated = appendProbeHistory(user, probe);
  updated.activeProbe = probe;
  return enrichUser(updated);
}

function orderedAvailableLevels(skillId, order) {
  const available = levelsForSkill(skillId);
  return order.filter((level) => available.includes(level));
}

function nextWeakLevel(skillState, levels) {
  return levels.find((level) => skillState[level] < (LEVEL_TARGETS[level] ?? 0.6)) ?? null;
}

function readyForDeeperProbe(skillState, levels) {
  return levels.every((level) => skillState[level] >= (LEVEL_TARGETS[level] ?? 0.6) - 0.03);
}

function nextLevelForSkill(skillId, skillState) {
  const availableLevels = levelsForSkill(skillId);
  if (availableLevels.length === 0) {
    return "recognition";
  }

  const surfaceLevels = orderedAvailableLevels(skillId, SURFACE_LEVELS);
  const reasoningLevels = orderedAvailableLevels(skillId, REASONING_LEVELS);
  const weakestSurface = nextWeakLevel(skillState, surfaceLevels);
  const weakestReasoning = nextWeakLevel(skillState, reasoningLevels);

  if ((surfaceLevels.length === 0 || readyForDeeperProbe(skillState, surfaceLevels)) && weakestReasoning) {
    return weakestReasoning;
  }

  if (weakestSurface) {
    return weakestSurface;
  }

  if (weakestReasoning) {
    return weakestReasoning;
  }

  return reasoningLevels.at(-1) ?? surfaceLevels.at(-1) ?? availableLevels[0];
}

function hasLearningSignals(user) {
  return (
    Object.entries(user.chapterProgress ?? {}).some(([slug, progress]) => isTrackedLessonSlug(slug) && Boolean(progress?.completedAt)) ||
    (user.recentEvidence ?? []).some((item) => countsAsTrackedLearningEvidence(item)) ||
    (user.probeHistory ?? []).some((entry) => Boolean(entry?.answeredAt))
  );
}

function accessibleLessonOrder(user) {
  const highestTrackedLesson = highestTrackedLessonOrder(user.chapterProgress ?? {});
  if (!highestTrackedLesson) {
    return 1;
  }

  return Math.min(LESSON_ORDER.length - 1, highestTrackedLesson + 1);
}

function rankedSkillTargets(user) {
  const accessibleLesson = accessibleLessonOrder(user);

  return SKILL_IDS.map((skillId) => ({
    skillId,
    mastery: masteryForSkillState(skillId, user.skills[skillId]),
    owningStage: SKILLS[skillId].owningStage,
    misses: user.skills[skillId].misses,
    courseDistance: Math.max(0, (SKILLS[skillId].introducedInLesson ?? 1) - accessibleLesson),
  })).sort((left, right) => {
    if (left.courseDistance !== right.courseDistance) {
      return left.courseDistance - right.courseDistance;
    }
    if (left.owningStage !== right.owningStage) {
      return left.owningStage - right.owningStage;
    }
    if (left.misses !== right.misses) {
      return right.misses - left.misses;
    }
    return left.mastery - right.mastery;
  });
}

export function selectNextProbeTarget(user) {
  if (!hasLearningSignals(user)) {
    return null;
  }

  const rankedSkills = rankedSkillTargets(user);

  for (const candidate of rankedSkills) {
    const skillState = user.skills[candidate.skillId];
    return {
      skillId: candidate.skillId,
      level: nextLevelForSkill(candidate.skillId, skillState),
      courseDistance: candidate.courseDistance,
      introducedInLesson: SKILLS[candidate.skillId].introducedInLesson ?? 1,
      levelGuidance: PROBE_LEVEL_GUIDANCE[nextLevelForSkill(candidate.skillId, skillState)],
      skillLabel: SKILLS[candidate.skillId].label,
      stage: SKILLS[candidate.skillId].owningStage,
      stageLabel: `Stage ${SKILLS[candidate.skillId].owningStage}`,
      summary: SKILLS[candidate.skillId].summary,
      weakSpot: SKILLS[candidate.skillId].weakSpot,
      nextAction: SKILLS[candidate.skillId].nextAction,
    };
  }

  return null;
}

export function selectFallbackProbe(user, preferredTarget = null) {
  const rankedSkills = preferredTarget
    ? [
        {
          skillId: preferredTarget.skillId,
          mastery: masteryForSkillState(preferredTarget.skillId, user.skills[preferredTarget.skillId]),
          owningStage: SKILLS[preferredTarget.skillId].owningStage,
          misses: user.skills[preferredTarget.skillId].misses,
          courseDistance: preferredTarget.courseDistance ?? 0,
        },
        ...rankedSkillTargets(user).filter((candidate) => candidate.skillId !== preferredTarget.skillId),
      ]
    : rankedSkillTargets(user);

  for (const candidate of rankedSkills) {
    const skillState = user.skills[candidate.skillId];
    const desiredLevel = preferredTarget?.skillId === candidate.skillId
      ? preferredTarget.level
      : nextLevelForSkill(candidate.skillId, skillState);
    const orderedLevels = [
      desiredLevel,
      ...orderedAvailableLevels(candidate.skillId, REASONING_LEVELS).filter((level) => level !== desiredLevel),
      ...orderedAvailableLevels(candidate.skillId, SURFACE_LEVELS).filter((level) => level !== desiredLevel),
    ];

    for (const level of orderedLevels) {
      const probe = PROBE_BANK.find((item) => item.skillId === candidate.skillId && item.level === level);
      if (probe) {
        return {
          ...probe,
          source: "catalog",
          skillLabel: SKILLS[probe.skillId].label,
          stage: SKILLS[probe.skillId].owningStage,
          stageLabel: `Stage ${SKILLS[probe.skillId].owningStage}`,
          summary: SKILLS[probe.skillId].summary,
        };
      }
    }
  }

  return null;
}

export function sanitizeProbeForClient(probe) {
  if (!probe) {
    return null;
  }

  const {
    answerIndex,
    explanation,
    expectedConcepts,
    qualitySignals,
    antiPatterns,
    rationale,
    ...publicProbe
  } = probe;

  return publicProbe;
}

export function resolveProbeForUser(user, probeId) {
  if (user.activeProbe?.id === probeId) {
    return user.activeProbe;
  }

  return findProbe(probeId);
}

export function resolveProbe(probeId) {
  return findProbe(probeId);
}
