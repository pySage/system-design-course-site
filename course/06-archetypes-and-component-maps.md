# 06 - Archetypes and Component Maps

Imagine you have already done the Chapter 05 opening on three design asks.

Do not label them yet.
Just read what kind of pain each product moment creates.

## Three Cold Reads Before Any Label

### WhatsApp

One user sends to one person or to a large group.
Delivery can happen to online or offline recipients.
Ordering matters inside the conversation.
Fanout can explode during big group moments.

### Stripe

Wrong answers are more dangerous than slow answers.
Retries happen.
Money movement must be audit-friendly.
Duplicate execution is a product failure, not just a technical inconvenience.

### YouTube

Large binary uploads must be accepted, transformed, stored, and served.
Background processing is heavy.
Bandwidth and edge delivery matter.
The hot path and the discovery path do not have the same pressure.

If those three design asks already feel like different kinds of systems before you draw any boxes, that instinct is the beginning of archetype recognition.

Before the course uses words like `archetype` or `component map`, give them a practical meaning:

- an `archetype` is a recurring kind of system pain that you have already described in plain language
- a `component map` is memory of the usual parts that often follow from that pain, not proof that those parts are correct here

The important part is what your ear noticed:

```text
WhatsApp -> one send becomes delivery work for recipients
Stripe   -> one retry can become duplicate money movement
YouTube  -> one upload becomes large-object storage and processing
```

Those are not product categories.
They are different kinds of pain.
The archetype label should come after you can say that pain plainly.

## What An Archetype Actually Is

An `archetype` is a recurring family of system pain.

It is not a product badge.
It is not a brand label.
It is not a shortcut for skipping reasoning.

Once the `LGTC` read is clear, the archetype gives you four useful things quickly:

- the dominant stress to keep centered
- the component map that usually follows from that stress
- the tradeoff interviewers usually expect you to recognize
- the failure mode that often appears first at scale

That is why archetype recognition happens after `LGTC`, not before it.

The label is supposed to compress a good read, not replace one.

The safe order is:

```text
LGTC read -> dominant stress -> archetype -> component map -> tradeoff -> first failure
```

If the order becomes:

```text
product name -> archetype -> memorized boxes
```

the answer may sound fluent while still being brittle.
The interviewer can break it with one follow-up: "Why is that component there?"

## Product Names Lie; Dominant Stress Tells The Truth

Many weak answers still choose archetypes by product name.

That is unreliable.

- `Slack` includes search, but its core write path still smells like messaging
- `Stripe` emits events, but that does not make it event-ingestion-first
- `Instagram` has DMs, but the whole product is not therefore mostly messaging
- `YouTube` includes discovery, but the write path still clearly smells like media

This is the question that keeps you honest:

What pressure dominates the path I am talking about right now?

If the answer changes by path, you are getting close to Chapter 07.
For now, this chapter stays one step earlier:
learn the pure shapes first.

Before the catalog appears, keep one warning in front of you:

> The component map is allowed only after the label is earned.

The bridge from Chapter 05 should sound like this:

```text
LGTC read -> dominant stress -> earned archetype -> component memory
```

For example, Slack does not become messaging because it is a chat brand.
It becomes messaging on the core path because the `LGTC` read says bursty fanout, local ordering, durable send acceptance, online/offline delivery, and lag-tolerant derived views.
Only then do message logs, delivery handling, presence, offline queues, and fanout workers start to make sense.

## The Main Archetypes As Recognizable Reads

### Messaging / Delivery

You should hear this archetype when one actor sends and one or many other actors must receive, especially when delivery timing, online versus offline state, or local ordering changes the product experience.

`WhatsApp`, the core write path of `Slack`, and many notification systems live here.

What the label pulls in:

- append-only message storage or conversation log
- connection layer for active clients
- presence or session awareness
- offline queueing
- fanout workers where one send becomes many deliveries

Expected tradeoff:
at-least-once delivery versus exactly-once cost.

Typical first failure:
large-group fanout amplification or overloaded receiver paths.

### Media Storage / Delivery

You should hear this archetype when the hard part is accepting, processing, storing, and serving large blobs rather than coordinating tiny correctness-critical writes.

`YouTube` uploads and playback, attachment-heavy media products, and photo or video hosting systems often live here.

What the label pulls in:

- chunked or resumable upload
- durable object storage
- processing queues
- background transformation pipelines
- CDN or edge serving
- metadata separate from the blob itself

Expected tradeoff:
eager processing versus lazy processing.

Typical first failure:
processing backlog, cold-cache origin pain, or invalidation trouble after updates.

### Transactional / Ledger

You should hear this archetype when wrong outcomes are more dangerous than slow outcomes, and when retries, money movement, scarce inventory, or auditability dominate the design.

`Stripe`, booking systems, order systems, and ledger-like financial paths live here.

What the label pulls in:

- append-only ledger or transaction log
- idempotency keys
- narrow strong state boundary
- lock or reservation logic when scarce state exists
- outbox or equivalent for downstream side effects
- retry handling that preserves business correctness

Expected tradeoff:
smaller local commits with explicit recovery steps versus one large distributed commit.
You may later hear this as `saga` versus `2PC`, but the plain decision comes first: scalable recovery logic versus expensive cross-system atomicity.

Typical first failure:
duplicate execution, double-booking, double-charge, or lost downstream side effects after a successful commit.

### Pause: The Label Must Still Earn Its Boxes

At this point in the catalog, notice the rhythm:

```text
pain first
label second
boxes third
```

If you say "transactional" but cannot name the duplicated business effect, the label is not earned.
If you say "messaging" but cannot name the delivery pressure, the label is not earned.
The component list is memory, not evidence.

### Real-Time Collaboration

You should hear this archetype when many users are editing or mutating the same shared state concurrently and the hard problem is not only storage, but convergence under overlapping writes.

`Google Docs` is the cleanest example.

What the label pulls in:

- low-latency bidirectional session channel
- operation log
- merge logic for concurrent edits, often discussed as `OT` or `CRDT`
- snapshotting
- presence and collaborator session tracking

Expected tradeoff:
server-authoritative ordering that is simpler to reason about versus more offline-friendly client/peer merge complexity.
You may later name those families as `OT` and `CRDT`, but the product decision is about where merge authority and offline tolerance live.

Typical first failure:
history loss after compaction, replay pain, or high-frequency collaboration fanout.

### Search / Discovery

You should hear this archetype when users are asking retrieval questions under a query-latency budget and relevance plus freshness matters more than point-update correctness on the hot path.

`Elasticsearch`, product search, feed retrieval, and document discovery systems live here.

What the label pulls in:

- indexing pipeline or change-feed ingestion
- inverted or search-oriented index
- query coordinator
- ranking or scoring stage
- caching for repeated popular queries
- document source or retrieval store behind the index

Expected tradeoff:
freshness versus query latency and indexing cost.

Typical first failure:
hot terms, hot shards, stale ranking, or lagging indexes.

### Event Ingestion / Observability

You should hear this archetype when the primary job is to absorb a producer firehose, keep schemas survivable, and make the stream queryable or alertable with bounded lag.

`Datadog`, metrics platforms, log pipelines, and telemetry systems live here.

What the label pulls in:

- partitioned ingestion
- buffering or streaming backbone
- stream processors
- schema registry or compatibility controls
- time-series or columnar storage
- query, dashboard, or alerting layer
- downsampling or sampling for cost control

Expected tradeoff:
raw retention versus pre-aggregation.

Typical first failure:
consumer lag during spikes or schema changes breaking downstream consumers.

### Geo / Dispatch

You should hear this archetype when the hard problem is matching supply and demand in physical space under real-time latency pressure, with live location state and assignment races.

`Uber` dispatch is the cleanest example.

What the label pulls in:

- location ingestion
- geo-indexing
- live supply or demand state
- matching engine
- assignment lock or conflict control
- ETA computation

Expected tradeoff:
optimistic versus pessimistic assignment locking.

Typical first failure:
dense hot zones, hot geo cells, or ETA latency inside the matching loop.

## Field Notes: Archetypes From Real Engineering Writeups

At this stage, real company writeups become useful only if you force them through the same question:

> "What archetype pressure does this story reveal, what component map does it justify, and what first failure should I carry into an interview?"

Do not begin by scanning a shelf of famous sources.
Work one story.
The wider shelf at the end of this section is optional practice; it becomes more valuable after Chapter 07 teaches path ownership.

### Field Note 1: Stripe Idempotency

Situation:

A payment API call times out. The buyer's phone or the merchant backend sends the same request again because it does not know whether the first attempt reached the server.

Learner decision:

Is this mainly generic event processing, or does it smell like a transactional archetype?

Reveal:

It smells transactional because the dangerous thing is not slow notification. The dangerous thing is a duplicated business effect: the same logical payment attempt turning into two charges or two state changes.

Component map pulled by the archetype:

- an idempotency-key record, because retries need a stable business identity
- a narrow transaction boundary around the payment truth, because duplicate execution is worse than delayed side effects
- an audit-friendly record of what happened, because money systems must be explainable later

Interview-ready sentence:

> "This is transactional because retry safety is part of the core correctness boundary; the idempotency key exists so repeated transport attempts map to one business attempt."

Source: [Stripe API docs, "Idempotent requests"](https://docs.stripe.com/api/idempotent_requests)

### Field Note 2: Netflix Open Connect

Situation:

Millions of viewers repeatedly request popular video content. Search and recommendations help people choose what to watch, but the painful path during playback is repeated byte delivery.

Learner decision:

Does the discovery archetype own the whole Netflix-like design?

Reveal:

No. Discovery matters, but playback is a media-delivery path. The archetype pressure is bandwidth, edge placement, cache health, origin protection, and graceful movement around unhealthy delivery paths.

Component map pulled by the archetype:

- edge caches, because repeated playback should be absorbed close to viewers
- origin storage, because the system still needs durable source content
- health and fallback routing, because cache placement changes how failures are experienced

Interview-ready sentence:

> "For a Netflix-like system, discovery may own the browse path, but media delivery owns playback because repeated video bytes, edge placement, and origin protection dominate the user experience."

Source: [Netflix Open Connect](https://openconnect.netflix.com/en/)

The other sources are still useful, but treat them as practice after you have modeled one story:

| Source story | Practice lens |
|---|---|
| [Discord storing trillions of messages](https://discord.com/blog/how-discord-stores-trillions-of-messages) | Messaging / Delivery plus storage placement: hot message-history reads, ordered channel history, migration pressure |
| [Slack shared channels](https://slack.engineering/how-slack-built-shared-channels/) | Messaging / Delivery moving toward hybrid ownership: workspace boundaries changed, channel ownership needed rethinking |
| [Uber H3](https://www.uber.com/blog/h3/) | Geo / Dispatch: nearby lookup is a first-class query shape |
| [Google SRE cascading failures](https://sre.google/sre-book/addressing-cascading-failures/) | Failure mode lens across archetypes: overload, retries, resource exhaustion, and feedback loops |
| [Google Bigtable](https://research.google/pubs/bigtable-a-distributed-storage-system-for-structured-data/) | Storage support for several archetypes: layout and locality matter for large structured data |
| [Google Spanner](https://research.google/pubs/spanner-googles-globally-distributed-database/) | Transactional / distributed correctness lens: global consistency is a paid guarantee choice |

## Component Maps Are Compressed Memory, Not Copy-Paste Templates

The `component map` is the cluster of components an archetype usually pulls with it once the label is justified.

That does not mean you copy every box every time.

It means the archetype is helping you remember what tends to be necessary and why.

Use component maps with three rules:

- every named component must answer a stress or a guarantee
- smaller systems should drop unnecessary components rather than include them for theater
- if you remove a common component, say which guarantee or scale pain is absent so the omission sounds intentional

Examples:

- a small chat system without offline users may not need a serious offline queue yet
- a small search product may not need a separate ranking service on day one
- a collaboration design ask without offline editing may not justify the more complex merge strategy

The map is there to compress experience, not to force over-design.

Use this small justification test for every component:

| If you name... | You should be able to say... |
|---|---|
| message log | what ordering, durability, or replay need it protects |
| object storage | why the blob does not belong in the small-record store |
| idempotency key store | which retry would otherwise duplicate a business effect |
| operation log | why concurrent edits need history or replay |
| inverted index | why scanning records directly cannot meet the query shape |
| stream processor | what continuous aggregation or enrichment must happen |
| geo-index | why nearby lookup cannot be treated as a generic database query |

The component name is only half the answer.
The reason is the part that proves you are designing.

## One Step Before Hybrids

Pure archetypes are a learning tool.
Real products often combine them.

You can already feel that in the examples:

- `YouTube` smells like media on the write path and discovery on the read path
- `Slack` smells like messaging on the core path and search on the history-search path
- `Airbnb` smells transactional for booking and search for listing discovery

This chapter only needs one preparation rule for that next step:
name the dominant pure shape of the path you are currently describing.

Chapter 07 will separate the mixed ownership cleanly.

## Difficulty Ladder: Shape Reads

### Easy: Notification Delivery

A product needs to send push notifications to millions of users.
Some users are online, some are offline, and duplicate notifications are annoying but not usually as dangerous as duplicate payments.

A weak answer says:

> "Use Kafka and workers."

A better answer says:

> "This smells like messaging and delivery because one event becomes delivery work to recipients, timing and retries matter, and the first failure is fanout or delayed receiver paths."

The label is earned from delivery pressure, not from the queue.

### Medium: Product Search

An e-commerce site lets users search by words, filters, popularity, and price.
Sellers update listings all day.

A weak answer says:

> "Use Elasticsearch because search."

A better answer says:

> "This is search and discovery because query latency, relevance, ranking, and index freshness dominate. The component map follows from that: indexing pipeline, search-oriented index, query coordination, ranking, and caches for repeated hot queries."

The better answer names the read shape and freshness tradeoff before naming a product.

### Hard: Collaborative Whiteboard

Multiple users draw on the same canvas at once.
They expect local-feeling updates, no lost strokes, and sensible convergence after brief disconnects.

A weak answer says:

> "Use WebSockets and a database."

A better answer says:

> "This smells like real-time collaboration because concurrent mutations to shared state must converge without losing intent. The expected map includes a session channel, operation log, merge strategy such as `OT` or `CRDT`, snapshots, and presence. The tradeoff is simpler server-authoritative ordering versus more offline-friendly merge complexity."

This is hard because the visible product is drawing, but the hidden pain is concurrent state convergence.

## Phrase Drill: Earn The Label

Practice this sentence shape:

> "Given the `LGTC` read, the dominant stress is ___, so the path smells like ___. That pulls in ___, and the first failure I would watch for is ___."

Examples:

| System path | Filled version |
|---|---|
| WhatsApp group send | "The dominant stress is delivery fanout with local ordering, so the path smells like messaging. That pulls in a conversation log, delivery handling, presence/offline behavior, and a first failure around large-group fanout." |
| Stripe charge | "The dominant stress is correctness under retries and auditability, so the path smells like transactional/ledger. That pulls in idempotency, a narrow ledger boundary, outbox-style side effects, and a first failure around duplicate execution or lost downstream publication." |
| Datadog metrics ingest | "The dominant stress is absorbing a producer firehose with queryable lag, so the path smells like event ingestion. That pulls in partitioned ingestion, stream processing, schema handling, time-series storage, and a first failure around consumer lag or schema breakage." |

## Earn The Label Under Pressure

If the interviewer hears this:

> "Slack is messaging because it is a chat app."

they still do not know whether you recognized the system or only recognized the product category.
Earn the label from the pressure:

> "Given the `LGTC` read, the dominant stress on the core path is bursty fanout plus per-conversation ordering with online and offline recipients. That makes the primary archetype messaging and delivery. So I expect an append-only message log, delivery or connection handling, presence or offline behavior, a delivery tradeoff around at-least-once versus exactly-once cost, and a first failure mode around large-channel fanout amplification."

Now the label is doing work:
it connects pressure to component memory, tradeoff, and likely failure mode.

## Mini Drill: Justify The Dominant Shape

Pick one system from each pair and justify the dominant archetype out loud:

- `WhatsApp` vs `Instagram`
- `Airbnb` vs `Elasticsearch`
- `Google Docs` vs `Uber`

Expected direction:

`WhatsApp` is dominated by messaging and delivery pressure, while `Instagram` as a whole more often smells like discovery or media depending on the path you are discussing. `Airbnb` booking is dominated by transactional correctness, while `Elasticsearch` is cleanly search and discovery. `Google Docs` is about concurrent writers and convergence, while `Uber` dispatch is about geo state, matching latency, and assignment races.

If your answer starts from the product brand, restart from the dominant stress and let the label arrive second.

## Before You Move To Lesson 07

Your checkpoint is earned pattern recognition, not category recall.

You should be able to:

- name the dominant archetype after `LGTC`
- justify it with the pressure that dominates the path
- use the component map as a starting memory, not a copy-paste diagram
- state the expected tradeoff
- name the failure mode that usually appears first

You are ready for Lesson `07` when you can hear a design ask, name the dominant shape, and defend that label without leaning on the product name.

Lesson `07` adds the next reality check:
the most interesting products are rarely one pure shape. They are several shapes combined.
