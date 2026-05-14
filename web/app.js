(function () {
  const archetypes = [
    {
      key: "messaging",
      label: "Messaging / Delivery",
      description: "Fanout, delivery semantics, and low-latency receiver paths dominate.",
      weights: { fanout: 3.4, blob: 0.3, correctness: 1.4, concurrency: 0.6, search: 0.5, ingestion: 0.4, geo: 0.2, latency: 2.6 },
    },
    {
      key: "media",
      label: "Media Storage / Delivery",
      description: "Large blobs, background processing, and edge delivery dominate.",
      weights: { fanout: 1.1, blob: 3.6, correctness: 0.8, concurrency: 0.4, search: 1.1, ingestion: 0.7, geo: 0.2, latency: 1.8 },
    },
    {
      key: "transactional",
      label: "Transactional / Ledger",
      description: "Correctness, idempotency, and narrow strong-consistency boundaries dominate.",
      weights: { fanout: 0.6, blob: 0.1, correctness: 3.8, concurrency: 1.1, search: 0.2, ingestion: 0.3, geo: 0.4, latency: 1.5 },
    },
    {
      key: "collaboration",
      label: "Real-Time Collaboration",
      description: "Concurrent writers to shared state and merge semantics dominate.",
      weights: { fanout: 1.4, blob: 0.3, correctness: 1.7, concurrency: 4.1, search: 0.3, ingestion: 0.3, geo: 0.1, latency: 2.4 },
    },
    {
      key: "search",
      label: "Search / Discovery",
      description: "Query relevance, index freshness, and read latency dominate.",
      weights: { fanout: 0.6, blob: 0.4, correctness: 0.7, concurrency: 0.2, search: 4.0, ingestion: 1.1, geo: 0.4, latency: 2.0 },
    },
    {
      key: "event",
      label: "Event Ingestion / Observability",
      description: "Ingestion throughput, schema evolution, and bounded staleness dominate.",
      weights: { fanout: 0.7, blob: 0.4, correctness: 1.0, concurrency: 0.2, search: 0.8, ingestion: 4.1, geo: 0.1, latency: 1.4 },
    },
    {
      key: "geo",
      label: "Geo / Dispatch",
      description: "Geo lookup, assignment races, and hot-path matching dominate.",
      weights: { fanout: 0.8, blob: 0.1, correctness: 2.3, concurrency: 1.2, search: 0.4, ingestion: 1.0, geo: 4.3, latency: 3.0 },
    },
  ];

  const criticalPathSystems = {
    stripe: {
      title: "Stripe payments",
      description:
        "Correctness dominates. Keep the commit path narrow, strong, and retry-safe. Push notifications and reporting out of the path.",
      tasks: [
        {
          title: "Persist the payment attempt and resulting transaction state",
          summary: "The API is about committing money-critical state.",
          answer: "sync",
          why: "You cannot acknowledge success before the source of truth records the attempt and final state.",
        },
        {
          title: "Run the fraud decision that gates authorization",
          summary: "This directly affects whether the charge should go through.",
          answer: "sync",
          why: "If fraud scoring determines allow or deny, it is part of the correctness boundary for the request.",
        },
        {
          title: "Send the merchant webhook",
          summary: "Merchants need it, but not before the charge is durably committed.",
          answer: "async",
          why: "Webhook delivery is retry-heavy and failure-prone. Use an outbox and async worker instead.",
        },
        {
          title: "Update internal analytics dashboards",
          summary: "Operational visibility matters, but not on the user-facing commit path.",
          answer: "async",
          why: "Analytics can lag safely as long as the ledger state is correct.",
        },
      ],
    },
    youtube: {
      title: "YouTube upload",
      description:
        "The truthful response is durable acceptance of the source file and core metadata. Renditions, discovery refresh, and cache warming can lag as long as backlog stays visible and controlled.",
      tasks: [
        {
          title: "Store the original upload and metadata",
          summary: "The creator needs a durable accepted state.",
          answer: "sync",
          why: "You need the blob and metadata durably stored before telling the creator the upload succeeded.",
        },
        {
          title: "Transcode every rendition and bitrate ladder",
          summary: "Necessary for playback quality, but expensive and deferrable.",
          answer: "async",
          why: "Transcoding is CPU-bound background work and should be decoupled behind a queue.",
        },
        {
          title: "Update search indexing and recommendation candidates",
          summary: "Important for discovery, not for upload acknowledgment.",
          answer: "async",
          why: "Freshness helps, but it does not belong in the upload path.",
        },
        {
          title: "Warm CDN caches in multiple regions",
          summary: "Useful for first-viewer latency, not for accepting the upload.",
          answer: "async",
          why: "Cache warming is an optimization after durable ingest, not a prerequisite.",
        },
      ],
    },
    whatsapp: {
      title: "WhatsApp messaging",
      description:
        "The hot path is durable ordered message acceptance. Delivery fanout and notifications must stay fast but should not block acceptance.",
      tasks: [
        {
          title: "Persist the message in the ordered conversation log",
          summary: "This is the core promise behind send success.",
          answer: "sync",
          why: "The system must durably record the message in order before acknowledging send success.",
        },
        {
          title: "Acknowledge the sender that the server accepted the message",
          summary: "This is part of the immediate user experience.",
          answer: "sync",
          why: "This is the response to the critical path itself after durable persistence.",
        },
        {
          title: "Fan out to offline queues and push-notification channels",
          summary: "Delivery matters, but recipients may be offline and retries are expected.",
          answer: "async",
          why: "This work is retryable and should be decoupled from initial acceptance.",
        },
        {
          title: "Index the message for future search",
          summary: "Useful in products like Slack, not core to send acceptance.",
          answer: "async",
          why: "Search freshness is a separate read path and can lag.",
        },
      ],
    },
    airbnb: {
      title: "Airbnb booking",
      description:
        "Scarce inventory dominates. The calendar lock and booking commit must stay inside a narrow correctness-critical path.",
      tasks: [
        {
          title: "Reserve or lock the requested listing dates",
          summary: "Scarce state must not be double-booked.",
          answer: "sync",
          why: "This is the core consistency boundary for the booking request.",
        },
        {
          title: "Commit booking state and payment authorization result",
          summary: "The user needs a confirmed booking outcome.",
          answer: "sync",
          why: "Confirmation cannot happen before the booking and payment state are durably recorded.",
        },
        {
          title: "Notify the host and send follow-up emails",
          summary: "Important side effects, but not part of the core commit boundary.",
          answer: "async",
          why: "These should be driven by an outbox after the reservation commits.",
        },
        {
          title: "Refresh search ranking and recommendation features",
          summary: "The read path can tolerate slight staleness.",
          answer: "async",
          why: "Discovery freshness helps, but it should not block scarce-state correctness.",
        },
      ],
    },
  };

  const frameworkQuestionGuide = [
    {
      key: "q1",
      number: "01",
      short: "Users and action",
      title: "Who is doing what?",
      answer:
        "Slack users send direct messages and channel messages, then other users read live updates and history. Some channels are tiny; some become enormous during incidents or launches.",
      insights: [
        "This identifies the core action as messaging, not generic CRUD.",
        "It exposes hidden fanout because one send may expand into many deliveries.",
        "It hints that access patterns cluster around workspace, channel, thread, and history reads.",
      ],
      next: "This lands mostly in Load. It shapes the workload before any component names show up.",
    },
    {
      key: "q2",
      number: "02",
      short: "Wrong or lost data",
      title: "What happens if data is wrong or lost?",
      answer:
        "If Slack loses an accepted message, users stop trusting the product. If a message is exposed to the wrong tenant, it becomes a privacy incident rather than a simple bug.",
      insights: [
        "Durable acceptance matters on the message path.",
        "Tenant isolation and privacy are part of the design contract.",
        "Enterprise retention or audit concerns may matter long before storage is discussed.",
      ],
      next: "This lands mostly in Guarantees and Constraints. It raises the trust bar before you talk about topology.",
    },
    {
      key: "q3",
      number: "03",
      short: "Slow path pain",
      title: "What happens if the system is slow?",
      answer:
        "High send latency makes Slack feel broken immediately. Search freshness and analytics freshness can usually lag more than message accept and live delivery.",
      insights: [
        "The hot path is tighter than the full product surface.",
        "Different read paths tolerate different delay.",
        "You are already separating synchronous from deferred work.",
      ],
      next: "This lands mostly in Topology. It tells you what belongs on the hot path and what can move behind it.",
    },
    {
      key: "q4",
      number: "04",
      short: "Peak load",
      title: "What happens at peak load?",
      answer:
        "Peak load is not just average traffic multiplied. Slack sees local hot channels, bursty fanout during incidents, and synchronized read spikes when many users open the same conversation.",
      insights: [
        "Dominant stress is burstiness and local hot spots, not only total QPS.",
        "Large-channel fanout can dominate system pain before the whole fleet is saturated.",
        "This narrows the scaling story to the paths that actually melt first.",
      ],
      next: "This lands mostly in Load. It turns vague scale talk into a concrete pressure read.",
    },
    {
      key: "q5",
      number: "05",
      short: "Fresh truth",
      title: "Does shared state need strong consistency, or is eventual okay?",
      answer:
        "Slack usually needs ordering and durable truth per conversation, not one global consistency boundary across the whole product. Search and some counters can often lag more than live message acceptance.",
      insights: [
        "Strong truth is local to the path where wrongness hurts.",
        "Per-conversation ordering matters more than global ordering.",
        "Derived views do not need the same guarantee level as core message accept.",
      ],
      next: "This lands mostly in Guarantees. It turns vague consistency language into scoped promises.",
    },
    {
      key: "q6",
      number: "06",
      short: "Deferred work",
      title: "What work can be decoupled from the critical path?",
      answer:
        "Push notifications, offline delivery, search indexing, analytics, and some fanout side effects can happen after durable message acceptance instead of blocking the sender.",
      insights: [
        "Queues and workers now have a job to do, not just a decorative presence.",
        "Async creates lag, retries, and visibility obligations.",
        "The response promise becomes easier to define once deferred work is named explicitly.",
      ],
      next: "This lands mostly in Topology. It shapes the time dimension of the architecture.",
    },
    {
      key: "q7",
      number: "07",
      short: "Trust and compliance",
      title: "Is there a money, legal, trust, or compliance angle?",
      answer:
        "For Slack, enterprise retention, legal hold, eDiscovery, privacy promises, and administrative controls can all matter even though no money is moving on the message send path.",
      insights: [
        "Real-world obligations can make a simple-looking product much stricter.",
        "Multi-tenant isolation and audit expectations belong in the design early.",
        "Constraints are not optional cleanup after the component diagram.",
      ],
      next: "This lands mostly in Constraints. It raises the real-world bar on the architecture.",
    },
    {
      key: "q8",
      number: "08",
      short: "Data and query shape",
      title: "What is the data shape and query shape?",
      answer:
        "For live messaging, Slack can start with append-only message history and conversation-scoped reads. If search, exports, or compliance retrieval are important, indexing and history shape suddenly matter much more.",
      insights: [
        "Question 8 is the bridge into deeper storage and indexing reasoning.",
        "It matters lightly in some design asks and heavily in data-shaped design asks.",
        "It tells you when the system needs more than a generic 'messages table' story.",
      ],
      next: "This is the +1 bridge, not a flat eighth question. It often feeds later storage and indexing choices, and becomes mandatory when data shape starts driving design credibility.",
    },
  ];

  const lessonQuizzes = {
    "00-study-method": {
      title: "Start Here",
      questions: [
        {
          prompt: "What is the main purpose of the opening chapter before the technical lessons begin?",
          options: [
            "To memorize the names of all common backend tools before the course starts.",
            "To understand the teaching philosophy and the mental map the course will build.",
            "To finish all interview practice before learning concepts.",
            "To skip directly to system archetypes.",
          ],
          answer: 1,
          explanation: "The opening chapter exists so the reader knows how the course thinks and what picture each later lesson is adding to.",
        },
        {
          prompt: "Why does the course organize the subject as one mind map instead of disconnected topics?",
          options: [
            "Because diagrams look nicer when everything is in one picture.",
            "Because system design concepts are easier to memorize when listed together.",
            "Because a single map shows dependency order and helps you recover what comes next under pressure.",
            "Because interviews only ask about one system type at a time.",
          ],
          answer: 2,
          explanation: "The map exists to prevent fragmented knowledge. It gives the learner one structure where each later concept has a place and sequence.",
        },
        {
          prompt: "Why does the course begin with pressure instead of architecture?",
          options: [
            "Because pressure determines which architecture choices actually make sense later.",
            "Because architecture is never discussed in system design interviews.",
            "Because pressure matters only for frontend systems.",
            "Because storage can always be chosen independently of load.",
          ],
          answer: 0,
          explanation: "The philosophy is that architecture is a response to pressure. Without pressure, design becomes memorized pattern matching.",
        },
        {
          prompt: "What makes an answer sound borrowed rather than reasoned through?",
          options: [
            "It starts with component names and vague claims instead of pressure, boundaries, and tradeoffs.",
            "It contains too many questions before the diagram.",
            "It avoids mentioning any storage technology at all.",
            "It focuses on user impact instead of infrastructure.",
          ],
          answer: 0,
          explanation: "The course is explicitly training explanation that starts from what is making the system hard, not from a list of tools.",
        },
      ],
    },
    "01-load-latency-and-data-shape": {
      title: "Load, latency, and data shape",
      questions: [
        {
          prompt: "Why can a lower-average-QPS system still be harder to design?",
          options: [
            "Because low average QPS always implies worse p99 latency.",
            "Because spikes, fanout, or skew can dominate even when the average looks modest.",
            "Because low-QPS systems usually require full global ordering.",
            "Because storage size is always inversely proportional to QPS.",
          ],
          answer: 1,
          explanation: "The lesson emphasizes peak load, burstiness, hidden fanout, and hot keys over simplistic average-QPS thinking.",
        },
        {
          prompt: "What is the main reason p99 matters in user-facing systems?",
          options: [
            "It captures the tail experience where production pain and user frustration often live.",
            "It is always equal to the database write latency.",
            "It directly measures throughput.",
            "It removes the need to think about burstiness.",
          ],
          answer: 0,
          explanation: "Average latency can look healthy while tail latency still creates a bad real-world user experience.",
        },
        {
          prompt: "What is the main mistake in calling a large group message 'one write'?",
          options: [
            "It ignores the downstream work created by fanout and write amplification.",
            "It assumes the system must use a relational database.",
            "It proves the system has no latency sensitivity.",
            "It means the system cannot be partitioned.",
          ],
          answer: 0,
          explanation: "The visible user action may be one send, but the backend work can expand into many deliveries, counters, pushes, and derived writes.",
        },
        {
          prompt: "Why does hot-key skew matter even when total capacity looks healthy?",
          options: [
            "Because skew guarantees full global outages before local ones.",
            "Because one partition or entity can melt down long before the whole fleet is saturated.",
            "Because skew makes average latency more accurate than p99.",
            "Because skew removes the need to think about fanout.",
          ],
          answer: 1,
          explanation: "The lesson pushes the idea that systems often fail locally before they fail globally. One hot key can dominate a partition or dependency while the average still looks fine.",
        },
        {
          prompt: "Which opening sounds more like Chapter 01 interview language?",
          options: [
            "We should start with Kafka, Redis, and sharding because incident traffic will be large.",
            "The dominant pressure is bursty fanout on a hot path, so I want to name the tail-latency risk before any components.",
            "The real answer depends on which database the company already uses.",
            "The queue is the architecture, so that is enough for the opening.",
          ],
          answer: 1,
          explanation: "Chapter 01 wants a pressure-first opening in natural language before tools or architecture appear.",
        },
        {
          prompt: "A learner says, 'the queue is full, so that is the main problem.' What is the strongest Chapter 01 repair?",
          options: [
            "That is enough. Queue fullness is already the best first-order design answer.",
            "The better first read is the dominant pressure creating the queue growth, such as retry-amplified fanout or hot-path burst load.",
            "The right move is to immediately choose a better queue technology.",
            "This means the system needs global strong consistency.",
          ],
          answer: 1,
          explanation: "Chapter 01 trains cause-before-symptom language. Queue growth may be real, but the pressure creating it should be named first.",
        },
        {
          prompt: "What is the difference between data shape and query shape?",
          options: [
            "Data shape is the schema; query shape is the deployment topology.",
            "Data shape is what the data looks like; query shape is how users need to read it.",
            "Data shape applies only to SQL; query shape applies only to NoSQL.",
            "They are the same concept with different words.",
          ],
          answer: 1,
          explanation: "Storage choices become credible only when you describe both the form of the data and the way it will be accessed.",
        },
        {
          prompt: "Which pair best separates pressure from symptom?",
          options: [
            "Pressure: search index. Symptom: large message group.",
            "Pressure: retry-amplified fanout. Symptom: delayed recent-message delivery.",
            "Pressure: database shard. Symptom: high QPS.",
            "Pressure: queue worker. Symptom: data shape.",
          ],
          answer: 1,
          explanation: "Chapter 01 wants the learner to distinguish the underlying force from the visible pain it creates.",
        },
        {
          prompt: "Why is retry amplification worth noticing even before the async-design chapter?",
          options: [
            "Because retries can multiply already-stressed work and worsen tail latency even before you talk about the exact mechanism.",
            "Because retries eliminate the need for idempotency.",
            "Because retries guarantee that the average latency will improve.",
            "Because retries are only a frontend problem.",
          ],
          answer: 0,
          explanation: "Chapter 01 only needs the intuition: retries are not free, and they can turn an existing pressure spike into a worse tail-latency event.",
        },
        {
          prompt: "In pressure-first sizing, what should you estimate after the visible request rate?",
          options: [
            "The exact database vendor cost before knowing the access pattern.",
            "The hidden work per action: fanout, peak multiplier, storage growth, bandwidth, and hot-key risk.",
            "Only the average QPS, because peaks are handled later by autoscaling.",
            "The number of microservices in the final diagram.",
          ],
          answer: 1,
          explanation: "The new sizing section keeps the same chapter habit: start from the visible action, then quantify the hidden work and uneven pressure it creates.",
        },
      ],
    },
    "02-storage-partitioning-and-replication": {
      title: "Storage, partitioning, and replication",
      questions: [
        {
          prompt: "Why can one product legitimately use several different storage families?",
          options: [
            "Because using more databases always makes the architecture look more senior.",
            "Because different data shapes and read paths inside one product may need different storage behavior.",
            "Because every internet-scale system must use exactly one relational store and one NoSQL store.",
            "Because replication requires a second storage engine.",
          ],
          answer: 1,
          explanation: "The chapter now emphasizes that raw blobs, structured metadata, search views, and analytics paths can belong in different storage families because their shapes differ.",
        },
        {
          prompt: "When is a document store a more natural first fit than a relational store?",
          options: [
            "When one entity is usually read and written as one nested record and cross-record joins are not the dominant need.",
            "When every query is a multi-hop traversal over relationships.",
            "When the main read is nearest-neighbor search by latitude and longitude.",
            "When strict cross-record constraints dominate the design.",
          ],
          answer: 0,
          explanation: "Document stores earn their place when the record itself wants to live as one flexible nested object rather than as many strongly related tables.",
        },
        {
          prompt: "Which workload most strongly smells like a wide-column store?",
          options: [
            "A payments table with strict cross-row constraints and transactional joins.",
            "A per-device telemetry system where reads and writes start with device ID and often scan time-ordered rows inside that partition.",
            "A media store where the main payload is large immutable blobs.",
            "A graph of suspicious accounts where the main question is multi-hop neighbor traversal.",
          ],
          answer: 1,
          explanation: "Wide-column stores become natural when one partition owns many related ordered rows and the main queries stay local to that partition.",
        },
        {
          prompt: "When does a graph store earn attention early?",
          options: [
            "When the main question is who connects to whom, including multi-hop traversal or neighborhood expansion.",
            "When the main path is point lookup by one key.",
            "When the dominant read is full-text retrieval and ranking.",
            "When the dominant need is cheap blob storage.",
          ],
          answer: 0,
          explanation: "Graph stores are justified when relationships themselves are the query, not when the product merely has related entities somewhere in the schema.",
        },
        {
          prompt: "What is the key difference between partitioning and replication?",
          options: [
            "Partitioning creates copies for availability; replication splits the dataset for scale.",
            "Partitioning splits data or traffic across nodes; replication creates copies for availability and read scale.",
            "Partitioning is for SQL systems and replication is for NoSQL systems.",
            "They are operationally equivalent once caching is added.",
          ],
          answer: 1,
          explanation: "Replication does not solve write hot spots. Partitioning and replication solve different scaling problems.",
        },
        {
          prompt: "Why should a partition key align with the main access pattern and unit of work?",
          options: [
            "Because it guarantees every query becomes a point lookup.",
            "Because it keeps the reads and writes that most want to stay together local whenever possible.",
            "Because it removes the need for replication.",
            "Because it makes stale reads impossible.",
          ],
          answer: 1,
          explanation: "A bad partition key scatters the hot path, creates hot shards, and makes the most important work cross-partition unnecessarily.",
        },
        {
          prompt: "When is an append-only log often a better fit than a mutable table?",
          options: [
            "When history, replay, and ordered events matter.",
            "When the workload is mostly ad hoc joins.",
            "When binary blobs need cheap storage.",
            "When the system has no need for auditability.",
          ],
          answer: 0,
          explanation: "Logs are especially strong when order and history are part of the product or operational contract.",
        },
        {
          prompt: "What is replication not a direct solution for?",
          options: [
            "Read scale.",
            "Surviving node failure.",
            "Placing copies closer to readers.",
            "A hot write owner that still handles every write.",
          ],
          answer: 3,
          explanation: "Replication makes copies. It does not split write ownership by itself, so a hot write leader can still melt down.",
        },
      ],
    },
    "03-consistency-ordering-idempotency-and-transactions": {
      title: "Guarantees",
      questions: [
        {
          prompt: "Why is asking for strong consistency everywhere usually a weak answer?",
          options: [
            "Because strong consistency is only available in SQL systems.",
            "Because guarantees should be narrowed to the exact state where stale truth would break the product.",
            "Because eventual consistency is always cheaper and therefore always better.",
            "Because retries remove the need for consistency decisions.",
          ],
          answer: 1,
          explanation: "The chapter now emphasizes naming the correctness boundary first. Strong consistency should protect the exact state where stale reads are unacceptable, not become a blanket slogan.",
        },
        {
          prompt: "Why is eventual consistency acceptable for search but not for booking?",
          options: [
            "Because search systems do not use databases.",
            "Because stale search results are tolerable for a short time, while stale booking state can double-book scarce inventory.",
            "Because booking systems always require global ordering.",
            "Because search systems never have retries.",
          ],
          answer: 1,
          explanation: "The core distinction is the correctness impact of stale reads. Search tolerates it far better than scarce-state booking.",
        },
        {
          prompt: "Why is per-key or local ordering often enough?",
          options: [
            "Because global ordering is free once replication exists.",
            "Because sequence usually changes meaning only within a smaller boundary such as one conversation or one scarce resource.",
            "Because ordering and consistency are the same guarantee.",
            "Because local ordering removes the need for transactions.",
          ],
          answer: 1,
          explanation: "The lesson argues that ordering should be scoped to where sequence actually changes the product outcome. Global ordering is usually unnecessary coordination.",
        },
        {
          prompt: "What is the practical meaning of idempotency?",
          options: [
            "The transport guarantees exactly-once delivery.",
            "Processing the same request twice has the same final effect as processing it once.",
            "A request finishes within one round trip.",
            "A database write is strongly consistent across regions.",
          ],
          answer: 1,
          explanation: "In real systems, retries happen. Idempotency is how you make retries safe instead of dangerous.",
        },
        {
          prompt: "What should a transaction boundary usually protect?",
          options: [
            "Every downstream side effect in the entire product.",
            "Only the smallest set of related state changes that define whether the core operation succeeded.",
            "Only cache updates and analytics writes.",
            "Only cross-region replication.",
          ],
          answer: 1,
          explanation: "A strong answer keeps the transaction boundary narrow: big enough to protect correctness, small enough to stay practical.",
        },
        {
          prompt: "What failure does the outbox pattern prevent?",
          options: [
            "A cache miss after deployment.",
            "A crash after the DB commit but before the event is published downstream.",
            "A follower replica serving stale reads.",
            "A hot shard caused by a bad partition key.",
          ],
          answer: 1,
          explanation: "The outbox protects against lost side effects when the core state commit succeeds but publication does not.",
        },
      ],
    },
    "04-async-caching-failure-handling-and-operability": {
      title: "Hot path and runtime behavior",
      questions: [
        {
          prompt: "For a YouTube upload, what must be true before the system can honestly return \"upload succeeded\"?",
          options: [
            "Every rendition, thumbnail, and search update is complete.",
            "The original blob and core metadata are durably accepted, along with any gating checks required before acceptance.",
            "CDN caches are warm in every region.",
            "Analytics dashboards show the new upload.",
          ],
          answer: 1,
          explanation: "The hot path is the minimum truthful boundary. Heavy derived work can wait, but the accepted source and core state cannot.",
        },
        {
          prompt: "Moving transcoding behind a queue helps the upload path. What design obligation does that create next?",
          options: [
            "No further obligation. The queue automatically guarantees graceful degradation.",
            "You now need to define acceptable lag and how backlog, retries, and priority behave under overload.",
            "The queue replaces the need for durable object storage.",
            "You must enforce total ordering across all jobs in the platform.",
          ],
          answer: 1,
          explanation: "A queue buys time, not magic. Once work is deferred, lag and overload behavior become part of the design contract.",
        },
        {
          prompt: "When is caching the watch path a strong fit?",
          options: [
            "When repeated reads hit the same results, the origin is worth protecting, and some bounded staleness is acceptable.",
            "Whenever the write path is correctness-critical.",
            "Whenever the system uses a queue somewhere else.",
            "Only when the cache can be treated as the source of truth.",
          ],
          answer: 0,
          explanation: "Caching is a speed bet on reuse. It works when repeated reads dominate and freshness requirements are explicit, not when you want to avoid thinking about truth.",
        },
        {
          prompt: "Why can retries be safe for a transcode job but dangerous for a payout?",
          options: [
            "Because transcode workers never fail, but payment systems do.",
            "Because retries only matter on the read path.",
            "Because the transcode path can often be made idempotent, while a replayed money-moving side effect can create a duplicate business outcome.",
            "Because payouts cannot use queues.",
          ],
          answer: 2,
          explanation: "Retries are safe only when the handler or business boundary makes replay harmless. Money movement usually needs much tighter duplicate protection.",
        },
        {
          prompt: "Which signal most directly tells you a deferred pipeline is falling behind before users fully notice?",
          options: [
            "The number of services in the architecture diagram.",
            "The age of the oldest queued job and rising retry or failure counts in that pipeline.",
            "The total amount of object storage provisioned.",
            "Average CPU usage on developer laptops.",
          ],
          answer: 1,
          explanation: "Queue depth matters, but age and repeated failures tell you whether the backlog is actually getting older instead of draining normally.",
        },
      ],
    },
    "05-the-interview-framework-7-plus-1-and-lgtc": {
      title: "7+1 and LGTC",
      questions: [
        {
          prompt: "Why does the framework ask the 7+1 questions before components?",
          options: [
            "Because component names are reserved for staff-level interviews only.",
            "Because the questions surface the pressures and guarantees that make later component choices defensible.",
            "Because diagrams are usually banned in interviews.",
            "Because LGTC only works for database-heavy systems.",
          ],
          answer: 1,
          explanation: "The questions extract first principles. Components are the consequence, not the first move.",
        },
        {
          prompt: "Why does the framework say 7+1 instead of a flat 8?",
          options: [
            "Because the first seven questions are the universal opening spine, while question 8 becomes heavy only when data shape and query shape start driving the design.",
            "Because the framework really has only seven questions and the last one is optional decoration.",
            "Because question 8 is only for database engineers and can be ignored in product interviews.",
            "Because the eighth question is asked only after the component diagram is complete.",
          ],
          answer: 0,
          explanation: "The +1 is not equal-weight ceremony on every design ask. It becomes central when the data and query shapes start making or breaking the design.",
        },
        {
          prompt: "What is LGTC doing after the 7+1 answers exist?",
          options: [
            "Adding a second round of requirements discovery after the questions were already asked.",
            "Compressing the extracted facts into Load, Guarantees, Topology, and Constraints so the design has a usable shape.",
            "Choosing databases before the problem is understood.",
            "Replacing the need to name a tradeoff or failure mode later.",
          ],
          answer: 1,
          explanation: "LGTC does not invent new facts. It reorganizes the facts you extracted so the next design choices are justified instead of improvised.",
        },
        {
          prompt: "Why does archetype recognition come after LGTC instead of before it?",
          options: [
            "Because the label should be justified by the dominant stresses and guarantees, not guessed from the product name.",
            "Because archetypes only apply once components have already been chosen.",
            "Because LGTC is optional once you have memorized enough systems.",
            "Because archetypes only matter in multi-region systems.",
          ],
          answer: 0,
          explanation: "The framework is designed to prevent blind pattern matching. First read the system clearly, then name its dominant shape.",
        },
        {
          prompt: "What does a strong first two minutes in a system-design interview sound like?",
          options: [
            "A fast component dump so the interviewer knows you have seen common infrastructure before.",
            "A requirements pause, a few clarifying questions, an LGTC summary, then a justified archetype and path walk.",
            "A storage choice first, because it determines every later answer.",
            "An immediate discussion of caching, because latency is always the main issue.",
          ],
          answer: 1,
          explanation: "The course is building a spoken flow: extract pressure first, compress it into LGTC, then let the architecture follow from that read.",
        },
        {
          prompt: "Where does a small API contract sketch belong in the Chapter 05 flow?",
          options: [
            "Before clarification, because endpoint names should drive the requirements.",
            "After 7+1 and LGTC extraction, before architecture, so the contract reflects guarantees, retry identity, boundaries, and allowed lag.",
            "After all components are chosen, as a cosmetic description of the diagram.",
            "Only in frontend interviews, not system-design interviews.",
          ],
          answer: 1,
          explanation: "API sketching is a post-extraction deliverable. It should expose the product promise and edge boundary before the component diagram hardens.",
        },
      ],
    },
    "06-archetypes-and-component-maps": {
      title: "Archetype reads",
      questions: [
        {
          prompt: "What does a justified archetype label buy you immediately?",
          options: [
            "Only a shorter product description.",
            "A likely component map, expected tradeoff, and likely first failure mode tied to the dominant stress.",
            "Permission to skip LGTC and jump straight to databases.",
            "A guarantee that the full product has only one shape.",
          ],
          answer: 1,
          explanation: "An archetype is useful because it compresses recurring experience. Once the label is justified, it suggests what components, tradeoffs, and failure patterns usually come next.",
        },
        {
          prompt: "Why does archetype recognition come after LGTC instead of before it?",
          options: [
            "Because the label should be derived from the system's actual dominant stresses, not guessed from the product name.",
            "Because archetypes only matter in distributed systems with queues.",
            "Because LGTC is optional once you know the archetypes.",
            "Because archetypes are only for hybrid systems.",
          ],
          answer: 0,
          explanation: "The course explicitly avoids blind pattern matching. LGTC comes first so the archetype is justified.",
        },
        {
          prompt: "Which design ask most strongly smells like the transactional / ledger archetype?",
          options: [
            "A system where one send may fan out to thousands of recipients and local ordering matters.",
            "A system where large blobs are uploaded, transcoded, and served from the edge.",
            "A system where wrong money movement is worse than slow responses, retries happen, and auditability matters.",
            "A system where relevance ranking and index freshness dominate query performance.",
          ],
          answer: 2,
          explanation: "That is the cleanest pressure read for transactional and ledger systems: correctness, replay safety, and auditability dominate the architecture.",
        },
        {
          prompt: "Why are component maps not copy-paste templates?",
          options: [
            "Because every archetype must use a completely different tech stack in every company.",
            "Because component maps are compressed memory and each component still needs a stress or guarantee justification in the current design ask.",
            "Because components should only be named after deployment diagrams are drawn.",
            "Because component maps are only useful for hybrid systems.",
          ],
          answer: 1,
          explanation: "A component map helps you remember what tends to be necessary, but a strong answer still explains why each component is needed here and which common ones can be omitted.",
        },
        {
          prompt: "Why does YouTube smell like media on the write path before discovery?",
          options: [
            "Because every consumer product is media-first by default.",
            "Because uploads, blobs, background processing, storage, and edge delivery dominate the write path before ranking and discovery do.",
            "Because search is not allowed in video products.",
            "Because media systems do not need metadata.",
          ],
          answer: 1,
          explanation: "The archetype comes from the dominant stress on the path you are discussing. For upload and serving, blob handling and processing dominate before discovery does.",
        },
        {
          prompt: "What is the strongest way to defend WebSockets for a Slack-like live path?",
          options: [
            "Say every messaging product uses WebSockets by default.",
            "Tie the transport to low-latency server push, bidirectional session needs, connection count, and delivery expectations for active clients.",
            "Use WebSockets for message search and compliance export because they are also Slack features.",
            "Claim WebSockets provide exactly-once delivery without any application logic.",
          ],
          answer: 1,
          explanation: "Transport choice now comes after the path read. WebSockets earn their place on active live delivery; plain HTTP may still fit send, history, and search.",
        },
      ],
    },
    "07-hybrid-systems-and-guided-walkthroughs": {
      title: "Hybrid systems",
      questions: [
        {
          prompt: "What makes a product a hybrid system in this course?",
          options: [
            "It uses more than one database technology.",
            "Its important paths are owned by different archetypes because different stresses dominate those paths.",
            "It has both reads and writes.",
            "It has more than one backend service.",
          ],
          answer: 1,
          explanation: "Hybrid ownership is about path ownership and dominant stress, not about technology count or service count.",
        },
        {
          prompt: "What should you do first when one label feels wrong for the whole product?",
          options: [
            "Pick the most generic archetype name possible.",
            "Split the product by path and ask what pressure dominates each path.",
            "Start listing shared components so the overlap becomes obvious.",
            "Choose the path with the highest QPS and ignore the rest.",
          ],
          answer: 1,
          explanation: "Chapter 07 teaches path ownership. You isolate the path first, then earn the owner from its dominant stress.",
        },
        {
          prompt: "For YouTube, which path is discovery-owned?",
          options: [
            "Upload durable accept and transcoding.",
            "Homepage, search, and recommendation retrieval.",
            "Video segment serving after the viewer has chosen a video.",
            "Blob storage replication to the origin.",
          ],
          answer: 1,
          explanation: "Discovery is owned by retrieval, ranking, and freshness concerns. Upload and playback are still media-owned paths.",
        },
        {
          prompt: "Why does rider-driver chat not make Uber mostly a messaging system?",
          options: [
            "Because chat is forbidden in dispatch products.",
            "Because the matching loop is still dominated by geo state, assignment races, and ETA pressure, while chat is a supporting path.",
            "Because messaging systems cannot share infrastructure with dispatch systems.",
            "Because chat only matters after payment settles.",
          ],
          answer: 1,
          explanation: "A side path becomes a co-owner only when it changes the main design conversation. For Uber, dispatch still owns the hot path.",
        },
        {
          prompt: "Why is Slack compliance export worth naming as a separate path owner?",
          options: [
            "Because enterprise products must always be observability-first.",
            "Because export and audit flows bring ingestion, replay, retention, and downstream-consumer concerns that differ from live message delivery and history search.",
            "Because compliance export replaces messaging as Slack's core hot path.",
            "Because exports are always implemented with the same queue topology.",
          ],
          answer: 1,
          explanation: "The export path is real because it changes dominant stress and topology, but it still does not own the whole product.",
        },
        {
          prompt: "Why should a Datadog-style observability design split ingest, dashboard query, alerting, and retention?",
          options: [
            "Because every path must use a different programming language.",
            "Because each path has a different promise: firehose absorption, query latency, bounded alert staleness, or cost-versus-fidelity retention.",
            "Because observability systems should avoid shared source truth.",
            "Because dashboards are always the write path owner.",
          ],
          answer: 1,
          explanation: "Chapter 07 now treats observability as path-owned: shared telemetry truth flows into paths with different stresses and first failures.",
        },
      ],
    },
    "08-drill-order-and-mock-interview-prep": {
      title: "Drills and mocks",
      questions: [
        {
          prompt: "What is the main practice rule Chapter 08 is trying to build?",
          options: [
            "Jump to the hardest drill first so pressure teaches everything faster.",
            "Practice at the earliest layer that still owns your miss, then climb again.",
            "Keep switching systems until one of them feels natural.",
            "Use full mocks for every weakness because they are the most realistic.",
          ],
          answer: 1,
          explanation: "The chapter's core rule is diagnostic practice. You do not repair every problem with more mocks; you step back to the layer that actually owns the miss.",
        },
        {
          prompt: "You keep naming Kafka and Redis before finishing the 7+1. Which stage should you revisit first?",
          options: [
            "Stage 1, because this is only a vocabulary problem.",
            "Stage 2, because the opening is not stable yet.",
            "Stage 4, because this is a hybrid-ownership problem.",
            "Stage 5, because more timer pressure will cure it.",
          ],
          answer: 1,
          explanation: "Naming components before the opening is complete means the framework layer is still weak. The repair is 7+1 plus LGTC drills with a component ban.",
        },
        {
          prompt: "What should you do if the same weakness appears twice across drills or mocks?",
          options: [
            "Ignore it until the final week of preparation.",
            "Cover it by doing more random systems.",
            "Treat it as a real repair target and drill the owning layer directly before moving on.",
            "Memorize a stronger component list for the next mock.",
          ],
          answer: 2,
          explanation: "Repeated misses are structural. The course's repair loop says to isolate the weakness, map it to the owning stage, and fix it there.",
        },
        {
          prompt: "When are you actually ready to spend serious time on hybrid systems?",
          options: [
            "As soon as you have read the chapter titles once.",
            "Only after the clean archetypes feel earned, with justified components, tradeoff, and first failure.",
            "Only after you can design every system in under five minutes.",
            "As soon as one product uses both SQL and NoSQL.",
          ],
          answer: 1,
          explanation: "Hybrid practice works only after pure shapes feel stable. Otherwise every mixed product turns into blurred labels and decorative diagrams.",
        },
        {
          prompt: "What is a strong move when a mock gets harder midway because the interviewer adds a new constraint?",
          options: [
            "Abandon your structure and start a new design from scratch.",
            "Add more components immediately so the interviewer sees activity.",
            "Feed the new fact back into LGTC, revisit ownership or tradeoffs if needed, and keep the structure.",
            "Ignore the new constraint until the end so you can finish the original answer.",
          ],
          answer: 2,
          explanation: "Pressure should not erase the framework. A strong answer absorbs the new fact into the existing structure instead of panicking into a fresh component dump.",
        },
        {
          prompt: "What is the minimum sign that an answer is becoming interview-ready?",
          options: [
            "It ends with more vendor names than tradeoffs.",
            "It can clarify requirements, extract LGTC, justify components, defend a tradeoff, and explain what breaks first out loud.",
            "It includes a full multi-region deployment no matter the design ask.",
            "It uses exactly the same template for every product.",
          ],
          answer: 1,
          explanation: "Readiness here means audible structure with justified choices and explicit failure thinking, not private recognition or extra infrastructure nouns.",
        },
        {
          prompt: "Which readiness check now belongs beside mocks and archetype drills?",
          options: [
            "Reciting more vendor names for the same diagram.",
            "Doing pressure-first sizing, sketching core API contracts, and defending transport choices from the path's needs.",
            "Avoiding API and transport discussion until after the interview.",
            "Replacing 7+1 and LGTC with a larger framework.",
          ],
          answer: 1,
          explanation: "Chapter 08 keeps the core framework intact, but readiness now includes sizing, API, and transport reps that are derived from the same reasoning chain.",
        },
      ],
    },
  };

  const courseJourney = [
    {
      slug: "00-study-method",
      stage: "Start Here",
      label: "Story Setup",
      summary: "Understand why the course starts from pressure and builds one layered story instead of disconnected topics.",
    },
    {
      slug: "01-load-latency-and-data-shape",
      stage: "Layer 1",
      label: "Pressure",
      summary: "See load, latency, fanout, skew, and the difference between data shape and query shape before anything else.",
    },
    {
      slug: "02-storage-partitioning-and-replication",
      stage: "Layer 2",
      label: "Data Placement",
      summary: "Decide where data lives and how it spreads across machines.",
    },
    {
      slug: "03-consistency-ordering-idempotency-and-transactions",
      stage: "Layer 3",
      label: "Guarantees",
      summary: "Decide what promises the system must keep when writes happen.",
    },
    {
      slug: "04-async-caching-failure-handling-and-operability",
      stage: "Layer 4",
      label: "Movement",
      summary: "Separate hot-path work from deferred work and think about runtime failure.",
    },
    {
      slug: "05-the-interview-framework-7-plus-1-and-lgtc",
      stage: "Layer 5",
      label: "Framework",
      summary: "Turn the raw concepts into one reusable interview flow.",
    },
    {
      slug: "06-archetypes-and-component-maps",
      stage: "Layer 6",
      label: "Shapes",
      summary: "Recognize recurring system families by dominant stress.",
    },
    {
      slug: "07-hybrid-systems-and-guided-walkthroughs",
      stage: "Layer 7",
      label: "Hybrids",
      summary: "Split ownership cleanly when several system shapes coexist.",
    },
    {
      slug: "08-drill-order-and-mock-interview-prep",
      stage: "Layer 8",
      label: "Practice",
      summary: "Turn the map into drill-ready and interview-ready reflex.",
    },
  ];

  const startLessonComparisons = [
    {
      title: "Opening move",
      prompt: "Which opening matches the teaching philosophy of this course?",
      options: [
        '“I would probably use Kafka, Redis, and sharding.”',
        '“Before naming components, I want to know whether fanout, correctness, latency, or skew is making this system hard.”',
      ],
      answer: 1,
      why: "The stronger opening starts from pressure and uses that to justify later architecture.",
    },
    {
      title: "Consistency language",
      prompt: "Which statement sounds more reasoned?",
      options: [
        '“This system needs strong consistency everywhere.”',
        '“I need strong consistency on booking state, but I can tolerate eventual consistency on search results.”',
      ],
      answer: 1,
      why: "Strong answers define a narrow correctness boundary instead of asking for the strongest guarantee everywhere.",
    },
    {
      title: "Scaling explanation",
      prompt: "Which statement fits the standard of explanation this course is building?",
      options: [
        '“We can shard it for scale.”',
        '“I would partition by conversation ID because ordering matters inside a conversation and that key matches the unit of work.”',
      ],
      answer: 1,
      why: "The better answer explains why the partition key exists and what boundary it preserves.",
    },
  ];

  const storageProfiles = [
    {
      key: "relational",
      label: "Relational store",
      description: "Mutable state with cross-record constraints and relational queries.",
      score(inputs) {
        let total = 0;
        if (inputs.read === "point" || inputs.read === "range") total += 3;
        if (inputs.write === "mutable") total += 4;
        if (inputs.constraints === "yes") total += 4;
        if (inputs.history === "yes") total += 1;
        if (inputs.structure === "flat") total += 2;
        if (inputs.structure === "nested") total += 1;
        if (inputs.read === "text") total -= 1;
        if (inputs.read === "traversal") total -= 3;
        if (inputs.read === "blob") total -= 3;
        if (inputs.structure === "relationships") total -= 2;
        return total;
      },
    },
    {
      key: "keyvalue",
      label: "Key-value store",
      description: "Simple lookup-heavy state with predictable access.",
      score(inputs) {
        let total = 0;
        if (inputs.read === "point") total += 5;
        if (inputs.write === "mutable") total += 2;
        if (inputs.constraints === "no") total += 2;
        if (inputs.history === "no") total += 1;
        if (inputs.structure === "flat") total += 2;
        if (inputs.structure === "nested") total -= 1;
        if (inputs.read === "range") total -= 1;
        if (inputs.read === "text") total -= 2;
        if (inputs.read === "traversal" || inputs.read === "nearby") total -= 2;
        if (inputs.structure === "relationships") total -= 2;
        return total;
      },
    },
    {
      key: "document",
      label: "Document store",
      description: "Nested or flexible records that are usually read and written as one entity.",
      score(inputs) {
        let total = 0;
        if (inputs.structure === "nested") total += 5;
        if (inputs.read === "point") total += 3;
        if (inputs.read === "range") total += 1;
        if (inputs.write === "mutable") total += 3;
        if (inputs.constraints === "no") total += 2;
        if (inputs.history === "no") total += 1;
        if (inputs.read === "text") total += 1;
        if (inputs.read === "traversal") total -= 2;
        if (inputs.read === "blob") total -= 2;
        return total;
      },
    },
    {
      key: "widecolumn",
      label: "Wide-column store",
      description: "Partition-key ownership with many ordered rows or cells inside each partition.",
      score(inputs) {
        let total = 0;
        if (inputs.read === "range") total += 5;
        if (inputs.read === "point") total += 1;
        if (inputs.write === "append") total += 3;
        if (inputs.write === "mutable") total += 1;
        if (inputs.constraints === "no") total += 2;
        if (inputs.history === "yes") total += 2;
        if (inputs.structure === "wide") total += 4;
        if (inputs.read === "text") total -= 2;
        if (inputs.read === "traversal") total -= 3;
        if (inputs.read === "blob") total -= 3;
        return total;
      },
    },
    {
      key: "log",
      label: "Append-only log",
      description: "Ordered history, replay, and durable event streams.",
      score(inputs) {
        let total = 0;
        if (inputs.write === "append") total += 5;
        if (inputs.history === "yes") total += 4;
        if (inputs.read === "range") total += 2;
        if (inputs.constraints === "yes") total += 1;
        if (inputs.read === "blob") total -= 1;
        return total;
      },
    },
    {
      key: "object",
      label: "Object storage",
      description: "Large immutable blobs served cheaply and durably.",
      score(inputs) {
        let total = 0;
        if (inputs.read === "blob") total += 6;
        if (inputs.write === "immutable") total += 4;
        if (inputs.constraints === "no") total += 1;
        if (inputs.structure === "blob") total += 4;
        if (inputs.write === "mutable") total -= 3;
        return total;
      },
    },
    {
      key: "search",
      label: "Inverted index",
      description: "Keyword retrieval and ranking across text-heavy content.",
      score(inputs) {
        let total = 0;
        if (inputs.read === "text") total += 6;
        if (inputs.write === "append") total += 1;
        if (inputs.constraints === "no") total += 1;
        if (inputs.structure === "nested" || inputs.structure === "flat") total += 1;
        if (inputs.read === "blob") total -= 3;
        return total;
      },
    },
    {
      key: "timeseries",
      label: "Time-series / columnar store",
      description: "Append-heavy metrics, range scans, and aggregations.",
      score(inputs) {
        let total = 0;
        if (inputs.read === "aggregation") total += 6;
        if (inputs.read === "range") total += 3;
        if (inputs.write === "append") total += 3;
        if (inputs.history === "yes") total += 2;
        if (inputs.structure === "wide") total += 2;
        if (inputs.constraints === "no") total += 1;
        if (inputs.read === "blob" || inputs.read === "traversal") total -= 2;
        return total;
      },
    },
    {
      key: "graph",
      label: "Graph store",
      description: "Node-and-edge traversal where relationships are the main query.",
      score(inputs) {
        let total = 0;
        if (inputs.read === "traversal") total += 6;
        if (inputs.structure === "relationships") total += 5;
        if (inputs.write === "mutable") total += 2;
        if (inputs.constraints === "no") total += 1;
        if (inputs.read === "point") total += 1;
        if (inputs.history === "no") total += 1;
        if (inputs.read === "blob") total -= 3;
        return total;
      },
    },
    {
      key: "geo",
      label: "Geo-index",
      description: "Nearby and spatial lookup where location is part of the query.",
      score(inputs) {
        let total = 0;
        if (inputs.read === "nearby") total += 6;
        if (inputs.write === "mutable") total += 1;
        if (inputs.constraints === "no") total += 1;
        if (inputs.structure === "flat") total += 1;
        if (inputs.read === "blob") total -= 2;
        return total;
      },
    },
  ];

  const archetypeReadGuide = {
    whatsapp: {
      button: "WhatsApp",
      prompt: "One user sends to one person or a huge group, recipients may be online or offline, and conversation-local ordering matters.",
      archetype: "Messaging / Delivery",
      why: [
        "The hard part is fanout and delivery semantics, not ranking or blob processing.",
        "Online versus offline recipients naturally suggest different delivery paths.",
        "Ordering matters inside a conversation much more than globally.",
      ],
      components: "Append-only message log, connection layer, presence service, offline queue, and fanout workers.",
      tradeoff: "At-least-once delivery versus exactly-once cost.",
      failure: "Large-group fanout amplification.",
    },
    youtube: {
      button: "YouTube",
      prompt: "Large video blobs are uploaded, transformed into many renditions, stored durably, and served through the edge.",
      archetype: "Media Storage / Delivery",
      why: [
        "Blob handling, background processing, and bandwidth dominate the path.",
        "The product naturally separates original ingest from deferred processing work.",
        "Edge delivery matters much more than local transactional correctness on the write path.",
      ],
      components: "Chunked upload service, object storage, processing queue, transcoding pipeline, CDN, and metadata storage.",
      tradeoff: "Eager processing versus lazy processing.",
      failure: "Backlogged processing or cold-cache origin pressure.",
    },
    stripe: {
      button: "Stripe",
      prompt: "Money-moving API calls must stay correct under retries, be audit-friendly, and avoid duplicate business effects.",
      archetype: "Transactional / Ledger",
      why: [
        "Wrong outcomes are worse than slow ones.",
        "Retries, idempotency, and narrow strong state dominate the hot path.",
        "Auditability is part of the product contract, not an afterthought.",
      ],
      components: "Ledger or transaction log, idempotency keys, state materialization, reservation logic, retry handling, and an outbox.",
      tradeoff: "Saga versus 2PC.",
      failure: "Duplicate execution or lost downstream side effects.",
    },
    docs: {
      button: "Google Docs",
      prompt: "Many users edit the same shared document concurrently and all clients must converge on one sane result.",
      archetype: "Real-Time Collaboration",
      why: [
        "The core problem is concurrent mutation of shared state.",
        "Merge semantics and convergence matter as much as latency.",
        "The system must preserve a meaningful edit history, not just final rows.",
      ],
      components: "Bidirectional session channel, operation log, OT or CRDT engine, snapshots, and presence.",
      tradeoff: "OT versus CRDT.",
      failure: "History loss or high-frequency collaboration fanout pain.",
    },
    elasticsearch: {
      button: "Elasticsearch",
      prompt: "Users query a corpus under tight latency budgets and expect relevant answers while the index keeps changing underneath.",
      archetype: "Search / Discovery",
      why: [
        "Query latency and relevance dominate the user experience.",
        "Freshness matters, but exact immediate truth is usually less critical than in booking or payments.",
        "Index structures and candidate retrieval define the architecture early.",
      ],
      components: "Indexing pipeline, inverted index, query coordinator, ranking or scoring, retrieval store, and cache.",
      tradeoff: "Freshness versus query latency budget.",
      failure: "Hot terms, hot shards, or stale indexing.",
    },
    datadog: {
      button: "Datadog",
      prompt: "Massive telemetry streams arrive continuously and the platform must keep them queryable and alertable with bounded lag.",
      archetype: "Event Ingestion / Observability",
      why: [
        "The system's first job is absorbing producer throughput safely.",
        "Schema evolution and bounded staleness matter as much as raw storage.",
        "Cost control appears early because the incoming stream can grow without mercy.",
      ],
      components: "Partitioned ingest layer, buffering backbone, stream processors, schema controls, time-series or columnar storage, and query or alerting layer.",
      tradeoff: "Raw retention versus pre-aggregation.",
      failure: "Consumer lag during spikes.",
    },
    uber: {
      button: "Uber",
      prompt: "Riders and drivers must be matched in physical space with low latency while assignment races and hot zones stay under control.",
      archetype: "Geo / Dispatch",
      why: [
        "Matching latency and live physical state dominate the product outcome.",
        "The system cares about geo locality, hot cells, and assignment races immediately.",
        "ETA quality feeds directly into the hot path rather than sitting as a side feature.",
      ],
      components: "Location ingestion, geo-index, supply state, matching engine, assignment control, and ETA service.",
      tradeoff: "Optimistic versus pessimistic assignment locking.",
      failure: "Dense-zone hot cells or slow ETA loops.",
    },
  };

  const hybridGuide = {
    youtube: {
      button: "YouTube",
      prompt: "Creators upload large videos, viewers search and browse, and selected videos must actually play smoothly at scale.",
      paths: {
        upload: {
          label: "Upload path",
          owner: "Media Storage / Delivery",
          why: [
            "Blob ingest, durable accept, and deferred processing dominate the path.",
            "The system must accept a large object truthfully before later work can happen.",
            "Transcoding backlog matters here more than ranking freshness does.",
          ],
          secondary: "Search, recommendations, and homepage ranking stay secondary on upload.",
          components: "Chunked upload service, durable object storage, metadata state, transcode queue, and workers.",
          tradeoff: "Eager versus lazy transcoding.",
          failure: "Transcode backlog or slow durable accept under burst.",
        },
        discovery: {
          label: "Discovery path",
          owner: "Search / Discovery",
          why: [
            "Retrieval latency, ranking quality, and freshness dominate this path.",
            "The user-visible pain is poor search or poor recommendations, not blob ingest.",
            "Indexing and candidate selection matter more than edge segment serving here.",
          ],
          secondary: "Upload durability and playback delivery stay secondary while the viewer is still deciding what to watch.",
          components: "Indexing pipeline, query service, ranking or recommendation features, and cache.",
          tradeoff: "Freshness versus query latency and ranking cost.",
          failure: "Stale discovery or hot-query pressure.",
        },
        playback: {
          label: "Playback path",
          owner: "Media Storage / Delivery",
          why: [
            "Once the viewer has chosen a video, edge delivery and cache locality dominate.",
            "The user-visible pain is buffering, not poor ranking.",
            "This is a read path, but it is still not discovery-owned.",
          ],
          secondary: "Search ranking is secondary once the product is serving the chosen video.",
          components: "CDN, manifest or segment serving, origin protection, and playback telemetry.",
          tradeoff: "Cache efficiency versus freshness and invalidation complexity.",
          failure: "Cold-cache origin overload or buffering spikes.",
        },
      },
    },
    airbnb: {
      button: "Airbnb",
      prompt: "Guests discover listings, try to book scarce inventory, and may message hosts around the trip.",
      paths: {
        discovery: {
          label: "Listing discovery",
          owner: "Search / Discovery",
          why: [
            "Filtering, ranking, and retrieval shape the experience while the user is browsing.",
            "Some freshness lag is tolerable here compared with booking correctness.",
            "The read problem is dominated by finding the right listing, not by money movement.",
          ],
          secondary: "Booking correctness stays secondary while the guest is still searching.",
          components: "Search-oriented index, ranking or filtering logic, geo-aware retrieval, and cache.",
          tradeoff: "Freshness versus fast filtered retrieval.",
          failure: "Stale listing visibility or hot filter combinations.",
        },
        booking: {
          label: "Booking path",
          owner: "Transactional / Ledger",
          why: [
            "Scarce inventory and money movement dominate this path.",
            "Retries and duplicate execution are product failures here.",
            "The system needs a narrow correctness boundary before anything else.",
          ],
          secondary: "Search ranking becomes secondary once the guest is claiming inventory.",
          components: "Reservation boundary, booking state, payment handling, idempotency, and durable side-effect publication.",
          tradeoff: "Coordination simplicity versus cross-system correctness.",
          failure: "Double-booking or duplicate charge.",
        },
        messaging: {
          label: "Host messaging",
          owner: "Messaging / Delivery",
          why: [
            "This path is about conversation delivery rather than search or booking correctness.",
            "It supports the trip flow with a different runtime shape.",
            "It is real, but it is not the main owner of the product.",
          ],
          secondary: "Discovery and booking remain the primary product-defining paths.",
          components: "Conversation log, delivery path, notifications, and presence or session handling.",
          tradeoff: "Delivery simplicity versus stronger exactly-once semantics.",
          failure: "Notification lag or localized fanout spikes.",
        },
      },
    },
    slack: {
      button: "Slack",
      prompt: "Users send messages live, search long history, and compliance teams may export or inspect activity later.",
      paths: {
        send: {
          label: "Message send",
          owner: "Messaging / Delivery",
          why: [
            "Ordering, delivery, presence, and fanout dominate the hot path.",
            "The user-visible pain is missed or delayed messages.",
            "Search and export concerns are not the main runtime pain here.",
          ],
          secondary: "History search and compliance export stay secondary on the hot send path.",
          components: "Append-only message log, connection layer, presence, offline queue, and fanout workers.",
          tradeoff: "At-least-once delivery versus exactly-once cost.",
          failure: "Large-channel fanout amplification.",
        },
        history: {
          label: "History search",
          owner: "Search / Discovery",
          why: [
            "Retrieval over old messages is a different read shape from live delivery.",
            "Indexing and ranking matter more than presence or connection management.",
            "Looser freshness can be acceptable than on the send path.",
          ],
          secondary: "Live delivery semantics stay secondary during retrieval.",
          components: "Indexing pipeline, search-oriented index, query path, ranking, and cache.",
          tradeoff: "Freshness versus search latency.",
          failure: "Stale search results or hot query pressure.",
        },
        compliance: {
          label: "Compliance export",
          owner: "Event Ingestion / Observability",
          why: [
            "Retention, replay, export, and downstream consumers dominate this path.",
            "The system behaves more like durable event capture than like live chat.",
            "Long-running export flows bring a different topology and failure story.",
          ],
          secondary: "Live UX latency is secondary to retention and replay guarantees here.",
          components: "Durable event capture, replay or export processors, retention controls, and downstream sinks.",
          tradeoff: "Raw retention versus processing cost.",
          failure: "Consumer lag or export backlog.",
        },
      },
    },
    uber: {
      button: "Uber",
      prompt: "Riders request trips, drivers move through geo space, matches must happen fast, and chat or payouts happen around the core trip flow.",
      paths: {
        dispatch: {
          label: "Dispatch path",
          owner: "Geo / Dispatch",
          why: [
            "Matching latency, live location state, and assignment races dominate the path.",
            "The core user-visible pain is a bad or delayed match.",
            "Chat and payouts are real, but they do not own the matching loop.",
          ],
          secondary: "Chat and payout remain supporting paths while the trip is being matched.",
          components: "Location ingest, geo-index, supply state, matching engine, assignment control, and ETA service.",
          tradeoff: "Optimistic versus pessimistic assignment locking.",
          failure: "Hot geo cells or slow ETA loops.",
        },
        chat: {
          label: "Rider-driver chat",
          owner: "Messaging / Delivery",
          why: [
            "This path is about message delivery between already matched participants.",
            "It changes the runtime shape, but it does not replace dispatch as the main owner.",
            "Its pain is missed messages or lag, not matching races.",
          ],
          secondary: "Dispatch still defines the main product-critical path.",
          components: "Conversation log, notifications, delivery path, and presence or session handling.",
          tradeoff: "Delivery simplicity versus stronger exactly-once guarantees.",
          failure: "Message delay during local spikes.",
        },
        payout: {
          label: "Settlement / payout",
          owner: "Transactional / Ledger",
          why: [
            "Money correctness dominates this path.",
            "Retries and duplicate execution become dangerous here.",
            "It is a real side path with a different correctness story from dispatch.",
          ],
          secondary: "It still does not take ownership away from the live matching loop.",
          components: "Ledger, idempotency, settlement state, and durable side-effect publication.",
          tradeoff: "Coordination simplicity versus correctness across systems.",
          failure: "Duplicate payout or missing settlement side effect.",
        },
      },
    },
  };

  const practiceGuide = [
    {
      key: "concepts",
      label: "Stage 1",
      title: "Make one idea speakable",
      overview:
        "Train one concept at a time until you can explain it in plain language, anchor it in one concrete system, name the alternative, and say what breaks if you choose badly.",
      bestDrill:
        "Run 60-90 second concept drills on things like idempotency in Stripe, pressure-first sizing and API contracts in Slack, eager versus lazy transcoding in YouTube, OT versus CRDT in Docs, transport choice for live collaboration, or freshness versus latency in search.",
      advance:
        "Advance only when the idea sounds like reasoning instead of glossary text, and you can answer a follow-up without notes.",
      systems: "Slack, Stripe, YouTube, Google Docs, Elasticsearch, Datadog, Uber.",
      repairs: [
        {
          button: "Sounds memorized",
          diagnosis:
            "Stay in Stage 1. Your concept explanation is still dictionary-shaped instead of interview-shaped.",
          repair:
            "Explain the idea through one system, name the strongest alternative, and state the cost of that alternative.",
          return:
            "Return upward only when you can say what the concept buys, what it costs, and what fails if you ignore it.",
        },
        {
          button: "Component but no why",
          diagnosis:
            "Stay in Stage 1. You can name infrastructure but not the guarantee or pressure it is protecting.",
          repair:
            "Force the sentence: 'This component exists because...' and tie it to one guarantee, boundary, or bottleneck.",
          return:
            "Move on when each named component automatically comes with a reason instead of a brand habit.",
        },
        {
          button: "Tradeoff one-sided",
          diagnosis:
            "Stay in Stage 1. You are naming a choice without proving you understand the alternative.",
          repair:
            "Redo the concept as A versus B, then finish with which side you would choose in one concrete system and why.",
          return:
            "Advance when your explanation naturally includes both sides, not just your preferred side.",
        },
      ],
    },
    {
      key: "opening",
      label: "Stage 2",
      title: "Make the opening stable",
      overview:
        "Take a full design ask, ban early architecture, and practice only the 7+1 plus LGTC until the first two or three minutes become disciplined.",
      bestDrill:
        "Use a component-ban drill on Slack, Stripe, YouTube, or Uber. Stop the attempt if boxes appear before the opening is complete, then restart.",
      advance:
        "Advance only when you can reach a concrete LGTC read without decorative components or generic bucket language.",
      systems: "Slack, Stripe, YouTube, Uber.",
      repairs: [
        {
          button: "Boxes appear early",
          diagnosis:
            "Stay in Stage 2. The framework is not owning the opening yet, so components are rushing in before pressure is clear.",
          repair:
            "Rerun the same system with a hard rule: no components until the 7+1 and LGTC are spoken aloud.",
          return:
            "Move on when you can reach LGTC first and the later architecture feels more stable because of it.",
        },
        {
          button: "LGTC feels generic",
          diagnosis:
            "Stay in Stage 2. The buckets exist, but they are not carrying product-specific pressure yet.",
          repair:
            "Force every bucket to include one concrete stress, one concrete guarantee, and one real boundary from the design ask.",
          return:
            "Advance when your LGTC summary sounds like this system, not any system.",
        },
        {
          button: "+1 is always heavy",
          diagnosis:
            "Stay in Stage 2. You are overusing the data-shape question instead of letting it become heavy only when the design ask earns it.",
          repair:
            "Compare Slack versus YouTube openings and say why the +1 stays lighter in one and much heavier in the other.",
          return:
            "Move on when you can explain why the framework is 7+1 instead of a flat 8.",
        },
      ],
    },
    {
      key: "archetypes",
      label: "Stage 3",
      title: "Make a clean archetype feel earned",
      overview:
        "Drill one pure system family at a time until the archetype, its component pull, tradeoff, and first failure all feel justified by the dominant stress.",
      bestDrill:
        "Take one clean system per archetype and run the full flow: opening, dominant archetype, core components with why, key tradeoff, and first failure mode.",
      advance:
        "Advance only when the label sounds earned and every component can be defended from the pressure, not from memory.",
      systems: "WhatsApp, YouTube, Stripe, Google Docs, Elasticsearch, Datadog, Uber.",
      repairs: [
        {
          button: "Label feels guessed",
          diagnosis:
            "Stay in Stage 3. You are naming the system family from the product brand rather than from the dominant stress.",
          repair:
            "Say the pressure first, then the archetype. If the pressure sentence is weak, the label is still weak.",
          return:
            "Advance when the archetype sounds like the consequence of LGTC rather than a shortcut around it.",
        },
        {
          button: "Components feel copied",
          diagnosis:
            "Stay in Stage 3. You know the map, but the components are not yet tied to guarantees or bottlenecks.",
          repair:
            "For each component, complete the line: 'Without this, the design fails because...' or remove the component entirely.",
          return:
            "Move on when each component sounds necessary, and omitted ones sound intentionally absent.",
        },
        {
          button: "Failure mode is vague",
          diagnosis:
            "Stay in Stage 3. 'Scale issues' is not a failure mode; it is an atmosphere.",
          repair:
            "Name the mechanism: hot shard, double charge, lagging index, transcode backlog, geo-cell hot spot, or similar.",
          return:
            "Advance when what breaks first is concrete enough that someone could instrument it.",
        },
      ],
    },
    {
      key: "hybrids",
      label: "Stage 4",
      title: "Split mixed products by path",
      overview:
        "Now take real products that stop making sense under one label and learn to say who owns the write path, the read path, and any meaningful secondary split.",
      bestDrill:
        "Use YouTube, Airbnb, Slack, DoorDash, or Netflix and force yourself to say what path you are describing before you name the owner.",
      advance:
        "Advance only when one product can be explained through several paths without turning every side feature into a fake co-owner.",
      systems: "YouTube, Airbnb, Slack, DoorDash, Netflix.",
      repairs: [
        {
          button: "One label is too blunt",
          diagnosis:
            "Stay in Stage 4. The product is mixed, but your explanation is still flattening unlike paths into one diagram.",
          repair:
            "Split the product into write path and primary read path first. If the read side is still mixed, split it again.",
          return:
            "Move on when the path split changes components, tradeoffs, or first failures in a way the listener can hear.",
        },
        {
          button: "Everything becomes co-owner",
          diagnosis:
            "Stay in Stage 4. You are over-splitting and promoting side features into equal owners.",
          repair:
            "Ask whether the side path really changes the core tradeoff and first failure. If not, keep it secondary.",
          return:
            "Advance when supporting paths stay subordinate and only real owners get the spotlight.",
        },
        {
          button: "Read path still blurred",
          diagnosis:
            "Stay in Stage 4. Saying 'the read path' is still too coarse for products like YouTube or Slack.",
          repair:
            "Separate retrieval, ranking, playback, search, export, or history if they have different dominant stresses.",
          return:
            "Move on when each important path has one honest owner and the explanation no longer blurs unlike jobs together.",
        },
      ],
    },
    {
      key: "mocks",
      label: "Stage 5",
      title: "Add the clock and constraints",
      overview:
        "Only now turn the full map into timed, interviewer-style performance with interruptions, follow-up questions, and changing constraints.",
      bestDrill:
        "Run a mock with a timer, require a clean opening, then inject one hard constraint midway: one region fails, latency halves, cost must drop, or compliance suddenly matters.",
      advance:
        "Advance here by recovery quality, not perfection. The structure should survive the new pressure even when the answer gets messier.",
      systems: "Mixed archetypes, novel products, and prior weak-spot systems under new constraints.",
      repairs: [
        {
          button: "Timer causes rambling",
          diagnosis:
            "Step back to Stage 2. The framework is not stable enough yet to survive time pressure.",
          repair:
            "Do short forced openings only: 7+1 plus LGTC in two to three minutes, then stop and restart.",
          return:
            "Return to full mocks when the opening stays ordered even with a visible clock.",
        },
        {
          button: "New constraint causes panic",
          diagnosis:
            "Stay in Stage 5, but repair your recovery move. You are treating the new fact as a fresh design instead of updating the existing one.",
          repair:
            "Practice saying: 'That changes Load/Guarantees/Topology/Constraints in these ways...' before adding any new component.",
          return:
            "Advance when a changed requirement bends the structure but does not erase it.",
        },
        {
          button: "Same miss repeats",
          diagnosis:
            "Step back to the earliest owning layer. Repeated misses are no longer mock problems; they are earlier-layer repair work.",
          repair:
            "Map the miss to Stage 1, 2, 3, or 4, drill it directly, then return to the mock with the same system or same failure trigger.",
          return:
            "Stay in test mode only after the repeated miss has stopped appearing in lower-pressure drills.",
        },
      ],
    },
  ];

  const lgtcGuide = {
    load: {
      label: "Load",
      focus: "What pressure hits the system?",
      examples: "Read-heavy versus write-heavy, peaks, burstiness, fanout, hot keys.",
      miss: "Candidates often name scale without saying what kind of scale it is.",
    },
    guarantees: {
      label: "Guarantees",
      focus: "What promises must the system keep?",
      examples: "Consistency, ordering, idempotency, freshness, transaction boundary.",
      miss: "Candidates often say strong consistency without naming what needs to be consistent.",
    },
    topology: {
      label: "Topology",
      focus: "How do work and data move through the system?",
      examples: "Sync versus async, queues, partitioning, replication, geo layout.",
      miss: "Candidates often add queues without discussing lag or retries.",
    },
    constraints: {
      label: "Constraints",
      focus: "What does the real world force on the design?",
      examples: "Availability, cost, compliance, operability, durability.",
      miss: "Candidates often skip operability and talk only about features.",
    },
  };

  const PERSONALIZATION_STORAGE_KEY = "sdesign-active-learner";
  const personalizationState = {
    activeUserId: null,
    user: null,
    nextProbe: null,
    lastReview: null,
    apiUnavailable: false,
    probeLoading: false,
    error: "",
    notice: "",
    menuOpen: false,
  };
  const courseChatState = {
    history: [],
    loading: false,
    error: "",
  };
  const chapterCoachState = {
    slug: null,
    loadingScope: "",
    error: "",
    doubtChat: null,
    mastery: null,
  };
  const arenaState = {
    loading: false,
    error: "",
    data: null,
  };
  const selectionCoachState = {
    lessonSlug: null,
    text: "",
    top: 0,
    left: 0,
    open: false,
    panelTop: null,
    panelLeft: null,
    panelWidth: null,
    panelHeight: null,
    questionDraft: "",
    submitting: false,
    error: "",
    notice: "",
    reply: "",
  };
  const selectionCoachPointerState = {
    mode: null,
    pointerId: null,
    startX: 0,
    startY: 0,
    startTop: 0,
    startLeft: 0,
    startWidth: 0,
    startHeight: 0,
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function buttonInnerMarkup(label, loadingLabel, isLoading) {
    if (!isLoading) {
      return `<span class="button-label">${escapeHtml(label)}</span>`;
    }

    return `
      <span class="button-spinner" aria-hidden="true"></span>
      <span class="button-label">${escapeHtml(loadingLabel || label)}</span>
    `;
  }

  function buttonBusyAttrs(isLoading) {
    return isLoading ? ' disabled aria-busy="true"' : "";
  }

  function loadingStatusMarkup(title, copy, { compact = false } = {}) {
    return `
      <div class="coach-loading${compact ? " coach-loading--compact" : ""}" role="status" aria-live="polite">
        <span class="button-spinner coach-loading-spinner" aria-hidden="true"></span>
        <div class="coach-loading-copy">
          <strong>${escapeHtml(title)}</strong>
          ${copy ? `<p>${escapeHtml(copy)}</p>` : ""}
        </div>
      </div>
    `;
  }

  function chapterCoachBusy(scope = null) {
    if (scope) {
      return chapterCoachState.loadingScope === scope;
    }

    return Boolean(chapterCoachState.loadingScope);
  }

  function getStoredLearnerId() {
    try {
      return window.localStorage.getItem(PERSONALIZATION_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  function setStoredLearnerId(userId) {
    try {
      if (userId) {
        window.localStorage.setItem(PERSONALIZATION_STORAGE_KEY, userId);
      } else {
        window.localStorage.removeItem(PERSONALIZATION_STORAGE_KEY);
      }
    } catch {
      // Ignore storage failures.
    }
  }

  function masteryPercent(value) {
    return `${Math.round((value ?? 0) * 100)}%`;
  }

  function currentLessonSlug() {
    return document.querySelector("[data-lesson-quiz]")?.dataset.lessonQuiz || null;
  }

  function activeLearnerInitial(user) {
    const source = String(user?.name ?? user?.username ?? "L").trim();
    return escapeHtml(source.slice(0, 1).toUpperCase() || "L");
  }

  function coachProfileBadges() {
    return ["reader-one", "reader-two", "reader-three", "reader-four", "dev-reader"]
      .map((username) => `<span class="coach-chip">@${escapeHtml(username)}</span>`)
      .join("");
  }

  function coachCurrentFocus(user) {
    const weakSpot = Array.isArray(user?.weakSpots) && user.weakSpots.length > 0 ? user.weakSpots[0] : null;
    if (weakSpot) {
      return {
        label: weakSpot.label,
        detail: weakSpot.summary,
      };
    }

    if (user?.weakestSkill?.label) {
      return {
        label: user.weakestSkill.label,
        detail: user.weakestSkill.mastery != null ? `Current confidence: ${masteryPercent(user.weakestSkill.mastery)}.` : "Still building evidence.",
      };
    }

    return {
      label: "Keep building evidence",
      detail: "Finish another lesson check before the coach tries to narrow your current focus.",
    };
  }

  function lastAssistantTurn(history = []) {
    return [...history].reverse().find((turn) => turn.role === "assistant") || null;
  }

  function renderCoachLoggedOutUnderstanding() {
    return `
      <div class="coach-empty">
        <div class="coach-panel-intro">
          <div class="coach-card-title">Sign in when you want the course to remember you</div>
          <p class="result-copy">Use the top-right profile menu when you want quiz results, practice history, and next steps to stay attached to your reader profile.</p>
        </div>
        <ul class="coach-preview-list">
          <li>Keep quiz progress separate for each reader profile.</li>
          <li>Resume the same learner from this browser later.</li>
          <li>Unlock coaching only after real lesson work has started.</li>
        </ul>
      </div>
    `;
  }

  function renderCoachOnboardingUnderstanding(user) {
    return `
      <div class="coach-empty">
        <div class="coach-panel-intro">
          <div class="coach-card-title">${escapeHtml(user.name)} has not started tracked practice yet</div>
          <p class="result-copy">You are signed in, but this profile does not have any lesson checks yet. Finish lesson 01 and its quiz first, then this panel will start reflecting actual progress.</p>
        </div>
        <ul class="coach-preview-list">
          <li>Chapter 00 is orientation, not a scored understanding checkpoint.</li>
          <li>The first tracked progress appears after lesson 01 and its quiz.</li>
          <li>Until then, the course should not guess your strongest or weakest area.</li>
        </ul>
      </div>
    `;
  }

  function renderCoachLoggedOutProbe() {
    return `
      <div class="coach-empty coach-empty--tinted">
        <div class="coach-panel-intro">
          <div class="coach-card-title">Practice questions appear later</div>
          <p class="result-copy">The coach should not start testing you before you have learned anything. After lesson 01 and its quiz, the next useful question will appear here.</p>
        </div>
        <ul class="coach-preview-list">
          <li>Starts only after you have completed a real lesson check.</li>
          <li>Builds on what you have already completed, not on assumptions.</li>
          <li>Lets you continue practice from where you actually left off.</li>
        </ul>
      </div>
    `;
  }

  function renderCoachOnboardingProbe() {
    return `
      <div class="coach-empty coach-empty--tinted">
        <div class="coach-panel-intro">
          <div class="coach-card-title">No probe yet</div>
          <p class="result-copy">Read lesson 01 and finish its quiz first. The coach should wait for your first real checkpoint before it starts asking follow-up questions.</p>
        </div>
        <ul class="coach-preview-list">
          <li>The first probe should follow real course work, not appear on an untouched profile.</li>
          <li>Once lesson evidence exists, this panel will continue from that point.</li>
        </ul>
      </div>
    `;
  }

  async function apiJson(path, options = {}) {
    const response = await fetch(path, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
      ...options,
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    if (!response.ok) {
      throw new Error(data.error || `Request failed with ${response.status}`);
    }

    return data;
  }

  function topbarPersonalizationMarkup() {
    if (personalizationState.apiUnavailable) {
      return `
        <div class="topbar-profile-shell">
          <button class="topbar-profile-button is-disabled" type="button" disabled>
            <span class="topbar-profile-icon">!</span>
            <span class="topbar-profile-copy">
              <strong>Coach Offline</strong>
              <small>Unavailable</small>
            </span>
          </button>
        </div>
      `;
    }

    const user = personalizationState.user;
    const title = user ? escapeHtml(user.name) : "Log In";
    const subtitle = user ? escapeHtml(user.stageLabel || "Profile active") : "Reader Profile";

    return `
      <div class="topbar-profile-shell">
        <button class="topbar-profile-button${personalizationState.menuOpen ? " is-open" : ""}" type="button" data-topbar-menu-toggle>
          <span class="topbar-profile-icon">${activeLearnerInitial(user)}</span>
          <span class="topbar-profile-copy">
            <strong>${title}</strong>
            <small>${subtitle}</small>
          </span>
        </button>
        ${
          personalizationState.menuOpen
            ? `
              <div class="topbar-profile-panel" data-topbar-menu>
                ${
                  user
                    ? `
                      <div class="topbar-profile-summary">
                        <strong>${escapeHtml(user.name)}</strong>
                        <span>@${escapeHtml(user.username || "unknown")}</span>
                        <small>${escapeHtml(user.stageLabel || "Profile active")}</small>
                      </div>
                      <p class="small-copy">
                        ${
                          user.isOnboarding
                            ? "Finish lesson 01 and its quiz before this profile starts showing tracked progress or follow-up questions."
                            : "This profile keeps its own saved quiz progress, practice history, and next steps."
                        }
                      </p>
                      <div class="coach-field">
                        <button class="button button-secondary" type="button" data-logout-button>Switch profile</button>
                      </div>
                      <form id="coach-reset-form" class="coach-login-form">
                        <label for="coach-reset-password">Reset progress</label>
                        <input
                          id="coach-reset-password"
                          name="password"
                          type="password"
                          autocomplete="current-password"
                          placeholder="Enter this profile password to reset"
                        />
                        <button class="button button-ghost" type="submit">Reset this profile</button>
                      </form>
                    `
                    : `
                      <div class="coach-panel-intro">
                        <div class="coach-card-title">Log in to your reader profile</div>
                        <p class="result-copy">Use the assigned local credentials for your reader. Coaching starts only after your first real lesson check.</p>
                      </div>
                      <form id="coach-login-form" class="coach-login-form">
                        <label for="coach-login-username">Username</label>
                        <input
                          id="coach-login-username"
                          name="username"
                          type="text"
                          maxlength="40"
                          autocomplete="username"
                          placeholder="reader-one"
                        />
                        <label for="coach-login-password">Password</label>
                        <input
                          id="coach-login-password"
                          name="password"
                          type="password"
                          autocomplete="current-password"
                          placeholder="Your assigned password"
                        />
                        <button class="button button-primary" type="submit">Open profile</button>
                      </form>
                      <div class="coach-profile-list">
                        ${coachProfileBadges()}
                      </div>
                    `
                }
                ${personalizationState.notice ? `<p class="coach-note">${escapeHtml(personalizationState.notice)}</p>` : ""}
                ${personalizationState.error ? `<p class="coach-error">${escapeHtml(personalizationState.error)}</p>` : ""}
              </div>
            `
            : ""
        }
      </div>
    `;
  }

  function personalCoachMarkup() {
    if (personalizationState.apiUnavailable) {
      return `
        <div class="coach-grid">
          <div class="result-card coach-panel">
            <p class="panel-label">Personal Coach</p>
            <div class="result-headline">Personalization is unavailable</div>
            <p class="result-copy">The course content still works, but the coaching panel is not reachable from this page right now.</p>
          </div>
        </div>
      `;
    }

    const user = personalizationState.user;
    const nextProbe = personalizationState.nextProbe;
    const review = personalizationState.lastReview;

    if (!user) {
      return `
        <div class="coach-grid">
          <div class="result-card coach-panel">
            <p class="panel-label">Save Your Place</p>
            <div class="coach-panel-intro">
              <div class="coach-card-title">Sign in only when you want the site to remember you</div>
              <p class="result-copy">Use the top-right profile menu if you want quiz results, practice history, and later coaching to stay attached to one reader profile.</p>
            </div>
            <ul class="coach-preview-list">
              <li>Chapter 00 and lesson 01 still work perfectly well before you sign in.</li>
              <li>The coach should wait until real lesson evidence exists before it starts judging your understanding.</li>
              <li>Your saved place, later questions, and chapter help stay separate for each reader profile.</li>
            </ul>
          </div>
        </div>
      `;
    }

    if (user.isOnboarding) {
      return `
        <div class="coach-grid">
          <div class="result-card coach-panel">
            <p class="panel-label">First Checkpoint</p>
            <div class="coach-panel-intro">
              <div class="coach-card-title">${escapeHtml(user.name)}, your first real checkpoint is lesson 01</div>
              <p class="result-copy">This profile is active, but the site should not start scoring your understanding yet. Read lesson 01 and finish its quiz first.</p>
            </div>
            <div class="coach-metrics">
              <article class="mini-metric">
                <span>Current step</span>
                <strong>Finish lesson 01</strong>
                <small>The first tracked understanding starts there.</small>
              </article>
              <article class="mini-metric mini-metric--focus">
                <span>Why this matters</span>
                <strong>No guessing yet</strong>
                <small>The coach should not invent strengths, weaknesses, or probes on an untouched profile.</small>
              </article>
            </div>
            <p class="result-copy"><strong>Best next move:</strong> ${escapeHtml(user.nextAction)}</p>
          </div>
        </div>
      `;
    }

    const focus = coachCurrentFocus(user);
    const nextQuestionMarkup = nextProbe
      ? renderProbePanel(nextProbe, review)
      : `
        <div class="coach-empty coach-empty--tinted">
          <div class="coach-panel-intro">
            <div class="coach-card-title">No follow-up question waiting right now</div>
            <p class="result-copy">Keep moving through the course. The next useful question appears only when there is enough fresh evidence to justify it.</p>
          </div>
        </div>
      `;

    return `
      <div class="coach-grid">
        <div class="coach-status-column">
          <div class="result-card coach-panel coach-state-panel">
            <p class="panel-label">Continue From Here</p>
            <div class="coach-panel-intro">
              <div class="coach-card-title">${escapeHtml(user.name)}, pick up from here</div>
              <p class="result-copy">This space remembers the last useful checkpoint for this profile so the site can point you to the next repair or next question instead of making you restart cold.</p>
            </div>
            <div class="coach-metrics">
              <article class="mini-metric">
                <span>Completed lessons</span>
                <strong>${escapeHtml(String(user.completedLessonCount ?? 0))}</strong>
                <small>Stored to this reader profile.</small>
              </article>
              <article class="mini-metric mini-metric--focus">
                <span>Current focus</span>
                <strong>${escapeHtml(focus.label)}</strong>
                <small>${escapeHtml(focus.detail)}</small>
              </article>
            </div>
            <p class="result-copy"><strong>Best next move:</strong> ${escapeHtml(user.nextAction)}</p>
            <ul class="insight-list">
              ${(user.weakSpots ?? [])
                .slice(0, 3)
                .map(
                  (spot) =>
                    `<li><strong>${escapeHtml(spot.label)}:</strong> ${escapeHtml(spot.summary)}</li>`,
                )
                .join("") || "<li>No open repairs yet. Keep moving through the course and store the next real checkpoint.</li>"}
            </ul>
          </div>
          <div class="result-card coach-panel coach-probe-panel">
            <p class="panel-label">Next Useful Question</p>
            ${nextQuestionMarkup}
          </div>
        </div>
        <div class="coach-inline-slot" data-course-chat></div>
      </div>
    `;
  }

  function renderProbePanel(probe, review) {
    const loadingMarkup = personalizationState.probeLoading
      ? loadingStatusMarkup(
          "Checking this probe",
          "Codex is reviewing your answer and deciding whether to repair an earlier layer or push one level deeper.",
          { compact: true },
        )
      : "";
    const responseMarkup =
      review && review.probeId === probe.id
        ? `
          <div class="probe-review">
            <p class="result-copy"><strong>Review:</strong> ${escapeHtml(review.summary)}</p>
            ${
              review.strengths?.length
                ? `<ul class="insight-list">${review.strengths
                    .map((item) => `<li><strong>Strong:</strong> ${escapeHtml(item)}</li>`)
                    .join("")}</ul>`
                : ""
            }
            ${
              review.misses?.length
                ? `<ul class="insight-list">${review.misses
                    .map((item) => `<li><strong>Miss:</strong> ${escapeHtml(item)}</li>`)
                    .join("")}</ul>`
                : ""
            }
            ${
              review.fallbackReason
                ? `<p class="small-copy">Used heuristic fallback because Codex review was unavailable: ${escapeHtml(review.fallbackReason)}</p>`
                : `<p class="small-copy">Review mode: ${escapeHtml(review.mode || "unknown")}.</p>`
            }
          </div>
        `
        : "";

    return `
      <div class="result-headline">${escapeHtml(probe.skillLabel)}</div>
      <p class="result-copy"><strong>${escapeHtml(probe.stageLabel)}.</strong> ${escapeHtml(probe.summary)}</p>
      <form data-probe-form data-probe-id="${escapeHtml(probe.id)}" class="probe-form">
        <p class="probe-question">${escapeHtml(probe.prompt)}</p>
        ${
          probe.format === "mcq"
            ? `
              <div class="probe-options">
                ${probe.options
                  .map(
                    (option, index) => `
                      <label class="quiz-option">
                        <input type="radio" name="probe-option" value="${index}" />
                        <span>${escapeHtml(option)}</span>
                      </label>
                    `,
                  )
                  .join("")}
              </div>
            `
            : `
              <label class="probe-text-label" for="probe-answer">Answer in your own words</label>
              <textarea id="probe-answer" name="answer" rows="6" placeholder="Write the reasoning you would actually say to an interviewer."></textarea>
            `
        }
        <div class="quiz-actions">
          <button class="button button-primary${personalizationState.probeLoading ? " is-loading" : ""}" type="submit"${buttonBusyAttrs(personalizationState.probeLoading)}>
            ${buttonInnerMarkup("Check This Probe", "Checking…", personalizationState.probeLoading)}
          </button>
        </div>
      </form>
      ${loadingMarkup}
      ${responseMarkup}
    `;
  }

  function chatTranscriptMarkup(history, emptyTitle, emptyCopy) {
    if (!history || history.length === 0) {
      return `
        <div class="coach-empty">
          <div class="coach-panel-intro">
            <div class="coach-card-title">${escapeHtml(emptyTitle)}</div>
            <p class="result-copy">${escapeHtml(emptyCopy)}</p>
          </div>
        </div>
      `;
    }

    return `
      <div class="coach-chat-transcript">
        ${history
          .map((turn) => {
            const followups =
              turn.role === "assistant" && Array.isArray(turn.followups) && turn.followups.length > 0
                ? `<div class="coach-followups">${turn.followups
                    .map((item) => `<span class="coach-followup-chip">${escapeHtml(item)}</span>`)
                    .join("")}</div>`
                : "";
            const checkBack =
              turn.role === "assistant" && turn.checkBack
                ? `<p class="small-copy coach-checkback">${escapeHtml(turn.checkBack)}</p>`
                : "";
            const selectionContext =
              turn.role === "user" && turn.selectedText
                ? `
                  <div class="coach-selection-context">
                    <span class="coach-message-label">Selected text</span>
                    <blockquote>${escapeHtml(turn.selectedText)}</blockquote>
                  </div>
                `
                : "";

            return `
              <article class="coach-message coach-message--${escapeHtml(turn.role || "assistant")}">
                <span class="coach-message-label">${turn.role === "user" ? "You" : "Coach"}</span>
                <div class="coach-message-body">${escapeHtml(turn.content)}</div>
                ${selectionContext}
                ${checkBack}
                ${followups}
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderCourseChatMarkup() {
    if (personalizationState.apiUnavailable) {
      return `
        <div class="result-card coach-panel">
          <p class="panel-label">Course Chat</p>
          <div class="result-headline">Course chat is unavailable</div>
          <p class="result-copy">The course is still readable, but the live coach is not reachable right now.</p>
        </div>
      `;
    }

    if (!personalizationState.activeUserId) {
      return `
        <div class="result-card coach-panel">
          <p class="panel-label">Course Chat</p>
          <div class="coach-panel-intro">
            <div class="coach-card-title">Log in to ask the course coach</div>
            <p class="result-copy">Use the top-right profile menu so your questions and follow-ups stay attached to your reader profile.</p>
          </div>
        </div>
      `;
    }

    return `
      <div class="result-card coach-panel">
        <p class="panel-label">Course Chat</p>
        <div class="coach-panel-intro">
          <div class="coach-card-title">Ask about any chapter or connection</div>
          <p class="result-copy">Use this for broader course questions, comparisons across chapters, or places where one idea still feels fuzzy.</p>
        </div>
        ${chatTranscriptMarkup(
          courseChatState.history,
          "No course questions yet",
          "Ask about any chapter, confusing term, or cross-chapter connection.",
        )}
        <form class="coach-chat-form" data-course-chat-form>
          <label class="probe-text-label" for="course-chat-question">Your question</label>
          <textarea id="course-chat-question" name="question" rows="4" placeholder="Why does the course keep insisting on pressure before architecture?"></textarea>
          <div class="quiz-actions">
            <button class="button button-primary${courseChatState.loading ? " is-loading" : ""}" type="submit"${buttonBusyAttrs(courseChatState.loading)}>
              ${buttonInnerMarkup("Ask The Coach", "Thinking…", courseChatState.loading)}
            </button>
          </div>
        </form>
        ${
          courseChatState.loading
            ? loadingStatusMarkup(
                "Coach is thinking",
                "Codex is reading your question and composing the clearest next explanation it can give inside the course context.",
                { compact: true },
              )
            : ""
        }
        ${courseChatState.error ? `<p class="coach-error">${escapeHtml(courseChatState.error)}</p>` : ""}
      </div>
    `;
  }

  function renderChapterDoubtMarkup(slug) {
    const doubtLoading = chapterCoachBusy("doubt");
    if (personalizationState.apiUnavailable) {
      return `
        <div class="result-card coach-panel">
          <p class="panel-label">Ask About This Chapter</p>
          <div class="result-headline">Chapter chat is unavailable</div>
          <p class="result-copy">The lesson content is still here, but the live coach is not reachable right now.</p>
        </div>
      `;
    }

    if (!personalizationState.activeUserId) {
      return `
        <div class="result-card coach-panel">
          <p class="panel-label">Ask About This Chapter</p>
          <div class="coach-panel-intro">
            <div class="coach-card-title">Log in to ask about this chapter</div>
            <p class="result-copy">Use the top-right profile menu so your doubts and follow-ups stay with your reader profile.</p>
          </div>
        </div>
      `;
    }

    const history = chapterCoachState.doubtChat?.history || [];
    const placeholder =
      chapterCoachState.doubtChat?.placeholder ||
      "Ask what still feels unclear in this chapter, or how it connects to another lesson.";

    return `
      <div class="result-card coach-panel">
        <p class="panel-label">Ask About This Chapter</p>
        <div class="coach-panel-intro">
          <div class="coach-card-title">Clear the fuzzy part before you move on</div>
          <p class="result-copy">Ask for a simpler explanation, a comparison, or a concrete example using this chapter's own language.</p>
        </div>
        ${chatTranscriptMarkup(history, "No chapter questions yet", "Ask the exact part of the chapter that still feels unclear.")}
        <form class="coach-chat-form" data-chapter-doubt-form data-chapter-slug="${escapeHtml(slug)}">
          <label class="probe-text-label" for="chapter-chat-question">Your question</label>
          <textarea id="chapter-chat-question" name="question" rows="4" placeholder="${escapeHtml(placeholder)}"></textarea>
          <div class="quiz-actions">
            <button class="button button-secondary${doubtLoading ? " is-loading" : ""}" type="submit"${buttonBusyAttrs(doubtLoading)}>
              ${buttonInnerMarkup("Ask About This Chapter", "Thinking…", doubtLoading)}
            </button>
          </div>
        </form>
        ${
          doubtLoading
            ? loadingStatusMarkup(
                "Reading this chapter question",
                "Codex is answering inside this lesson's scope so the reply stays tied to the chapter you are reading.",
                { compact: true },
              )
            : ""
        }
        ${chapterCoachState.error ? `<p class="coach-error">${escapeHtml(chapterCoachState.error)}</p>` : ""}
      </div>
    `;
  }

  function renderMilestoneSummary(mastery) {
    const milestones = mastery?.milestones || [];
    if (milestones.length === 0) {
      return "";
    }

    return `
      <div class="coach-milestone-row">
        ${milestones
          .map(
            (item) => `
              <article class="coach-milestone coach-milestone--${escapeHtml(item.status)}">
                <span>${escapeHtml(item.label)}</span>
                <strong>${
                  item.status === "passed"
                    ? "Passed"
                    : item.status === "repair"
                      ? "Repairing"
                      : "Pending"
                }</strong>
              </article>
            `,
          )
          .join("")}
      </div>
    `;
  }

  function renderMasteryTranscript(mastery) {
    const history = mastery?.transcript || [];
    if (history.length === 0) {
      return `
        <div class="coach-empty coach-empty--tinted">
          <div class="coach-panel-intro">
            <div class="coach-card-title">No mastery turns yet</div>
            <p class="result-copy">Start the mastery check after the lesson quiz. The coach will keep probing until the chapter's main ideas sound stable.</p>
          </div>
        </div>
      `;
    }

    return `
      <div class="coach-chat-transcript coach-chat-transcript--mastery">
        ${history
          .map((turn) => {
            const extra =
              turn.type === "feedback"
                ? `
                    ${turn.repairExplanation ? `<p class="small-copy coach-checkback">${escapeHtml(turn.repairExplanation)}</p>` : ""}
                    ${
                      Array.isArray(turn.misses) && turn.misses.length
                        ? `<ul class="insight-list">${turn.misses
                            .map((item) => `<li><strong>Gap:</strong> ${escapeHtml(item)}</li>`)
                            .join("")}</ul>`
                        : ""
                    }
                  `
                : "";

            return `
              <article class="coach-message coach-message--${turn.role === "user" ? "user" : "assistant"}">
                <span class="coach-message-label">${
                  turn.role === "user"
                    ? "You"
                    : turn.type === "feedback"
                      ? "Coach Feedback"
                      : turn.type === "completion"
                        ? "Coach"
                        : "Coach Question"
                }</span>
                <div class="coach-message-body">${escapeHtml(turn.content)}</div>
                ${extra}
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderChapterMasteryMarkup(slug) {
    const masteryLoading = chapterCoachBusy("mastery");
    if (personalizationState.apiUnavailable) {
      return `
        <div class="result-card coach-panel">
          <p class="panel-label">Chapter Mastery</p>
          <div class="result-headline">Mastery coach is unavailable</div>
          <p class="result-copy">The lesson is still readable, but the live mastery loop is not reachable right now.</p>
        </div>
      `;
    }

    if (!personalizationState.activeUserId) {
      return `
        <div class="result-card coach-panel">
          <p class="panel-label">Chapter Mastery</p>
          <div class="coach-panel-intro">
            <div class="coach-card-title">Log in to track chapter mastery</div>
            <p class="result-copy">Use the top-right profile menu so the chapter coach can remember what you already proved and what still needs repair.</p>
          </div>
        </div>
      `;
    }

    const mastery = chapterCoachState.mastery;
    if (!mastery) {
      return `
        <div class="result-card coach-panel">
          <p class="panel-label">Chapter Mastery</p>
          ${loadingStatusMarkup(
            "Loading chapter coach",
            "Pulling the current mastery state for this lesson.",
          )}
        </div>
      `;
    }

    const masteryLoadingMarkup = masteryLoading
      ? loadingStatusMarkup(
          mastery.activeProbe
            ? "Checking your answer"
            : mastery.transcript?.length
              ? "Preparing the next chapter question"
              : "Starting the mastery check",
          mastery.activeProbe
            ? "Codex is evaluating this answer and deciding whether the chapter idea is stable or still needs repair."
            : "Codex is preparing the next mastery question for this chapter.",
          { compact: true },
        )
      : "";

    const actionMarkup = !mastery.unlocked
      ? `<p class="result-copy">${escapeHtml(mastery.unlockCopy)}</p>`
      : mastery.status === "mastered"
        ? `<p class="result-copy">${escapeHtml(mastery.doneCopy)}</p>`
        : mastery.activeProbe
          ? `
            <form class="coach-chat-form" data-chapter-mastery-form data-chapter-slug="${escapeHtml(slug)}" data-probe-id="${escapeHtml(mastery.activeProbe.id)}">
              <label class="probe-text-label" for="chapter-mastery-answer">Your answer</label>
              <textarea id="chapter-mastery-answer" name="answer" rows="5" placeholder="Answer as if you are speaking to an interviewer."></textarea>
              <div class="quiz-actions">
                <button class="button button-primary${masteryLoading ? " is-loading" : ""}" type="submit"${buttonBusyAttrs(masteryLoading)}>
                  ${buttonInnerMarkup("Check This Answer", "Checking…", masteryLoading)}
                </button>
              </div>
            </form>
          `
          : `
            <div class="quiz-actions">
              <button class="button button-primary${masteryLoading ? " is-loading" : ""}" type="button" data-chapter-mastery-start data-chapter-slug="${escapeHtml(slug)}"${buttonBusyAttrs(masteryLoading)}>
                ${buttonInnerMarkup(
                  mastery.transcript?.length ? "Continue Mastery Check" : "Start Mastery Check",
                  mastery.transcript?.length ? "Loading next question…" : "Starting…",
                  masteryLoading,
                )}
              </button>
            </div>
          `;

    return `
      <div class="result-card coach-panel">
        <p class="panel-label">Chapter Mastery</p>
        <div class="coach-panel-intro">
          <div class="coach-card-title">${escapeHtml(mastery.title)}</div>
          <p class="result-copy">${escapeHtml(mastery.intro)}</p>
        </div>
        ${renderMilestoneSummary(mastery)}
        ${renderMasteryTranscript(mastery)}
        ${actionMarkup}
        ${masteryLoadingMarkup}
        ${chapterCoachState.error ? `<p class="coach-error">${escapeHtml(chapterCoachState.error)}</p>` : ""}
      </div>
    `;
  }

  function renderArenaTrackCards(trackCards = []) {
    if (!trackCards.length) {
      return "";
    }

    return `
      <div class="arena-track-grid">
        ${trackCards
          .map(
            (track) => `
              <article class="arena-track arena-track--${
                track.current ? "current" : track.unlocked ? "unlocked" : "locked"
              }">
                <span>${escapeHtml(track.label)}</span>
                <strong>${track.unlocked ? "Open" : `After lesson ${String(track.unlockLesson).padStart(2, "0")}`}</strong>
              </article>
            `,
          )
          .join("")}
      </div>
    `;
  }

  function renderArenaPhaseProgress(phases = []) {
    if (!phases.length) {
      return "";
    }

    return `
      <div class="arena-phase-strip">
        ${phases
          .map(
            (phase) => `
              <article class="arena-phase arena-phase--${escapeHtml(phase.status)}">
                <span>${escapeHtml(phase.label)}</span>
                <strong>${
                  phase.status === "passed"
                    ? "Cleared"
                    : phase.status === "current"
                      ? "Current"
                      : "Pending"
                }</strong>
              </article>
            `,
          )
          .join("")}
      </div>
    `;
  }

  function renderArenaTranscript(transcript = []) {
    if (!transcript.length) {
      return `
        <div class="coach-empty coach-empty--tinted">
          <div class="coach-panel-intro">
            <div class="coach-card-title">No arena rounds yet</div>
            <p class="result-copy">Start a set when you want the course to keep one idea under pressure until it either holds or reveals the exact repair needed.</p>
          </div>
        </div>
      `;
    }

    return `
      <div class="coach-chat-transcript coach-chat-transcript--mastery">
        ${transcript
          .map((turn) => {
            const detail =
              turn.type === "feedback"
                ? `
                    ${turn.repairExplanation ? `<p class="small-copy coach-checkback">${escapeHtml(turn.repairExplanation)}</p>` : ""}
                    ${
                      Array.isArray(turn.misses) && turn.misses.length
                        ? `<ul class="insight-list">${turn.misses
                            .map((item) => `<li><strong>Gap:</strong> ${escapeHtml(item)}</li>`)
                            .join("")}</ul>`
                        : ""
                    }
                  `
                : "";

            return `
              <article class="coach-message coach-message--${turn.role === "user" ? "user" : "assistant"}">
                <span class="coach-message-label">${
                  turn.role === "user"
                    ? "You"
                    : turn.type === "feedback"
                      ? `Coach Feedback${turn.phaseLabel ? ` • ${escapeHtml(turn.phaseLabel)}` : ""}`
                      : `Coach Question${turn.phaseLabel ? ` • ${escapeHtml(turn.phaseLabel)}` : ""}`
                }</span>
                <div class="coach-message-body">${escapeHtml(turn.content)}</div>
                ${detail}
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderPracticeArenaMarkup() {
    if (personalizationState.apiUnavailable) {
      return `
        <div class="coach-grid">
          <div class="result-card coach-panel">
            <p class="panel-label">Practice Arena</p>
            <div class="result-headline">Arena is unavailable</div>
            <p class="result-copy">The course pages still work, but the live arena cannot be reached from this browser right now.</p>
          </div>
        </div>
      `;
    }

    if (!personalizationState.activeUserId) {
      return `
        <div class="coach-grid">
          <div class="result-card coach-panel">
            <p class="panel-label">Practice Arena</p>
            <div class="coach-panel-intro">
              <div class="coach-card-title">Log in to train with a reader profile</div>
              <p class="result-copy">Use the top-right profile menu first. Arena sets, repair history, and progress should stay attached to one reader profile instead of this browser alone.</p>
            </div>
          </div>
        </div>
      `;
    }

    const arena = arenaState.data;
    if (!arena) {
      return `
        <div class="coach-grid">
          <div class="result-card coach-panel">
            <p class="panel-label">Practice Arena</p>
            ${loadingStatusMarkup(
              "Loading your arena",
              "Pulling the current readiness, progress, and active set for this reader.",
            )}
          </div>
        </div>
      `;
    }

    const session = arena.activeSession;
    const arenaLoadingMarkup = arenaState.loading
      ? loadingStatusMarkup(
          session?.activeRound ? "Checking this round" : "Preparing the next set",
          session?.activeRound
            ? "Codex is evaluating this answer and deciding how the next round should adjust."
            : "Codex is preparing the next adaptive arena round for this reader.",
          { compact: true },
        )
      : "";
    const startLabel =
      session?.status === "completed" || !session
        ? "Start adaptive set"
        : session.activeRound
          ? "Resume current set"
          : "Continue adaptive set";

    const actionMarkup = !arena.readiness.ready
      ? `
        <div class="coach-empty coach-empty--tinted">
          <div class="coach-panel-intro">
            <div class="coach-card-title">The arena opens after the first real chapter checkpoint</div>
            <p class="result-copy">${escapeHtml(arena.readiness.entryCopy)}</p>
          </div>
          <p class="small-copy">${escapeHtml(arena.readiness.nextUnlockCopy)}</p>
        </div>
      `
      : session?.activeRound
        ? `
          <div class="arena-session-card">
            <div class="coach-panel-intro">
              <div class="coach-card-title">${escapeHtml(session.phase?.label || "Current round")}</div>
              <p class="result-copy">${escapeHtml(session.phase?.summary || "Answer this round in spoken interview language.")}</p>
            </div>
            ${renderArenaPhaseProgress(session.phaseProgress)}
            <p class="probe-question">${escapeHtml(session.activeRound.prompt)}</p>
            <form class="coach-chat-form" data-arena-turn-form data-probe-id="${escapeHtml(session.activeRound.id)}">
              <label class="probe-text-label" for="arena-answer">Your answer</label>
              <textarea id="arena-answer" name="answer" rows="5" placeholder="Answer the way you would speak in an interview."></textarea>
              <div class="quiz-actions">
                <button class="button button-primary${arenaState.loading ? " is-loading" : ""}" type="submit"${buttonBusyAttrs(arenaState.loading)}>
                  ${buttonInnerMarkup("Check This Round", "Checking…", arenaState.loading)}
                </button>
              </div>
            </form>
          </div>
        `
        : `
          <div class="coach-empty coach-empty--tinted">
            <div class="coach-panel-intro">
              <div class="coach-card-title">${
                session?.status === "completed" ? "Set cleared" : "Ready for the next set"
              }</div>
              <p class="result-copy">${
                session?.status === "completed"
                  ? "That set has finished. Start a fresh adaptive set to make the next weak layer hold under pressure too."
                  : "Start a set when you want the course to choose the next useful layer, then push it through transfer and pressure."
              }</p>
            </div>
            <div class="quiz-actions">
              <button class="button button-primary${arenaState.loading ? " is-loading" : ""}" type="button" data-arena-start${buttonBusyAttrs(arenaState.loading)}>
                ${buttonInnerMarkup(startLabel, "Starting…", arenaState.loading)}
              </button>
            </div>
          </div>
        `;

    return `
      <div class="coach-grid">
        <div class="coach-status-column">
          <div class="result-card coach-panel">
            <p class="panel-label">Arena Status</p>
            <div class="coach-panel-intro">
              <div class="coach-card-title">${escapeHtml(personalizationState.user?.name || "Reader")} in the practice arena</div>
              <p class="result-copy">${escapeHtml(arena.readiness.entryCopy)}</p>
            </div>
            <div class="coach-metrics">
              <article class="mini-metric">
                <span>Rounds played</span>
                <strong>${escapeHtml(String(arena.stats.roundsPlayed ?? 0))}</strong>
              </article>
              <article class="mini-metric">
                <span>Clear rate</span>
                <strong>${escapeHtml(String(arena.stats.clearRate ?? 0))}%</strong>
              </article>
              <article class="mini-metric">
                <span>Best streak</span>
                <strong>${escapeHtml(String(arena.stats.bestStreak ?? 0))}</strong>
              </article>
            </div>
            ${
              arena.focus
                ? `<p class="result-copy"><strong>Likely repair target:</strong> ${escapeHtml(arena.focus.label)} (${masteryPercent(
                    arena.focus.mastery,
                  )})</p>`
                : ""
            }
            <p class="small-copy">${escapeHtml(arena.readiness.nextUnlockCopy)}</p>
            ${renderArenaTrackCards(arena.readiness.trackCards)}
          </div>
          <div class="result-card coach-panel">
            <p class="panel-label">Current Set</p>
            ${
              session
                ? `
                  <div class="coach-panel-intro">
                    <div class="coach-card-title">${escapeHtml(session.trackLabel || "Adaptive set")}</div>
                    <p class="result-copy">${escapeHtml(session.focusReason || "The arena chooses one useful idea, then raises the heat only after it holds.")}</p>
                  </div>
                  <p class="small-copy"><strong>Focus:</strong> ${escapeHtml(session.skill.label)} • ${escapeHtml(
                    session.skill.stageLabel,
                  )}</p>
                  ${session.lastAdjustment ? `<p class="small-copy">${escapeHtml(session.lastAdjustment)}</p>` : ""}
                `
                : `
                  <div class="coach-panel-intro">
                    <div class="coach-card-title">No set running yet</div>
                    <p class="result-copy">Start a set and the arena will choose the weakest useful layer for this reader.</p>
                  </div>
                `
            }
            ${actionMarkup}
            ${renderArenaTranscript(session?.transcript || [])}
            ${
              session?.status === "completed"
                ? `
                  <div class="quiz-actions">
                    <button class="button button-primary${arenaState.loading ? " is-loading" : ""}" type="button" data-arena-start${buttonBusyAttrs(arenaState.loading)}>
                      ${buttonInnerMarkup("Start another set", "Starting…", arenaState.loading)}
                    </button>
                  </div>
                `
                : ""
            }
            ${arenaLoadingMarkup}
            ${arenaState.error ? `<p class="coach-error">${escapeHtml(arenaState.error)}</p>` : ""}
          </div>
        </div>
      </div>
    `;
  }

  function renderPracticeArenaPanels() {
    document.querySelectorAll("[data-practice-arena]").forEach((root) => {
      root.innerHTML = renderPracticeArenaMarkup();

      root.querySelectorAll("[data-arena-start]").forEach((button) => {
        button.addEventListener("click", async () => {
          if (!personalizationState.activeUserId || arenaState.loading) {
            return;
          }

          arenaState.loading = true;
          arenaState.error = "";
          syncPersonalizationUi();

          try {
            const payload = await apiJson(`/api/users/${personalizationState.activeUserId}/arena/start`, {
              method: "POST",
              body: JSON.stringify({}),
            });
            arenaState.data = payload.arena;
            await refreshActiveLearner();
            return;
          } catch (error) {
            arenaState.error = error.message;
          } finally {
            arenaState.loading = false;
            syncPersonalizationUi();
          }
        });
      });

      const form = root.querySelector("[data-arena-turn-form]");
      if (form) {
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          if (!personalizationState.activeUserId || arenaState.loading) {
            return;
          }

          const probeId = form.dataset.probeId;
          const answer = String(new FormData(form).get("answer") ?? "").trim();
          if (!answer) {
            arenaState.error = "Write an answer first.";
            syncPersonalizationUi();
            return;
          }

          arenaState.loading = true;
          arenaState.error = "";
          syncPersonalizationUi();

          try {
            const payload = await apiJson(`/api/users/${personalizationState.activeUserId}/arena/turn`, {
              method: "POST",
              body: JSON.stringify({ probeId, answer }),
            });
            arenaState.data = payload.arena;
            await refreshActiveLearner();
            return;
          } catch (error) {
            arenaState.error = error.message;
          } finally {
            arenaState.loading = false;
            syncPersonalizationUi();
          }
        });
      }
    });
  }

  function renderLearnerSidebarCards() {
    document.querySelectorAll("[data-learner-sidebar]").forEach((root) => {
      if (personalizationState.apiUnavailable) {
        root.innerHTML = `
          <p class="sidebar-label">Learner Context</p>
          <p>Personalization is unavailable because the local app server is not reachable.</p>
          <a class="sidebar-link" href="index.html#personal-coach">Open Personal Coach</a>
        `;
        return;
      }

      const user = personalizationState.user;

      root.innerHTML = `
        <p class="sidebar-label">Learner Context</p>
        ${
          user
            ? `
              <p><strong>${escapeHtml(user.name)}</strong></p>
              <p class="small-copy">@${escapeHtml(user.username || "unknown")}</p>
              <p><strong>${escapeHtml(user.stageLabel)}</strong></p>
              <p>${escapeHtml(user.nextAction)}</p>
              <a class="sidebar-link" href="arena.html">Open Practice Arena</a>
              <a class="sidebar-link" href="index.html#personal-coach">Open Personal Coach</a>
            `
            : `
              <p>Use the top-right profile menu once you want the course to remember progress for a reader.</p>
              <a class="sidebar-link" href="arena.html">Open Practice Arena</a>
              <a class="sidebar-link" href="index.html#personal-coach">Open Personal Coach</a>
            `
        }
      `;
    });
  }

  async function submitProfileLogin(form) {
    const formData = new FormData(form);
    const username = String(formData.get("username") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    if (!username || !password) {
      personalizationState.notice = "";
      personalizationState.error = "Enter both username and password.";
      syncPersonalizationUi();
      return;
    }

    try {
      personalizationState.notice = "";
      personalizationState.error = "";
      const payload = await apiJson("/api/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      personalizationState.activeUserId = payload.user.id;
      personalizationState.menuOpen = false;
      setStoredLearnerId(payload.user.id);
      personalizationState.user = payload.user;
      personalizationState.nextProbe = payload.nextProbe;
      personalizationState.lastReview = null;
      personalizationState.notice = `Profile opened for ${payload.user.name}.`;
    } catch (error) {
      personalizationState.notice = "";
      personalizationState.error = error.message;
    }

    syncPersonalizationUi();
    await refreshSupplementalCoachState();
  }

  function detachActiveProfile() {
    personalizationState.activeUserId = null;
    personalizationState.user = null;
    personalizationState.nextProbe = null;
    personalizationState.lastReview = null;
    personalizationState.probeLoading = false;
    personalizationState.error = "";
    personalizationState.notice = "Profile detached from this browser.";
    personalizationState.menuOpen = false;
    courseChatState.history = [];
    courseChatState.error = "";
    chapterCoachState.doubtChat = null;
    chapterCoachState.mastery = null;
    chapterCoachState.loadingScope = "";
    chapterCoachState.error = "";
    setStoredLearnerId(null);
    syncPersonalizationUi();
  }

  async function submitProfileReset(form) {
    if (!personalizationState.activeUserId) {
      return;
    }

    const password = String(new FormData(form).get("password") ?? "");
    if (!password) {
      personalizationState.notice = "";
      personalizationState.error = "Enter the profile password to reset progress.";
      syncPersonalizationUi();
      return;
    }

    try {
      personalizationState.notice = "";
      personalizationState.error = "";
      const payload = await apiJson(`/api/users/${personalizationState.activeUserId}/reset-progress`, {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      personalizationState.menuOpen = false;
      personalizationState.user = payload.user;
      personalizationState.nextProbe = payload.nextProbe;
      personalizationState.lastReview = null;
      personalizationState.notice = `Progress reset for ${payload.user.name}.`;
    } catch (error) {
      personalizationState.notice = "";
      personalizationState.error = error.message;
    }

    syncPersonalizationUi();
    await refreshSupplementalCoachState();
  }

  function renderTopbarPersonalization() {
    document.querySelectorAll("[data-topbar-personalization]").forEach((root) => {
      root.innerHTML = topbarPersonalizationMarkup();

      const toggle = root.querySelector("[data-topbar-menu-toggle]");
      if (toggle) {
        toggle.addEventListener("click", (event) => {
          event.stopPropagation();
          personalizationState.menuOpen = !personalizationState.menuOpen;
          syncPersonalizationUi();
        });
      }

      const loginForm = root.querySelector("#coach-login-form");
      if (loginForm) {
        loginForm.addEventListener("submit", async (event) => {
          event.preventDefault();
          await submitProfileLogin(loginForm);
        });
      }

      const logoutButton = root.querySelector("[data-logout-button]");
      if (logoutButton) {
        logoutButton.addEventListener("click", detachActiveProfile);
      }

      const resetForm = root.querySelector("#coach-reset-form");
      if (resetForm) {
        resetForm.addEventListener("submit", async (event) => {
          event.preventDefault();
          await submitProfileReset(resetForm);
        });
      }
    });
  }

  function renderPersonalizationHome() {
    document.querySelectorAll("[data-personalization-home]").forEach((root) => {
      root.innerHTML = personalCoachMarkup();

      const probeForm = root.querySelector("[data-probe-form]");
      if (probeForm) {
        probeForm.addEventListener("submit", async (event) => {
          event.preventDefault();
          if (!personalizationState.activeUserId || !personalizationState.nextProbe || personalizationState.probeLoading) {
            return;
          }

          const probe = personalizationState.nextProbe;
          let body;

          if (probe.format === "mcq") {
            const checked = probeForm.querySelector('input[name="probe-option"]:checked');
            if (!checked) {
              personalizationState.notice = "";
              personalizationState.error = "Choose an option before checking the probe.";
              syncPersonalizationUi();
              return;
            }
            body = {
              probeId: probe.id,
              answerIndex: Number(checked.value),
            };
          } else {
            const answer = String(new FormData(probeForm).get("answer") ?? "").trim();
            if (!answer) {
              personalizationState.notice = "";
              personalizationState.error = "Write an answer before checking the probe.";
              syncPersonalizationUi();
              return;
            }
            body = {
              probeId: probe.id,
              answer,
            };
          }

          try {
            personalizationState.notice = "";
            personalizationState.error = "";
            personalizationState.probeLoading = true;
            syncPersonalizationUi();
            const payload = await apiJson(`/api/users/${personalizationState.activeUserId}/probe-attempt`, {
              method: "POST",
              body: JSON.stringify(body),
            });
            personalizationState.user = payload.user;
            personalizationState.nextProbe = payload.nextProbe;
            personalizationState.lastReview = {
              probeId: probe.id,
              ...payload.evaluation,
              fallbackReason: payload.fallbackReason,
            };
          } catch (error) {
            personalizationState.notice = "";
            personalizationState.error = error.message;
          } finally {
            personalizationState.probeLoading = false;
          }

          syncPersonalizationUi();
        });
      }
    });
  }

  function renderCourseChatPanels() {
    document.querySelectorAll("[data-course-chat]").forEach((root) => {
      root.innerHTML = renderCourseChatMarkup();

      const form = root.querySelector("[data-course-chat-form]");
      if (form) {
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          if (!personalizationState.activeUserId || courseChatState.loading) {
            return;
          }

          const question = String(new FormData(form).get("question") ?? "").trim();
          if (!question) {
            courseChatState.error = "Write a question first.";
            syncPersonalizationUi();
            return;
          }

          courseChatState.loading = true;
          courseChatState.error = "";
          syncPersonalizationUi();

          try {
            const payload = await apiJson(`/api/users/${personalizationState.activeUserId}/course-chat/ask`, {
              method: "POST",
              body: JSON.stringify({ question }),
            });
            courseChatState.history = payload.chat.history || [];
          } catch (error) {
            courseChatState.error = error.message;
          }

          courseChatState.loading = false;
          syncPersonalizationUi();
        });
      }
    });
  }

  async function submitChapterDoubtTurn({ lessonSlug, question, selectedText = "" }) {
    if (!personalizationState.activeUserId || !lessonSlug || chapterCoachBusy()) {
      return null;
    }

    const trimmedQuestion = String(question ?? "").trim();
    if (!trimmedQuestion) {
      chapterCoachState.error = "Write a question first.";
      syncPersonalizationUi();
      return null;
    }

    chapterCoachState.loadingScope = "doubt";
    chapterCoachState.error = "";
    syncPersonalizationUi();

    try {
      const payload = await apiJson(`/api/users/${personalizationState.activeUserId}/chapters/${lessonSlug}/doubt-turn`, {
        method: "POST",
        body: JSON.stringify({
          question: trimmedQuestion,
          selectedText,
        }),
      });
      chapterCoachState.doubtChat = payload.doubtChat;
      return payload;
    } catch (error) {
      chapterCoachState.error = error.message;
      throw error;
    } finally {
      chapterCoachState.loadingScope = "";
      syncPersonalizationUi();
    }
  }

  function renderChapterCoachPanels() {
    const slug = currentLessonSlug();

    document.querySelectorAll("[data-chapter-doubt-chat]").forEach((root) => {
      root.innerHTML = renderChapterDoubtMarkup(root.dataset.chapterDoubtChat || slug || "");

      const form = root.querySelector("[data-chapter-doubt-form]");
      if (form) {
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const lessonSlug = form.dataset.chapterSlug;
          const question = String(new FormData(form).get("question") ?? "").trim();
          try {
            await submitChapterDoubtTurn({ lessonSlug, question });
          } catch {
            // State was already updated inside submitChapterDoubtTurn.
          }
        });
      }
    });

    document.querySelectorAll("[data-chapter-mastery]").forEach((root) => {
      root.innerHTML = renderChapterMasteryMarkup(root.dataset.chapterMastery || slug || "");

      const startButton = root.querySelector("[data-chapter-mastery-start]");
      if (startButton) {
        startButton.addEventListener("click", async () => {
          const lessonSlug = startButton.dataset.chapterSlug;
          if (!personalizationState.activeUserId || !lessonSlug || chapterCoachBusy()) {
            return;
          }

          chapterCoachState.loadingScope = "mastery";
          chapterCoachState.error = "";
          syncPersonalizationUi();

          try {
            const payload = await apiJson(`/api/users/${personalizationState.activeUserId}/chapters/${lessonSlug}/mastery-start`, {
              method: "POST",
              body: JSON.stringify({}),
            });
            chapterCoachState.mastery = payload.mastery;
          } catch (error) {
            chapterCoachState.error = error.message;
          }

          chapterCoachState.loadingScope = "";
          syncPersonalizationUi();
        });
      }

      const form = root.querySelector("[data-chapter-mastery-form]");
      if (form) {
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const lessonSlug = form.dataset.chapterSlug;
          const probeId = form.dataset.probeId;
          if (!personalizationState.activeUserId || !lessonSlug || !probeId || chapterCoachBusy()) {
            return;
          }

          const answer = String(new FormData(form).get("answer") ?? "").trim();
          if (!answer) {
            chapterCoachState.error = "Write an answer first.";
            syncPersonalizationUi();
            return;
          }

          chapterCoachState.loadingScope = "mastery";
          chapterCoachState.error = "";
          syncPersonalizationUi();

          try {
            const payload = await apiJson(`/api/users/${personalizationState.activeUserId}/chapters/${lessonSlug}/mastery-turn`, {
              method: "POST",
              body: JSON.stringify({ probeId, answer }),
            });
            chapterCoachState.mastery = payload.mastery;
          } catch (error) {
            chapterCoachState.error = error.message;
          }

          chapterCoachState.loadingScope = "";
          syncPersonalizationUi();
        });
      }
    });
  }

  function normalizedSelectionText(text) {
    return String(text ?? "").replace(/\s+/g, " ").trim();
  }

  function clampNumber(value, min, max) {
    return Math.max(min, Math.min(value, max));
  }

  function selectionCoachMinWidth() {
    return Math.min(280, Math.max(220, window.innerWidth - 24));
  }

  function selectionCoachMaxWidth() {
    return Math.max(selectionCoachMinWidth(), window.innerWidth - 24);
  }

  function selectionCoachDefaultWidth() {
    return Math.min(360, selectionCoachMaxWidth());
  }

  function selectionCoachMinHeight() {
    return Math.min(240, Math.max(180, window.innerHeight - 24));
  }

  function selectionCoachMaxHeight() {
    return Math.max(selectionCoachMinHeight(), window.innerHeight - 24);
  }

  function selectionCoachDefaultHeightEstimate() {
    return Math.min(420, selectionCoachMaxHeight());
  }

  function selectionCoachLayout() {
    const chipTop = Math.max(16, Math.min(selectionCoachState.top, window.innerHeight - 80));
    const chipLeft = Math.max(16, Math.min(selectionCoachState.left, window.innerWidth - 220));
    const panelWidth = clampNumber(
      selectionCoachState.panelWidth ?? selectionCoachDefaultWidth(),
      selectionCoachMinWidth(),
      selectionCoachMaxWidth(),
    );
    const panelHeight =
      selectionCoachState.panelHeight == null
        ? null
        : clampNumber(selectionCoachState.panelHeight, selectionCoachMinHeight(), selectionCoachMaxHeight());
    const fallbackHeight = panelHeight ?? selectionCoachDefaultHeightEstimate();
    const panelTop = clampNumber(
      selectionCoachState.panelTop ?? selectionCoachState.top + 52,
      16,
      Math.max(16, window.innerHeight - fallbackHeight - 16),
    );
    const panelLeft = clampNumber(
      selectionCoachState.panelLeft ?? selectionCoachState.left,
      16,
      Math.max(16, window.innerWidth - panelWidth - 16),
    );

    return {
      chipTop,
      chipLeft,
      panelTop,
      panelLeft,
      panelWidth,
      panelHeight,
    };
  }

  function syncSelectionCoachLayoutState() {
    if (!selectionCoachState.text) {
      return;
    }
    const layout = selectionCoachLayout();
    selectionCoachState.panelTop = layout.panelTop;
    selectionCoachState.panelLeft = layout.panelLeft;
    selectionCoachState.panelWidth = layout.panelWidth;
    if (selectionCoachState.panelHeight != null) {
      selectionCoachState.panelHeight = layout.panelHeight;
    }
  }

  function applySelectionCoachLayout() {
    const root = document.querySelector("[data-selection-coach-root]");
    if (!root) {
      return;
    }

    const layout = selectionCoachLayout();
    const chip = root.querySelector(".selection-coach-chip");
    if (chip) {
      chip.style.top = `${layout.chipTop}px`;
      chip.style.left = `${layout.chipLeft}px`;
    }

    const panel = root.querySelector("[data-selection-coach-panel]");
    if (panel) {
      panel.style.top = `${layout.panelTop}px`;
      panel.style.left = `${layout.panelLeft}px`;
      panel.style.width = `${layout.panelWidth}px`;
      if (layout.panelHeight == null) {
        panel.style.removeProperty("height");
      } else {
        panel.style.height = `${layout.panelHeight}px`;
      }
    }
  }

  function resetSelectionCoachPanelBox() {
    selectionCoachState.panelTop = null;
    selectionCoachState.panelLeft = null;
    selectionCoachState.panelWidth = null;
    selectionCoachState.panelHeight = null;
  }

  function clearSelectionCoachPointerState() {
    selectionCoachPointerState.mode = null;
    selectionCoachPointerState.pointerId = null;
    const panel = document.querySelector("[data-selection-coach-panel]");
    panel?.classList.remove("is-dragging", "is-resizing");
  }

  function startSelectionCoachPointerAction(event, mode) {
    if (!selectionCoachState.open || event.button !== 0) {
      return;
    }

    const panel = document.querySelector("[data-selection-coach-panel]");
    if (!panel) {
      return;
    }

    const rect = panel.getBoundingClientRect();
    selectionCoachState.panelTop = rect.top;
    selectionCoachState.panelLeft = rect.left;
    selectionCoachState.panelWidth = rect.width;
    if (mode === "resize") {
      selectionCoachState.panelHeight = rect.height;
    }

    selectionCoachPointerState.mode = mode;
    selectionCoachPointerState.pointerId = event.pointerId;
    selectionCoachPointerState.startX = event.clientX;
    selectionCoachPointerState.startY = event.clientY;
    selectionCoachPointerState.startTop = rect.top;
    selectionCoachPointerState.startLeft = rect.left;
    selectionCoachPointerState.startWidth = rect.width;
    selectionCoachPointerState.startHeight = rect.height;

    panel.classList.toggle("is-dragging", mode === "drag");
    panel.classList.toggle("is-resizing", mode === "resize");
    event.preventDefault();
    event.currentTarget?.setPointerCapture?.(event.pointerId);
  }

  function handleSelectionCoachPointerMove(event) {
    if (!selectionCoachState.open || selectionCoachPointerState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - selectionCoachPointerState.startX;
    const deltaY = event.clientY - selectionCoachPointerState.startY;
    if (selectionCoachPointerState.mode === "drag") {
      selectionCoachState.panelTop = selectionCoachPointerState.startTop + deltaY;
      selectionCoachState.panelLeft = selectionCoachPointerState.startLeft + deltaX;
    } else if (selectionCoachPointerState.mode === "resize") {
      selectionCoachState.panelWidth = selectionCoachPointerState.startWidth + deltaX;
      selectionCoachState.panelHeight = selectionCoachPointerState.startHeight + deltaY;
    } else {
      return;
    }

    syncSelectionCoachLayoutState();
    applySelectionCoachLayout();
    event.preventDefault();
  }

  function handleSelectionCoachPointerStop(event) {
    if (selectionCoachPointerState.pointerId !== event.pointerId) {
      return;
    }

    syncSelectionCoachLayoutState();
    applySelectionCoachLayout();
    clearSelectionCoachPointerState();
  }

  function selectionCoachAllowedNode(node) {
    const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    if (!element || !document.body.classList.contains("lesson-body")) {
      return false;
    }

    if (!element.closest(".main-content")) {
      return false;
    }

    if (
      element.closest(
        ".chapter-coach-block, .quiz-panel, .selection-coach, form, textarea, input, button, label, .topbar, .sidebar, .toc",
      )
    ) {
      return false;
    }

    return true;
  }

  function clearSelectionCoach({ keepReply = false } = {}) {
    selectionCoachState.text = "";
    selectionCoachState.lessonSlug = currentLessonSlug();
    selectionCoachState.open = false;
    resetSelectionCoachPanelBox();
    selectionCoachState.questionDraft = "";
    selectionCoachState.submitting = false;
    selectionCoachState.error = "";
    selectionCoachState.notice = "";
    if (!keepReply) {
      selectionCoachState.reply = "";
    }
  }

  function selectionCoachMarkup() {
    const lessonSlug = currentLessonSlug();
    const hasSelection = Boolean(selectionCoachState.text && lessonSlug);
    const layout = selectionCoachLayout();
    const panelStyles = [
      `top:${layout.panelTop}px`,
      `left:${layout.panelLeft}px`,
      `width:${layout.panelWidth}px`,
    ];
    if (layout.panelHeight != null) {
      panelStyles.push(`height:${layout.panelHeight}px`);
    }

    return `
      <button
        class="selection-coach-chip${hasSelection && !selectionCoachState.open ? "" : " is-hidden"}"
        type="button"
        style="top:${layout.chipTop}px; left:${layout.chipLeft}px;"
        data-selection-coach-open
      >
        Ask about this text
      </button>
      <section
        class="selection-coach${selectionCoachState.open && hasSelection ? "" : " is-hidden"}"
        style="${panelStyles.join("; ")}"
        aria-live="polite"
        data-selection-coach-panel
      >
        <div class="selection-coach-head" data-selection-coach-handle>
          <div class="selection-coach-title">Ask about this passage</div>
          <button class="selection-coach-close" type="button" data-selection-coach-close aria-label="Close text question">&times;</button>
        </div>
        <p class="selection-coach-excerpt">${escapeHtml(selectionCoachState.text)}</p>
        ${
          !personalizationState.activeUserId
            ? `
              <p class="result-copy">Log in from the top-right profile menu if you want the answer saved to this chapter and attached to your reader profile.</p>
              <div class="selection-coach-actions">
                <button class="button button-primary" type="button" data-selection-open-login>Open Profile Menu</button>
              </div>
            `
            : `
              <form class="selection-coach-form" data-selection-coach-form>
                <label class="probe-text-label" for="selection-coach-question">What feels unclear here?</label>
                <textarea id="selection-coach-question" name="question" placeholder="What does this mean in this chapter?">${escapeHtml(selectionCoachState.questionDraft)}</textarea>
                <div class="selection-coach-actions">
                  <button class="button button-primary${selectionCoachState.submitting ? " is-loading" : ""}" type="submit"${buttonBusyAttrs(selectionCoachState.submitting)}>
                    ${buttonInnerMarkup("Ask For Clarity", "Thinking…", selectionCoachState.submitting)}
                  </button>
                  <button class="button button-ghost" type="button" data-selection-coach-close>Close</button>
                </div>
              </form>
            `
        }
        ${
          selectionCoachState.submitting
            ? loadingStatusMarkup(
                "Getting clarity for this passage",
                "Codex is answering this exact highlighted text and saving the exchange in the chapter coach below.",
                { compact: true },
              )
            : ""
        }
        ${selectionCoachState.reply ? `<div class="selection-coach-reply">${escapeHtml(selectionCoachState.reply)}</div>` : ""}
        ${selectionCoachState.notice ? `<p class="coach-note">${escapeHtml(selectionCoachState.notice)}</p>` : ""}
        ${selectionCoachState.error ? `<p class="coach-error">${escapeHtml(selectionCoachState.error)}</p>` : ""}
        <div class="selection-coach-resize" data-selection-coach-resize aria-hidden="true"></div>
      </section>
    `;
  }

  function renderSelectionCoach() {
    let root = document.querySelector("[data-selection-coach-root]");
    if (!root) {
      root = document.createElement("div");
      root.dataset.selectionCoachRoot = "true";
      document.body.append(root);
    }

    if (!document.body.classList.contains("lesson-body")) {
      root.innerHTML = "";
      return;
    }

    root.innerHTML = selectionCoachMarkup();

    const openButton = root.querySelector("[data-selection-coach-open]");
    if (openButton) {
      openButton.addEventListener("mousedown", (event) => {
        event.preventDefault();
        selectionCoachState.open = true;
        selectionCoachState.error = "";
        selectionCoachState.notice = "";
        renderSelectionCoach();
      });
    }

    root.querySelectorAll("[data-selection-coach-close]").forEach((button) => {
      button.addEventListener("click", () => {
        clearSelectionCoachPointerState();
        clearSelectionCoach();
        renderSelectionCoach();
      });
    });

    const loginButton = root.querySelector("[data-selection-open-login]");
    if (loginButton) {
      loginButton.addEventListener("click", () => {
        personalizationState.menuOpen = true;
        syncPersonalizationUi();
      });
    }

    const form = root.querySelector("[data-selection-coach-form]");
    if (form) {
      const questionField = form.querySelector('textarea[name="question"]');
      if (questionField) {
        questionField.addEventListener("input", () => {
          selectionCoachState.questionDraft = questionField.value;
        });
      }

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const question = String(selectionCoachState.questionDraft || new FormData(form).get("question") || "").trim();
        if (!question) {
          selectionCoachState.error = "Write a question first.";
          renderSelectionCoach();
          return;
        }

        selectionCoachState.submitting = true;
        selectionCoachState.error = "";
        renderSelectionCoach();

        try {
          const payload = await submitChapterDoubtTurn({
            lessonSlug: selectionCoachState.lessonSlug || currentLessonSlug(),
            question,
            selectedText: selectionCoachState.text,
          });
          const reply = lastAssistantTurn(payload?.doubtChat?.history || []);
          selectionCoachState.questionDraft = "";
          selectionCoachState.reply = reply?.content || "";
          selectionCoachState.notice = "Saved in the chapter coach below so you can return to it later.";
        } catch {
          selectionCoachState.error ||= "Could not ask about this text right now.";
        }

        selectionCoachState.submitting = false;
        renderSelectionCoach();
      });
    }

    const dragHandle = root.querySelector("[data-selection-coach-handle]");
    if (dragHandle) {
      dragHandle.addEventListener("pointerdown", (event) => {
        if (event.target.closest("[data-selection-coach-close]")) {
          return;
        }
        startSelectionCoachPointerAction(event, "drag");
      });
    }

    const resizeHandle = root.querySelector("[data-selection-coach-resize]");
    if (resizeHandle) {
      resizeHandle.addEventListener("pointerdown", (event) => {
        startSelectionCoachPointerAction(event, "resize");
      });
    }
  }

  function syncSelectionCoachFromPage() {
    if (!document.body.classList.contains("lesson-body")) {
      renderSelectionCoach();
      return;
    }
    if (selectionCoachState.open) {
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      clearSelectionCoach();
      renderSelectionCoach();
      return;
    }

    const range = selection.getRangeAt(0);
    if (!selectionCoachAllowedNode(range.commonAncestorContainer)) {
      clearSelectionCoach();
      renderSelectionCoach();
      return;
    }

    const text = normalizedSelectionText(selection.toString());
    if (text.length < 12) {
      clearSelectionCoach();
      renderSelectionCoach();
      return;
    }

    const rect = range.getBoundingClientRect();
    selectionCoachState.text = text.slice(0, 360);
    selectionCoachState.lessonSlug = currentLessonSlug();
    selectionCoachState.top = rect.bottom + 12;
    selectionCoachState.left = rect.left;
    resetSelectionCoachPanelBox();
    selectionCoachState.questionDraft = "";
    selectionCoachState.error = "";
    selectionCoachState.notice = "";
    selectionCoachState.reply = "";
    renderSelectionCoach();
  }

  function initSelectionCoach() {
    if (!document.body.classList.contains("lesson-body")) {
      return;
    }

    document.addEventListener("selectionchange", () => {
      window.requestAnimationFrame(syncSelectionCoachFromPage);
    });

    window.addEventListener("pointermove", handleSelectionCoachPointerMove);
    window.addEventListener("pointerup", handleSelectionCoachPointerStop);
    window.addEventListener("pointercancel", handleSelectionCoachPointerStop);
    window.addEventListener("resize", () => {
      if (!selectionCoachState.text) {
        return;
      }
      syncSelectionCoachLayoutState();
      applySelectionCoachLayout();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && (selectionCoachState.text || selectionCoachState.open)) {
        clearSelectionCoachPointerState();
        clearSelectionCoach();
        renderSelectionCoach();
      }
    });

    renderSelectionCoach();
  }

  async function refreshSupplementalCoachState() {
    const lessonSlug = currentLessonSlug();
    chapterCoachState.slug = lessonSlug;

    if (personalizationState.apiUnavailable || !personalizationState.activeUserId) {
      courseChatState.history = [];
      courseChatState.error = "";
      chapterCoachState.doubtChat = null;
      chapterCoachState.mastery = null;
      chapterCoachState.loadingScope = "";
      chapterCoachState.error = "";
      arenaState.data = null;
      arenaState.error = "";
      syncPersonalizationUi();
      return;
    }

    if (document.querySelector("[data-course-chat]")) {
      try {
        const payload = await apiJson(`/api/users/${personalizationState.activeUserId}/course-chat/state`);
        courseChatState.history = payload.chat.history || [];
        courseChatState.error = "";
      } catch (error) {
        courseChatState.error = error.message;
      }
    }

    if (lessonSlug && document.querySelector("[data-chapter-doubt-chat], [data-chapter-mastery]")) {
      try {
        const payload = await apiJson(`/api/users/${personalizationState.activeUserId}/chapters/${lessonSlug}/coach-state`);
        chapterCoachState.doubtChat = payload.doubtChat;
        chapterCoachState.mastery = payload.mastery;
        chapterCoachState.error = "";
      } catch (error) {
        chapterCoachState.error = error.message;
      }
    }

    if (document.querySelector("[data-practice-arena]")) {
      try {
        const payload = await apiJson(`/api/users/${personalizationState.activeUserId}/arena/state`);
        arenaState.data = payload.arena;
        arenaState.error = "";
      } catch (error) {
        arenaState.error = error.message;
      }
    }

    syncPersonalizationUi();
  }

  function syncPersonalizationUi() {
    renderTopbarPersonalization();
    renderLearnerSidebarCards();
    renderPersonalizationHome();
    renderCourseChatPanels();
    renderChapterCoachPanels();
    renderPracticeArenaPanels();
    renderSelectionCoach();
  }

  function initPersonalizationMenuChrome() {
    document.addEventListener("click", (event) => {
      if (!personalizationState.menuOpen) {
        return;
      }

      if (event.target.closest("[data-topbar-personalization]")) {
        return;
      }

      personalizationState.menuOpen = false;
      syncPersonalizationUi();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !personalizationState.menuOpen) {
        return;
      }

      personalizationState.menuOpen = false;
      syncPersonalizationUi();
    });
  }

  async function refreshActiveLearner() {
    if (!personalizationState.activeUserId) {
      personalizationState.user = null;
      personalizationState.nextProbe = null;
      personalizationState.lastReview = null;
      syncPersonalizationUi();
      await refreshSupplementalCoachState();
      return;
    }

    const payload = await apiJson(`/api/users/${personalizationState.activeUserId}/state`);
    personalizationState.user = payload.user;
    personalizationState.nextProbe = payload.nextProbe;
    syncPersonalizationUi();
    await refreshSupplementalCoachState();
  }

  async function initPersonalization() {
    try {
      personalizationState.activeUserId = getStoredLearnerId();
      if (!personalizationState.activeUserId) {
        syncPersonalizationUi();
        return;
      }

      await refreshActiveLearner();
    } catch (error) {
      if (personalizationState.activeUserId && /not found/i.test(error.message)) {
        personalizationState.activeUserId = null;
        personalizationState.user = null;
        personalizationState.nextProbe = null;
        personalizationState.lastReview = null;
        personalizationState.error = "The stored reader profile is no longer available. Log in again.";
        personalizationState.notice = "";
        setStoredLearnerId(null);
        syncPersonalizationUi();
        return;
      }

      personalizationState.apiUnavailable = true;
      personalizationState.error = error.message;
      syncPersonalizationUi();
    }
  }

  function initLiveValues() {
    document.querySelectorAll("[data-live-value]").forEach((input) => {
      const target = document.getElementById(input.dataset.liveValue);
      if (!target) return;
      const sync = () => {
        target.textContent = input.value;
      };
      input.addEventListener("input", sync);
      sync();
    });
  }

  function initStressMapper() {
    const form = document.getElementById("stress-form");
    if (!form) return;

    const primary = document.getElementById("stress-primary");
    const explanation = document.getElementById("stress-explanation");
    const bars = document.getElementById("stress-bars");

    function readValues() {
      const data = new FormData(form);
      return {
        fanout: Number(data.get("fanout")),
        blob: Number(data.get("blob")),
        correctness: Number(data.get("correctness")),
        concurrency: Number(data.get("concurrency")),
        search: Number(data.get("search")),
        ingestion: Number(data.get("ingestion")),
        geo: Number(data.get("geo")),
        latency: Number(data.get("latency")),
      };
    }

    function score(values) {
      return archetypes
        .map((archetype) => {
          const total = Object.entries(archetype.weights).reduce((sum, [key, weight]) => {
            return sum + values[key] * weight;
          }, 0);
          return { ...archetype, total };
        })
        .sort((a, b) => b.total - a.total);
    }

    function render() {
      const values = readValues();
      const ranked = score(values);
      const [best, second] = ranked;
      const max = ranked[0].total || 1;

      primary.textContent = `${best.label}${second.total > best.total * 0.78 ? ` with a ${second.label} read/write sidecar` : ""}`;
      explanation.textContent =
        second.total > best.total * 0.78
          ? `${best.description} The second signal is ${second.label.toLowerCase()}, which suggests a hybrid path ownership split may matter.`
          : best.description;

      bars.innerHTML = ranked
        .map((item) => {
          const width = Math.max(8, Math.round((item.total / max) * 100));
          return `
            <div class="bar-row">
              <div class="bar-head">
                <span>${item.label}</span>
                <strong>${item.total.toFixed(1)}</strong>
              </div>
              <div class="bar-track">
                <div class="bar-fill" style="width: ${width}%"></div>
              </div>
            </div>
          `;
        })
        .join("");
    }

    form.addEventListener("input", render);
    render();
  }

  function initGuaranteeBuilder() {
    const form = document.getElementById("guarantee-form");
    if (!form) return;

    const family = document.getElementById("guarantee-family");
    const summary = document.getElementById("guarantee-summary");
    const actions = document.getElementById("guarantee-actions");

    function render() {
      const data = new FormData(form);
      const state = {
        consistency: data.get("consistency"),
        ordering: data.get("ordering"),
        retries: data.get("retries"),
        risk: data.get("risk"),
        sideEffects: data.get("sideEffects"),
      };

      const guidance = [];
      let familyLabel = "Flexible read-path system";
      let familySummary = "You are mostly optimizing for latency and operability, not for a hard correctness boundary.";

      if (state.consistency === "strong" || state.risk === "high") {
        familyLabel = "Transactional posture";
        familySummary = "The system has a narrow correctness-critical core. Design around strong state ownership and retry safety.";
      } else if (state.ordering === "causal" || state.ordering === "total") {
        familyLabel = "Coordination-heavy messaging or collaboration posture";
        familySummary = "Ordering is a first-class requirement, so transport and state ownership need to align to that boundary.";
      } else if (state.consistency === "eventual" && state.ordering === "none") {
        familyLabel = "Discovery or ingestion posture";
        familySummary = "Freshness is important, but temporary staleness is acceptable if throughput and latency stay healthy.";
      }

      if (state.consistency === "strong") {
        guidance.push("Define a small strong-consistency boundary around the scarce or money-critical state.");
      }

      if (state.ordering === "per-key") {
        guidance.push("Partition by the entity that defines the ordering boundary, not by a random hash that scatters writes.");
      }

      if (state.ordering === "causal" || state.ordering === "total") {
        guidance.push("Expect extra coordination cost. Be explicit about why weaker ordering would fail the product contract.");
      }

      if (state.retries === "yes") {
        guidance.push("Idempotency and deduplication are mandatory because retries turn rare failures into duplicate attempts.");
      }

      if (state.risk === "high") {
        guidance.push("Use an append-only ledger or durable audit trail so you can explain what happened after failures.");
      }

      if (state.sideEffects === "yes") {
        guidance.push("Use an outbox or durable workflow edge so side effects cannot disappear after the core commit succeeds.");
      }

      if (state.consistency !== "strong") {
        guidance.push("Take the scalability win where you can, but state the exact freshness budget you are accepting.");
      }

      family.textContent = familyLabel;
      summary.textContent = familySummary;
      actions.innerHTML = guidance.map((item) => `<li>${item}</li>`).join("");
    }

    form.addEventListener("input", render);
    render();
  }

  function initCriticalPathStudio() {
    const select = document.getElementById("path-system");
    const tasksRoot = document.getElementById("path-tasks");
    const description = document.getElementById("path-description");
    const checkButton = document.getElementById("path-check");
    const resetButton = document.getElementById("path-reset");
    const score = document.getElementById("path-score");
    const feedback = document.getElementById("path-feedback");

    if (!select || !tasksRoot) return;

    function renderScenario() {
      const scenario = criticalPathSystems[select.value];
      description.textContent = scenario.description;
      tasksRoot.innerHTML = scenario.tasks
        .map(
          (task, index) => `
            <article class="task-card" data-task-index="${index}">
              <h3>${task.title}</h3>
              <p>${task.summary}</p>
              <div class="task-controls">
                <button class="task-button" type="button" data-choice="sync">Sync</button>
                <button class="task-button" type="button" data-choice="async">Async</button>
              </div>
              <div class="task-answer" hidden></div>
            </article>
          `,
        )
        .join("");

      tasksRoot.querySelectorAll(".task-button").forEach((button) => {
        button.addEventListener("click", () => {
          const card = button.closest(".task-card");
          card.dataset.selected = button.dataset.choice;
          card.querySelectorAll(".task-button").forEach((candidate) => {
            candidate.classList.toggle("is-selected", candidate === button);
          });
        });
      });

      score.textContent = "Pick a classification for each task.";
      feedback.textContent =
        "The point is to justify what truly belongs in the user-facing path and what should be deferred behind retries.";
    }

    function checkAnswers() {
      const scenario = criticalPathSystems[select.value];
      const cards = [...tasksRoot.querySelectorAll(".task-card")];
      let correct = 0;
      let unanswered = 0;

      cards.forEach((card) => {
        const task = scenario.tasks[Number(card.dataset.taskIndex)];
        const answer = card.dataset.selected;
        const answerBox = card.querySelector(".task-answer");

        card.classList.remove("is-correct", "is-wrong");

        if (!answer) {
          unanswered += 1;
          answerBox.hidden = false;
          answerBox.textContent = `Unanswered. Model answer: ${task.answer.toUpperCase()}. ${task.why}`;
          return;
        }

        if (answer === task.answer) {
          correct += 1;
          card.classList.add("is-correct");
          answerBox.hidden = false;
          answerBox.textContent = `Correct. ${task.why}`;
        } else {
          card.classList.add("is-wrong");
          answerBox.hidden = false;
          answerBox.textContent = `Model answer: ${task.answer.toUpperCase()}. ${task.why}`;
        }
      });

      score.textContent = `${correct}/${scenario.tasks.length} correct`;

      if (correct === scenario.tasks.length) {
        feedback.textContent = "Good. The next level is being able to say why the opposite choice would fail under scale or retries.";
      } else if (unanswered > 0) {
        feedback.textContent = "A skipped answer usually means the sync-versus-async boundary is still fuzzy. Focus on what must happen before the user can trust the result.";
      } else {
        feedback.textContent = "Look at the misses and ask what would break if you moved that task to the other side of the critical path.";
      }
    }

    function resetScenario() {
      renderScenario();
    }

    select.addEventListener("change", renderScenario);
    checkButton.addEventListener("click", checkAnswers);
    resetButton.addEventListener("click", resetScenario);
    renderScenario();
  }

  function initCourseMaps() {
    document.querySelectorAll("[data-course-map]").forEach((root) => {
      const detailStage = root.querySelector("[data-map-detail-stage]");
      const detailTitle = root.querySelector("[data-map-detail-title]");
      const detailSummary = root.querySelector("[data-map-detail-summary]");
      const buttons = [...root.querySelectorAll("[data-map-node]")];

      buttons.forEach((button) => {
        button.addEventListener("click", () => {
          buttons.forEach((candidate) => {
            candidate.classList.toggle("is-current", candidate === button);
          });

          detailStage.textContent = button.dataset.mapStage;
          detailTitle.textContent = button.dataset.mapTitle;
          detailSummary.textContent = button.dataset.mapSummary;
        });
      });
    });
  }

  function renderJourneyVisual(root) {
    root.innerHTML = `
      <div class="visual-board">
        <div class="journey-strip">
          ${courseJourney
            .map(
              (step, index) => `
                <button class="journey-node${index === 0 ? " is-current" : ""}" type="button" data-journey-node="${step.slug}">
                  <span>${step.stage}</span>
                  <strong>${step.label}</strong>
                </button>
              `,
            )
            .join("")}
        </div>
        <div class="visual-output">
          <p class="panel-label" id="journey-stage">${courseJourney[0].stage}</p>
          <h3 id="journey-title">${courseJourney[0].label}</h3>
          <p id="journey-summary">${courseJourney[0].summary}</p>
        </div>
      </div>
    `;

    const stage = root.querySelector("#journey-stage");
    const title = root.querySelector("#journey-title");
    const summary = root.querySelector("#journey-summary");
    const buttons = [...root.querySelectorAll("[data-journey-node]")];

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        const step = courseJourney.find((item) => item.slug === button.dataset.journeyNode);
        if (!step) return;

        buttons.forEach((candidate) => candidate.classList.toggle("is-current", candidate === button));
        stage.textContent = step.stage;
        title.textContent = step.label;
        summary.textContent = step.summary;
      });
    });
  }

  function initStartLessonPractice() {
    document.querySelectorAll("[data-start-lens-root]").forEach((root) => {
      root.innerHTML = `
        <div class="task-grid">
          ${startLessonComparisons
            .map(
              (item, index) => `
                <article class="task-card" data-lens-index="${index}">
                  <p class="panel-label">${item.title}</p>
                  <h3>${item.prompt}</h3>
                  <div class="task-controls">
                    ${item.options
                      .map(
                        (option, optionIndex) => `
                          <button class="task-button" type="button" data-lens-choice="${optionIndex}">
                            ${optionIndex === 0 ? "A" : "B"}
                          </button>
                        `,
                      )
                      .join("")}
                  </div>
                  <p class="result-copy">${item.options
                    .map((option, optionIndex) => `${optionIndex === 0 ? "A" : "B"}. ${option}`)
                    .join(" ")}</p>
                  <div class="task-answer" hidden></div>
                </article>
              `,
            )
            .join("")}
        </div>
        <div class="quiz-actions">
          <button class="button button-primary" type="button" data-lens-action="check">Check Choices</button>
          <button class="button button-ghost" type="button" data-lens-action="reset">Reset</button>
        </div>
        <div class="quiz-summary" data-lens-summary hidden>
          <strong>Result</strong>
          <span data-lens-summary-copy></span>
        </div>
      `;

      root.querySelectorAll("[data-lens-choice]").forEach((button) => {
        button.addEventListener("click", () => {
          const card = button.closest("[data-lens-index]");
          card.dataset.selected = button.dataset.lensChoice;
          card.querySelectorAll("[data-lens-choice]").forEach((candidate) => {
            candidate.classList.toggle("is-selected", candidate === button);
          });
        });
      });

      root.querySelector('[data-lens-action="check"]').addEventListener("click", () => {
        let correct = 0;
        let unanswered = 0;

        root.querySelectorAll("[data-lens-index]").forEach((card) => {
          const item = startLessonComparisons[Number(card.dataset.lensIndex)];
          const selected = Number(card.dataset.selected);
          const answerBox = card.querySelector(".task-answer");

          card.classList.remove("is-correct", "is-wrong");

          if (Number.isNaN(selected)) {
            unanswered += 1;
            answerBox.hidden = false;
            answerBox.textContent = `Unanswered. Better choice: ${item.answer === 0 ? "A" : "B"}. ${item.why}`;
            return;
          }

          if (selected === item.answer) {
            correct += 1;
            card.classList.add("is-correct");
            answerBox.hidden = false;
            answerBox.textContent = `Good. ${item.why}`;
            return;
          }

          card.classList.add("is-wrong");
          answerBox.hidden = false;
          answerBox.textContent = `Better choice: ${item.answer === 0 ? "A" : "B"}. ${item.why}`;
        });

        const summary = root.querySelector("[data-lens-summary]");
        const summaryCopy = root.querySelector("[data-lens-summary-copy]");
        summary.hidden = false;

        if (correct === startLessonComparisons.length) {
          summaryCopy.textContent =
            "You are reading the chapter the right way: the stronger answer is the one that starts from pressure, boundaries, and explanation.";
        } else if (unanswered > 0) {
          summaryCopy.textContent =
            `You answered ${correct}/${startLessonComparisons.length}. If you are hesitating, that usually means the difference between memorized and reasoned explanation is not stable yet.`;
        } else {
          summaryCopy.textContent =
            `You answered ${correct}/${startLessonComparisons.length}. Re-read the stronger statements and notice that each one explains why, not just what.`;
        }
      });

      root.querySelector('[data-lens-action="reset"]').addEventListener("click", () => {
        root.querySelectorAll("[data-lens-index]").forEach((card) => {
          delete card.dataset.selected;
          card.classList.remove("is-correct", "is-wrong");
          card.querySelectorAll("[data-lens-choice]").forEach((button) => {
            button.classList.remove("is-selected");
          });
          const answerBox = card.querySelector(".task-answer");
          answerBox.hidden = true;
          answerBox.textContent = "";
        });

        const summary = root.querySelector("[data-lens-summary]");
        const summaryCopy = root.querySelector("[data-lens-summary-copy]");
        summary.hidden = true;
        summaryCopy.textContent = "";
      });
    });
  }

  function renderPressureVisual(root) {
    root.innerHTML = `
      <div class="visual-board">
        <div class="visual-controls">
          <label>
            <span>Load</span>
            <input type="range" min="0" max="4" value="2" name="load" />
          </label>
          <label>
            <span>Fanout</span>
            <input type="range" min="0" max="4" value="1" name="fanout" />
          </label>
          <label>
            <span>Skew</span>
            <input type="range" min="0" max="4" value="1" name="skew" />
          </label>
          <label>
            <span>Latency sensitivity</span>
            <input type="range" min="0" max="4" value="3" name="latency" />
          </label>
        </div>
        <div class="visual-output">
          <p class="panel-label">Step 1 · Read The Pressure</p>
          <p class="result-copy">
            This panel is not giving you an architecture. It only helps you see which
            <a class="term-link" href="glossary.html#pressure">pressure</a>
            is loudest so you know what to inspect first.
          </p>
          <div class="signal-grid" id="pressure-signals"></div>
          <p class="panel-label">Inspect First</p>
          <h3 id="pressure-title"></h3>
          <p id="pressure-copy" class="result-copy"></p>
        </div>
        <div class="visual-controls">
          <label>
            <span>Data shape</span>
            <select name="dataShape">
              <option value="append">Append-only history</option>
              <option value="mutable">Mutable records</option>
              <option value="blob">Large blobs</option>
              <option value="timeseries">Time-series points</option>
              <option value="document">Documents / text</option>
            </select>
          </label>
          <label>
            <span>Query shape</span>
            <select name="queryShape">
              <option value="point">Point lookup by ID</option>
              <option value="range" selected>Recent range by time</option>
              <option value="text">Full-text search</option>
              <option value="aggregate">Aggregation over many rows</option>
              <option value="ranking">Top-N / ranked retrieval</option>
            </select>
          </label>
        </div>
        <div class="visual-output">
          <p class="panel-label">Step 2 · Read The Data And Query Pair</p>
          <h3 id="shape-title"></h3>
          <p id="shape-copy" class="result-copy"></p>
          <ul id="shape-next" class="insight-list"></ul>
        </div>
      </div>
    `;

    const inputs = [...root.querySelectorAll('input[type="range"]')];
    const dataShapeInput = root.querySelector('select[name="dataShape"]');
    const queryShapeInput = root.querySelector('select[name="queryShape"]');
    const title = root.querySelector("#pressure-title");
    const copy = root.querySelector("#pressure-copy");
    const signals = root.querySelector("#pressure-signals");
    const shapeTitle = root.querySelector("#shape-title");
    const shapeCopy = root.querySelector("#shape-copy");
    const shapeNext = root.querySelector("#shape-next");

    const dataShapeLabels = {
      append: "append-only history",
      mutable: "mutable records",
      blob: "large blobs",
      timeseries: "time-series points",
      document: "documents / text",
    };

    const queryShapeLabels = {
      point: "point lookup",
      range: "recent range read",
      text: "full-text search",
      aggregate: "aggregation",
      ranking: "ranked retrieval",
    };

    function describeAccessShape(values, dataShape, queryShape) {
      let title = `${dataShapeLabels[dataShape]} + ${queryShapeLabels[queryShape]}`;
      let copy =
        "Carry both shapes into the next chapter. The stored thing and the read pattern are separate questions, and both constrain what storage discussion is even sensible.";
      const next = [];

      if (dataShape === "append" && queryShape === "range") {
        title = "Conversation Or Event Timeline";
        copy =
          "History itself is part of the product. The next storage discussion should ask what entity owns the timeline, how recent windows are read, and where ordering or hot channels can become painful.";
      } else if (dataShape === "mutable" && queryShape === "point") {
        title = "Entity Record Path";
        copy =
          "The access pattern is mostly direct by key, which sounds simple until one entity becomes much hotter than the rest. Carry key ownership and update hotspots into the next chapter.";
      } else if (dataShape === "blob" && queryShape === "point") {
        title = "Large Object Path";
        copy =
          "Payload size dominates this path more than row count does. The next storage conversation should separate blob handling from metadata handling and ask what work happens after acceptance.";
      } else if (dataShape === "timeseries" && queryShape === "aggregate") {
        title = "Telemetry Window Read";
        copy =
          "This path combines heavy ingest with time-window reads and rollups. The next chapter should ask how raw history, summaries, and hot tag combinations interact under bursty write pressure.";
      } else if (dataShape === "document" && queryShape === "text") {
        title = "Searchable Corpus";
        copy =
          "The stored document and the read path are different enough that the next chapter must think about source data and search-friendly representation together.";
      } else if (dataShape === "document" && queryShape === "ranking") {
        title = "Ranked Discovery View";
        copy =
          "The system is not only serving stored data; it is producing ordered answers from many candidates. Carry retrieval cost, freshness expectations, and hot query patterns into the next chapter.";
      }

      if (dataShape === "append") {
        next.push("Ask what entity, channel, or timeline naturally owns the history.");
      } else if (dataShape === "mutable") {
        next.push("Ask which records update frequently enough to become hot under skew.");
      } else if (dataShape === "blob") {
        next.push("Ask whether payload bytes and metadata should travel on different paths.");
      } else if (dataShape === "timeseries") {
        next.push("Ask how much raw history versus summarized history the product really needs.");
      } else if (dataShape === "document") {
        next.push("Ask whether the source representation and the search representation can stay the same.");
      }

      if (queryShape === "point") {
        next.push("Ask whether most reads can stay local to one key or entity.");
      } else if (queryShape === "range") {
        next.push("Ask what defines the range boundary: time, conversation, tenant, or something else.");
      } else if (queryShape === "text") {
        next.push("Ask how fresh search results must be after writes land.");
      } else if (queryShape === "aggregate") {
        next.push("Ask whether aggregate views may lag behind raw ingest during spikes.");
      } else if (queryShape === "ranking") {
        next.push("Ask whether the ranked answer is read directly or derived from a larger candidate set.");
      }

      if (values.fanout >= 3) {
        next.push("Carry hidden downstream work forward; one visible action may create much more write load than request count suggests.");
      }

      if (values.skew >= 3) {
        next.push("Expect local pain before global pain. One key, term, channel, or region can dominate the path.");
      }

      return { title, copy, next: next.slice(0, 4) };
    }

    function render() {
      const values = Object.fromEntries(inputs.map((input) => [input.name, Number(input.value)]));
      const readings = [
        {
          label: "Load",
          value: values.load,
          summary:
            'Start by asking how much work arrives over time: average traffic, peak traffic, and whether the system is bursty.',
        },
        {
          label: "Latency sensitivity",
          value: values.latency,
          summary:
            'Start by asking how quickly the user needs a result and how bad the slowest normal requests are allowed to feel.',
        },
        {
          label: "Fanout",
          value: values.fanout,
          summary:
            'Start by asking how much downstream work one user action creates. One logical write can expand into many internal actions.',
        },
        {
          label: "Skew",
          value: values.skew,
          summary:
            'Start by asking whether a few users, groups, keys, or regions can become much hotter than the average.',
        },
      ];

      const ranked = readings
        .map((item, index) => ({ ...item, index }))
        .sort((a, b) => b.value - a.value || a.index - b.index);

      const max = 4;
      signals.innerHTML = ranked
        .map(
          (item) => `
            <div class="signal-card">
              <strong><span>${item.label}</span><span>${item.value}/4</span></strong>
              <div class="signal-track"><div class="signal-fill" style="width: ${Math.round((item.value / max) * 100)}%"></div></div>
            </div>
          `,
        )
        .join("");

      const topValue = ranked[0].value;
      const topReadings = ranked.filter((item) => item.value === topValue);

      if (topReadings.length === 1) {
        title.textContent = topReadings[0].label;
        copy.textContent = topReadings[0].summary;
      } else {
        title.textContent = topReadings.map((item) => item.label).join(" + ");
        copy.textContent =
          "There is no single dominant pressure in this setup yet. Treat the tied items as the first questions to clarify before choosing components.";
      }

      const accessShape = describeAccessShape(values, dataShapeInput.value, queryShapeInput.value);
      shapeTitle.textContent = accessShape.title;
      shapeCopy.textContent = accessShape.copy;
      shapeNext.innerHTML = accessShape.next.map((item) => `<li>${item}</li>`).join("");
    }

    inputs.forEach((input) => input.addEventListener("input", render));
    dataShapeInput.addEventListener("input", render);
    queryShapeInput.addEventListener("input", render);
    render();
  }

  function renderStorageVisual(root) {
    root.innerHTML = `
      <div class="visual-board">
        <div class="visual-controls">
          <label>
            <span>Primary read shape</span>
            <select name="read">
              <option value="point">Point lookup</option>
              <option value="range">Partition-local range / time window</option>
              <option value="text">Full-text search</option>
              <option value="aggregation">Aggregation over many rows</option>
              <option value="traversal">Relationship traversal</option>
              <option value="nearby">Nearby / geospatial lookup</option>
              <option value="blob">Large blob fetch</option>
            </select>
          </label>
          <label>
            <span>Data organization</span>
            <select name="structure">
              <option value="flat">Flat records</option>
              <option value="nested">Nested documents</option>
              <option value="wide">Wide sparse rows</option>
              <option value="relationships">Relationship edges</option>
              <option value="blob">Large blobs</option>
            </select>
          </label>
          <label>
            <span>Write shape</span>
            <select name="write">
              <option value="mutable">Mutable state</option>
              <option value="append">Append-heavy history</option>
              <option value="immutable">Mostly immutable objects</option>
            </select>
          </label>
          <label>
            <span>Cross-record constraints</span>
            <select name="constraints">
              <option value="yes">Important</option>
              <option value="no">Not central</option>
            </select>
          </label>
          <label>
            <span>History and replay</span>
            <select name="history">
              <option value="no">Not central</option>
              <option value="yes">Important</option>
            </select>
          </label>
        </div>
        <div class="visual-output">
          <p class="panel-label">How To Read This</p>
          <p class="result-copy">
            This panel stays inside chapter 02 ideas. You are comparing storage families by
            read shape, data organization, write shape, constraints, and whether history matters.
          </p>
          <div class="visual-list" id="storage-rankings"></div>
        </div>
      </div>
    `;

    const controls = [...root.querySelectorAll("select")];
    const rankings = root.querySelector("#storage-rankings");

    function render() {
      const inputs = Object.fromEntries(controls.map((control) => [control.name, control.value]));
      const ranked = storageProfiles
        .map((profile) => ({ ...profile, total: profile.score(inputs) }))
        .sort((a, b) => b.total - a.total);

      rankings.innerHTML = ranked
        .map(
          (profile, index) => `
            <article class="rank-card${index === 0 ? " is-top" : ""}">
              <div class="rank-head">
                <strong>${profile.label}</strong>
                <span>${profile.total}</span>
              </div>
              <p>${profile.description}</p>
            </article>
          `,
        )
        .join("");
    }

    controls.forEach((control) => control.addEventListener("input", render));
    render();
  }

  function renderGuaranteeVisual(root) {
    root.innerHTML = `
      <div class="visual-board">
        <div class="visual-controls">
          <label>
            <span>Stale reads are</span>
            <select name="stale">
              <option value="cheap">Tolerable</option>
              <option value="dangerous">Dangerous</option>
            </select>
          </label>
          <label>
            <span>Retries happen</span>
            <select name="retries">
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <label>
            <span>Shared scarce state exists</span>
            <select name="scarce">
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <label>
            <span>Ordering needed</span>
            <select name="ordering">
              <option value="none">None</option>
              <option value="per-key">Per-key</option>
              <option value="causal">Causal</option>
            </select>
          </label>
        </div>
        <div class="visual-output">
          <p class="panel-label">Required safeguards</p>
          <ul class="insight-list" id="guarantee-stack"></ul>
        </div>
      </div>
    `;

    const controls = [...root.querySelectorAll("select")];
    const stack = root.querySelector("#guarantee-stack");

    function render() {
      const state = Object.fromEntries(controls.map((control) => [control.name, control.value]));
      const items = [];

      if (state.stale === "dangerous") items.push("Narrow strong-consistency boundary around the state that cannot go stale.");
      else items.push("State can be relaxed, but you still need to name the freshness budget.");

      if (state.retries === "yes") items.push("Idempotency and deduplication must exist because duplicate attempts are part of reality.");
      if (state.scarce === "yes") items.push("Use a reservation or locking strategy so concurrent claims do not create invalid outcomes.");
      if (state.ordering === "per-key") items.push("Align partitioning to the entity whose updates must stay in order.");
      if (state.ordering === "causal") items.push("Expect higher coordination cost and justify why weaker ordering would fail the product contract.");

      stack.innerHTML = items.map((item) => `<li>${item}</li>`).join("");
    }

    controls.forEach((control) => control.addEventListener("input", render));
    render();
  }

  function renderFlowVisual(root) {
    root.innerHTML = `
      <div class="visual-board">
        <div class="visual-controls">
          <label>
            <span>Scenario</span>
            <select id="flow-scenario">
              <option value="youtube">YouTube upload</option>
              <option value="stripe">Stripe payments</option>
              <option value="whatsapp">WhatsApp messaging</option>
              <option value="airbnb">Airbnb booking</option>
            </select>
          </label>
          <button class="button button-secondary" type="button" id="flow-split">Reveal Healthy Split</button>
        </div>
        <div class="flow-lane">
          <p class="panel-label">Scenario framing</p>
          <p class="result-copy" id="flow-description"></p>
        </div>
        <div class="lane-grid">
          <div class="flow-lane">
            <p class="panel-label">Hot Path</p>
            <div class="lane-body" id="flow-sync"></div>
          </div>
          <div class="flow-lane">
            <p class="panel-label">Deferred Path</p>
            <div class="lane-body" id="flow-async"></div>
          </div>
        </div>
      </div>
    `;

    const select = root.querySelector("#flow-scenario");
    const button = root.querySelector("#flow-split");
    const description = root.querySelector("#flow-description");
    const syncLane = root.querySelector("#flow-sync");
    const asyncLane = root.querySelector("#flow-async");

    function render(showSplit = false) {
      const scenario = criticalPathSystems[select.value];
      description.textContent = scenario.description;
      if (!showSplit) {
        const allTasks = scenario.tasks
          .map((task) => `<div class="flow-token">${task.title}</div>`)
          .join("");
        syncLane.innerHTML = allTasks;
        asyncLane.innerHTML = `<p class="lane-hint">Reveal the split to see what has to finish before the response can be truthful.</p>`;
        return;
      }

      syncLane.innerHTML = scenario.tasks
        .filter((task) => task.answer === "sync")
        .map((task) => `<div class="flow-token is-sync">${task.title}</div>`)
        .join("");
      asyncLane.innerHTML = scenario.tasks
        .filter((task) => task.answer === "async")
        .map((task) => `<div class="flow-token is-async">${task.title}</div>`)
        .join("");
    }

    select.addEventListener("change", () => render(false));
    button.addEventListener("click", () => render(true));
    select.value = "youtube";
    render(false);
  }

  function renderFrameworkVisual(root) {
    root.innerHTML = `
      <div class="visual-board">
        <div class="result-card scenario-card">
          <p class="panel-label">Interview design ask</p>
          <div class="result-headline">Design Slack messaging</div>
          <p class="result-copy">
            Click through the questions. Each one should pull something concrete out of the design ask before any architecture boxes appear.
          </p>
        </div>
        <div class="bucket-tabs">
          ${frameworkQuestionGuide
            .map(
              (item, index) => `
                <button class="bucket-tab${index === 0 ? " is-current" : ""}" type="button" data-framework-question="${item.key}">
                  <span class="map-node-index">${item.number}</span>
                  <span>${item.short}</span>
                </button>
              `,
            )
            .join("")}
        </div>
        <div class="visual-output">
          <p class="panel-label" id="framework-stage">Question 1</p>
          <h3 id="framework-focus">${frameworkQuestionGuide[0].title}</h3>
          <p id="framework-answer" class="result-copy">${frameworkQuestionGuide[0].answer}</p>
          <ul id="framework-insights" class="insight-list">
            ${frameworkQuestionGuide[0].insights.map((item) => `<li>${item}</li>`).join("")}
          </ul>
          <p class="panel-label">Where It Lands Next</p>
          <p id="framework-next" class="result-copy">${frameworkQuestionGuide[0].next}</p>
        </div>
      </div>
    `;

    const stage = root.querySelector("#framework-stage");
    const focus = root.querySelector("#framework-focus");
    const answer = root.querySelector("#framework-answer");
    const insights = root.querySelector("#framework-insights");
    const next = root.querySelector("#framework-next");
    const buttons = [...root.querySelectorAll("[data-framework-question]")];

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        const item = frameworkQuestionGuide.find((candidate) => candidate.key === button.dataset.frameworkQuestion);
        buttons.forEach((candidate) => candidate.classList.toggle("is-current", candidate === button));
        stage.textContent = `Question ${String(Number(item.number))}`;
        focus.textContent = item.title;
        answer.textContent = item.answer;
        insights.innerHTML = item.insights.map((entry) => `<li>${entry}</li>`).join("");
        next.textContent = item.next;
      });
    });
  }

  function renderArchetypeVisual(root) {
    const keys = Object.keys(archetypeReadGuide);
    const first = archetypeReadGuide[keys[0]];

    root.innerHTML = `
      <div class="visual-board">
        <div class="result-card scenario-card">
          <p class="panel-label">Recognition rule</p>
          <div class="result-headline">Start from the design ask, not the brand</div>
          <p class="result-copy">
            Click a concrete system and ask what pressure dominates that path. The archetype label should feel earned by the read.
          </p>
        </div>
        <div class="bucket-tabs">
          ${keys
            .map(
              (key, index) => `
                <button class="bucket-tab${index === 0 ? " is-current" : ""}" type="button" data-archetype-tab="${key}">
                  ${archetypeReadGuide[key].button}
                </button>
              `,
            )
            .join("")}
        </div>
        <div class="visual-output">
          <p class="panel-label">Design ask</p>
          <p id="archetype-prompt" class="result-copy">${first.prompt}</p>
          <p class="panel-label">Most likely archetype</p>
          <div id="archetype-title" class="result-headline">${first.archetype}</div>
          <ul id="archetype-why" class="insight-list">
            ${first.why.map((item) => `<li>${item}</li>`).join("")}
          </ul>
          <p id="archetype-components"><strong>Component pull:</strong> ${first.components}</p>
          <p id="archetype-tradeoff"><strong>Expected tradeoff:</strong> ${first.tradeoff}</p>
          <p id="archetype-failure"><strong>First failure:</strong> ${first.failure}</p>
        </div>
      </div>
    `;

    const prompt = root.querySelector("#archetype-prompt");
    const title = root.querySelector("#archetype-title");
    const why = root.querySelector("#archetype-why");
    const components = root.querySelector("#archetype-components");
    const tradeoff = root.querySelector("#archetype-tradeoff");
    const failure = root.querySelector("#archetype-failure");
    const buttons = [...root.querySelectorAll("[data-archetype-tab]")];

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        const guide = archetypeReadGuide[button.dataset.archetypeTab];
        buttons.forEach((candidate) => candidate.classList.toggle("is-current", candidate === button));
        prompt.textContent = guide.prompt;
        title.textContent = guide.archetype;
        why.innerHTML = guide.why.map((entry) => `<li>${entry}</li>`).join("");
        components.innerHTML = `<strong>Component pull:</strong> ${guide.components}`;
        tradeoff.innerHTML = `<strong>Expected tradeoff:</strong> ${guide.tradeoff}`;
        failure.innerHTML = `<strong>First failure:</strong> ${guide.failure}`;
      });
    });
  }

  function renderHybridVisual(root) {
    const systemKeys = Object.keys(hybridGuide);
    let currentSystem = systemKeys[0];
    let currentPath = Object.keys(hybridGuide[currentSystem].paths)[0];

    root.innerHTML = `
      <div class="visual-board">
        <div class="result-card scenario-card">
          <p class="panel-label">Whole product design ask</p>
          <div class="result-headline" id="hybrid-system-name">${hybridGuide[currentSystem].button}</div>
          <p class="result-copy" id="hybrid-prompt">${hybridGuide[currentSystem].prompt}</p>
          <p class="result-copy">
            Hybrid thinking starts by slicing the product into paths. The owner should change only when the dominant stress really changes.
          </p>
        </div>
        <div class="bucket-tabs">
          ${systemKeys
            .map(
              (key, index) => `
                <button class="bucket-tab${index === 0 ? " is-current" : ""}" type="button" data-hybrid-system="${key}">
                  ${hybridGuide[key].button}
                </button>
              `,
            )
            .join("")}
        </div>
        <div class="button-row" id="hybrid-path-tabs"></div>
        <div class="visual-output">
          <p class="panel-label">Selected path</p>
          <h3 id="hybrid-path-name"></h3>
          <p class="panel-label">Path owner</p>
          <div id="hybrid-owner" class="result-headline"></div>
          <ul id="hybrid-why" class="insight-list"></ul>
          <p id="hybrid-secondary" class="result-copy"></p>
          <p id="hybrid-components" class="result-copy"></p>
          <p id="hybrid-tradeoff" class="result-copy"></p>
          <p id="hybrid-failure" class="result-copy"></p>
        </div>
      </div>
    `;

    const systemName = root.querySelector("#hybrid-system-name");
    const prompt = root.querySelector("#hybrid-prompt");
    const pathTabs = root.querySelector("#hybrid-path-tabs");
    const pathName = root.querySelector("#hybrid-path-name");
    const owner = root.querySelector("#hybrid-owner");
    const why = root.querySelector("#hybrid-why");
    const secondary = root.querySelector("#hybrid-secondary");
    const components = root.querySelector("#hybrid-components");
    const tradeoff = root.querySelector("#hybrid-tradeoff");
    const failure = root.querySelector("#hybrid-failure");
    const systemButtons = [...root.querySelectorAll("[data-hybrid-system]")];

    function renderPathButtons(system) {
      const pathKeys = Object.keys(system.paths);
      if (!system.paths[currentPath]) currentPath = pathKeys[0];
      pathTabs.innerHTML = pathKeys
        .map(
          (key) => `
            <button class="button button-secondary${key === currentPath ? " is-path-current" : ""}" type="button" data-hybrid-path="${key}">
              ${system.paths[key].label}
            </button>
          `,
        )
        .join("");
      [...pathTabs.querySelectorAll("[data-hybrid-path]")].forEach((button) => {
        button.addEventListener("click", () => {
          currentPath = button.dataset.hybridPath;
          render();
        });
      });
    }

    function render() {
      const system = hybridGuide[currentSystem];
      const detail = system.paths[currentPath];
      systemName.textContent = system.button;
      prompt.textContent = system.prompt;
      pathName.textContent = detail.label;
      owner.textContent = detail.owner;
      why.innerHTML = detail.why.map((entry) => `<li>${entry}</li>`).join("");
      secondary.innerHTML = `<strong>What stays secondary:</strong> ${detail.secondary}`;
      components.innerHTML = `<strong>Component pull:</strong> ${detail.components}`;
      tradeoff.innerHTML = `<strong>Expected tradeoff:</strong> ${detail.tradeoff}`;
      failure.innerHTML = `<strong>First failure:</strong> ${detail.failure}`;
      systemButtons.forEach((button) => {
        button.classList.toggle("is-current", button.dataset.hybridSystem === currentSystem);
      });
      renderPathButtons(system);
    }

    systemButtons.forEach((button) => {
      button.addEventListener("click", () => {
        currentSystem = button.dataset.hybridSystem;
        currentPath = Object.keys(hybridGuide[currentSystem].paths)[0];
        render();
      });
    });
    render();
  }

  function renderPracticeVisual(root) {
    let currentStage = 0;
    let currentRepair = 0;

    function selectedStage() {
      return practiceGuide[currentStage];
    }

    function selectedRepair() {
      return selectedStage().repairs[currentRepair];
    }

    function renderRepairTabs() {
      return selectedStage()
        .repairs
        .map(
          (repair, index) => `
            <button class="bucket-tab${index === currentRepair ? " is-current" : ""}" type="button" data-practice-repair="${index}">
              ${repair.button}
            </button>
          `,
        )
        .join("");
    }

    root.innerHTML = `
      <div class="visual-board">
        <div class="result-card scenario-card">
          <p class="panel-label">Practice rule</p>
          <div class="result-headline">Advance by locked habits, not by boredom</div>
          <p class="result-copy">
            Pick a stage, then click the miss you are seeing. The answer should tell you whether to stay, step back, or move on.
          </p>
        </div>
        <div class="bucket-tabs">
          ${practiceGuide
            .map(
              (stage, index) => `
                <button class="bucket-tab${index === currentStage ? " is-current" : ""}" type="button" data-practice-stage="${index}">
                  <span class="map-node-index">${stage.label.replace("Stage ", "")}</span>
                  <span>${stage.title}</span>
                </button>
              `,
            )
            .join("")}
        </div>
        <div class="button-row" id="practice-repair-tabs">${renderRepairTabs()}</div>
        <div class="visual-output">
          <p class="panel-label" id="practice-stage-label">${selectedStage().label}</p>
          <h3 id="practice-title">${selectedStage().title}</h3>
          <p id="practice-overview" class="result-copy">${selectedStage().overview}</p>
          <p class="panel-label">Best drill now</p>
          <p id="practice-drill" class="result-copy">${selectedStage().bestDrill}</p>
          <ul id="practice-signals" class="insight-list">
            <li><strong>Advance when:</strong> ${selectedStage().advance}</li>
            <li><strong>Best systems:</strong> ${selectedStage().systems}</li>
          </ul>
          <p class="panel-label">Observed miss</p>
          <p id="practice-diagnosis" class="result-copy">${selectedRepair().diagnosis}</p>
          <p id="practice-repair" class="result-copy"><strong>Repair move:</strong> ${selectedRepair().repair}</p>
          <p id="practice-return" class="result-copy"><strong>Return signal:</strong> ${selectedRepair().return}</p>
        </div>
      </div>
    `;

    const stageLabel = root.querySelector("#practice-stage-label");
    const title = root.querySelector("#practice-title");
    const overview = root.querySelector("#practice-overview");
    const drill = root.querySelector("#practice-drill");
    const signals = root.querySelector("#practice-signals");
    const diagnosis = root.querySelector("#practice-diagnosis");
    const repair = root.querySelector("#practice-repair");
    const returnSignal = root.querySelector("#practice-return");
    const repairTabs = root.querySelector("#practice-repair-tabs");

    function bindRepairButtons() {
      [...root.querySelectorAll("[data-practice-repair]")].forEach((button) => {
        button.addEventListener("click", () => {
          currentRepair = Number(button.dataset.practiceRepair);
          render();
        });
      });
    }

    function render() {
      const stage = selectedStage();
      const repairItem = selectedRepair();
      const stageButtons = [...root.querySelectorAll("[data-practice-stage]")];

      stageButtons.forEach((button, index) => {
        button.classList.toggle("is-current", index === currentStage);
      });

      repairTabs.innerHTML = renderRepairTabs();
      bindRepairButtons();

      stageLabel.textContent = stage.label;
      title.textContent = stage.title;
      overview.textContent = stage.overview;
      drill.textContent = stage.bestDrill;
      signals.innerHTML = `
        <li><strong>Advance when:</strong> ${stage.advance}</li>
        <li><strong>Best systems:</strong> ${stage.systems}</li>
      `;
      diagnosis.textContent = repairItem.diagnosis;
      repair.innerHTML = `<strong>Repair move:</strong> ${repairItem.repair}`;
      returnSignal.innerHTML = `<strong>Return signal:</strong> ${repairItem.return}`;
    }

    [...root.querySelectorAll("[data-practice-stage]")].forEach((button) => {
      button.addEventListener("click", () => {
        currentStage = Number(button.dataset.practiceStage);
        currentRepair = 0;
        render();
      });
    });

    bindRepairButtons();
    render();
  }

  function initChapterVisuals() {
    document.querySelectorAll("[data-chapter-visual]").forEach((root) => {
      switch (root.dataset.chapterVisual) {
        case "00-study-method":
          renderJourneyVisual(root);
          break;
        case "01-load-latency-and-data-shape":
          renderPressureVisual(root);
          break;
        case "02-storage-partitioning-and-replication":
          renderStorageVisual(root);
          break;
        case "03-consistency-ordering-idempotency-and-transactions":
          renderGuaranteeVisual(root);
          break;
        case "04-async-caching-failure-handling-and-operability":
          renderFlowVisual(root);
          break;
        case "05-the-interview-framework-7-plus-1-and-lgtc":
          renderFrameworkVisual(root);
          break;
        case "06-archetypes-and-component-maps":
          renderArchetypeVisual(root);
          break;
        case "07-hybrid-systems-and-guided-walkthroughs":
          renderHybridVisual(root);
          break;
        case "08-drill-order-and-mock-interview-prep":
          renderPracticeVisual(root);
          break;
        default:
          break;
      }
    });
  }

  function initLessonQuizzes() {
    document.querySelectorAll("[data-lesson-quiz]").forEach((container) => {
      const slug = container.dataset.lessonQuiz;
      const quiz = lessonQuizzes[slug];
      const root = container.querySelector(".quiz-root");
      if (!quiz || !root) return;

      root.innerHTML = `
        ${quiz.questions
          .map(
            (question, index) => `
              <fieldset class="quiz-question" data-question-index="${index}">
                <legend>${index + 1}. ${question.prompt}</legend>
                <div class="quiz-options">
                  ${question.options
                    .map(
                      (option, optionIndex) => `
                        <label class="quiz-option">
                          <input type="radio" name="${slug}-question-${index}" value="${optionIndex}" />
                          <span>${option}</span>
                        </label>
                      `,
                    )
                    .join("")}
                </div>
                <div class="quiz-explanation" hidden></div>
              </fieldset>
            `,
          )
          .join("")}
        <div class="quiz-actions">
          <button class="button button-primary" type="button" data-quiz-action="check">Check Answers</button>
          <button class="button button-ghost" type="button" data-quiz-action="reset">Reset</button>
        </div>
        <div class="quiz-summary" hidden>
          <strong>Result</strong>
          <span class="quiz-summary-copy"></span>
        </div>
      `;

      const checkButton = root.querySelector('[data-quiz-action="check"]');
      const resetButton = root.querySelector('[data-quiz-action="reset"]');
      const summary = root.querySelector(".quiz-summary");
      const summaryCopy = root.querySelector(".quiz-summary-copy");

      checkButton.addEventListener("click", async () => {
        let correct = 0;
        let unanswered = 0;

        root.querySelectorAll(".quiz-question").forEach((questionNode, index) => {
          const question = quiz.questions[index];
          const checked = questionNode.querySelector("input:checked");
          const explanation = questionNode.querySelector(".quiz-explanation");

          questionNode.classList.remove("is-correct", "is-wrong", "is-unanswered");

          if (!checked) {
            unanswered += 1;
            questionNode.classList.add("is-unanswered");
            explanation.hidden = false;
            explanation.textContent = `Unanswered. ${question.explanation}`;
            return;
          }

          const picked = Number(checked.value);
          if (picked === question.answer) {
            correct += 1;
            questionNode.classList.add("is-correct");
            explanation.hidden = false;
            explanation.textContent = `Correct. ${question.explanation}`;
          } else {
            questionNode.classList.add("is-wrong");
            explanation.hidden = false;
            explanation.textContent = `Not quite. ${question.explanation}`;
          }
        });

        summary.hidden = false;
        summaryCopy.textContent =
          unanswered > 0
            ? `You scored ${correct}/${quiz.questions.length}. Finish the skipped questions before moving on.`
            : `You scored ${correct}/${quiz.questions.length}. If any miss felt fuzzy, revisit that section before the next lesson.`;

        if (personalizationState.apiUnavailable) {
          return;
        }

        if (!personalizationState.activeUserId) {
          if (unanswered === 0) {
            summaryCopy.textContent += " Log in from the top-right profile menu to store this result.";
          }
          return;
        }

        if (unanswered > 0) {
          return;
        }

        const signature = Array.from(root.querySelectorAll('input[type="radio"]:checked'))
          .map((input) => input.value)
          .join("|");

        if (root.dataset.lastSubmissionSignature === signature) {
          return;
        }

        try {
          const payload = await apiJson(`/api/users/${personalizationState.activeUserId}/quiz-attempt`, {
            method: "POST",
            body: JSON.stringify({
              slug,
              correct,
              total: quiz.questions.length,
            }),
          });
          root.dataset.lastSubmissionSignature = signature;
          personalizationState.user = payload.user;
          personalizationState.nextProbe = payload.nextProbe;
          personalizationState.lastReview = null;
          syncPersonalizationUi();
          await refreshSupplementalCoachState();
          summaryCopy.textContent += " Stored for the active learner.";
        } catch (error) {
          summaryCopy.textContent += ` Could not store this result: ${error.message}`;
        }
      });

      resetButton.addEventListener("click", () => {
        root.querySelectorAll('input[type="radio"]').forEach((input) => {
          input.checked = false;
        });

        root.querySelectorAll(".quiz-question").forEach((questionNode) => {
          questionNode.classList.remove("is-correct", "is-wrong", "is-unanswered");
          const explanation = questionNode.querySelector(".quiz-explanation");
          explanation.hidden = true;
          explanation.textContent = "";
        });

        summary.hidden = true;
        summaryCopy.textContent = "";
        delete root.dataset.lastSubmissionSignature;
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initCourseMaps();
    initChapterVisuals();
    initStartLessonPractice();
    initLiveValues();
    initStressMapper();
    initGuaranteeBuilder();
    initCriticalPathStudio();
    initLessonQuizzes();
    initSelectionCoach();
    initPersonalizationMenuChrome();
    initPersonalization();
  });
})();
