export const glossaryGroups = [
  {
    id: "foundations",
    label: "Foundations",
    summary: "The core forces and shapes that make a system hard before you ever draw components.",
  },
  {
    id: "data-placement",
    label: "Data Placement",
    summary: "Terms that explain where data lives, how it is organized, and how it spreads.",
  },
  {
    id: "guarantees",
    label: "Guarantees",
    summary: "The promises a system must keep when it reads, writes, retries, and fails.",
  },
  {
    id: "runtime-failure",
    label: "Runtime And Failure",
    summary: "How work moves through time and what happens when parts of the system slow down or break.",
  },
  {
    id: "interview-reasoning",
    label: "Interview Reasoning",
    summary: "The course-specific language for structuring, compressing, and speaking your design clearly.",
  },
];

export const glossaryEntries = [
  {
    id: "pressure",
    term: "Pressure",
    group: "foundations",
    aliases: ["pressure", "pressures"],
    summary: "The force that makes a system difficult to design.",
    body: `In this course, pressure means the thing that most strongly shapes the design. Pressure can come from load, latency, fanout, skew, correctness risk, or query shape.

You look for pressure before architecture because architecture is a response to pressure. If you name components first, you are usually pattern-matching instead of reasoning.`,
  },
  {
    id: "dominant-stress",
    term: "Dominant Stress",
    group: "foundations",
    aliases: ["dominant stress", "dominant stresses"],
    summary: "The pressure that matters most for the first major design decisions.",
    body: `A system can have several kinds of pressure at once, but one or two usually dominate early choices. That dominant stress is what should drive the first architecture moves.

For example, a transactional system may care about load, but correctness can still be the dominant stress if a wrong result is worse than a slow one.`,
  },
  {
    id: "load",
    term: "Load",
    group: "foundations",
    aliases: ["load"],
    summary: "How much work hits the system over time.",
    body: `Load is the amount of work a system has to process: reads, writes, uploads, messages, searches, or other requests.

In interviews, load is not just average traffic. Peak traffic, burstiness, fanout, and skew often matter more than the average.`,
  },
  {
    id: "qps",
    term: "QPS",
    group: "foundations",
    aliases: ["qps"],
    summary: "Queries per second, used as a shorthand for request rate.",
    body: `QPS stands for queries per second. In practice people often use it loosely to mean request rate, not only database queries.

QPS is a useful load signal, but it is never the whole story. A modest QPS system can still be hard if it has high fanout, strict guarantees, or severe skew.`,
  },
  {
    id: "latency",
    term: "Latency",
    group: "foundations",
    aliases: ["latency", "latencies"],
    summary: "How long a request, read, or write takes before a result is seen.",
    body: `Latency is the time between asking the system to do something and seeing the result.

Latency matters because users experience waiting directly. A design with good average latency can still feel bad if tail latency is poor.`,
  },
  {
    id: "tail-latency",
    term: "Tail Latency",
    group: "foundations",
    aliases: ["tail latency", "p99", "p99 latency", "p95", "p95 latency"],
    summary: "The slowest slice of requests, where real production pain often lives.",
    body: `Tail latency focuses on the slow end of the latency distribution, such as p95 or p99. It answers, "How bad are the worst normal requests?"

This matters because users and downstream systems often feel the tail, not the average. Queues, fanout, retries, and overloaded dependencies usually show up there first.`,
  },
  {
    id: "fanout",
    term: "Fanout",
    group: "foundations",
    aliases: ["fanout", "fan-out"],
    summary: "One action causing many downstream actions.",
    body: `Fanout happens when one write or event turns into many deliveries, updates, or notifications.

Fanout is dangerous because the visible work can be much larger than the incoming request rate. A single post, message, or update can expand into thousands or millions of downstream operations.`,
  },
  {
    id: "skew",
    term: "Skew",
    group: "foundations",
    aliases: ["skew", "hot key", "hot keys", "hot spot", "hot spots", "skewed access"],
    summary: "Uneven distribution of work or data across keys, times, or machines.",
    body: `Skew means work is not evenly spread. A few users, partitions, terms, or time windows receive much more traffic than the rest.

Skew matters because a system can fail locally before it fails globally. Overall capacity can look healthy while one partition or dependency is overloaded.`,
  },
  {
    id: "burstiness",
    term: "Burstiness",
    group: "foundations",
    aliases: ["burstiness", "bursty traffic"],
    summary: "Traffic arriving in spikes rather than smoothly.",
    body: `Burstiness means load arrives in short sharp spikes instead of a steady stream.

This matters because systems must survive the peak, not just the average. Queues, backpressure, and buffering often exist because burstiness is unavoidable.`,
  },
  {
    id: "data-shape",
    term: "Data Shape",
    group: "foundations",
    aliases: ["data shape"],
    summary: "The structure and lifecycle of the data itself.",
    body: `Data shape describes what the data looks like and how it behaves over time. Is it key-value state, append-only history, blobs, documents, time-series points, or something else?

Data shape matters because it constrains storage shape, indexing, partitioning, and query cost.`,
  },
  {
    id: "query-shape",
    term: "Query Shape",
    group: "foundations",
    aliases: ["query shape"],
    summary: "How the system needs to read, write, filter, rank, or aggregate data.",
    body: `Query shape describes the operations the product needs: point lookups, range scans, full-text search, ranking, aggregation, joins, or streaming reads.

Two systems can have similar data shape and still need different storage choices because their query shape is different.`,
  },
  {
    id: "storage-shape",
    term: "Storage Shape",
    group: "data-placement",
    aliases: ["storage shape"],
    summary: "The kind of storage model that best matches the data shape, query shape, and guarantees.",
    body: `Storage shape is the family of storage behavior you want, such as relational, key-value, append-only log, object storage, or search index.

The right storage shape is chosen from access pattern and guarantees, not from brand familiarity.`,
  },
  {
    id: "document-store",
    term: "Document Store",
    group: "data-placement",
    aliases: ["document store", "document stores"],
    summary: "A store where one entity is usually read and written as one nested document.",
    body: `A document store feels natural when one record is usually owned, read, and updated as one nested object, and cross-document joins are not the dominant need.

It trades some relational power for document-shaped modeling and easier evolution of flexible record structure.`,
  },
  {
    id: "wide-column-store",
    term: "Wide-Column Store",
    group: "data-placement",
    aliases: ["wide-column store", "wide column store", "wide-column", "wide column", "column family", "column-family"],
    summary: "A store organized around a partition key with many ordered rows or cells inside that partition.",
    body: `A wide-column store feels natural when access starts with a partition key, writes are heavy, and reads often scan a local ordered range inside that partition, such as by time.

It is strong for partition-local scale and weaker for ad hoc cross-partition queries or joins.`,
  },
  {
    id: "graph-store",
    term: "Graph Store",
    group: "data-placement",
    aliases: ["graph store", "graph stores", "graph database", "graph databases"],
    summary: "A store optimized for traversing relationships between connected entities.",
    body: `A graph store feels natural when the hard query is about edges and paths: neighbors, multi-hop traversal, reachability, fraud rings, or permission ancestry.

If relationships are not the dominant query, a simpler storage family is often enough.`,
  },
  {
    id: "inverted-index",
    term: "Inverted Index",
    group: "data-placement",
    aliases: ["inverted index", "search index", "search-oriented index"],
    summary: "A search structure that maps terms to the documents or records that contain them.",
    body: `An inverted index is a natural fit when full-text retrieval, keyword matching, and ranking dominate the read path.

It is usually a search-oriented representation rather than the main transactional source of truth.`,
  },
  {
    id: "time-series-store",
    term: "Time-Series Store",
    group: "data-placement",
    aliases: ["time-series store", "time series store", "time-series", "time series", "columnar store", "columnar storage", "columnar"],
    summary: "A store optimized for append-heavy time-window reads, scans, and aggregates.",
    body: `A time-series or columnar store feels natural when data arrives continuously and readers mostly ask for windows, rollups, and aggregate views instead of row-by-row mutation.

It is strong for scans, compression, and retention policies, and weaker for rich transactional updates.`,
  },
  {
    id: "geo-index",
    term: "Geo-Index",
    group: "data-placement",
    aliases: ["geo-index", "geo index", "geospatial index", "spatial index"],
    summary: "A structure optimized for nearby, within-radius, and other spatial queries.",
    body: `A geo-index feels natural when location is part of the question and the product must answer nearest-neighbor or within-area lookups efficiently.

It is usually introduced because spatial access is dominant, not because the product merely stores latitude and longitude.`,
  },
  {
    id: "index",
    term: "Index",
    group: "data-placement",
    aliases: ["index", "indexes", "indices", "indexing"],
    summary: "A structure that makes specific lookups or scans faster.",
    body: `An index is extra organized data that helps the system find records quickly for a particular query shape.

Indexes trade write cost and storage space for faster reads. A useful index is justified by the queries it accelerates.`,
  },
  {
    id: "partitioning",
    term: "Partitioning",
    group: "data-placement",
    aliases: ["partitioning", "partitioned", "sharding", "sharded"],
    summary: "Splitting data or work across logical ownership slices so the system can scale.",
    body: `Partitioning divides data or traffic across independent logical ownership slices so one machine does not own everything.

In this course, a partition is the logical slice. A shard is the primary physical serving owner for one or more partitions, usually a node or storage process. A shard can own many partitions.

If the same partition exists on several machines, those are replicas. If the primary data for one partition is split across several machines, the cleaner explanation is that it has been divided into smaller partitions or sub-partitions. A hot partition can make its owning shard hot.

Vendor documentation may use the words at different levels. For example, CrateDB calls a partition a table segment that itself contains shards. In interviews, define the level you mean before reasoning about hot spots.

Partitioning mainly helps scale and isolation. It does not automatically solve correctness, availability, or ordering on its own.`,
  },
  {
    id: "partition-key",
    term: "Partition Key",
    group: "data-placement",
    aliases: ["partition key", "shard key"],
    summary: "The value used to decide which logical partition owns a piece of data or work.",
    body: `A partition key routes writes and reads to a logical partition. A later mapping places that partition on a primary shard, node, or storage process. Good partition keys spread load while still matching the access pattern.

In this course, a strong partition key often aligns with the ordering boundary, consistency boundary, or user-visible unit of work.`,
  },
  {
    id: "virtual-partitions",
    term: "Virtual Partitions",
    group: "data-placement",
    aliases: ["virtual partition", "virtual partitions", "virtual node", "virtual nodes", "vnode", "vnodes"],
    summary: "Extra logical placement slices that can be moved between physical owners as the cluster changes.",
    body: `Virtual partitions are logical slices created in larger numbers than the current physical machines or shards.

They make later rebalancing easier because the system can move small logical slices between physical owners instead of redesigning the partition key or moving one huge range at once.`,
  },
  {
    id: "consistent-hashing",
    term: "Consistent Hashing",
    group: "data-placement",
    aliases: ["consistent hashing", "hash ring", "ring hashing"],
    summary: "A placement technique that limits how much data moves when nodes are added or removed.",
    body: `Consistent hashing maps keys and nodes onto a ring or similar hash space so ownership can change gradually.

Its practical interview value is rebalancing: adding or removing a node should move only part of the key space instead of forcing a full reshuffle.`,
  },
  {
    id: "replication",
    term: "Replication",
    group: "data-placement",
    aliases: ["replication", "replica", "replicas", "replicated"],
    summary: "Keeping multiple copies of data or service state.",
    body: `Replication means storing or serving multiple copies so the system can survive failures and sometimes scale reads.

Replication mostly helps availability and durability. It does not remove the need to think about consistency, freshness, or failover behavior.`,
  },
  {
    id: "topology",
    term: "Topology",
    group: "data-placement",
    aliases: ["topology"],
    summary: "How data and work move through space and time in the system.",
    body: `Topology covers where things live and how they connect: partitioning, replication, geographic placement, sync or async flow, queues, and service boundaries.

In LGTC, topology is the bucket that turns raw requirements into movement and placement decisions.`,
  },
  {
    id: "guarantee",
    term: "Guarantee",
    group: "guarantees",
    aliases: ["guarantee", "guarantees"],
    summary: "A promise the system must keep even when load or failure shows up.",
    body: `A guarantee is an explicit promise about behavior, such as consistency, ordering, idempotency, durability, or freshness.

Good design work makes guarantees narrow and clear. Vague guarantees usually hide vague reasoning.`,
  },
  {
    id: "correctness",
    term: "Correctness",
    group: "guarantees",
    aliases: ["correctness"],
    summary: "Whether the system does the right thing, not just whether it stays up.",
    body: `Correctness means the product behavior is valid. A system can be highly available and still be incorrect if it double-charges, loses state, misorders operations, or shows a false answer at the wrong moment.

Correctness is product-specific. What counts as acceptable error in analytics may be unacceptable in booking or payments.`,
  },
  {
    id: "consistency",
    term: "Consistency",
    group: "guarantees",
    aliases: ["consistency"],
    summary: "What a reader is allowed to assume about data after writes happen.",
    body: `Consistency describes how aligned reads are with writes and with each other.

In interviews, the practical question is not "Do I like strong consistency?" It is "Which operations need fresh truth, and which ones can tolerate lag?"`,
  },
  {
    id: "strong-consistency",
    term: "Strong Consistency",
    group: "guarantees",
    aliases: ["strong consistency"],
    summary: "Relevant reads should reflect the latest acknowledged write.",
    body: `Strong consistency means once a write is confirmed, a relevant later read should observe that write instead of stale state.

You usually pay for strong consistency with coordination cost, latency, or reduced availability under certain failures. That is why it should be used where correctness actually requires it.`,
  },
  {
    id: "eventual-consistency",
    term: "Eventual Consistency",
    group: "guarantees",
    aliases: ["eventual consistency"],
    summary: "Reads may lag behind writes, but replicas converge over time.",
    body: `Eventual consistency means the system allows temporary divergence as long as replicas or views converge later.

This can be a good choice for feeds, search, analytics, and derived views where freshness matters but immediate perfection is not required.`,
  },
  {
    id: "freshness",
    term: "Freshness",
    group: "guarantees",
    aliases: ["freshness", "staleness", "bounded staleness", "stale reads"],
    summary: "How up-to-date a read must be to be acceptable.",
    body: `Freshness is the allowed lag between the newest real state and what a reader sees.

Freshness is often the business-level version of consistency. The system design question is usually, "How stale is still acceptable here?"`,
  },
  {
    id: "ordering",
    term: "Ordering",
    group: "guarantees",
    aliases: ["ordering"],
    summary: "Whether operations or events must be seen in a particular sequence.",
    body: `Ordering matters when the sequence changes meaning, such as messages in one conversation or edits in one document.

Ordering should be scoped carefully. Per-key ordering is common and useful. Global ordering is expensive and rarely necessary.`,
  },
  {
    id: "ot",
    term: "OT",
    group: "guarantees",
    aliases: ["OT", "operational transformation", "operational transform"],
    summary: "A collaboration technique that transforms concurrent operations against an ordered history.",
    body: `OT stands for operational transformation. It is commonly discussed in collaborative editing systems where concurrent edits must be transformed so everyone converges on the same document.

The practical choice is usually about merge authority: an OT design often leans on a server-authoritative operation order, which can simplify reasoning but makes offline-first behavior harder.`,
  },
  {
    id: "crdt",
    term: "CRDT",
    group: "guarantees",
    aliases: ["CRDT", "CRDTs", "conflict-free replicated data type", "conflict-free replicated data types"],
    summary: "A data type designed so replicas can merge concurrent updates and converge.",
    body: `A CRDT is a conflict-free replicated data type. It is designed so independently updated replicas can merge and converge without a central sequencer for every operation.

CRDTs are useful when offline or peer-friendly collaboration matters, but they often pay with metadata growth, garbage-collection complexity, and constraints on what edits can be represented cleanly.`,
  },
  {
    id: "idempotency",
    term: "Idempotency",
    group: "guarantees",
    aliases: ["idempotency", "idempotent"],
    summary: "Repeating the same request should not create a different final effect.",
    body: `Idempotency is how systems stay correct when retries happen. If the same logical operation is sent twice, the outcome should still look like one successful execution.

In practice, idempotency is often the real answer behind "exactly once" business behavior.`,
  },
  {
    id: "deduplication",
    term: "Deduplication",
    group: "guarantees",
    aliases: ["deduplication", "dedupe", "duplicate delivery", "duplicate deliveries"],
    summary: "Detecting and suppressing duplicate work or duplicate events.",
    body: `Deduplication removes duplicate deliveries or duplicate operations so retries and redelivery do not corrupt state.

Deduplication is often paired with idempotency. Idempotency protects the effect; deduplication tries to avoid doing the same work twice.`,
  },
  {
    id: "transaction",
    term: "Transaction",
    group: "guarantees",
    aliases: ["transaction", "transactions", "transactional"],
    summary: "A set of changes that should succeed or fail as one unit.",
    body: `A transaction groups several related state changes into one atomic boundary.

Transactions are useful when partial success would be invalid. The important design question is where the transaction boundary should stop, not whether everything everywhere should be transactional.`,
  },
  {
    id: "saga",
    term: "Saga",
    group: "guarantees",
    aliases: ["saga", "sagas", "saga pattern"],
    summary: "A multi-step workflow that uses local commits and compensation instead of one giant distributed transaction.",
    body: `A saga breaks a long business process into smaller committed steps, with compensating actions when a later step fails.

In interviews, saga language is useful when one atomic cross-service commit would be too expensive or brittle, but the product still needs a deliberate recovery story.`,
  },
  {
    id: "2pc",
    term: "2PC",
    group: "guarantees",
    aliases: ["2PC", "two-phase commit", "two phase commit"],
    summary: "A coordination protocol for trying to commit a transaction atomically across participants.",
    body: `2PC means two-phase commit. Participants first prepare, then a coordinator decides whether everyone commits or aborts.

It can provide a strong atomic boundary across systems, but it is coordination-heavy and can block during failures. That is why many interview designs prefer local commits plus saga-style recovery unless strict atomicity is truly required.`,
  },
  {
    id: "durability",
    term: "Durability",
    group: "guarantees",
    aliases: ["durability", "durable"],
    summary: "Whether acknowledged data survives crashes and failures.",
    body: `Durability asks whether the system can lose data after saying "success."

Durability is different from consistency. Data can be durably stored and still be served inconsistently, or vice versa.`,
  },
  {
    id: "availability",
    term: "Availability",
    group: "guarantees",
    aliases: ["availability", "available"],
    summary: "Whether the system can keep serving useful requests during faults or overload.",
    body: `Availability is the ability to continue serving despite failures, overload, or dependency loss.

High availability does not mean every feature remains perfect. Good degradation often means some behavior becomes weaker so the core path can stay alive.`,
  },
  {
    id: "hot-path",
    term: "Hot Path",
    group: "runtime-failure",
    aliases: ["hot path", "critical path", "hot-path"],
    summary: "The work that must finish before the user can trust the result.",
    body: `The hot path is the minimum work that must complete before the system can safely respond.

Keeping the hot path small improves latency and resilience, but you cannot move correctness-critical work off it just to make the diagram look faster.`,
  },
  {
    id: "async",
    term: "Async",
    group: "runtime-failure",
    aliases: ["async", "asynchronous"],
    summary: "Work that can happen later instead of blocking the user-visible result.",
    body: `Async work is deferred or decoupled from the immediate response. It is often moved behind a queue or event stream.

Async design helps latency and burst handling, but it introduces freshness lag, retries, duplicate delivery, and failure-recovery questions.`,
  },
  {
    id: "transport-choice",
    term: "Transport Choice",
    group: "runtime-failure",
    aliases: ["transport choice", "transport choices", "transport"],
    summary: "The decision about how clients and services communicate on a path.",
    body: `Transport choice is about the communication shape for a path: request/response, server push, bidirectional sessions, streaming, or polling.

In this course, transport is chosen after latency, directionality, connection count, and delivery expectations are visible. It is not a substitute for application-level guarantees.`,
  },
  {
    id: "websockets",
    term: "WebSockets",
    group: "runtime-failure",
    aliases: ["WebSocket", "WebSockets"],
    summary: "A long-lived bidirectional connection often used for live updates.",
    body: `WebSockets keep a bidirectional connection open so clients and servers can exchange messages with low overhead after the connection is established.

They fit active live paths such as chat delivery, presence, typing indicators, and collaborative editing, but they create connection-management and scaling obligations.`,
  },
  {
    id: "sse",
    term: "SSE",
    group: "runtime-failure",
    aliases: ["SSE", "server-sent events", "server sent events"],
    summary: "A one-way server-to-client event stream over HTTP.",
    body: `SSE stands for server-sent events. It lets a server push a stream of events to a browser over HTTP while the client listens.

It can be simpler than WebSockets when the product needs one-way updates rather than a full bidirectional session.`,
  },
  {
    id: "long-polling",
    term: "Long Polling",
    group: "runtime-failure",
    aliases: ["long polling", "long-polling"],
    summary: "A fallback push-like pattern where clients hold a request open waiting for updates.",
    body: `Long polling keeps an HTTP request open until the server has an update or the request times out, then the client sends another request.

It can approximate near-live delivery when persistent connections are not available, but it costs more request churn than a true long-lived channel.`,
  },
  {
    id: "queue",
    term: "Queue",
    group: "runtime-failure",
    aliases: ["queue", "queues", "queued"],
    summary: "A buffer that decouples producers from consumers over time.",
    body: `A queue absorbs bursts and lets producers hand work to consumers without waiting for each downstream action to finish immediately.

Queues are powerful because they turn timing pressure into manageable backlog, but they also create lag, retries, and operational visibility needs.`,
  },
  {
    id: "cache",
    term: "Cache",
    group: "runtime-failure",
    aliases: ["cache", "caches", "cached", "caching"],
    summary: "A faster copy of data used to reduce latency or load.",
    body: `A cache stores data closer to the reader or in a cheaper retrieval path so repeated reads are faster.

Caching is a latency and load tool, not a free win. Every cache creates freshness and invalidation questions.`,
  },
  {
    id: "cdn",
    term: "CDN",
    group: "runtime-failure",
    aliases: ["CDN", "CDNs", "content delivery network", "content delivery networks", "edge cache", "edge caches"],
    summary: "A geographically distributed cache and delivery layer for serving content close to users.",
    body: `A CDN is a content delivery network. It serves cached assets, media, or other responses from edge locations closer to users instead of sending every request to origin.

CDNs reduce latency, bandwidth cost, and origin load, but they introduce cache freshness, invalidation, regional coverage, and fallback questions.`,
  },
  {
    id: "retry",
    term: "Retry",
    group: "runtime-failure",
    aliases: ["retry", "retries", "retrying"],
    summary: "Trying an operation again after a timeout or transient failure.",
    body: `Retries are normal in distributed systems because networks and dependencies fail in partial, temporary ways.

Retries are safe only when the operation is idempotent or otherwise protected against duplicate effects.`,
  },
  {
    id: "backpressure",
    term: "Backpressure",
    group: "runtime-failure",
    aliases: ["backpressure"],
    summary: "A system slowing or limiting incoming work because it cannot safely keep up.",
    body: `Backpressure is a control mechanism that tells upstream producers to slow down or shed load when downstream capacity is saturated.

Without backpressure, overload often turns into queues that never drain, timeouts, cascading retries, and broad failure.`,
  },
  {
    id: "degradation",
    term: "Degradation",
    group: "runtime-failure",
    aliases: ["degradation", "graceful degradation"],
    summary: "Reduced behavior that keeps the most important path alive under stress.",
    body: `Degradation means the system intentionally provides a weaker but still useful experience instead of fully failing.

Examples include serving stale cache, delaying secondary features, dropping low-priority work, or narrowing result quality to preserve availability.`,
  },
  {
    id: "operability",
    term: "Operability",
    group: "runtime-failure",
    aliases: ["operability"],
    summary: "How easy the system is to observe, debug, change, and keep healthy in production.",
    body: `Operability covers the practical life of the system after launch: observability, alerts, deployability, rollbacks, schema evolution, and safe maintenance.

In this course, operability is part of design quality. A system that cannot be understood or repaired in production is not well designed.`,
  },
  {
    id: "outbox",
    term: "Outbox",
    group: "runtime-failure",
    aliases: ["outbox", "outbox pattern"],
    summary: "A pattern for atomically recording a state change and the event that should be published.",
    body: `The outbox pattern writes the business state change and a pending event record in the same transaction. A separate worker publishes the event later.

This matters because it avoids the classic failure where the database commits but the event publish is lost.`,
  },
  {
    id: "failure-mode",
    term: "Failure Mode",
    group: "runtime-failure",
    aliases: ["failure mode", "failure modes", "failure thinking", "what breaks first"],
    summary: "The specific way a system is most likely to break first.",
    body: `A failure mode is the concrete mechanism by which the design fails under load or fault.

This course keeps asking "what breaks first?" because that question reveals whether you really understand the design's weak edge instead of only its happy path.`,
  },
  {
    id: "tradeoff",
    term: "Tradeoff",
    group: "interview-reasoning",
    aliases: ["tradeoff", "tradeoffs"],
    summary: "A choice that improves one dimension by paying in another.",
    body: `A tradeoff is the price you knowingly pay to get a benefit somewhere else.

Strong answers name both sides. Saying only what you chose is incomplete; the interviewer also wants to hear what you gave up and why that was acceptable.`,
  },
  {
    id: "interview-flow",
    term: "Interview Flow",
    group: "interview-reasoning",
    aliases: ["interview flow"],
    summary: "A stable order for clarifying, summarizing, and explaining a system design.",
    body: `Interview flow is the speaking structure that keeps your reasoning stable under time pressure.

The point of a good flow is not to sound scripted. It is to prevent rambling and make sure pressure, guarantees, topology, and constraints appear before components.`,
  },
  {
    id: "functional-requirements",
    term: "Functional Requirements",
    group: "interview-reasoning",
    aliases: ["functional requirement", "functional requirements", "FR", "FRs", "use case", "use cases"],
    summary: "What the system must do: actors, actions, and in-scope read/write paths.",
    body: `Functional requirements describe what the system must do and who it must serve.

In this course, they are settled through the opening scope questions: who are the users, what actions are in scope, and which read/write paths matter. They should be clear before sizing. Estimating load before scope is settled means estimating the wrong thing.`,
  },
  {
    id: "non-functional-requirements",
    term: "Non-Functional Requirements",
    group: "interview-reasoning",
    aliases: ["non-functional requirement", "non-functional requirements", "NFR", "NFRs", "quality attributes"],
    summary: "Performance, consistency, availability, and compliance constraints captured by LGTC.",
    body: `Non-functional requirements describe how the system must behave under pressure.

LGTC is the course's compression format for them: scale, peaks, and fanout belong in Load; wrong or lost data, consistency, and ordering belong in Guarantees; latency, geography, and decoupling belong in Topology; compliance, regulatory limits, and cost belong in Constraints. In the interview room, speak those dimensions out loud instead of relying on the acronym alone.`,
  },
  {
    id: "api-contract",
    term: "API Contract",
    group: "interview-reasoning",
    aliases: ["API contract", "API contracts", "API sketch", "API sketches"],
    summary: "The product-facing request and response promise at a system boundary.",
    body: `An API contract describes what a caller can ask for, what identity and permissions are required, and what the response promises.

In system design interviews, a small API sketch is useful only after pressure and guarantees are visible. It should expose boundaries, retry identity, and allowed lag, not hide a component list behind endpoint names.`,
  },
  {
    id: "design-ask",
    term: "Design Ask",
    group: "interview-reasoning",
    aliases: ["design ask", "design asks", "problem statement", "problem statements", "interview ask", "interview asks"],
    summary: "The one-line system-design question the interviewer gives you at the start.",
    body: `A design ask is the short system-design instruction you are responding to, such as "Design Slack" or "Design YouTube uploads and playback."

The meaning here is the interview problem statement you must clarify before architecture.`,
  },
  {
    id: "7-plus-1",
    term: "7+1",
    group: "interview-reasoning",
    aliases: ["7+1", "7+1 questions"],
    summary: "The course's opening question set for clarifying a system design ask.",
    body: `The 7+1 questions are the first move in the framework. The first seven questions are the universal opening spine: users and actions, correctness risk, slowness cost, peak load, consistency needs, async opportunities, and real-world obligations.

The +1 is the data-shape and query-shape bridge question. It is named separately because it stays light in some design asks and becomes central in others, especially when storage, indexing, or retrieval shape drives the design.

The point of 7+1 is to surface dominant stress before you talk about components.`,
  },
  {
    id: "lgtc",
    term: "LGTC",
    group: "interview-reasoning",
    aliases: ["lgtc"],
    summary: "The course's four-bucket summary: Load, Guarantees, Topology, Constraints.",
    body: `LGTC is the compressed summary format used after the 7+1 questions.

It organizes the system into four buckets: Load, Guarantees, Topology, and Constraints. The goal is to compress messy design-ask details into a design-ready structure before naming an archetype or components.`,
  },
  {
    id: "constraints",
    term: "Constraints",
    group: "interview-reasoning",
    aliases: ["constraints"],
    summary: "The non-negotiable real-world limits that shape the design.",
    body: `Constraints are the things the real world forces on the design: availability, durability, security, privacy, compliance, cost, and operational limits.

Constraints matter because a design that looks elegant in the abstract may still be wrong if it violates the business, regulatory, or runtime reality.`,
  },
  {
    id: "archetype",
    term: "Archetype",
    group: "interview-reasoning",
    aliases: ["archetype", "archetypes", "system shape", "system shapes"],
    summary: "A recurring family of system problems with familiar dominant stresses and components.",
    body: `An archetype is a recurring kind of system such as messaging, search, transactional, media, collaboration, observability, or geo-dispatch.

Archetypes are useful because they compress experience. But in this course, you only name an archetype after pressure and LGTC make the label defensible.`,
  },
  {
    id: "hybrid",
    term: "Hybrid",
    group: "interview-reasoning",
    aliases: ["hybrid", "hybrids", "hybrid system", "hybrid systems"],
    summary: "A product that combines multiple archetypes in different paths.",
    body: `A hybrid system is a product whose important paths belong to different archetypes.

Hybrid thinking prevents blur. Instead of forcing one label onto the whole product, you ask which archetype owns the write path and which owns the read path.`,
  },
  {
    id: "write-path",
    term: "Write Path",
    group: "interview-reasoning",
    aliases: ["write path", "write-path"],
    summary: "The path that creates or mutates source-of-truth state.",
    body: `The write path is the sequence of steps that records new truth or changes existing truth.

In hybrid systems, the write path often belongs to a different archetype than the read path. That is why ownership by path is clearer than one blurred diagram.`,
  },
  {
    id: "read-path",
    term: "Read Path",
    group: "interview-reasoning",
    aliases: ["read path", "read-path"],
    summary: "The path that serves queries, views, or retrieval from existing state.",
    body: `The read path is the sequence that fetches, ranks, filters, or presents data to the user after truth already exists.

Read paths often care more about latency, caching, and freshness than the write path does. That is why they deserve separate design reasoning.`,
  },
  {
    id: "weak-spot",
    term: "Weak Spot",
    group: "interview-reasoning",
    aliases: ["weak spot", "weak spots"],
    summary: "A concept you still cannot explain cleanly under pressure.",
    body: `A weak spot is any idea that still becomes fuzzy when you try to explain it out loud.

In this course, weak spots are tracked deliberately. If the same confusion appears twice, it should be drilled directly instead of ignored.`,
  },
];
