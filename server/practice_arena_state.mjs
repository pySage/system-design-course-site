import crypto from "node:crypto";
import {
  SKILLS,
  SKILL_IDS,
  STAGE_LABELS,
  masteryForSkillState,
} from "./personalization_catalog.mjs";
import {
  ARENA_PHASES,
  ARENA_SESSION_HISTORY_LIMIT,
  ARENA_TRANSCRIPT_LIMIT,
  arenaLevelGuidance,
  arenaPhaseByIndex,
  arenaReadiness,
  arenaRepairLessonSlug,
  arenaTrackById,
  preferredArenaLevel,
} from "./practice_arena_catalog.mjs";
import {
  appendProbeHistory,
  applyProbeEvaluationToHistory,
  sanitizeProbeForClient,
} from "./personalization_engine.mjs";

function nowIso() {
  return new Date().toISOString();
}

function clone(value) {
  return structuredClone(value);
}

function clip(items, limit) {
  return items.slice(-limit);
}

function defaultSkillArenaStats() {
  return Object.fromEntries(
    SKILL_IDS.map((skillId) => [
      skillId,
      {
        rounds: 0,
        clears: 0,
        highestPhase: 0,
        bestScore: 0,
        lastPlayedAt: null,
      },
    ]),
  );
}

function defaultArenaState() {
  return {
    roundsPlayed: 0,
    roundsCleared: 0,
    sessionsCompleted: 0,
    currentStreak: 0,
    bestStreak: 0,
    highestPhaseCleared: 0,
    highestTrackId: null,
    activeSession: null,
    lastSession: null,
    sessionHistory: [],
    skillStats: defaultSkillArenaStats(),
  };
}

function ensureArenaContainer(user) {
  user.arena ??= defaultArenaState();
  user.arena.skillStats ??= defaultSkillArenaStats();
  user.arena.sessionHistory ??= [];
  return user.arena;
}

function ensureSkillArenaStats(arena, skillId) {
  arena.skillStats ??= defaultSkillArenaStats();
  arena.skillStats[skillId] ??= {
    rounds: 0,
    clears: 0,
    highestPhase: 0,
    bestScore: 0,
    lastPlayedAt: null,
  };
  return arena.skillStats[skillId];
}

function pushTranscript(session, item) {
  session.transcript = clip([...(session.transcript ?? []), item], ARENA_TRANSCRIPT_LIMIT);
}

function summarizeSession(session) {
  const track = arenaTrackById(session.trackId);
  const rounds = session.scoreCount ?? 0;
  const averageScore = rounds > 0 ? Number((session.scoreTotal / rounds).toFixed(2)) : 0;

  return {
    id: session.id,
    status: session.status,
    startedAt: session.startedAt,
    completedAt: session.completedAt ?? null,
    trackId: session.trackId,
    trackLabel: track?.label ?? "Arena set",
    skillId: session.skillId,
    skillLabel: SKILLS[session.skillId]?.label ?? session.skillId,
    rounds,
    averageScore,
    clearedPhases: [...(session.clearedPhaseIds ?? [])],
    focusReason: session.focusReason,
  };
}

function rankSkillCandidates(user, skillIds) {
  const arena = ensureArenaContainer(user);

  return [...new Set(skillIds)]
    .filter((skillId) => Boolean(SKILLS[skillId]))
    .map((skillId) => ({
      skillId,
      mastery: masteryForSkillState(skillId, user.skills[skillId]),
      misses: user.skills[skillId]?.misses ?? 0,
      lastPlayedAt: ensureSkillArenaStats(arena, skillId).lastPlayedAt,
    }))
    .sort((left, right) => {
      if (left.misses !== right.misses) {
        return right.misses - left.misses;
      }
      if (left.mastery !== right.mastery) {
        return left.mastery - right.mastery;
      }
      const leftAt = left.lastPlayedAt ? Date.parse(left.lastPlayedAt) : 0;
      const rightAt = right.lastPlayedAt ? Date.parse(right.lastPlayedAt) : 0;
      return leftAt - rightAt;
    });
}

function chooseArenaFocus(user) {
  const readiness = arenaReadiness(user);
  const highestTrack = readiness.highestTrack;
  if (!highestTrack) {
    return null;
  }

  const pool = highestTrack.id === "mock"
    ? readiness.unlockedTracks.flatMap((track) => track.skillIds)
    : highestTrack.skillIds;
  const weakSpot = (user.weakSpots ?? []).find((spot) => pool.includes(spot.skillId));
  const ranked = rankSkillCandidates(user, pool);
  const selectedSkillId = weakSpot?.skillId ?? ranked[0]?.skillId ?? pool[0] ?? null;

  if (!selectedSkillId) {
    return null;
  }

  return {
    trackId: highestTrack.id,
    skillId: selectedSkillId,
    focusReason: weakSpot
      ? `This set starts on ${SKILLS[selectedSkillId].label.toLowerCase()} because that is the earliest open gap still owning the miss.`
      : highestTrack.id === "mock"
        ? `All arena tracks are open, so this set starts from the weakest useful layer and then pushes it under mixed interview pressure.`
        : `This set starts on ${SKILLS[selectedSkillId].label.toLowerCase()} because that is the weakest useful layer inside ${highestTrack.label.toLowerCase()}.`,
  };
}

export function ensureArenaState(user) {
  const updated = clone(user);
  ensureArenaContainer(updated);
  return updated;
}

export function startArenaSession(user) {
  const updated = ensureArenaState(user);
  const arena = ensureArenaContainer(updated);

  if (arena.activeSession?.status === "active" && arena.activeSession?.activeRound) {
    return updated;
  }

  const focus = chooseArenaFocus(updated);
  if (!focus) {
    return updated;
  }

  arena.activeSession = {
    id: crypto.randomUUID(),
    status: "active",
    startedAt: nowIso(),
    completedAt: null,
    lastUpdatedAt: nowIso(),
    trackId: focus.trackId,
    skillId: focus.skillId,
    focusReason: focus.focusReason,
    phaseIndex: 0,
    roundNumber: 1,
    repairLoops: 0,
    clearedPhaseIds: [],
    transcript: [],
    activeRound: null,
    systemAnchors: [],
    scoreTotal: 0,
    scoreCount: 0,
    lastEvaluation: null,
    lastAdjustment: "",
  };

  return updated;
}

export function arenaRoundPlan(user) {
  const normalized = ensureArenaState(user);
  const readiness = arenaReadiness(normalized);
  const session = normalized.arena.activeSession;

  if (!readiness.ready || !session) {
    return null;
  }

  const phase = arenaPhaseByIndex(session.phaseIndex ?? 0);
  const track = arenaTrackById(session.trackId) ?? readiness.highestTrack;
  const stage = SKILLS[session.skillId].owningStage;
  const level = preferredArenaLevel(session.skillId, phase.id);

  return {
    readiness,
    session,
    phase,
    track,
    repairLessonSlug: arenaRepairLessonSlug(session.skillId),
    target: {
      skillId: session.skillId,
      level,
      levelGuidance: `${arenaLevelGuidance(session.skillId, phase.id)} Arena phase: ${phase.guidance}`,
      skillLabel: SKILLS[session.skillId].label,
      stage,
      stageLabel: STAGE_LABELS[stage] ?? `Stage ${stage}`,
      summary: `${phase.label}. ${SKILLS[session.skillId].summary}`,
      phaseId: phase.id,
      phaseLabel: phase.label,
      trackId: track?.id ?? session.trackId,
      trackLabel: track?.label ?? "Arena set",
    },
  };
}

export function setArenaActiveRound(user, probe) {
  const updated = appendProbeHistory(ensureArenaState(user), probe);
  const arena = ensureArenaContainer(updated);
  const session = arena.activeSession;
  const phase = arenaPhaseByIndex(session?.phaseIndex ?? 0);

  if (!session) {
    return updated;
  }

  session.activeRound = probe;
  session.lastUpdatedAt = nowIso();
  if (probe.systemAnchor) {
    session.systemAnchors = [...new Set([...(session.systemAnchors ?? []), probe.systemAnchor])].slice(-6);
  }

  pushTranscript(session, {
    id: crypto.randomUUID(),
    role: "assistant",
    type: "probe",
    phaseId: phase.id,
    phaseLabel: phase.label,
    probeId: probe.id,
    content: probe.prompt,
    summary: probe.summary,
    createdAt: nowIso(),
  });

  return updated;
}

function phaseProgress(session) {
  return ARENA_PHASES.map((phase, index) => ({
    id: phase.id,
    label: phase.label,
    status:
      session.status === "completed" || (session.clearedPhaseIds ?? []).includes(phase.id)
        ? "passed"
        : index === (session.phaseIndex ?? 0) && session.status === "active"
          ? "current"
          : "pending",
  }));
}

export function applyArenaTurn(user, answer, evaluation) {
  const updated = applyProbeEvaluationToHistory(ensureArenaState(user), user.arena.activeSession.activeRound, evaluation, {
    clearActiveProbe: false,
  });
  const arena = ensureArenaContainer(updated);
  const session = arena.activeSession;

  if (!session) {
    return updated;
  }

  const phase = arenaPhaseByIndex(session.phaseIndex ?? 0);
  const currentProbe = session.activeRound;
  const completedAt = nowIso();
  const passed = evaluation.score >= phase.successScore;
  const skillStats = ensureSkillArenaStats(arena, session.skillId);

  arena.roundsPlayed += 1;
  skillStats.rounds += 1;
  skillStats.bestScore = Math.max(skillStats.bestScore ?? 0, evaluation.score);
  skillStats.lastPlayedAt = completedAt;
  session.scoreTotal = (session.scoreTotal ?? 0) + evaluation.score;
  session.scoreCount = (session.scoreCount ?? 0) + 1;
  session.lastEvaluation = {
    ...evaluation,
    passed,
    phaseId: phase.id,
    phaseLabel: phase.label,
    scoredAt: completedAt,
  };

  pushTranscript(session, {
    id: crypto.randomUUID(),
    role: "user",
    type: "answer",
    phaseId: phase.id,
    phaseLabel: phase.label,
    probeId: currentProbe.id,
    content: String(answer ?? "").trim(),
    createdAt: completedAt,
  });

  pushTranscript(session, {
    id: crypto.randomUUID(),
    role: "assistant",
    type: "feedback",
    phaseId: phase.id,
    phaseLabel: phase.label,
    probeId: currentProbe.id,
    content: evaluation.summary,
    repairExplanation: evaluation.repairExplanation ?? "",
    nextRepairMove: evaluation.nextRepairMove ?? "",
    score: evaluation.score,
    passed,
    strengths: evaluation.strengths ?? [],
    misses: evaluation.misses ?? [],
    createdAt: completedAt,
  });

  session.activeRound = null;
  session.lastUpdatedAt = completedAt;

  if (passed) {
    arena.roundsCleared += 1;
    arena.currentStreak += 1;
    arena.bestStreak = Math.max(arena.bestStreak, arena.currentStreak);
    arena.highestPhaseCleared = Math.max(arena.highestPhaseCleared ?? 0, (session.phaseIndex ?? 0) + 1);
    skillStats.clears += 1;
    skillStats.highestPhase = Math.max(skillStats.highestPhase ?? 0, (session.phaseIndex ?? 0) + 1);

    session.clearedPhaseIds = [...new Set([...(session.clearedPhaseIds ?? []), phase.id])];
    session.repairLoops = 0;
    session.lastAdjustment = `Cleared ${phase.label.toLowerCase()}.`;

    if ((session.phaseIndex ?? 0) >= ARENA_PHASES.length - 1) {
      session.status = "completed";
      session.completedAt = completedAt;
      arena.sessionsCompleted += 1;
      const highestTrack = arenaTrackById(session.trackId);
      if (highestTrack) {
        arena.highestTrackId = highestTrack.id;
      }
      arena.lastSession = summarizeSession(session);
      arena.sessionHistory = clip([arena.lastSession, ...(arena.sessionHistory ?? [])], ARENA_SESSION_HISTORY_LIMIT);
    } else {
      session.phaseIndex += 1;
      session.roundNumber += 1;
    }
  } else {
    arena.currentStreak = 0;
    session.repairLoops = (session.repairLoops ?? 0) + 1;
    session.roundNumber += 1;

    if (session.repairLoops >= 2 && (session.phaseIndex ?? 0) > 0) {
      session.phaseIndex -= 1;
      session.repairLoops = 0;
      session.lastAdjustment = `Stepped back to ${arenaPhaseByIndex(session.phaseIndex).label.toLowerCase()} to rebuild the idea before adding more pressure again.`;
    } else {
      session.lastAdjustment = `Stay on ${phase.label.toLowerCase()} and repair the missing idea before going deeper.`;
    }
  }

  return updated;
}

export function arenaPublicState(user) {
  const normalized = ensureArenaState(user);
  const arena = ensureArenaContainer(normalized);
  const readiness = arenaReadiness(normalized);
  const session = arena.activeSession;
  const activePlan = session ? arenaRoundPlan(normalized) : null;

  return {
    readiness,
    stats: {
      roundsPlayed: arena.roundsPlayed ?? 0,
      roundsCleared: arena.roundsCleared ?? 0,
      sessionsCompleted: arena.sessionsCompleted ?? 0,
      clearRate:
        (arena.roundsPlayed ?? 0) > 0
          ? Number(((arena.roundsCleared / arena.roundsPlayed) * 100).toFixed(0))
          : 0,
      currentStreak: arena.currentStreak ?? 0,
      bestStreak: arena.bestStreak ?? 0,
      highestPhase:
        (arena.highestPhaseCleared ?? 0) > 0
          ? ARENA_PHASES[(arena.highestPhaseCleared ?? 1) - 1]?.label ?? "Settle The Idea"
          : "No phase cleared yet",
    },
    focus: normalized.weakestSkillId
      ? {
          skillId: normalized.weakestSkillId,
          label: SKILLS[normalized.weakestSkillId].label,
          mastery: masteryForSkillState(normalized.weakestSkillId, normalized.skills[normalized.weakestSkillId]),
          repairLessonSlug: arenaRepairLessonSlug(normalized.weakestSkillId),
        }
      : null,
    activeSession: session
      ? {
          id: session.id,
          status: session.status,
          startedAt: session.startedAt,
          completedAt: session.completedAt ?? null,
          roundNumber: session.roundNumber,
          trackId: session.trackId,
          trackLabel: activePlan?.track?.label ?? arenaTrackById(session.trackId)?.label ?? "Arena set",
          focusReason: session.focusReason,
          lastAdjustment: session.lastAdjustment ?? "",
          skill: {
            id: session.skillId,
            label: SKILLS[session.skillId].label,
            stageLabel: STAGE_LABELS[SKILLS[session.skillId].owningStage] ?? `Stage ${SKILLS[session.skillId].owningStage}`,
            summary: SKILLS[session.skillId].summary,
            repairLessonSlug: arenaRepairLessonSlug(session.skillId),
          },
          phase: activePlan
            ? {
                id: activePlan.phase.id,
                label: activePlan.phase.label,
                summary: activePlan.phase.summary,
              }
            : null,
          phaseProgress: phaseProgress(session),
          activeRound: sanitizeProbeForClient(session.activeRound),
          transcript: clip(session.transcript ?? [], ARENA_TRANSCRIPT_LIMIT),
          averageScore:
            (session.scoreCount ?? 0) > 0
              ? Number(((session.scoreTotal ?? 0) / session.scoreCount).toFixed(2))
              : 0,
        }
      : null,
    lastSession: arena.lastSession,
    sessionHistory: clip(arena.sessionHistory ?? [], ARENA_SESSION_HISTORY_LIMIT),
    canStartFresh: readiness.ready && (!session || session.status !== "active" || !session.activeRound),
  };
}
