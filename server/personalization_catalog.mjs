export const MAX_USERS = 5;

export const LEVEL_ORDER = ["recognition", "recall", "explanation", "transfer", "pressure"];
export const SURFACE_LEVELS = ["recognition", "recall"];
export const REASONING_LEVELS = ["explanation", "transfer", "pressure"];
export const LESSON_ORDER = [
  "00-study-method",
  "01-load-latency-and-data-shape",
  "02-storage-partitioning-and-replication",
  "03-consistency-ordering-idempotency-and-transactions",
  "04-async-caching-failure-handling-and-operability",
  "05-the-interview-framework-7-plus-1-and-lgtc",
  "06-archetypes-and-component-maps",
  "07-hybrid-systems-and-guided-walkthroughs",
  "08-drill-order-and-mock-interview-prep",
];
export const LESSON_INDEX_BY_SLUG = Object.freeze(
  Object.fromEntries(LESSON_ORDER.map((slug, index) => [slug, index])),
);

export const PROBE_LEVEL_GUIDANCE = {
  recognition:
    "Use a short cold question that checks whether the learner can hear the right distinction before naming tools.",
  recall:
    "Use a short prompt that asks for the course's spoken opening move or framing, not a glossary definition.",
  explanation:
    "Ask the learner to explain why a choice or boundary exists in interviewer language, using cause and consequence.",
  transfer:
    "Ask the learner to carry the same idea into a different system and justify what changes or stays the same.",
  pressure:
    "Apply an edge case, constraint, tradeoff, or failure scenario and ask what breaks first or what choice now changes.",
};

export const STAGE_LABELS = {
  1: "Stage 1 - Make one idea speakable",
  2: "Stage 2 - Make the opening stable",
  3: "Stage 3 - Make a clean archetype feel earned",
  4: "Stage 4 - Split mixed products by path",
  5: "Stage 5 - Add the clock and constraints",
};

export const UNDERSTANDING_WEIGHTS = {
  recognition: 0.15,
  recall: 0.12,
  explanation: 0.28,
  transfer: 0.22,
  pressure: 0.23,
};

export const SURFACE_UNDERSTANDING_GAP_ALLOWANCE = 0.18;
export const SURFACE_UNDERSTANDING_PENALTY = 0.18;

export const PROBE_UPDATE_WEIGHTS = {
  recognition: 0.32,
  recall: 0.38,
  explanation: 0.5,
  transfer: 0.58,
  pressure: 0.58,
};

export const PROBE_CONFIDENCE_GAINS = {
  recognition: 0.05,
  recall: 0.06,
  explanation: 0.09,
  transfer: 0.1,
  pressure: 0.1,
};

export const QUIZ_SIGNAL_WEIGHTS = {
  recognition: 0.12,
  recall: 0.04,
  confidence: 0.02,
};

export const LEVEL_TARGETS = {
  recognition: 0.52,
  recall: 0.55,
  explanation: 0.58,
  transfer: 0.64,
  pressure: 0.7,
};

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function averageForLevels(skillState, levels) {
  if (levels.length === 0) {
    return 0;
  }

  const total = levels.reduce((sum, level) => sum + (skillState[level] ?? 0), 0);
  return total / levels.length;
}

export const SKILLS = {
  pressure_reading: {
    id: "pressure_reading",
    label: "Pressure reading",
    owningStage: 1,
    introducedInLesson: 1,
    teacherSystems: ["Slack", "WhatsApp", "Twitter/X Feed"],
    teacherFocus:
      "Hear the dominant stress before components, and say it in interview language with pressure, latency, fanout, or skew made explicit.",
    summary: "Can the learner hear the dominant pressure before naming boxes?",
    weakSpot: "You are still describing systems by components before naming the real stress.",
    nextAction: "Redo one short pressure read aloud before moving back into full design answers.",
  },
  query_shape_reasoning: {
    id: "query_shape_reasoning",
    label: "Data and query shape reasoning",
    owningStage: 2,
    introducedInLesson: 2,
    teacherSystems: ["YouTube", "Elasticsearch / Internal Document Search", "Datadog (Metrics Platform)"],
    teacherFocus:
      "Explain when data shape and query shape become design-driving, and connect them to storage or indexing pressure without hand-waving.",
    summary: "Can the learner tell when data shape or query shape becomes design-driving?",
    weakSpot: "The +1 bridge is still fuzzy, so storage and indexing choices sound generic.",
    nextAction: "Compare one light +1 case and one heavy +1 case before doing another full opening.",
  },
  transactional_correctness: {
    id: "transactional_correctness",
    label: "Transactional correctness",
    owningStage: 1,
    introducedInLesson: 3,
    teacherSystems: ["Stripe (Payments)", "Airbnb", "DoorDash Dispatch"],
    teacherFocus:
      "Name the narrow correctness boundary, explain retry safety, and justify idempotency, transaction scope, and side-effect discipline.",
    summary: "Can the learner explain retry safety, correctness boundaries, and side-effect discipline?",
    weakSpot: "You are naming payments concepts without proving retry safety and business correctness.",
    nextAction: "Drill idempotency, transaction boundary, and outbox on Stripe before another mock.",
  },
  opening_discipline: {
    id: "opening_discipline",
    label: "Opening discipline",
    owningStage: 2,
    introducedInLesson: 5,
    teacherSystems: ["Slack", "WhatsApp", "YouTube"],
    teacherFocus:
      "Run the 7+1 and LGTC before architecture, and keep the spoken opening disciplined under interview pressure.",
    summary: "Can the learner finish 7+1 plus LGTC before jumping to architecture?",
    weakSpot: "Your opening is still collapsing into components before the design ask is read clearly.",
    nextAction: "Run a component-ban opening drill and stop as soon as a box appears too early.",
  },
  archetype_recognition: {
    id: "archetype_recognition",
    label: "Archetype recognition",
    owningStage: 3,
    introducedInLesson: 6,
    teacherSystems: ["WhatsApp", "YouTube", "Stripe (Payments)", "Datadog (Metrics Platform)"],
    teacherFocus:
      "Name the dominant archetype only after the read is earned, and justify the label from pressure rather than product branding.",
    summary: "Can the learner justify the dominant system shape from stress rather than brand?",
    weakSpot: "The archetype label still sounds guessed from the product name instead of earned from the read.",
    nextAction: "Say the dominant stress first, then name the archetype and the tradeoff it pulls in.",
  },
  hybrid_path_ownership: {
    id: "hybrid_path_ownership",
    label: "Hybrid path ownership",
    owningStage: 4,
    introducedInLesson: 7,
    teacherSystems: ["YouTube", "Airbnb", "Instagram"],
    teacherFocus:
      "Split products by meaningful paths and state which archetype owns the write path, the read path, and what stays secondary.",
    summary: "Can the learner split real products by path without flattening or over-splitting?",
    weakSpot: "Mixed products are still being blurred into one label or over-split into fake co-owners.",
    nextAction: "Re-split the product by write path and main read path, then split again only if pressure truly changes.",
  },
  tradeoff_articulation: {
    id: "tradeoff_articulation",
    label: "Tradeoff articulation",
    owningStage: 3,
    introducedInLesson: 6,
    teacherSystems: ["WhatsApp", "Stripe (Payments)", "Google Docs", "YouTube"],
    teacherFocus:
      "Make the learner name both sides of a choice, what they gain, what they pay, and the strongest argument for the path not chosen.",
    summary: "Can the learner name both sides of a choice and defend one clearly?",
    weakSpot: "You are naming preferred choices without proving you understand the strongest alternative.",
    nextAction: "Redo one system answer as a tradeoff comparison, not just a chosen design.",
  },
  failure_mode_clarity: {
    id: "failure_mode_clarity",
    label: "Failure mode clarity",
    owningStage: 5,
    introducedInLesson: 4,
    teacherSystems: ["Airbnb", "WhatsApp", "Datadog (Metrics Platform)", "Uber Dispatch"],
    teacherFocus:
      "End with a mechanism-level failure mode, not vague scale language, and explain what breaks first and why.",
    summary: "Can the learner say what breaks first with a concrete mechanism instead of vague scale language?",
    weakSpot: "Your endings still say 'scale' or 'downtime' instead of one instrumentable failure mechanism.",
    nextAction: "Name one concrete first failure and why it appears before the rest of the system falls over.",
  },
};

export const SKILL_IDS = Object.keys(SKILLS);

export const QUIZ_SKILL_TAGS = {
  "01-load-latency-and-data-shape": ["pressure_reading"],
  "02-storage-partitioning-and-replication": ["query_shape_reasoning"],
  "03-consistency-ordering-idempotency-and-transactions": ["transactional_correctness"],
  "04-async-caching-failure-handling-and-operability": ["failure_mode_clarity"],
  "05-the-interview-framework-7-plus-1-and-lgtc": ["opening_discipline", "query_shape_reasoning"],
  "06-archetypes-and-component-maps": ["archetype_recognition", "tradeoff_articulation"],
  "07-hybrid-systems-and-guided-walkthroughs": ["hybrid_path_ownership"],
  "08-drill-order-and-mock-interview-prep": ["opening_discipline", "failure_mode_clarity"],
};

export function isTrackedLessonSlug(slug) {
  const lessonIndex = LESSON_INDEX_BY_SLUG[slug];
  return Number.isInteger(lessonIndex) && lessonIndex > 0 && (QUIZ_SKILL_TAGS[slug] ?? []).length > 0;
}

export function trackedCompletedLessonIndexes(chapterProgress = {}) {
  return Object.entries(chapterProgress)
    .filter(([slug, progress]) => isTrackedLessonSlug(slug) && Boolean(progress?.completedAt))
    .map(([slug]) => LESSON_INDEX_BY_SLUG[slug])
    .filter((index) => Number.isInteger(index))
    .sort((left, right) => left - right);
}

export function countTrackedCompletedLessons(chapterProgress = {}) {
  return trackedCompletedLessonIndexes(chapterProgress).length;
}

export function highestTrackedLessonOrder(chapterProgress = {}) {
  const indexes = trackedCompletedLessonIndexes(chapterProgress);
  return indexes.length ? Math.max(...indexes) : 0;
}

export function countsAsTrackedLearningEvidence(item) {
  if (!item || typeof item !== "object") {
    return false;
  }

  if (item.type === "quiz") {
    return isTrackedLessonSlug(item.slug);
  }

  return item.type === "probe" || item.type === "chapter-mastery" || item.type === "arena-round";
}

export const PROBE_BANK = [
  {
    id: "pressure-reading-recognition",
    skillId: "pressure_reading",
    level: "recognition",
    format: "mcq",
    prompt: "Which opening sounds more like a pressure-first read?",
    options: [
      "For chat, I would probably start with Kafka, Redis, SQL storage, and WebSockets.",
      "Before naming components, I want to know whether fanout, latency, correctness, or something else is the main pressure here.",
      "The answer depends entirely on whether the company prefers microservices.",
      "I would start with caching because latency is always the hardest part.",
    ],
    answerIndex: 1,
    explanation:
      "The course trains pressure-first reading before architecture. The second answer extracts the force shaping the design.",
  },
  {
    id: "pressure-reading-explanation",
    skillId: "pressure_reading",
    level: "explanation",
    format: "text",
    prompt: "In 2-4 sentences, explain the dominant pressure in 'Design large group chat' without naming components.",
    expectedConcepts: ["fanout", "latency", "ordering", "group", "pressure"],
    qualitySignals: ["because", "before", "dominant", "main"],
    antiPatterns: ["kafka", "redis", "websocket", "database", "microservice"],
  },
  {
    id: "query-shape-recognition",
    skillId: "query_shape_reasoning",
    level: "recognition",
    format: "mcq",
    prompt: "Why does the framework call the last opening question '+1' instead of a flat 8?",
    options: [
      "Because the framework really has only seven questions and the last one is decorative.",
      "Because data shape and query shape stay light in some design asks and become central in others.",
      "Because the eighth question is only for database engineers.",
      "Because the eighth question is asked only after the component diagram is complete.",
    ],
    answerIndex: 1,
    explanation:
      "The +1 is the conditional bridge into data and query-shape reasoning. Its weight changes with the design ask.",
  },
  {
    id: "query-shape-transfer",
    skillId: "query_shape_reasoning",
    level: "transfer",
    format: "text",
    prompt:
      "Compare Slack live messaging with YouTube uploads. Why does the data/query-shape question stay lighter in one and get heavier in the other?",
    expectedConcepts: ["slack", "youtube", "data shape", "query shape", "blob", "index", "search"],
    qualitySignals: ["because", "while", "heavier", "lighter", "drives"],
    antiPatterns: ["it depends", "use sql", "use nosql"],
  },
  {
    id: "transactional-recognition",
    skillId: "transactional_correctness",
    level: "recognition",
    format: "mcq",
    prompt: "What failure does idempotency primarily protect against in payments?",
    options: [
      "Users seeing stale analytics dashboards",
      "Duplicate business execution after retries or timeouts",
      "Search indexes becoming slightly stale",
      "A CDN missing a cache warm-up event",
    ],
    answerIndex: 1,
    explanation:
      "Idempotency is about retry safety on correctness-critical paths, especially when timeouts happen around already-committed work.",
  },
  {
    id: "transactional-explanation",
    skillId: "transactional_correctness",
    level: "explanation",
    format: "text",
    prompt: "Explain why Stripe needs idempotency and an outbox in a retry-heavy world.",
    expectedConcepts: ["retry", "duplicate", "idempotency", "outbox", "side effect", "commit"],
    qualitySignals: ["because", "after", "before", "avoid", "prevent"],
    antiPatterns: ["eventually consistent", "kafka first", "just use exactly once"],
  },
  {
    id: "opening-discipline-recall",
    skillId: "opening_discipline",
    level: "recall",
    format: "mcq",
    prompt: "What should happen before you name Kafka, Redis, or a database in a system-design interview answer?",
    options: [
      "State the 7+1 read and compress it into LGTC first",
      "Estimate global QPS and storage numbers first every time",
      "Pick the archetype from the company name",
      "Draw the write path immediately so the interviewer sees momentum",
    ],
    answerIndex: 0,
    explanation:
      "Component choices become defensible only after the opening extracts the real pressure and guarantees.",
  },
  {
    id: "opening-discipline-pressure",
    skillId: "opening_discipline",
    level: "pressure",
    format: "text",
    prompt:
      "Give a 3-5 sentence opening for 'Design Slack' that stops before components and sounds interview-ready.",
    expectedConcepts: ["user", "fanout", "latency", "ordering", "search", "lgtc", "pressure"],
    qualitySignals: ["before", "dominant", "matters", "while", "hot path"],
    antiPatterns: ["kafka", "redis", "websocket", "database", "microservice"],
  },
  {
    id: "archetype-recognition-recognition",
    skillId: "archetype_recognition",
    level: "recognition",
    format: "mcq",
    prompt: "Which design ask most strongly smells like the transactional / ledger archetype?",
    options: [
      "One send may fan out to many recipients and per-conversation ordering matters.",
      "Wrong money movement is worse than slow responses, retries happen, and auditability matters.",
      "Large blobs are uploaded, transformed, and served from the edge.",
      "Users query a corpus under a tight relevance and latency budget.",
    ],
    answerIndex: 1,
    explanation:
      "Transactional / ledger systems are dominated by correctness, retry safety, and audit-friendly state changes.",
  },
  {
    id: "archetype-recognition-explanation",
    skillId: "archetype_recognition",
    level: "explanation",
    format: "text",
    prompt: "Why does YouTube's upload path smell like media before it smells like discovery?",
    expectedConcepts: ["upload", "blob", "transcode", "storage", "edge", "discovery", "path"],
    qualitySignals: ["because", "before", "dominates", "write path"],
    antiPatterns: ["youtube is media because it is video", "company", "brand"],
  },
  {
    id: "hybrid-recognition",
    skillId: "hybrid_path_ownership",
    level: "recognition",
    format: "mcq",
    prompt: "What makes a product a hybrid system in this course?",
    options: [
      "It uses both SQL and NoSQL.",
      "It has important paths owned by different archetypes.",
      "It has both mobile and web clients.",
      "It has many teams and many services.",
    ],
    answerIndex: 1,
    explanation:
      "Hybrid is about path ownership, not technology count or organization chart complexity.",
  },
  {
    id: "hybrid-transfer",
    skillId: "hybrid_path_ownership",
    level: "transfer",
    format: "text",
    prompt: "Split YouTube into path owners. Name the write path owner, the main read-path owners, and one thing that should stay secondary.",
    expectedConcepts: ["write path", "upload", "media", "discovery", "playback", "secondary", "path"],
    qualitySignals: ["owner", "while", "secondary", "because"],
    antiPatterns: ["everything", "all are equal", "one big system"],
  },
  {
    id: "tradeoff-recognition",
    skillId: "tradeoff_articulation",
    level: "recognition",
    format: "mcq",
    prompt: "What makes a tradeoff explanation strong?",
    options: [
      "It states your preferred choice and omits the weaker alternative.",
      "It names both sides, says what you gain, what you pay, and why the chosen side fits here.",
      "It lists two technologies without discussing consequences.",
      "It avoids costs so the answer sounds decisive.",
    ],
    answerIndex: 1,
    explanation:
      "A tradeoff is only clear when both sides and the paid cost are visible.",
  },
  {
    id: "tradeoff-pressure",
    skillId: "tradeoff_articulation",
    level: "pressure",
    format: "text",
    prompt: "For WhatsApp group delivery, defend at-least-once versus exactly-once and name the strongest argument for the side you did not choose.",
    expectedConcepts: ["at-least-once", "exactly-once", "dedup", "cost", "delivery", "tradeoff"],
    qualitySignals: ["because", "however", "cost", "alternative", "choose"],
    antiPatterns: ["best practice", "always", "never"],
  },
  {
    id: "failure-mode-recognition",
    skillId: "failure_mode_clarity",
    level: "recognition",
    format: "mcq",
    prompt: "Which answer names a real failure mode instead of vague 'scale issues'?",
    options: [
      "The system may have downtime if traffic grows.",
      "A large group message can create fanout amplification that overloads receiver delivery workers first.",
      "Performance may get worse in distributed systems.",
      "Something might bottleneck at high scale.",
    ],
    answerIndex: 1,
    explanation:
      "A strong failure mode names the concrete mechanism and where it shows up first.",
  },
  {
    id: "failure-mode-pressure",
    skillId: "failure_mode_clarity",
    level: "pressure",
    format: "text",
    prompt: "What breaks first in Airbnb booking if you get the scarce-state boundary wrong? Answer in 2-4 sentences.",
    expectedConcepts: ["double booking", "scarce", "reservation", "boundary", "conflict", "race"],
    qualitySignals: ["first", "because", "if", "before"],
    antiPatterns: ["scale issues", "downtime", "latency only"],
  },
];

export function createDefaultSkillState() {
  return {
    recognition: 0,
    recall: 0,
    explanation: 0,
    transfer: 0,
    pressure: 0,
    confidence: 0,
    hits: 0,
    misses: 0,
    lastEvidenceAt: null,
    lastProbeId: null,
  };
}

export function createDefaultSkills() {
  return Object.fromEntries(SKILL_IDS.map((skillId) => [skillId, createDefaultSkillState()]));
}

export const PROBE_LEVELS_BY_SKILL = Object.freeze(
  Object.fromEntries(
    SKILL_IDS.map((skillId) => [
      skillId,
      LEVEL_ORDER.filter((level) => PROBE_BANK.some((probe) => probe.skillId === skillId && probe.level === level)),
    ]),
  ),
);

export function levelsForSkill(skillId) {
  return PROBE_LEVELS_BY_SKILL[skillId] ?? [];
}

export function masteryForSkillState(skillId, skillState) {
  const measuredLevels = levelsForSkill(skillId);
  const relevantLevels = measuredLevels.length > 0 ? measuredLevels : LEVEL_ORDER;
  const weightTotal =
    relevantLevels.reduce((sum, level) => sum + (UNDERSTANDING_WEIGHTS[level] ?? 0), 0) || 1;

  const weightedBase =
    relevantLevels.reduce(
      (sum, level) => sum + (skillState[level] ?? 0) * (UNDERSTANDING_WEIGHTS[level] ?? 0),
      0,
    ) / weightTotal;

  const surfaceLevels = relevantLevels.filter((level) => SURFACE_LEVELS.includes(level));
  const reasoningLevels = relevantLevels.filter((level) => REASONING_LEVELS.includes(level));

  let penalty = 0;
  if (surfaceLevels.length > 0 && reasoningLevels.length > 0) {
    const surfaceAverage = averageForLevels(skillState, surfaceLevels);
    const reasoningAverage = averageForLevels(skillState, reasoningLevels);
    const overshoot = surfaceAverage - reasoningAverage - SURFACE_UNDERSTANDING_GAP_ALLOWANCE;

    if (overshoot > 0) {
      penalty = overshoot * SURFACE_UNDERSTANDING_PENALTY;
    }
  }

  return Number(clamp(weightedBase - penalty).toFixed(3));
}

export function findProbe(probeId) {
  return PROBE_BANK.find((probe) => probe.id === probeId) ?? null;
}
