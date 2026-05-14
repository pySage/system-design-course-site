# 05 - The Interview Framework: 7+1 and LGTC

Imagine the interviewer says:

> "Design Slack."

A weak start sounds busy:

> "We will have clients, an API gateway, Kafka, Redis, databases, and WebSockets."

It sounds architectural, but it is still mostly theater.
Nothing in that answer has been justified yet.

A stronger start sounds slower for about ten seconds, and then much faster after that:

> "Before I pick components, I want to clarify the dominant pressures, guarantees, and constraints."

That pause is the whole point of this chapter.
It is not hesitation.
It is the moment where you prevent the answer from becoming a memorized box diagram.

Before the course uses words like `framework`, `7+1`, or `LGTC`, give them a practical meaning:

- a `design ask` is the one-line system-design request you are trying to open up, such as "Design Slack"
- `7+1` is the small set of opening questions that pulls out the facts hidden inside that request
- `LGTC` is a short four-bucket summary of those facts after you have extracted them
- a `framework` is a guardrail that keeps your first two minutes in the right order, not a script to recite

In this course, that one-line instruction from the interviewer is the design ask.
Some older interview material uses different wording for the same idea.
This course uses design ask because it keeps the focus on the system-design question you are trying to open up before architecture.

The framework is not a ritual.
It is a guardrail against premature architecture.

This chapter builds one new habit:
turn the first two minutes of an answer into a controlled extraction step.

## The Framework Is An Extraction Step, Not A Ceremony

The `7+1` questions are useful because each one is designed to pull something design-relevant out of the design ask before components appear.

Here they are in their plain form:

1. Who are the users and what action are they taking?
2. What happens if data is wrong or lost?
3. What happens if the system is slow?
4. What happens at peak load?
5. Does shared state need strong consistency, or is eventual okay?
6. What work can be decoupled from the critical path?
7. Is there a money, legal, trust, or compliance angle?
8. What is the data shape and query shape?

Notice what the name is telling you.

The first seven questions are the universal opening spine.
Almost every serious design ask needs them because every system has users, wrong-state risk, slowness cost, peak stress, a consistency boundary, some split between hot-path work and deferrable work, and real-world obligations.

Question `8` behaves differently.
Sometimes it stays light because the early shape is already obvious without deep storage reasoning.
Sometimes it becomes the hinge of the whole answer because search, graph traversal, media blobs, compliance retrieval, time windows, or ranking views stop making sense if you hand-wave the data and query shape.

That is why this framework says `7+1` instead of a flat `8`.
It is not denying that there are eight questions.
It is teaching that the last one is conditionally heavy.
You still check it every time.
The difference is depth, not existence.
Sometimes question `8` takes one sentence.
Sometimes it becomes the center of the answer.
The moment data shape and query shape start deciding whether your answer is credible, the `+1` moves from a quick check to the center of the opening.

But notice the real point:
you are not asking these to sound disciplined.
You are asking them because each answer rules certain designs in and out.

We will run the full sequence once on Slack so the method feels like a lived move rather than a slogan.

Before that, notice what each question is protecting you from:

| Question | The bad shortcut it prevents |
|---|---|
| users and actions | designing a generic backend before knowing the real workload |
| wrong or lost data | treating trust failures like ordinary bugs |
| slowness | hiding latency-sensitive paths inside average performance |
| peak load | designing for calm traffic while the real pain is bursty or skewed |
| consistency | saying "strong everywhere" instead of naming the shared state |
| decoupled work | putting every task on the response path or throwing everything behind a queue |
| money, legal, trust, compliance | missing obligations that change storage, access, audit, or failure handling |
| data shape and query shape | choosing storage by brand name instead of by access pattern |

This table is not a checklist to recite.
It is a set of guardrails.
Each question catches one kind of premature architecture.

## Run The 7+1 On Slack Once

### 1. Who Is Doing What?

Suppose the interviewer says the product supports direct messages, channels, threads, attachments, and searchable history.

That first answer already gives you more than people realize.

Users are sending messages to one person or to groups.
Readers are loading history and live updates.
Some conversations are tiny.
Some channels explode during incidents, launches, or company-wide announcements.

That means the system is not a generic CRUD app.
It already smells like a messaging path with uneven fanout and conversation-shaped access.

One user action may hide much more backend work than the UI suggests.
The moment you say "post one message to a giant channel," you should hear Chapter 01 ringing in your head.

### 2. What Happens If Data Is Wrong Or Lost?

Now the design ask sharpens.

If Slack loses an accepted message, users stop trusting the product.
If a message is delivered to the wrong workspace or tenant, you have a privacy incident.
If retention or legal hold is in scope, message loss becomes more than a user annoyance.

This answer raises the bar on:

- durable acceptance of sent messages
- tenant isolation
- privacy and access control
- retention and audit concerns when enterprise usage matters

Without drawing anything, the product is already telling you that truth and trust matter locally and concretely.

### 3. What Happens If The System Is Slow?

Slack does not feel "slightly worse" when message send latency gets high.
It starts feeling broken.

That changes the way you read the system.

- send and receive paths are latency-sensitive
- live presence and typing signals are sensitive too
- history search can usually lag more than live send
- analytics can lag far more than the core message path

So now the design ask is separating hot-path behavior from derived behavior.
That is Chapter 04 feeding into the framework.

### 4. What Happens At Peak Load?

Peak load in Slack is not just "lots of traffic."

The useful pressure read is more specific:

- bursts during major incidents or launches
- very large channels with heavy fanout
- local hot spots inside one workspace or one channel
- big read spikes when many people open the same channel at once

This is exactly why the framework asks the question.
Average scale is not the point.
Dominant stress is the point.

### 5. Does Shared State Need Strong Consistency, Or Is Eventual Okay?

This question prevents vague guarantee language.

For Slack, the answer is usually not:

> "Make everything strongly consistent."

It is much narrower:

- message order usually matters per conversation or per channel, not globally
- message acceptance should be durable before success is shown
- unread counts or search results can often lag more than the live send path
- some derived views can be eventual as long as the core send truth is safe

That answer is already doing Chapter 03 work inside the framework.
It is naming where strong truth matters and where it does not.

### 6. What Work Can Be Decoupled From The Critical Path?

This question is where time enters the picture explicitly.

For Slack, likely deferred work includes:

- push notifications
- delivery to offline queues
- search indexing
- analytics
- some fanout or derived counters, depending on product expectations

What stays on the hot path is whatever makes "message sent" a truthful response.
What moves out of it is whatever can happen later without making the system lie.

This question stops queues from being decorative.
It forces you to say what they are protecting.

### 7. Is There A Money, Legal, Trust, Or Compliance Angle?

Many candidates underuse this question because they hear "money" and assume it only matters for payments.

But trust and regulation often matter just as much.

For Slack, this question can surface:

- enterprise retention policies
- legal hold and eDiscovery
- privacy promises
- administrative controls
- audit expectations

Now the system is no longer "just chat."
It is a multi-tenant enterprise messaging product with real-world obligations.

That changes constraints, access control, retention, and operational requirements long before you name a storage engine.

### 8. What Is The Data Shape And Query Shape?

This is the bridge question.

It is not equally important in every design ask, but when it matters, it matters early.

For Slack, if the design ask is mostly about live messaging, the answer may stay light:

- append-only message history per conversation or channel
- point lookups by message or thread
- sequential history reads

If search, compliance export, or deep history access is in scope, the same question becomes heavier:

- message logs and search views now diverge
- indexing strategy starts mattering
- retention rules shape the storage story

That is why `8` is called the `+1`.
It is optional in some design asks, but mandatory the moment data shape starts driving design credibility.

## Notice What You Already Know Before Architecture

After those questions, you still have not named Kafka, Redis, or any database.

But you already know a surprising amount:

- the core user action is message send and history read
- large-channel fanout and local hot spots dominate peak pain
- per-conversation ordering matters more than global ordering
- the hot path must stay tighter than search or analytics
- enterprise privacy, retention, and audit constraints may matter a lot
- data shape may stay simple for messaging but become heavier once search and export are in scope

This is what a good opening feels like.

You are not being vague.
You are getting the right facts in the right order before architecture hardens too early.

## LGTC Is The Compression Step

Once the raw answers exist, `LGTC` turns them into a short, design-ready summary.

This is the important thing to notice:
`LGTC` is not a second round of discovery.
It is a compression step.

The same Slack notes now become:

### Load

Write-heavy message sends, bursty fanout in large channels, and local hot spots inside workspaces or channels.

### Guarantees

Durable message acceptance, ordering scoped to the conversation rather than globally, lag tolerance for derived views such as search or analytics, and strong tenant isolation.

### Topology

Synchronous message accept on the hot path, asynchronous push and indexing behind it, partitioning aligned to conversation or workspace boundaries, and replication driven by availability requirements.

### Constraints

Enterprise retention, eDiscovery, privacy, multi-tenant isolation, availability expectations, and the need to observe lag, delivery health, and operational drift.

What changed?

Not the facts.
Only the shape.

The question answers were raw notes.
`LGTC` makes those notes usable.

You do not have to speak `LGTC` as four stiff headings every time.
The internal move can be structured while the spoken answer still sounds natural.

Raw notes:

```text
Load: bursty large-channel fanout, local hot spots
Guarantees: durable accept, per-conversation order, tenant isolation
Topology: sync accept, async delivery/search, partition by conversation/workspace
Constraints: enterprise retention, privacy, availability, lag visibility
```

Spoken compression:

> "The dominant shape is bursty messaging fanout with local hot spots. I need durable message acceptance and per-conversation order, while search and analytics can lag. I would keep the send path tight, move delivery/indexing work behind it, and keep enterprise constraints like tenant isolation and retention visible."

Same facts.
Less recital.
More interview-ready.

Here is the same move as a compact flow:

```text
design ask
   |
   v
7+1 extracts facts
   |
   v
LGTC compresses those facts
   |
   v
archetype becomes justified
   |
   v
components finally have reasons
```

If you skip from the first line to the last line, components become guesses.
If you run the middle steps, components become consequences.

Now the archetype is no longer guessed.
For Slack, the handoff is:

```text
LGTC says: bursty fanout + local ordering + durable send + async derived work
        |
        v
dominant stress says: one send becomes delivery work to recipients
        |
        v
archetype says: Messaging / Delivery owns the core path
```

That bridge is the reason Chapter 06 comes after this one.

## Sketch The API Contract After Extraction

After the `7+1` and `LGTC` read, an interviewer may expect a small API sketch before the architecture diagram.
That does not change the framework.
It is a deliverable that sits between extraction and component choice.

The API sketch should show the product boundary, not a hidden component dump.
It should answer:

- what action is the client asking for?
- what identity makes retries safe?
- what response means the hot-path promise is true?
- what is allowed to lag after the response?
- what tenant, permission, or retention boundary is visible at the edge?

For Slack, the core send contract might be:

```text
POST /workspaces/{workspace_id}/channels/{channel_id}/messages

request:
  client_message_id
  sender_user_id
  text
  thread_id? / parent_message_id?

response:
  message_id
  channel_id
  server_timestamp
  accepted: true
```

That sketch is useful only because the earlier read already exists.
The `client_message_id` hints at retry safety.
The `workspace_id` and `channel_id` expose tenant and ordering boundaries.
The `accepted` response should mean the message is durably accepted into the channel's source truth, not that every recipient has already received it and not that search has already indexed it.

A recent-history read might be:

```text
GET /workspaces/{workspace_id}/channels/{channel_id}/messages?before=<cursor>&limit=50

response:
  messages in channel order
  next_cursor
```

This is a different contract from full-message search.
Recent history wants ordered channel reads.
Search wants retrieval over old messages with looser freshness.
Those different API shapes are already hinting at different read paths before any storage brand appears.

The warning is simple:
API design is not a component list with HTTP verbs attached.
If the API sketch does not reflect guarantees, pressure, permissions, and lag tolerance from `LGTC`, it is just another kind of premature architecture.

## Production Lab: Extract The Case Before Admiring It

Real postmortems can become overwhelming if you try to absorb every detail at once. Chapter 05 gives you a safer move: run the same extraction flow on the story.

Take GitHub's October 2018 incident as a design-read exercise.

Before the framework appears, picture only the evidence a learner can hold:

- users and internal systems still needed GitHub data while recovery was underway
- some database state could not be treated as cleanly caught up yet
- bringing the site back too aggressively risked making data disagreement worse
- downstream work such as webhooks and builds could wait, but user data integrity could not

Those clues are why the framework is useful.
It stops you from saying the nearest database word and forces you to extract the shape of the incident.

Do not start with:

> "They had a MySQL failover incident."

Start with the `7+1` shape:

1. Users were reading and writing GitHub data while internal systems depended on database topology.
2. Wrong or lost metadata would be worse than slow service.
3. The service being slow or partially unavailable was painful but less dangerous than corrupting user data.
4. Peak recovery load included normal traffic plus backlog catch-up.
5. Shared state needed careful correctness; stale replicas were user-visible.
6. Webhooks, Pages builds, and other downstream work could be paused and replayed later.
7. Trust was central because user data integrity was the product promise.
8. The data shape mattered because metadata clusters, replicas, and queued downstream effects did not all recover at the same speed.

Now compress:

> "The `LGTC` read is integrity-heavy: load includes recovery backlog, guarantees prioritize correct metadata over returning to normal too quickly, topology is constrained by replication and recovery state, and constraints include trust, availability, and observable catch-up."

That is how to read a postmortem as interview training.

Source: [GitHub, "October 21 post-incident analysis"](https://github.blog/news-insights/company-news/oct21-post-incident-analysis/)

## Why This Order Matters

Many weak answers reverse the order.

They say:

1. product name
2. guessed archetype
3. component list
4. vague requirements after the fact

The framework flips that:

1. extract facts through `7+1`
2. compress them into `LGTC`
3. name the dominant `archetype`
4. then choose components, tradeoffs, and failure modes

That order matters because labels and components become defensible only after the system has a clear shape.

For Slack, once the `LGTC` summary is visible, calling the primary archetype `Messaging / Delivery` stops being pattern matching.
It becomes a justified read.

## What A Good First Two Minutes Sounds Like

A weak chapter-05 opening sounds like this:

> "I would use WebSockets, Kafka, Redis, and a database."

A good enough 20-second opening sounds like this:

> "Before components, I want to extract the shape. Slack is mainly users sending and reading messages, with bursty fanout in large channels, durable send acceptance, local message ordering, and enterprise trust constraints. Search and analytics can lag more than live messaging, so the core path smells messaging-owned."

An expanded 60-second opening sounds like this:

> "Before jumping to components, I want to clarify the dominant stresses. For Slack, users are sending messages in DMs and channels, with bursty fanout in large channels. Lost or misdelivered messages are trust failures, while send latency matters much more than analytics freshness. Ordering needs are local to conversations, not global. Search and push can lag more than durable message acceptance. There may also be enterprise constraints like retention, privacy, and eDiscovery. Given that, my `LGTC` read is: load is bursty messaging fanout with local hot spots; guarantees are durable accept plus per-conversation ordering; topology is sync accept with async delivery and indexing; constraints are enterprise trust, isolation, availability, and operability. With that framing, I would treat the core as a messaging system and then walk the write path first."

Both answers are better than the component dump because they sound like reasoning, not memorization.

It does not just avoid mistakes.
It creates a stable platform for the rest of the interview.

## One Quick Transfer: Why The +1 Gets Heavier In YouTube

Slack is a good teaching case because the first seven questions already carry most of the shape.

But now compare that with YouTube.

The moment the interviewer says:

> "Design YouTube uploads and playback,"

question `8` becomes much heavier much earlier.

Why?

Because now the data shape itself changes the design:

- large binary blobs for video
- structured metadata for ownership and state
- search views for discovery
- analytics streams for watch behavior

The framework did not change.
The weight shifted.

That is the point of the `+1`.
It tells you when the design ask needs serious data-shape reasoning instead of only load and guarantee reasoning.

## Difficulty Ladder: Opening Reads

The opening should work when the design ask is tiny, broad, or mixed.

### Easy: Design A URL Shortener

A weak opening says:

> "We need an API, a database, and a cache."

A better opening says:

> "The core action is create and resolve short links. The read path is much hotter than the write path, wrong redirects are trust failures, and latency matters on redirect. My early `LGTC` read is read-heavy load, correctness around key-to-target mapping, topology around fast lookup and replication, and constraints around abuse, expiration, and availability."

This is easy because the core path is narrow.
The opening still earns the cache instead of naming it first.

### Medium: Design Slack

A weak opening says:

> "Use WebSockets and Kafka."

A better opening says:

> "The core actions are sending messages, receiving live updates, and reading history. Load is bursty fanout in large channels, guarantees are durable accept and per-conversation order, topology is sync accept with async delivery and indexing, and constraints include tenant isolation, retention, privacy, availability, and lag visibility."

This is medium because live messaging and history search already pull in different pressures.

### Hard: Design YouTube

A weak opening says:

> "Use object storage, CDN, and recommendations."

A better opening says:

> "The `+1` is heavy here because video blobs, metadata, discovery indexes, and watch analytics are different data shapes. My opening should separate creator upload, viewer playback, and discovery before I choose components. Load is read-dominant on playback but heavy on upload processing; guarantees differ between durable upload acceptance and eventual analytics; topology includes edge delivery plus async processing; constraints include bandwidth, copyright, cost, and operational lag."

This is hard because the design ask is already hybrid.
The opening must create enough structure that Chapter 07 can split ownership cleanly later.

## Phrase Drill: Opening Language

Use these repairs until the opening sounds natural.

| Rough answer | Interview-ready version |
|---|---|
| "Let me design the system." | "Before components, I want to extract the workload, correctness risks, latency tolerance, peak pressure, and real-world constraints." |
| "This needs Kafka and Redis." | "I first need to know what work is on the hot path, what can lag, and what repeated reads or deferred work justify those components." |
| "The eighth question is optional." | "The `+1` is conditionally heavy: light when data shape is obvious, central when storage, indexing, traversal, media, or analytics shape the design." |
| "LGTC is requirements." | "`LGTC` compresses the facts we extracted into load, guarantees, topology, and constraints so the architecture has a justified shape." |

Now say a two-sentence opening for `Design Slack`.
If a component name appears before `LGTC`, restart the sentence.

## Mini Drill: Start Uber Dispatch Without Drawing Boxes

Treat this as a three-minute opening.
You pass only if the facts reach `LGTC` before any component name appears:

- who is doing what?
- what goes wrong if assignment state is wrong?
- what happens if matching is slow?
- where does peak pressure concentrate?
- what needs fresh truth versus eventual truth?
- what can move off the hot path?
- what trust or regulatory angles matter?
- does data shape meaningfully change storage or indexing choices here?

Then compress it into four lines of `LGTC`.

Expected direction:

The design ask is about riders requesting trips and drivers being matched in real time. Wrong or duplicated assignments are correctness failures, while matching latency is product-critical. Pressure concentrates in dense geo cells and city spikes. Fresh truth matters on nearby supply and assignment state, while some analytics and history can lag. The hot path stays narrow around matching and assignment, while notifications and analytics can defer. Constraints include availability, safety, operational visibility, and regional behavior. Data shape matters more for geo-indexing and live state than for heavy secondary indexing.

If a box appears before the `LGTC` read, restart from the fact you skipped.

## Before You Move To Lesson 06

The checkpoint is a different opening move.
Instead of:

> "Let me design the system."

you should be able to:

- open with clarifying questions that extract real design pressure
- turn the answers into a short `LGTC` summary
- name the dominant `archetype` only after that summary exists
- enter the rest of the design with a stable structure instead of improvising from component memory

You are ready for Lesson `06` when you can hear a product design ask and reach a disciplined `LGTC` read in under three minutes.

Lesson `06` takes the next step:
once the system has a clear shape, what kind of system are you actually looking at?
