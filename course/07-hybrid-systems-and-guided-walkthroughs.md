# 07 - Hybrid Systems and Guided Walkthroughs

At the end of Chapter 06, one rule started to break.

You learned to hear one dominant `archetype`.
That was correct.
But now real product design asks start pushing back.

Imagine the interviewer says:

> Design YouTube.

If you answer, "This is a media system," you are right about upload, storage, transcoding, and playback delivery.

But you have not yet explained search, homepage ranking, recommendation freshness, or candidate retrieval.

If you answer, "This is a discovery system," you are right about search and recommendations.

But you have not yet explained durable upload acceptance, blob storage, or transcoding backlog.

The product is not confused.
The answer is.

This chapter teaches the move that fixes that:
separate the product by path, then ask who owns each path.

The shape of the move is:

```text
one product name
        |
        v
several user-visible paths
        |
        v
different dominant pressures
        |
        v
different owners, tradeoffs, and first failures
```

If you skip the middle two lines, a hybrid product turns into one blurry diagram.

## When One Honest Label Is Not Enough

A `hybrid` system is not just a product with many technologies.

It is a product whose important paths are owned by different `archetypes`.

That means different paths have different:

- dominant `pressure`
- expected components
- core `tradeoff`
- first `failure mode`

This is why a whole-product label sometimes becomes too blunt.

The point is not to say more labels.
The point is to stop flattening unlike paths into one vague diagram.

## What Hybrid Does And Does Not Mean

Hybrid does mean:

- one product contains paths with different dominant stress
- one path may be about `correctness` while another is about retrieval speed
- one path may want a very different topology or freshness budget from another

Hybrid does not mean:

- the product uses both SQL and NoSQL
- the product has web and mobile clients
- the company has many teams
- every subsystem deserves equal explanation time

That last mistake matters most.

Strong hybrid answers separate what is primary from what is supportive.
Weak hybrid answers either collapse everything together or promote every side feature into a co-equal owner.

## Start By Slicing The Product

The first split is usually:

- what owns the `write path`?
- what owns the primary `read path`?

That is a good start, but it is not always enough.

Sometimes the read side itself still contains very different paths.

For YouTube:

- upload is one path
- discovery is another path
- playback delivery is another path again

So the more general rule is:

What path am I explaining right now?

Then ask:

1. What user-visible job is this path doing?
2. What `pressure` dominates here?
3. Which `archetype` owns that pressure?
4. What stays secondary on this path?

That fourth question keeps the answer disciplined.
It stops discovery from hijacking upload.
It stops compliance export from hijacking message delivery.
It stops side chat from hijacking dispatch.

Use this quick test before declaring a separate owner:

| Ask | If the answer is yes |
|---|---|
| Does this path have a different user-visible job? | it may deserve its own explanation |
| Does a different pressure dominate? | the owner may change |
| Would the expected components change? | separate the path before drawing |
| Would the main tradeoff or first failure change? | name that ownership explicitly |
| Is it merely a supporting feature? | keep it secondary |

The goal is not to split forever.
The goal is to split until the design stops lying.

## Walkthrough 1: Design YouTube Without Flattening It

This is the cleanest place to feel hybrid ownership.

The full product contains at least three important paths:

### Upload Path

The creator sends a large video file.
The system must durably accept it, store it, and move it into processing.

Owner:
`Media Storage / Delivery`

Why:

- large blob ingest dominates the path
- durable acceptance matters before later work can happen
- background transformation is part of the main runtime shape

What that pulls in:

- chunked upload service
- durable object storage
- metadata state for processing and visibility
- transcoding queue and workers

Expected `tradeoff`:
eager versus lazy transcoding.

Typical first `failure mode`:
transcoding backlog or slow durable accept under burst.

What stays secondary here:
homepage ranking and search retrieval.

### Discovery Path

A viewer wants to find something worth watching.
Now the hard part is retrieval, ranking, freshness, and candidate selection.

Owner:
`Search / Discovery`

Why:

- query latency and ranking quality dominate
- text search, recommendation, and freshness matter more than blob ingest
- the user-visible pain is "I cannot find the right video," not "a segment file was stored"

What that pulls in:

- indexing pipeline
- query and ranking services
- feature or recommendation inputs
- caches around hot search and homepage requests

Expected `tradeoff`:
freshness versus query latency and ranking cost.

Typical first `failure mode`:
stale discovery, hot queries, or overloaded ranking paths.

What stays secondary here:
upload durability and transcode throughput.

### Playback Path

The viewer has already chosen a video.
Now the problem becomes serving it smoothly.

Owner:
`Media Storage / Delivery`

Why:

- edge delivery, cache locality, bitrate adaptation, and origin protection dominate
- the user-visible pain is buffering, not poor search ranking
- this is a read path, but it is still not discovery-owned

What that pulls in:

- CDN
- segment or manifest serving
- origin protection
- playback telemetry

Expected `tradeoff`:
cache efficiency versus freshness and invalidation complexity.

Typical first `failure mode`:
cold-cache origin overload or rebuffering spikes.

This is the first big lesson of hybrids:
do not force the whole read side under one owner if the read side itself contains different dominant pain.

The YouTube map now looks like this:

```text
creator upload  -> media owner      -> durable blob + processing backlog
viewer discovery -> discovery owner -> retrieval, ranking, freshness
viewer playback -> media owner      -> CDN, segments, buffering, origin protection
```

Same product.
Different path.
Different pain.

### Shared Seam

The paths are separate, but they are not unrelated.

The seam is the shared video truth:

| Seam question | YouTube answer |
|---|---|
| What is the source truth? | video metadata, ownership, processing state, and durable blob references |
| What flows downstream? | indexing events, recommendation features, playback manifests, analytics signals |
| What freshness is expected? | upload acceptance must be honest immediately; discovery and analytics can lag within a budget; playback needs a usable rendition before it is promised |
| What should not happen? | discovery should not invent videos that were not accepted, and playback should not depend on recommendation freshness |

This is where hybrid answers often fail.
They split paths, but never explain what the paths share and what each path is allowed to borrow.

## Walkthrough 2: Airbnb

`Airbnb` feels simple from the UI:
search, click, book.

But the paths are not owned by the same system shape.

### Listing Discovery Path

Owner:
`Search / Discovery`

Why:

- retrieval, filtering, ranking, and geography shape the experience
- some `freshness` lag is tolerable compared with booking correctness

What that pulls in:

- search-oriented index
- ranking or filtering logic
- cache-friendly read path

Typical first `failure mode`:
stale listing visibility, hot search filters, or ranking drift.

### Booking Path

Owner:
`Transactional / Ledger`

Why:

- scarce inventory and money movement dominate
- stale truth is dangerous here
- retries and duplicate booking attempts are product failures

What that pulls in:

- reservation boundary
- payment or booking state store
- `idempotency`
- durable side-effect publication

Typical first `failure mode`:
double-booking, duplicate charge, or missing confirmation side effect.

This is why "Airbnb is a search system" is incomplete and "Airbnb is a booking system" is also incomplete.

The honest answer is path-owned.

A flat answer says:

> "Airbnb needs search, booking, payment, and messaging."

A repaired answer says:

> "I would split listing discovery from booking. Discovery is search-owned because filters, geo, ranking, and tolerable freshness lag dominate. Booking is transactional-owned because the scarce listing-date state and payment attempt cannot duplicate or disagree. Messaging and notifications are supporting paths unless the design ask makes them central."

Shared seam:

| Seam question | Airbnb answer |
|---|---|
| What is the source truth? | listing calendar, booking state, payment state, host/listing metadata |
| What is derived? | search index, ranking features, recommendations, emails, analytics |
| What must be fresh? | the booking commit decision for a scarce date range |
| What may lag? | search visibility, recommendations, confirmation side effects, analytics |

The seam matters because search can show a listing that looked available a moment ago, but booking must still check the fresh source before selling it.

## Walkthrough 3: Slack

`Slack` is a strong hybrid because the product keeps the same surface while the paths quietly change shape.

### Message Send Path

Owner:
`Messaging / Delivery`

Why:

- per-channel ordering, delivery, presence, and fanout dominate
- the user-visible pain is missed or delayed messages

What that pulls in:

- append-only message log
- connection layer
- presence
- offline queue
- fanout workers

Typical first `failure mode`:
large-channel fanout amplification.

### History Search Path

Owner:
`Search / Discovery`

Why:

- retrieval over old messages is a different read shape from live delivery
- looser freshness is acceptable than on the send path
- indexing and ranking matter more than connection management

What that pulls in:

- indexing pipeline
- search-oriented index
- query path and ranking

Typical first `failure mode`:
stale search results or hot query pressure.

### Compliance / Export Path

Owner:
`Event Ingestion / Observability`

Why:

- this path is event-pipeline-shaped, even if the product is not an observability product
- long-running export and audit workflows behave differently from live delivery
- retention, replay, batch processing, and downstream consumers become central

What that pulls in:

- durable event capture
- export or sink processors
- retention and replay handling

Typical first `failure mode`:
consumer lag or export backlog.

This path is real.
But it still does not own the whole product.
That is the discipline hybrids require.

A flat answer says:

> "Slack is messaging with search and compliance."

A repaired answer says:

> "Live send is messaging-owned because fanout, online/offline delivery, and local ordering dominate. History search is discovery-owned because old-message retrieval and freshness-lagged indexing dominate. Compliance export is a support path shaped like event ingestion because retention, replay, and export backlog dominate, but it should not steal ownership from the live send path."

Shared seam:

| Seam question | Slack answer |
|---|---|
| What is the source truth? | accepted messages in the conversation or channel log, with workspace/tenant boundaries |
| What flows downstream? | delivery attempts, search indexing, notifications, compliance/export feeds, analytics |
| What freshness is expected? | live delivery should be fast and ordered locally; search/export can lag with visible backlog |
| What should not happen? | search, export, or analytics should not redefine whether the message was accepted |

## Production Lab: Path Ownership In Real Systems

Now the production stories can be read as hybrid ownership problems.

### Slack Shared Channels: One Product Boundary Stopped Being Enough

Slack's shared-channels writeup is useful here because it shows a product feature forcing architecture to cross the old workspace boundary. If you flatten that into "Slack is messaging," you miss the important design change.

Situation:

A channel is no longer cleanly owned by one workspace. People from separate workspaces need shared visibility, membership behavior, message access, and API behavior around one channel-shaped product object.

Path read:

- live message behavior still smells like messaging
- shared-channel data placement changes because two workspaces interact with one channel
- user visibility and cache behavior become cross-boundary problems

Learner decision:

Does the shared channel become a totally new archetype, or does messaging still own the path while the ownership boundary changes?

Interview-ready sentence:

> "Slack Connect-style channels keep the core messaging path, but the ownership boundary changes because channel data and user visibility now cross workspace boundaries."

Source: [Slack Engineering, "How Slack Built Shared Channels"](https://slack.engineering/how-slack-built-shared-channels/)

### Netflix Open Connect: Playback Is Not Discovery

Netflix Open Connect is a good reminder that a media product's playback path can be its own serious design conversation. Search and recommendation help the user choose content, but repeated playback traffic is dominated by edge placement, cache health, peering, and fallback.

Situation:

A viewer has already chosen a show. The system's job is no longer ranking titles; it is delivering the same popular bytes smoothly to many viewers across different networks.

Path read:

- discovery helps the user decide what to play
- playback owns the heavy read path once the video starts
- repeated bytes should be served close to viewers when possible
- cache health and fallback decide whether a regional problem becomes a playback incident

Learner decision:

If an interviewer asks for Netflix, which path owns the answer after the user presses play?

Interview-ready sentence:

> "For Netflix-like systems, discovery and playback should not be flattened. Discovery is retrieval and ranking; playback delivery is media serving, edge placement, origin protection, and fallback when a delivery path is unhealthy."

Source: [Netflix Open Connect](https://openconnect.netflix.com/en/)

### Uber H3: The Hot Path Owns The Answer

Uber's H3 writeup is not a full dispatch architecture, but it shows why location shape deserves explicit ownership. In an Uber-like design, chat, payments, trip history, and analytics are real, but the hot path is still nearby supply, matching latency, and assignment safety.

Situation:

A rider opens the app and asks for a car nearby. The system may later need payment, chat, receipts, and history, but the moment that defines the product is matching live demand with live nearby supply.

Path read:

- nearby lookup is not a generic database lookup
- location changes quickly, so the query shape owns the hot path
- assignment safety matters because the same driver should not be promised to two riders
- chat and payment are important supporting paths, not the primary owner of dispatch

Learner decision:

Which path gets first-class architecture attention before you mention side features?

Interview-ready sentence:

> "Uber's core path is geo/dispatch-owned because nearby lookup and live assignment dominate; payments and chat are important supporting paths, but they should not steal ownership from the matching loop."

Source: [Uber Engineering, "H3: Uber's Hexagonal Hierarchical Spatial Index"](https://www.uber.com/blog/h3/)

## Do Not Promote Every Side Feature Into A Co-Owner

Once people learn hybrids, they often over-correct.

They start naming every side path as if it deserves equal billing.

That is also weak.

A path deserves explicit ownership only if it changes the design conversation in a real way:

- it changes the dominant `pressure`
- it changes the expected components
- it changes the main `tradeoff`
- it changes the first thing likely to break

If not, keep it subordinate.

Examples:

- `WhatsApp` attachments do not make the core product mostly media-first
- `Uber` rider-driver chat does not take ownership away from dispatch
- `Airbnb` host messaging is real, but it does not dominate the booking path

Hybrid thinking is not about saying more things.
It is about separating the few things that actually need to be separated.

### Borderline Drill: Split Or Keep Secondary?

Use this when you are unsure whether a path deserves its own owner.

| Product moment | Candidate path | Decision |
|---|---|---|
| WhatsApp group text send | media attachments | keep secondary unless the ask is attachment-heavy |
| Airbnb booking flow | host messaging | keep secondary unless the ask is host-guest communication |
| Slack enterprise export | compliance/export | separate only when retention, replay, and legal access are in scope |
| Uber trip request | rider-driver chat | keep secondary to dispatch unless communication reliability is the actual ask |
| YouTube after video starts | playback delivery | separate, because buffering, edge cache, and origin protection are different from discovery |

The stop rule is simple:
split when the pressure, components, tradeoff, or first failure changes enough that one owner would lie.
Keep it secondary when it is real but does not change the main path you are explaining.

## Difficulty Ladder: Hybrid Reads

### Easy: Airbnb

The UI flow is simple:
search, view, book.

A weak answer says:

> "Airbnb is a search system with bookings."

A better answer says:

> "Listing discovery is search-owned because retrieval, filters, ranking, and some freshness lag dominate there. Booking is transactional-owned because scarce inventory, payment, retries, and duplicate prevention dominate there."

This is easy because the two major paths are visible in the product flow.

### Medium: Slack

Slack looks like one messaging product, but its paths split.

A weak answer says:

> "Slack is messaging, and search is just another feature."

A better answer says:

> "Live send and delivery are messaging-owned, while history search is discovery-owned because old-message retrieval, indexing, ranking, and freshness lag are a different problem from live delivery. Compliance export may deserve a separate explanation when enterprise retention and replay are in scope, but it still should not hijack the core send path."

This is medium because the same message data appears in multiple paths with different access needs.

### Hard: Uber

Uber has dispatch, maps, chat, payment, fraud, notifications, and trip history.

A weak answer says:

> "Uber is a hybrid of geo, messaging, payments, and analytics, so I will design all of them."

A better answer says:

> "The hot path is geo/dispatch-owned because live location, nearby supply, matching latency, and assignment races dominate. Payments and chat are real supporting paths, but unless the design ask focuses on them, they should stay secondary so the dispatch loop remains clear."

This is hard because the product has many real subsystems.
Hybrid discipline means choosing which ones own the current answer.

## Phrase Drill: Path Ownership

Practice this sentence shape:

> "For this product, I would split ___ from ___. The ___ path is owned by ___ because ___. The ___ path is owned by ___ because ___. I would keep ___ secondary because it does not change the main pressure of this path."

Examples:

| Product | Interview-ready ownership sentence |
|---|---|
| YouTube | "I would split upload, discovery, and playback. Upload and playback are media-owned because blob processing and edge serving dominate; discovery is search-owned because retrieval, ranking, and freshness dominate." |
| Airbnb | "I would split listing discovery from booking. Discovery is search-owned because filters and ranking dominate; booking is transactional-owned because scarce inventory and money movement dominate." |
| Slack | "I would split live messaging from history search. Live messaging is messaging-owned because fanout and ordering dominate; history search is discovery-owned because indexing and retrieval dominate." |

## Path-Split Rehearsal

Suppose your YouTube answer starts flat:

> "This is basically a media platform, so I would use object storage, a CDN, and some search."

That answer is too flat.
It leaves the discovery path blurry and treats search like a bolt-on.

Repair it by splitting the product into paths before you draw:

> "I would split YouTube by path before drawing one architecture. The upload and playback-serving paths are owned by media storage and delivery because blob handling, transcoding, and edge serving dominate there. The discovery path is owned by search and recommendation because retrieval, ranking, and freshness dominate there. I would explain each path separately, then show what shared metadata or pipelines connect them."

The repair works because:

- it isolates the paths before naming components
- it earns each `archetype` from the path's dominant stress
- it keeps shared state and shared services from turning into conceptual blur

## Mini Drill: Slice The Product Before You Sketch

For each product below, say out loud:

- the main path you would isolate first
- which `archetype` owns it
- one other real path with a different owner
- one side path you would keep secondary

Products:

- `YouTube`
- `Airbnb`
- `Slack`
- `Uber`

Expected direction:

`YouTube` splits into upload, discovery, and playback.
`Airbnb` splits into listing discovery and booking correctness.
`Slack` splits into live messaging and history search, with compliance/export as a real side path.
`Uber` is primarily `Geo / Dispatch`, while chat and payouts are secondary supporting paths rather than the core owner of the system.

If the product turns back into one giant box diagram, pause and name the path you are currently explaining.

## Before You Move To Lesson 08

The checkpoint is path ownership.
You should be able to:

- split a product by meaningful path before naming the whole architecture
- assign an owner to each important path from its dominant `pressure`
- explain what stays secondary on that path
- avoid both under-splitting and over-splitting

You are ready for Lesson `08` when you can take a real interview design ask, slice it into paths, and explain the owners clearly in spoken form.

Lesson `08` turns the whole course into a practice ladder so these moves become automatic under interview pressure.
