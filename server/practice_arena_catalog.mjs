import {
  LESSON_ORDER,
  PROBE_LEVEL_GUIDANCE,
  SKILLS,
  SKILL_IDS,
  highestTrackedLessonOrder,
  levelsForSkill,
} from "./personalization_catalog.mjs";

export const ARENA_TRANSCRIPT_LIMIT = 20;
export const ARENA_SESSION_HISTORY_LIMIT = 8;

export const ARENA_TRACKS = [
  {
    id: "foundation",
    label: "Foundation Reps",
    unlockLesson: 1,
    description:
      "Read the system cleanly before architecture. This track trains pressure, access shape, correctness boundary, and truthful hot-path thinking.",
    skillIds: ["pressure_reading", "query_shape_reasoning", "transactional_correctness", "failure_mode_clarity"],
  },
  {
    id: "framework",
    label: "Framework Run",
    unlockLesson: 5,
    description:
      "Keep the opening disciplined. This track forces 7+1 and LGTC language before boxes, even when the prompt feels familiar.",
    skillIds: ["opening_discipline"],
  },
  {
    id: "shape",
    label: "Shape And Tradeoffs",
    unlockLesson: 6,
    description:
      "Earn the system shape from pressure, then defend the tradeoff it naturally pulls in.",
    skillIds: ["archetype_recognition", "tradeoff_articulation"],
  },
  {
    id: "hybrid",
    label: "Hybrid Split",
    unlockLesson: 7,
    description:
      "Split mixed products by path ownership without flattening everything into one label or over-splitting decorative sub-systems.",
    skillIds: ["hybrid_path_ownership"],
  },
  {
    id: "mock",
    label: "Interview Heat",
    unlockLesson: 8,
    description:
      "Mixed adaptive circuits with transfer, pressure, and interviewer-style pushback across the full course.",
    skillIds: SKILL_IDS,
  },
];

export const ARENA_PHASES = [
  {
    id: "settle",
    label: "Settle The Idea",
    shortLabel: "Settle",
    successScore: 0.72,
    levelPreference: ["explanation", "recall", "recognition"],
    guidance:
      "Make the learner say the core idea plainly and causally before any tool or box appears.",
    summary:
      "Start with one clean answer in plain interview language. If the idea cannot be said simply, more pressure would only hide the miss.",
  },
  {
    id: "move",
    label: "Move The Idea",
    shortLabel: "Move",
    successScore: 0.74,
    levelPreference: ["transfer", "explanation", "recall"],
    guidance:
      "Carry the same idea into a different system or path and explain what changes or stays the same.",
    summary:
      "Once the answer is stable, move it into a new context so the learner proves understanding instead of repeating one memorized example.",
  },
  {
    id: "pressure",
    label: "Add Pressure",
    shortLabel: "Pressure",
    successScore: 0.77,
    levelPreference: ["pressure", "transfer", "explanation"],
    guidance:
      "Add one concrete edge case, tradeoff, or failure condition and force the learner to choose what matters first.",
    summary:
      "This is where the arena stops accepting tidy textbook answers and makes the learner survive a realistic constraint.",
  },
  {
    id: "crossfire",
    label: "Hold The Line",
    shortLabel: "Crossfire",
    successScore: 0.8,
    levelPreference: ["pressure", "transfer", "explanation"],
    guidance:
      "Ask as interviewer pushback. The learner must defend the choice, represent the strongest alternative, or name what breaks first.",
    summary:
      "The final phase sounds like an interviewer leaning in. Correct answers still get pressure-tested before the set is cleared.",
  },
];

export const PRODUCTION_CASE_ANCHORS = [
  {
    id: "discord-message-storage",
    label: "Discord message storage migration",
    sourceLabel: "Discord Engineering: How Discord Stores Trillions of Messages",
    sourceUrl: "https://discord.com/blog/how-discord-stores-trillions-of-messages",
    skillIds: ["pressure_reading", "query_shape_reasoning", "failure_mode_clarity"],
    useFor:
      "hot channels, message-history data shape, hot ownership slices, request coalescing, migration pressure",
  },
  {
    id: "cloudflare-waf-outage",
    label: "Cloudflare July 2019 WAF outage",
    sourceLabel: "Cloudflare: Details of the Cloudflare outage on July 2, 2019",
    sourceUrl: "https://blog.cloudflare.com/details-of-the-cloudflare-outage-on-july-2-2019/",
    skillIds: ["pressure_reading", "failure_mode_clarity", "tradeoff_articulation"],
    useFor:
      "CPU saturation, rollout safety, canaries, rollback path, operational access during incidents",
  },
  {
    id: "github-2018-incident",
    label: "GitHub October 2018 incident",
    sourceLabel: "GitHub: October 21 post-incident analysis",
    sourceUrl: "https://github.blog/news-insights/company-news/oct21-post-incident-analysis/",
    skillIds: ["transactional_correctness", "opening_discipline", "failure_mode_clarity"],
    useFor:
      "data integrity over fast recovery, replication topology, stale reads, backlog recovery, LGTC extraction",
  },
  {
    id: "stripe-idempotency",
    label: "Stripe idempotent requests",
    sourceLabel: "Stripe API docs: Idempotent requests",
    sourceUrl: "https://docs.stripe.com/api/idempotent_requests",
    skillIds: ["transactional_correctness", "archetype_recognition", "tradeoff_articulation"],
    useFor:
      "retry safety, idempotency keys, duplicate business effects, transactional archetype language",
  },
  {
    id: "slack-shared-channels",
    label: "Slack shared channels",
    sourceLabel: "Slack Engineering: How Slack Built Shared Channels",
    sourceUrl: "https://slack.engineering/how-slack-built-shared-channels/",
    skillIds: ["query_shape_reasoning", "hybrid_path_ownership", "opening_discipline"],
    useFor:
      "workspace boundary changes, channel ownership, cross-boundary routing, hybrid path ownership",
  },
  {
    id: "netflix-open-connect",
    label: "Netflix Open Connect",
    sourceLabel: "Netflix Open Connect",
    sourceUrl: "https://openconnect.netflix.com/en/",
    skillIds: ["hybrid_path_ownership", "archetype_recognition", "failure_mode_clarity"],
    useFor:
      "edge placement, playback path ownership, cache placement, origin protection, failover-aware delivery",
  },
  {
    id: "uber-h3",
    label: "Uber H3 spatial indexing",
    sourceLabel: "Uber Engineering: H3 Hexagonal Hierarchical Spatial Index",
    sourceUrl: "https://www.uber.com/blog/h3/",
    skillIds: ["query_shape_reasoning", "archetype_recognition", "hybrid_path_ownership"],
    useFor:
      "geo query shape, nearby lookup, dispatch ownership, spatial indexing",
  },
  {
    id: "google-sre-cascades",
    label: "Google SRE cascading failures",
    sourceLabel: "Google SRE Book: Addressing Cascading Failures",
    sourceUrl: "https://sre.google/sre-book/addressing-cascading-failures/",
    skillIds: ["pressure_reading", "failure_mode_clarity", "tradeoff_articulation"],
    useFor:
      "overload feedback loops, retry amplification, resource exhaustion, load shedding",
  },
  {
    id: "google-bigtable",
    label: "Google Bigtable",
    sourceLabel: "Google Research: Bigtable",
    sourceUrl: "https://research.google/pubs/bigtable-a-distributed-storage-system-for-structured-data/",
    skillIds: ["query_shape_reasoning", "archetype_recognition"],
    useFor:
      "large structured storage, data layout, locality, access-pattern-driven storage choices",
  },
  {
    id: "google-spanner",
    label: "Google Spanner",
    sourceLabel: "Google Research: Spanner",
    sourceUrl: "https://research.google/pubs/spanner-googles-globally-distributed-database/",
    skillIds: ["transactional_correctness", "tradeoff_articulation"],
    useFor:
      "globally distributed consistency, coordination cost, correctness boundaries across regions",
  },
];

const trackLookup = Object.freeze(Object.fromEntries(ARENA_TRACKS.map((track) => [track.id, track])));
const phaseLookup = Object.freeze(Object.fromEntries(ARENA_PHASES.map((phase) => [phase.id, phase])));

export function arenaTrackById(trackId) {
  return trackLookup[trackId] ?? null;
}

export function arenaPhaseById(phaseId) {
  return phaseLookup[phaseId] ?? null;
}

export function arenaPhaseByIndex(index) {
  return ARENA_PHASES[index] ?? ARENA_PHASES[0];
}

export function productionCaseAnchorsForSkill(skillId, limit = 3) {
  return PRODUCTION_CASE_ANCHORS.filter((anchor) => anchor.skillIds.includes(skillId)).slice(0, limit);
}

export function highestTrackedLessonForArena(user) {
  return highestTrackedLessonOrder(user?.chapterProgress ?? {});
}

export function unlockedArenaTracks(user) {
  const highestLesson = highestTrackedLessonForArena(user);
  return ARENA_TRACKS.filter((track) => highestLesson >= track.unlockLesson);
}

export function highestUnlockedArenaTrack(user) {
  return unlockedArenaTracks(user).at(-1) ?? null;
}

export function nextArenaTrack(user) {
  const highestLesson = highestTrackedLessonForArena(user);
  return ARENA_TRACKS.find((track) => highestLesson < track.unlockLesson) ?? null;
}

export function preferredArenaLevel(skillId, phaseId) {
  const phase = arenaPhaseById(phaseId) ?? ARENA_PHASES[0];
  const available = levelsForSkill(skillId);
  if (available.length === 0) {
    return "recognition";
  }

  for (const level of phase.levelPreference) {
    if (available.includes(level)) {
      return level;
    }
  }

  return available.at(-1) ?? available[0];
}

export function arenaTrackForSkill(skillId, user) {
  const unlocked = unlockedArenaTracks(user);
  const match = unlocked.filter((track) => track.skillIds.includes(skillId)).at(-1);
  return match ?? highestUnlockedArenaTrack(user);
}

export function arenaReadiness(user) {
  const highestLesson = highestTrackedLessonForArena(user);
  const unlocked = unlockedArenaTracks(user);
  const nextTrack = nextArenaTrack(user);
  const ready = unlocked.length > 0;

  return {
    ready,
    highestLesson,
    highestTrack: unlocked.at(-1) ?? null,
    nextTrack,
    unlockedTracks: unlocked,
    trackCards: ARENA_TRACKS.map((track) => ({
      id: track.id,
      label: track.label,
      description: track.description,
      unlockLesson: track.unlockLesson,
      unlocked: highestLesson >= track.unlockLesson,
      current: unlocked.at(-1)?.id === track.id,
    })),
    entryCopy: ready
      ? "The arena is live. Each set begins at the weakest useful layer for this reader, then adds transfer, pressure, and interviewer pushback only after the answer earns it."
      : "Finish lesson 01 and its quiz first. The arena starts only after the course has one real chapter checkpoint to build on.",
    nextUnlockCopy: nextTrack
      ? `Complete lesson ${String(nextTrack.unlockLesson).padStart(2, "0")} to unlock ${nextTrack.label.toLowerCase()}.`
      : "All arena tracks are unlocked for this reader.",
  };
}

export function arenaRepairLessonSlug(skillId) {
  const lessonOrder = SKILLS[skillId]?.introducedInLesson;
  return Number.isInteger(lessonOrder) ? LESSON_ORDER[lessonOrder] ?? null : null;
}

export function arenaLevelGuidance(skillId, phaseId) {
  const level = preferredArenaLevel(skillId, phaseId);
  return PROBE_LEVEL_GUIDANCE[level] ?? "Ask for a concrete answer in interview language.";
}
