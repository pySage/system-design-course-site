import crypto from "node:crypto";
import { SKILLS, masteryForSkillState } from "./personalization_catalog.mjs";
import {
  MOCK_PHASES,
  MOCK_RUBRIC,
  MOCK_SESSION_HISTORY_LIMIT,
  MOCK_TRANSCRIPT_LIMIT,
  chooseMockFocus,
  mockPhaseByIndex,
  mockProblemById,
  targetForMockPhase,
} from "./mock_interview_catalog.mjs";
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

function defaultMockState() {
  return {
    sessionsStarted: 0,
    sessionsCompleted: 0,
    activeSession: null,
    lastSession: null,
    sessionHistory: [],
  };
}

function ensureMockContainer(user) {
  user.mockInterviews ??= defaultMockState();
  user.mockInterviews.sessionHistory ??= [];
  return user.mockInterviews;
}

function pushTranscript(session, item) {
  session.transcript = clip([...(session.transcript ?? []), item], MOCK_TRANSCRIPT_LIMIT);
}

function averageScore(session) {
  return (session.scoreCount ?? 0) > 0
    ? Number(((session.scoreTotal ?? 0) / session.scoreCount).toFixed(2))
    : 0;
}

function dimensionScore(session, dimension) {
  const evaluations = (session.evaluations ?? []).filter((item) =>
    dimension.skillIds.includes(item.skillId),
  );

  if (evaluations.length === 0) {
    return 1;
  }

  const average = evaluations.reduce((sum, item) => sum + item.score, 0) / evaluations.length;
  if (average >= 0.78) return 3;
  if (average >= 0.55) return 2;
  return 1;
}

function rubricSummary(session) {
  return MOCK_RUBRIC.map((dimension) => ({
    id: dimension.id,
    label: dimension.label,
    description: dimension.description,
    score: dimensionScore(session, dimension),
  }));
}

function summarizeSession(session) {
  const rubric = rubricSummary(session);
  const total = rubric.reduce((sum, item) => sum + item.score, 0);
  const lowest = [...rubric].sort((left, right) => left.score - right.score)[0] ?? null;

  return {
    id: session.id,
    status: session.status,
    problemLabel: session.problemLabel,
    problemPrompt: session.problemPrompt,
    focusSkillId: session.focusSkillId,
    focusSkillLabel: SKILLS[session.focusSkillId]?.label ?? session.focusSkillId,
    startedAt: session.startedAt,
    completedAt: session.completedAt ?? null,
    turns: session.evaluations?.length ?? 0,
    averageScore: averageScore(session),
    rubric,
    total,
    maxTotal: rubric.length * 3,
    weakestDimension: lowest
      ? {
          id: lowest.id,
          label: lowest.label,
          score: lowest.score,
        }
      : null,
    nextRepairMove:
      session.lastEvaluation?.nextRepairMove ??
      (lowest ? `Repair ${lowest.label.toLowerCase()} before the next full mock.` : "Run another adaptive mock."),
  };
}

function phaseProgress(session) {
  return MOCK_PHASES.map((phase, index) => ({
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

export function ensureMockInterviewState(user) {
  const updated = clone(user);
  ensureMockContainer(updated);
  return updated;
}

export function startMockInterview(user) {
  const updated = ensureMockInterviewState(user);
  const mock = ensureMockContainer(updated);

  if (mock.activeSession?.status === "active" && mock.activeSession?.activeProbe) {
    return updated;
  }

  const focus = chooseMockFocus(updated);
  const startedAt = nowIso();
  mock.sessionsStarted += 1;
  mock.activeSession = {
    id: crypto.randomUUID(),
    status: "active",
    startedAt,
    completedAt: null,
    lastUpdatedAt: startedAt,
    problemId: focus.problem.id,
    problemLabel: focus.problem.label,
    problemPrompt: focus.problem.prompt,
    focusSkillId: focus.skillId,
    currentSkillId: focus.skillId,
    focusReason: focus.reason,
    phaseIndex: 0,
    turnNumber: 1,
    activeProbe: null,
    clearedPhaseIds: [],
    transcript: [
      {
        id: crypto.randomUUID(),
        role: "assistant",
        type: "problem",
        content: `${focus.problem.prompt}\n\nYou drive the interview. Start with clarification and the first pressure read.`,
        createdAt: startedAt,
      },
    ],
    evaluations: [],
    scoreTotal: 0,
    scoreCount: 0,
    lastEvaluation: null,
    lastAdjustment: "",
  };

  return updated;
}

export function mockInterviewPlan(user) {
  const normalized = ensureMockInterviewState(user);
  const session = normalized.mockInterviews.activeSession;

  if (!session || session.status !== "active") {
    return null;
  }

  const phase = mockPhaseByIndex(session.phaseIndex ?? 0);
  const problem = mockProblemById(session.problemId);
  const target = targetForMockPhase(session);

  return {
    session,
    phase,
    problem,
    target,
  };
}

export function setMockInterviewActiveProbe(user, probe) {
  const updated = appendProbeHistory(ensureMockInterviewState(user), probe);
  const mock = ensureMockContainer(updated);
  const session = mock.activeSession;
  const phase = mockPhaseByIndex(session?.phaseIndex ?? 0);

  if (!session) {
    return updated;
  }

  session.activeProbe = probe;
  session.lastUpdatedAt = nowIso();
  session.currentSkillId = probe.skillId;
  pushTranscript(session, {
    id: crypto.randomUUID(),
    role: "assistant",
    type: "interviewer",
    phaseId: phase.id,
    phaseLabel: phase.label,
    probeId: probe.id,
    content: probe.prompt,
    createdAt: nowIso(),
  });

  return updated;
}

export function applyMockInterviewTurn(user, answer, evaluation) {
  const activeProbe = user.mockInterviews?.activeSession?.activeProbe;
  const updated = applyProbeEvaluationToHistory(ensureMockInterviewState(user), activeProbe, evaluation, {
    clearActiveProbe: false,
  });
  const mock = ensureMockContainer(updated);
  const session = mock.activeSession;

  if (!session) {
    return updated;
  }

  const phase = mockPhaseByIndex(session.phaseIndex ?? 0);
  const completedAt = nowIso();
  const passed = evaluation.score >= phase.successScore;

  session.evaluations = [
    ...(session.evaluations ?? []),
    {
      probeId: activeProbe.id,
      skillId: activeProbe.skillId,
      phaseId: phase.id,
      score: evaluation.score,
      passed,
      summary: evaluation.summary,
      misses: evaluation.misses ?? [],
      strengths: evaluation.strengths ?? [],
      createdAt: completedAt,
    },
  ];
  session.scoreTotal = (session.scoreTotal ?? 0) + evaluation.score;
  session.scoreCount = (session.scoreCount ?? 0) + 1;
  session.lastEvaluation = { ...evaluation, passed, phaseId: phase.id, phaseLabel: phase.label };

  pushTranscript(session, {
    id: crypto.randomUUID(),
    role: "user",
    type: "answer",
    phaseId: phase.id,
    phaseLabel: phase.label,
    probeId: activeProbe.id,
    content: String(answer ?? "").trim(),
    createdAt: completedAt,
  });

  pushTranscript(session, {
    id: crypto.randomUUID(),
    role: "assistant",
    type: "feedback",
    phaseId: phase.id,
    phaseLabel: phase.label,
    probeId: activeProbe.id,
    content: evaluation.summary,
    repairExplanation: evaluation.repairExplanation ?? "",
    nextRepairMove: evaluation.nextRepairMove ?? "",
    score: evaluation.score,
    passed,
    strengths: evaluation.strengths ?? [],
    misses: evaluation.misses ?? [],
    createdAt: completedAt,
  });

  session.activeProbe = null;
  session.lastUpdatedAt = completedAt;

  if (passed) {
    session.clearedPhaseIds = [...new Set([...(session.clearedPhaseIds ?? []), phase.id])];
    if ((session.phaseIndex ?? 0) < MOCK_PHASES.length - 1) {
      session.phaseIndex += 1;
      session.lastAdjustment = `Moved into ${mockPhaseByIndex(session.phaseIndex).label.toLowerCase()}.`;
    } else {
      session.status = "completed";
    }
  } else {
    session.currentSkillId = activeProbe.skillId;
    session.lastAdjustment = `Stayed on ${phase.label.toLowerCase()} because the last answer exposed a repair target.`;
  }

  session.turnNumber += 1;
  if (session.turnNumber > 7 && session.status === "active") {
    session.status = "completed";
    session.lastAdjustment = "Ended this mock after enough evidence to score the session.";
  }

  if (session.status === "completed") {
    session.completedAt = completedAt;
    mock.sessionsCompleted += 1;
    mock.lastSession = summarizeSession(session);
    mock.sessionHistory = clip([mock.lastSession, ...(mock.sessionHistory ?? [])], MOCK_SESSION_HISTORY_LIMIT);
  }

  return updated;
}

export function mockInterviewPublicState(user) {
  const normalized = ensureMockInterviewState(user);
  const mock = ensureMockContainer(normalized);
  const session = mock.activeSession;
  const activePlan = mockInterviewPlan(normalized);
  const weakestSkillId = normalized.weakestSkillId ?? normalized.weakSpots?.[0]?.skillId ?? "opening_discipline";

  return {
    readiness: {
      ready: true,
      entryCopy:
        "AI mock interviews are open for signed-in learners and use the learner profile, prior misses, and live answer quality to choose the problem, interrupt, probe, score, and route repair work.",
      lockedCopy: "",
    },
    stats: {
      sessionsStarted: mock.sessionsStarted ?? 0,
      sessionsCompleted: mock.sessionsCompleted ?? 0,
      latestScore: mock.lastSession ? `${mock.lastSession.total}/${mock.lastSession.maxTotal}` : "No score yet",
    },
    focus: {
      skillId: weakestSkillId,
      label: SKILLS[weakestSkillId]?.label ?? "Opening discipline",
      mastery: masteryForSkillState(weakestSkillId, normalized.skills?.[weakestSkillId]),
    },
    activeSession: session
      ? {
          id: session.id,
          status: session.status,
          startedAt: session.startedAt,
          completedAt: session.completedAt ?? null,
          problemLabel: session.problemLabel,
          problemPrompt: session.problemPrompt,
          focusReason: session.focusReason,
          turnNumber: session.turnNumber,
          lastAdjustment: session.lastAdjustment ?? "",
          phase: activePlan
            ? {
                id: activePlan.phase.id,
                label: activePlan.phase.label,
                summary: activePlan.phase.summary,
              }
            : null,
          phaseProgress: phaseProgress(session),
          activeProbe: sanitizeProbeForClient(session.activeProbe),
          transcript: clip(session.transcript ?? [], MOCK_TRANSCRIPT_LIMIT),
          averageScore: averageScore(session),
          summary: session.status === "completed" ? summarizeSession(session) : null,
        }
      : null,
    lastSession: mock.lastSession,
    sessionHistory: clip(mock.sessionHistory ?? [], MOCK_SESSION_HISTORY_LIMIT),
    canStartFresh: !session || session.status !== "active" || !session.activeProbe,
  };
}
