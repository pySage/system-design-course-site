import { SKILLS, STAGE_LABELS } from "./personalization_catalog.mjs";

export const CHAT_SCOPE_COURSE = "course";

function milestoneId(slug, key) {
  return `${slug}.${key}`;
}

function chapter(slug, config) {
  return {
    slug,
    ...config,
    milestones: (config.milestones ?? []).map((milestone) => ({
      successScore: 0.72,
      ...milestone,
      id: milestone.id ?? milestoneId(slug, milestone.key),
    })),
  };
}

export const CHAPTER_COACHES = {
  "00-study-method": chapter("00-study-method", {
    title: "Prelude Coach",
    doubtPlaceholder: "Ask what this course is trying to train, why it starts from pressure, or how to study the material.",
    masteryIntro:
      "This prelude checks whether you can hear the course's basic reasoning habit before the technical chapters begin.",
    masteryUnlockCopy:
      "Finish the lesson check first. The mastery chat then verifies that you can distinguish pressure-first reasoning from component-first pattern matching.",
    masteryDoneCopy:
      "You showed the prelude habit clearly enough. Move into lesson 01 and start applying it on real system pressure.",
    milestones: [
      {
        key: "pressure-first-lens",
        skillId: "pressure_reading",
        level: "recognition",
        label: "Pressure before components",
        objective:
          "Check whether the learner can explain why this course starts from pressure and tradeoffs before boxes.",
        promptHint:
          "Keep the learner in plain language. Ask for the reasoning habit, not for framework jargon.",
        summary: "Can the learner say why pressure-first reasoning produces a better opening than a component-first answer?",
        systemAnchor: "Large group chat",
        fallbackPrompt:
          "Two candidates hear 'Design large group chat.' One gives plausible components like Kafka, Redis, sharding, and WebSockets before naming the pressure. The other starts by asking what pressure makes the system hard. Why is the second opening stronger in this course?",
        expectedConcepts: ["pressure", "before components", "why", "tradeoff", "real stress"],
        qualitySignals: ["because", "before", "instead", "reasoning", "hard part"],
        antiPatterns: ["kafka", "redis", "microservice", "tool list"],
      },
    ],
  }),
  "01-load-latency-and-data-shape": chapter("01-load-latency-and-data-shape", {
    title: "Chapter 01 Coach",
    doubtPlaceholder: "Ask about peaks, p99, fanout, skew, hot keys, data shape, or query shape.",
    masteryIntro:
      "This coach keeps testing whether you can read hidden work, say the pressure cleanly, and separate cause from symptom before reaching for architecture.",
    masteryUnlockCopy:
      "Finish the lesson check first. The mastery chat then tests whether you can say the pressure in interview language, explain why it comes first, and keep data shape separate from query shape.",
    masteryDoneCopy:
      "You showed the chapter-01 read clearly enough: pressure first, symptom second, then the access shape that later drives storage and topology choices.",
    milestones: [
      {
        key: "dominant-pressure",
        skillId: "pressure_reading",
        level: "explanation",
        label: "Name the dominant pressure",
        objective:
          "Check whether the learner can name the hidden work and dominant pressure in one interview-ready opening before any component appears.",
        promptHint:
          "Use a concrete messaging, feed, ticketing, or incident-style scenario. Force the learner to answer in one short line plus one sentence of reasoning, and reward pressure-first language over component language.",
        summary: "Can the learner read fanout, burst, retry amplification, tail pain, or local hotness before boxes?",
        systemAnchor: "Slack",
        fallbackPrompt:
          "A message lands in a giant Slack channel during an incident. Without naming components, answer in one short line plus one sentence: what is the dominant pressure, and why should it come before architecture in your opening?",
        expectedConcepts: ["fanout", "burst", "tail latency", "hot channel", "hidden work", "before components"],
        qualitySignals: ["dominant pressure", "because", "before", "tail", "hot", "fanout"],
        antiPatterns: ["kafka", "redis", "database first", "microservice"],
      },
      {
        key: "pressure-vs-symptom",
        skillId: "pressure_reading",
        level: "transfer",
        label: "Separate pressure from symptom",
        objective:
          "Check whether the learner can step back from a downstream symptom and restate the first-order pressure in cleaner interview language.",
        promptHint:
          "Stay inside chapter 01 language. Ask for the underlying pressure first, then the concrete pain it creates. Do not reward queue or worker talk as the main answer.",
        summary: "Can the learner distinguish burst fanout, skew, retries, or tail pressure from the downstream symptom they cause?",
        systemAnchor: "WhatsApp delivery delay",
        fallbackPrompt:
          "A learner says, 'the queue is full, so that is the main problem.' Repair that answer in chapter-01 language: what is the underlying pressure, and what concrete tail-latency or backlog symptom does it create?",
        expectedConcepts: ["pressure", "symptom", "fanout", "retry", "tail latency", "backlog"],
        qualitySignals: ["underlying", "pressure", "symptom", "because", "creates"],
        antiPatterns: ["kafka", "worker pool", "database", "component fix"],
      },
      {
        key: "data-vs-query-shape",
        skillId: "query_shape_reasoning",
        level: "recognition",
        label: "Separate data shape from query shape",
        objective:
          "Check whether the learner can explain why one product can have one core data form but multiple important read shapes before storage is discussed.",
        promptHint:
          "Stay inside chapter 01 language. Use examples like Slack history, metrics, or uploads. Do not jump into concrete storage selection from chapter 02.",
        summary: "Can the learner separate what the data looks like from how the system needs to read it?",
        systemAnchor: "Slack history search",
        fallbackPrompt:
          "Slack live messaging and Slack history search sit in the same product. In 2-3 sentences, explain why data shape and query shape should be spoken separately before you talk about storage.",
        expectedConcepts: ["data shape", "query shape", "append-heavy history", "recent reads", "search"],
        qualitySignals: ["because", "while", "different", "read", "history", "search"],
        antiPatterns: ["use sql", "use nosql", "it depends", "database"],
      },
      {
        key: "pressure-first-sizing",
        skillId: "pressure_reading",
        level: "transfer",
        label: "Size hidden work",
        objective:
          "Check whether the learner can turn one visible action rate into rough hidden work: fanout, peak multiplier, storage, bandwidth, and hot-key risk.",
        promptHint:
          "Use Slack, notifications, or feed delivery. Reward rough arithmetic only when it starts from pressure and hidden work.",
        summary: "Can the learner size from hidden work per visible action instead of reciting formulas?",
        systemAnchor: "Slack incident channel",
        fallbackPrompt:
          "A Slack incident channel receives 30 message sends per second and has 1,000 active readers. Do a rough pressure-first sizing pass: visible QPS, hidden delivery attempts, bandwidth if messages are 3 KB, and the hot-key risk.",
        expectedConcepts: ["visible QPS", "fanout", "peak", "bandwidth", "hot key", "rough"],
        qualitySignals: ["30", "1000", "delivery", "per second", "hot"],
        antiPatterns: ["exact math only", "database first", "autoscale", "microservices"],
      },
    ],
  }),
  "02-storage-partitioning-and-replication": chapter("02-storage-partitioning-and-replication", {
    title: "Chapter 02 Coach",
    doubtPlaceholder: "Ask about storage families, partition keys, replication, or why one product can need multiple stores.",
    masteryIntro:
      "This coach checks whether you can place data honestly instead of saying 'use a database' and moving on.",
    masteryUnlockCopy:
      "Finish the lesson check first. The mastery chat then tests whether you can justify storage fit from shape and access.",
    masteryDoneCopy:
      "You showed the chapter-02 habit clearly enough: one product can hold several data shapes, and partitioning and replication solve different problems.",
    milestones: [
      {
        key: "multi-store-honesty",
        skillId: "query_shape_reasoning",
        level: "explanation",
        label: "Explain why one product can need multiple stores",
        objective:
          "Check whether the learner can justify different storage families from different data shapes and read paths inside one product.",
        promptHint:
          "Use YouTube or another product with blobs, metadata, search, and analytics. Do not reward brand recitation.",
        summary: "Can the learner explain why blobs, metadata, search views, and analytics paths do not naturally live in one store?",
        systemAnchor: "YouTube",
        fallbackPrompt:
          "Why can YouTube honestly need different storage families for raw video, metadata, search retrieval, and analytics instead of one generic 'database' answer?",
        expectedConcepts: ["blob", "metadata", "search", "analytics", "different shape"],
        qualitySignals: ["because", "different", "read path", "write path", "shape"],
        antiPatterns: ["one database", "use nosql", "use sql", "best practice"],
      },
      {
        key: "partition-locality",
        skillId: "query_shape_reasoning",
        level: "transfer",
        label: "Justify partition locality",
        objective:
          "Check whether the learner can connect a partition key to the unit of work and keep the hot path local.",
        promptHint:
          "Use telemetry, chat history, or another partitioned workload. Make them explain why the key exists, not just what it is.",
        summary: "Can the learner justify a partition key from access locality instead of naming one decoratively?",
        systemAnchor: "Per-device telemetry",
        fallbackPrompt:
          "In a per-device telemetry system, why is 'device ID plus time bucket' stronger reasoning than just saying 'we will shard it'? Explain what work that key keeps local.",
        expectedConcepts: ["partition key", "local", "device", "time bucket", "unit of work"],
        qualitySignals: ["because", "local", "keeps", "together", "hot path"],
        antiPatterns: ["shard it", "scale", "replication", "random key"],
      },
    ],
  }),
  "03-consistency-ordering-idempotency-and-transactions": chapter(
    "03-consistency-ordering-idempotency-and-transactions",
    {
      title: "Chapter 03 Coach",
      doubtPlaceholder: "Ask about consistency scope, ordering boundaries, idempotency, transactions, or outbox reasoning.",
      masteryIntro:
        "This coach keeps testing whether you can draw a narrow correctness boundary instead of asking for the strongest guarantee everywhere.",
      masteryUnlockCopy:
        "Finish the lesson check first. The mastery chat then checks whether your correctness language is narrow, practical, and retry-safe.",
      masteryDoneCopy:
        "You showed the chapter-03 habit clearly enough: narrow correctness, local ordering, retry safety, and practical transaction scope.",
      milestones: [
        {
          key: "narrow-boundary",
          skillId: "transactional_correctness",
          level: "explanation",
          label: "Draw the narrow correctness boundary",
          objective:
            "Check whether the learner can say exactly what state must stay correct before they ask for a stronger guarantee.",
          promptHint:
            "Use booking, payments, or another scarce/correctness-critical case. Force the learner to say what must stay true and why.",
          summary: "Can the learner name the narrow state where wrongness hurts instead of saying 'strong consistency everywhere'?",
          systemAnchor: "Airbnb booking",
          fallbackPrompt:
            "For Airbnb booking, what is the narrow correctness boundary, and why is that narrower than saying 'the whole system needs strong consistency'?",
          expectedConcepts: ["scarce state", "booking", "boundary", "wrongness", "narrow"],
          qualitySignals: ["because", "boundary", "before", "exactly", "must"],
          antiPatterns: ["everywhere", "global consistency", "whole system", "just use serializable"],
        },
        {
          key: "retry-safe-side-effects",
          skillId: "transactional_correctness",
          level: "explanation",
          label: "Explain retry safety",
          objective:
            "Check whether the learner can explain why idempotency and an outbox protect correctness under retries and crashes.",
          promptHint:
            "Use a money-moving or side-effect-heavy flow. Reward the sequence: commit truth first, publish later safely.",
          summary: "Can the learner explain why retries are dangerous without idempotency and why side effects need an outbox boundary?",
          systemAnchor: "Stripe payments",
          fallbackPrompt:
            "A Stripe charge request times out after the core payment state commits. Why are idempotency keys and an outbox stronger reasoning than 'the message bus will handle it'?",
          expectedConcepts: ["retry", "idempotency", "duplicate", "outbox", "side effect"],
          qualitySignals: ["because", "after", "before", "prevent", "commit"],
          antiPatterns: ["exactly once", "kafka solves it", "bus handles it", "eventually consistent"],
        },
      ],
    },
  ),
  "04-async-caching-failure-handling-and-operability": chapter(
    "04-async-caching-failure-handling-and-operability",
    {
      title: "Chapter 04 Coach",
      doubtPlaceholder: "Ask about hot-path truth, deferred work, queues, retries, caching, degradation, or observability.",
      masteryIntro:
        "This coach checks whether you can say what must happen before the response and what can safely wait.",
      masteryUnlockCopy:
        "Finish the lesson check first. The mastery chat then checks whether you can defend the hot path and explain what bending under load looks like.",
      masteryDoneCopy:
        "You showed the chapter-04 habit clearly enough: define the truthful response, move the right work behind it, and say what failure shows up first.",
      milestones: [
        {
          key: "truth-before-async",
          skillId: "failure_mode_clarity",
          level: "explanation",
          label: "Define the truthful response boundary",
          objective:
            "Check whether the learner can say what must complete before an honest success response and what can lag behind it.",
          promptHint:
            "Use YouTube upload or another async-heavy path. Reward clear truth-vs-delay language.",
          summary: "Can the learner separate the truthful response boundary from expensive derived work?",
          systemAnchor: "YouTube upload",
          fallbackPrompt:
            "For a YouTube upload, what must be true before the system can honestly say 'upload succeeded,' and what expensive work can move behind that response?",
          expectedConcepts: ["durable acceptance", "truthful response", "transcode later", "metadata", "async"],
          qualitySignals: ["before", "after", "because", "honestly", "can wait"],
          antiPatterns: ["queue everything", "transcode first", "cdn first", "analytics first"],
        },
        {
          key: "mechanism-not-atmosphere",
          skillId: "failure_mode_clarity",
          level: "pressure",
          label: "Name what breaks first",
          objective:
            "Check whether the learner can name a mechanism-level failure once work is deferred behind a queue or cache.",
          promptHint:
            "Force one concrete failure and why it appears before the whole architecture collapses.",
          summary: "Can the learner end the runtime story with one instrumentable failure mechanism instead of vague 'scale issues'?",
          systemAnchor: "Upload processing backlog",
          fallbackPrompt:
            "A breaking-news spike floods the YouTube transcode queue. What breaks first, and what signal would tell you the deferred pipeline is aging into a real problem?",
          expectedConcepts: ["queue age", "oldest job", "backlog", "retries", "breaks first"],
          qualitySignals: ["because", "first", "signal", "if", "lag"],
          antiPatterns: ["scale issues", "downtime", "latency only", "something bottlenecks"],
        },
      ],
    },
  ),
  "05-the-interview-framework-7-plus-1-and-lgtc": chapter(
    "05-the-interview-framework-7-plus-1-and-lgtc",
    {
      title: "Chapter 05 Coach",
      doubtPlaceholder: "Ask about the design ask, 7+1, LGTC, why 7+1 is not 8, or how to keep the opening disciplined.",
      masteryIntro:
        "This coach checks whether you can keep the interview opening in extraction mode instead of rushing into boxes.",
      masteryUnlockCopy:
        "Finish the lesson check first. The mastery chat then checks whether you can run the opening in spoken interview language.",
      masteryDoneCopy:
        "You showed the chapter-05 habit clearly enough: extract with 7+1, compress into LGTC, and only then let the shape and components follow.",
      milestones: [
        {
          key: "why-7-plus-1",
          skillId: "opening_discipline",
          level: "recall",
          label: "Explain why the framework is 7+1",
          objective:
            "Check whether the learner understands the universal opening spine versus the conditional data/query-shape bridge.",
          promptHint:
            "Do not reward memorized names alone. Make them explain why the +1 changes weight by design ask.",
          summary: "Can the learner explain why the last opening question is a bridge rather than a flat eighth step?",
          systemAnchor: "Design Slack",
          fallbackPrompt:
            "Why does the course call the framework 7+1 instead of 8, and when does the +1 become heavy enough to matter a lot?",
          expectedConcepts: ["universal spine", "+1 bridge", "data shape", "query shape", "weight changes"],
          qualitySignals: ["because", "when", "bridge", "while", "changes"],
          antiPatterns: ["decorative", "optional forever", "database only", "after components"],
        },
        {
          key: "speak-the-opening",
          skillId: "opening_discipline",
          level: "pressure",
          label: "Speak the opening before components",
          objective:
            "Check whether the learner can give a short, interviewer-ready opening that stays disciplined under pressure.",
          promptHint:
            "Force 3-5 spoken sentences. Stop before components. Reward users, pressure, guarantees, topology, and constraints language.",
          summary: "Can the learner speak a clean interview opening without collapsing into components?",
          systemAnchor: "Slack",
          fallbackPrompt:
            "Give a 3-5 sentence opening for 'Design Slack' that stays in 7+1 plus LGTC mode and stops before components.",
          expectedConcepts: ["users", "pressure", "guarantees", "topology", "constraints"],
          qualitySignals: ["before", "dominant", "matters", "while", "hot path"],
          antiPatterns: ["kafka", "redis", "database", "microservice", "component list"],
        },
        {
          key: "api-contract-placement",
          skillId: "opening_discipline",
          level: "transfer",
          label: "Place the API contract",
          objective:
            "Check whether the learner can sketch a small API contract after extraction and tie it to guarantees, retry identity, boundaries, and allowed lag.",
          promptHint:
            "Use Slack message send. The learner should say what the response promises and what it does not promise.",
          summary: "Can the learner make an API sketch reflect LGTC instead of turning it into component theater?",
          systemAnchor: "Slack message send",
          fallbackPrompt:
            "After a 7+1 and LGTC read for Slack, sketch the core POST message API. What retry identity, boundary, response promise, and allowed lag should the contract expose?",
          expectedConcepts: ["API", "client_message_id", "durable accept", "channel", "lag", "boundary"],
          qualitySignals: ["promise", "retry", "accepted", "after", "not delivery"],
          antiPatterns: ["api gateway", "component list", "websocket only", "database schema first"],
        },
        {
          key: "fr-nfr-api-mapping",
          skillId: "opening_discipline",
          level: "transfer",
          label: "Map 7+1 to FR / NFR / API placement",
          objective:
            "Check whether the learner can translate the course opening into functional requirements, non-functional requirements, the +1 data/query read, and API placement.",
          promptHint:
            "An interviewer says: 'before we go further, state your functional and non-functional requirements, then sketch the API.' Make the learner answer in order.",
          summary:
            "Can the learner map scope to FRs, LGTC to NFRs, +1 to data/query shape, and API sketch to post-extraction/pre-architecture?",
          systemAnchor: "Ride-sharing dispatch",
          fallbackPrompt:
            "For ride-sharing dispatch, what does the system do and who uses it, which non-functional pressures matter, what does the +1 cover, and when would you sketch the API?",
          expectedConcepts: [
            "scope",
            "actors",
            "load",
            "guarantees",
            "topology",
            "constraints",
            "data shape",
            "query shape",
            "API after extraction",
          ],
          qualitySignals: ["before estimating", "agreed on what", "after extraction", "before the map"],
          antiPatterns: ["kafka", "redis", "LGTC answers functional", "+1 is API"],
        },
      ],
    },
  ),
  "06-archetypes-and-component-maps": chapter("06-archetypes-and-component-maps", {
    title: "Chapter 06 Coach",
    doubtPlaceholder: "Ask about archetype reads, component pull, tradeoffs, or first-failure intuition.",
    masteryIntro:
      "This coach checks whether your system-shape labels are earned from pressure instead of guessed from the product name.",
    masteryUnlockCopy:
      "Finish the lesson check first. The mastery chat then checks whether you can justify a shape and the tradeoff it pulls in.",
    masteryDoneCopy:
      "You showed the chapter-06 habit clearly enough: shape comes from dominant stress, and a justified shape naturally pulls in likely components, tradeoffs, and failures.",
    milestones: [
      {
        key: "earn-the-shape",
        skillId: "archetype_recognition",
        level: "explanation",
        label: "Justify the dominant archetype",
        objective:
          "Check whether the learner can justify a system label from dominant stress instead of product branding.",
        promptHint:
          "Use YouTube, WhatsApp, Stripe, or another archetype-heavy product. Reward 'because this pressure dominates' language.",
        summary: "Can the learner earn the archetype from the path's dominant stress?",
        systemAnchor: "YouTube upload path",
        fallbackPrompt:
          "Why does YouTube's upload path smell like media before it smells like discovery? Justify the shape from the dominant stress, not from the product brand.",
        expectedConcepts: ["upload path", "blob", "processing", "dominant stress", "before discovery"],
        qualitySignals: ["because", "dominates", "path", "before", "stress"],
        antiPatterns: ["because it is video", "company", "brand", "everyone knows"],
      },
      {
        key: "tradeoff-pulled-by-shape",
        skillId: "tradeoff_articulation",
        level: "recognition",
        label: "Explain the pulled tradeoff",
        objective:
          "Check whether the learner can say what the archetype buys and what it makes harder.",
        promptHint:
          "Make the learner name both sides. Do not accept a label without the cost it drags in.",
        summary: "Can the learner say what a chosen shape gains and what it pays?",
        systemAnchor: "WhatsApp group delivery",
        fallbackPrompt:
          "If you read WhatsApp group delivery as messaging and delivery first, what tradeoff does that pull into the design, and what is the strongest argument for the side you did not choose?",
        expectedConcepts: ["gain", "cost", "delivery", "alternative", "tradeoff"],
        qualitySignals: ["because", "however", "cost", "alternative", "choose"],
        antiPatterns: ["always", "never", "best practice", "obvious"],
      },
      {
        key: "transport-earned-by-path",
        skillId: "archetype_recognition",
        level: "transfer",
        label: "Defend transport choice",
        objective:
          "Check whether the learner can choose WebSockets, SSE, long polling, or plain HTTP from latency, directionality, connection count, and delivery expectations.",
        promptHint:
          "Use Slack or Google Docs. Do not accept transport labels without the path reason.",
        summary: "Can the learner defend transport as a consequence of path pressure instead of a memorized brand move?",
        systemAnchor: "Slack live delivery",
        fallbackPrompt:
          "For Slack, which paths would you put on plain HTTP and which active path might earn WebSockets? Defend the choice using latency, directionality, connection count, and delivery expectations.",
        expectedConcepts: ["WebSockets", "HTTP", "latency", "server push", "bidirectional", "active clients"],
        qualitySignals: ["because", "live", "push", "while", "history"],
        antiPatterns: ["websocket everywhere", "exactly once", "always", "because chat"],
      },
    ],
  }),
  "07-hybrid-systems-and-guided-walkthroughs": chapter("07-hybrid-systems-and-guided-walkthroughs", {
    title: "Chapter 07 Coach",
    doubtPlaceholder: "Ask about path ownership, true hybrids, co-owners versus side paths, or how to split a mixed product cleanly.",
    masteryIntro:
      "This coach checks whether you can split a real product by path instead of flattening it into one label or over-splitting it into noise.",
    masteryUnlockCopy:
      "Finish the lesson check first. The mastery chat then checks whether you can assign path owners cleanly.",
    masteryDoneCopy:
      "You showed the chapter-07 habit clearly enough: split by meaningful path, assign owners from pressure, and keep secondary paths secondary.",
    milestones: [
      {
        key: "recognize-hybrid",
        skillId: "hybrid_path_ownership",
        level: "recognition",
        label: "Recognize when a product is truly hybrid",
        objective:
          "Check whether the learner knows that hybrid means path ownership, not technology count.",
        promptHint:
          "Keep the distinction sharp: different archetypes own different important paths.",
        summary: "Can the learner explain what makes a product hybrid in this course?",
        systemAnchor: "YouTube",
        fallbackPrompt:
          "What makes YouTube a hybrid product in this course, and why is that not the same as saying 'it uses many technologies'?",
        expectedConcepts: ["path ownership", "different pressure", "hybrid", "not technology count", "important path"],
        qualitySignals: ["because", "path", "owner", "different", "dominates"],
        antiPatterns: ["sql and nosql", "many services", "many teams", "technology count"],
      },
      {
        key: "assign-owners",
        skillId: "hybrid_path_ownership",
        level: "transfer",
        label: "Assign write and read path owners",
        objective:
          "Check whether the learner can split a product into write/read owners and keep side paths from hijacking the answer.",
        promptHint:
          "Use YouTube, Airbnb, or Uber. Ask for write owner, read owner, and one thing that stays secondary.",
        summary: "Can the learner name the write-path owner, the main read-path owner, and what stays secondary?",
        systemAnchor: "YouTube",
        fallbackPrompt:
          "Split YouTube into path owners. Name the write-path owner, the main read-path owners, and one path that should stay secondary rather than become a fake co-owner.",
        expectedConcepts: ["write path", "read path", "owner", "secondary", "hybrid"],
        qualitySignals: ["because", "owner", "while", "secondary", "path"],
        antiPatterns: ["everything", "all are equal", "one big system", "same owner everywhere"],
      },
      {
        key: "observability-path-ownership",
        skillId: "hybrid_path_ownership",
        level: "transfer",
        label: "Split observability paths",
        objective:
          "Check whether the learner can split a Datadog-style platform into ingest, dashboard query, alerting, and retention/downsampling owners.",
        promptHint:
          "Force them to name the different promises and what stays shared.",
        summary: "Can the learner avoid flattening observability into one generic event pipeline?",
        systemAnchor: "Datadog-style metrics and logs",
        fallbackPrompt:
          "Split a Datadog-style metrics/logs platform into ingest, dashboard query, alerting, and retention/downsampling paths. What promise owns each path, and what shared seam connects them?",
        expectedConcepts: ["ingest", "query", "alerting", "retention", "bounded staleness", "shared telemetry"],
        qualitySignals: ["because", "firehose", "dashboard", "alert", "downsample"],
        antiPatterns: ["just kafka", "one pipeline", "dashboard owns all", "generic database"],
      },
    ],
  }),
  "08-drill-order-and-mock-interview-prep": chapter("08-drill-order-and-mock-interview-prep", {
    title: "Chapter 08 Coach",
    doubtPlaceholder: "Ask about drill order, repair loops, mock readiness, or how to step back to the owning layer of a miss.",
    masteryIntro:
      "This coach checks whether you can diagnose misses and step back to the earliest layer that still owns them.",
    masteryUnlockCopy:
      "Finish the lesson check first. The mastery chat then checks whether your practice decisions are diagnostic rather than random.",
    masteryDoneCopy:
      "You showed the chapter-08 habit clearly enough: practice order is a repair ladder, and the earliest owning layer should fix the miss.",
    milestones: [
      {
        key: "repair-loop",
        skillId: "opening_discipline",
        level: "pressure",
        label: "Step back to the owning layer",
        objective:
          "Check whether the learner can map a concrete miss to the stage that should repair it.",
        promptHint:
          "Use a concrete miss from mocks, such as premature components or vague guarantees. Force a stage choice and why.",
        summary: "Can the learner step back to the earliest layer that still owns the miss?",
        systemAnchor: "Premature components in a mock",
        fallbackPrompt:
          "In a mock interview, you can name plausible tools like Kafka and Redis, but you do it before finishing the 7+1. Which stage should repair that miss first, and why is drilling a harder mock the wrong first move?",
        expectedConcepts: ["owning layer", "stage", "step back", "opening", "repair"],
        qualitySignals: ["because", "first", "repair", "before", "stage"],
        antiPatterns: ["harder mock", "random system", "memorize more tools", "just practice more"],
      },
      {
        key: "ready-signal",
        skillId: "failure_mode_clarity",
        level: "pressure",
        label: "Define interview-ready minimum",
        objective:
          "Check whether the learner can say what a minimally interview-ready answer sounds like under pressure.",
        promptHint:
          "The answer should mention structure, justified choices, tradeoffs, and what breaks first.",
        summary: "Can the learner say what audible signs show that an answer is becoming interview-ready?",
        systemAnchor: "Full mock answer",
        fallbackPrompt:
          "What is the minimum sign that a system-design answer is becoming interview-ready in this course? Answer in spoken-interview language, not as a checklist of tool names.",
        expectedConcepts: ["clarify", "structure", "tradeoff", "failure mode", "out loud"],
        qualitySignals: ["because", "sounds like", "justify", "breaks first", "under pressure"],
        antiPatterns: ["vendor names", "template", "multi-region by default", "more components"],
      },
      {
        key: "readiness-extra-deliverables",
        skillId: "opening_discipline",
        level: "pressure",
        label: "Calibrate extra deliverables",
        objective:
          "Check whether the learner knows that sizing, API contracts, and transport defense are interview-readiness reps derived from the same 7+1/LGTC reasoning.",
        promptHint:
          "Use Slack. Ask for one readiness gap and the smallest drill that repairs it.",
        summary: "Can the learner add sizing, API, and transport practice without renaming or bloating the framework?",
        systemAnchor: "Slack readiness check",
        fallbackPrompt:
          "You can run Slack through 7+1 and LGTC, but your sizing, POST message API, and WebSocket defense are vague. Which readiness drills should you add, and why does this not change the 7+1/LGTC framework?",
        expectedConcepts: ["sizing", "API", "transport", "7+1", "LGTC", "readiness"],
        qualitySignals: ["derived", "pressure", "promise", "defend", "same framework"],
        antiPatterns: ["expanded framework", "new question count", "new framework", "component list", "skip"],
      },
    ],
  }),
};

export function getChapterCoach(slug) {
  return CHAPTER_COACHES[slug] ?? null;
}

export function listChapterCoachMilestones(slug) {
  return getChapterCoach(slug)?.milestones ?? [];
}

export function milestoneStatus(record, milestone) {
  const progress = record?.milestones?.[milestone.id] ?? null;
  if (progress?.passedAt) {
    return "passed";
  }
  if ((progress?.attempts ?? 0) > 0) {
    return "repair";
  }
  return "pending";
}

export function chapterCoachStageLabel(skillId) {
  const owningStage = SKILLS[skillId]?.owningStage ?? 1;
  return STAGE_LABELS[owningStage] ?? STAGE_LABELS[1];
}
