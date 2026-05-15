import { SKILLS, SKILL_IDS, STAGE_LABELS, masteryForSkillState } from "./personalization_catalog.mjs";

export const MOCK_TRANSCRIPT_LIMIT = 28;
export const MOCK_SESSION_HISTORY_LIMIT = 6;

export const MOCK_PHASES = [
  {
    id: "opening",
    label: "Opening",
    shortLabel: "Open",
    successScore: 0.72,
    level: "pressure",
    fallbackSkillId: "opening_discipline",
    summary:
      "Start the interview cold: clarify scope, extract the first pressure read, and keep architecture out until the shape is visible.",
  },
  {
    id: "deep-dive",
    label: "Deep Dive",
    shortLabel: "Dive",
    successScore: 0.74,
    level: "transfer",
    fallbackSkillId: "archetype_recognition",
    summary:
      "The interviewer chooses one path and asks the learner to justify ownership, components, and the first important tradeoff.",
  },
  {
    id: "constraint-change",
    label: "Constraint Change",
    shortLabel: "Shift",
    successScore: 0.76,
    level: "pressure",
    fallbackSkillId: "tradeoff_articulation",
    summary:
      "A new load, latency, correctness, or availability fact appears and the learner must adjust without throwing away the structure.",
  },
  {
    id: "failure-defense",
    label: "Failure Defense",
    shortLabel: "Fail",
    successScore: 0.78,
    level: "pressure",
    fallbackSkillId: "failure_mode_clarity",
    summary:
      "The interview closes by forcing a concrete first failure, visible signal, mitigation, and one honest cost.",
  },
];

export const MOCK_RUBRIC = [
  {
    id: "requirements",
    label: "Requirements",
    skillIds: ["opening_discipline", "pressure_reading"],
    description: "Clarifies users, actions, FR/NFR shape, and scope before architecture.",
  },
  {
    id: "pressure",
    label: "Dominant Stress",
    skillIds: ["pressure_reading", "query_shape_reasoning"],
    description: "Names load, data/query shape, hidden work, and the pressure that changes the first design choice.",
  },
  {
    id: "shape",
    label: "System Shape",
    skillIds: ["archetype_recognition", "hybrid_path_ownership"],
    description: "Earns the archetype and splits write/read/path ownership when the product is mixed.",
  },
  {
    id: "components",
    label: "Components",
    skillIds: ["archetype_recognition", "tradeoff_articulation"],
    description: "Names components only with the stress, guarantee, or failure they protect.",
  },
  {
    id: "tradeoffs",
    label: "Tradeoffs",
    skillIds: ["tradeoff_articulation", "transactional_correctness"],
    description: "Defends one side, represents the alternative, and names the cost.",
  },
  {
    id: "failure",
    label: "Failure Modes",
    skillIds: ["failure_mode_clarity", "transactional_correctness"],
    description: "Explains what breaks first with mechanism-level clarity and a visible signal.",
  },
];

export const MOCK_PROBLEM_BANK = [
  {
    id: "slack-messaging",
    label: "Design Slack messaging",
    prompt: "Design Slack messaging for channels, direct messages, recent history, and live delivery.",
    skillIds: ["opening_discipline", "pressure_reading", "archetype_recognition", "failure_mode_clarity"],
  },
  {
    id: "stripe-payments",
    label: "Design Stripe payments",
    prompt: "Design a Stripe-like payment API that charges customers, records money movement, and notifies merchants.",
    skillIds: ["transactional_correctness", "tradeoff_articulation", "failure_mode_clarity"],
  },
  {
    id: "youtube-upload-playback",
    label: "Design YouTube uploads and playback",
    prompt: "Design YouTube uploads and playback, including upload acceptance, processing, serving, and discovery hooks.",
    skillIds: ["query_shape_reasoning", "hybrid_path_ownership", "archetype_recognition", "tradeoff_articulation"],
  },
  {
    id: "datadog-ingestion",
    label: "Design Datadog metrics ingestion",
    prompt: "Design a Datadog-style metrics platform that ingests telemetry, serves dashboards, evaluates alerts, and manages retention.",
    skillIds: ["query_shape_reasoning", "failure_mode_clarity", "pressure_reading"],
  },
  {
    id: "rideshare-dispatch",
    label: "Design ride-sharing dispatch",
    prompt: "Design a ride-sharing dispatch system that matches riders and drivers in real time.",
    skillIds: ["pressure_reading", "hybrid_path_ownership", "failure_mode_clarity", "tradeoff_articulation"],
  },
  {
    id: "collaborative-docs",
    label: "Design collaborative docs",
    prompt: "Design a collaborative document editor with real-time editing, presence, offline recovery, and shared history.",
    skillIds: ["tradeoff_articulation", "archetype_recognition", "failure_mode_clarity"],
  },
];

export function mockPhaseByIndex(index) {
  return MOCK_PHASES[index] ?? MOCK_PHASES[0];
}

export function mockPhaseById(phaseId) {
  return MOCK_PHASES.find((phase) => phase.id === phaseId) ?? null;
}

export function mockProblemById(problemId) {
  return MOCK_PROBLEM_BANK.find((problem) => problem.id === problemId) ?? null;
}

function rankSkillCandidates(user) {
  return SKILL_IDS.map((skillId) => ({
    skillId,
    mastery: masteryForSkillState(skillId, user.skills?.[skillId]),
    misses: user.skills?.[skillId]?.misses ?? 0,
  })).sort((left, right) => {
    if (left.misses !== right.misses) {
      return right.misses - left.misses;
    }
    return left.mastery - right.mastery;
  });
}

export function chooseMockFocus(user) {
  const weakSpotSkillId = (user.weakSpots ?? [])[0]?.skillId;
  const rankedSkillId = rankSkillCandidates(user)[0]?.skillId;
  const skillId = weakSpotSkillId ?? rankedSkillId ?? "opening_discipline";
  const problem =
    MOCK_PROBLEM_BANK.find((item) => item.skillIds.includes(skillId)) ??
    MOCK_PROBLEM_BANK.find((item) => item.skillIds.includes(user.weakestSkillId)) ??
    MOCK_PROBLEM_BANK[0];

  return {
    skillId,
    problem,
    reason: weakSpotSkillId
      ? `This mock starts from ${SKILLS[skillId].label.toLowerCase()} because that is the learner's current weak spot.`
      : `This mock starts from ${SKILLS[skillId].label.toLowerCase()} because it is the weakest useful signal in the learner profile.`,
  };
}

export function targetForMockPhase(session) {
  const phase = mockPhaseByIndex(session.phaseIndex ?? 0);
  const problem = mockProblemById(session.problemId) ?? MOCK_PROBLEM_BANK[0];
  const rememberedSkillId = session.currentSkillId ?? session.focusSkillId ?? phase.fallbackSkillId;
  const skillId = problem.skillIds.includes(rememberedSkillId)
    ? rememberedSkillId
    : problem.skillIds.includes(phase.fallbackSkillId)
      ? phase.fallbackSkillId
      : problem.skillIds[0] ?? phase.fallbackSkillId;
  const skill = SKILLS[skillId];

  return {
    skillId,
    level: phase.level,
    levelGuidance: `${phase.summary} Ask one interviewer-style follow-up tied to the active problem, not a standalone quiz card.`,
    skillLabel: skill.label,
    stage: skill.owningStage,
    stageLabel: STAGE_LABELS[skill.owningStage] ?? `Stage ${skill.owningStage}`,
    summary: `${phase.label}: ${skill.summary}`,
    phaseId: phase.id,
    phaseLabel: phase.label,
  };
}
