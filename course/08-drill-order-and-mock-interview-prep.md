# 08 - Drill Order and Mock Interview Prep

You have the map now.

The last problem is not learning one more concept.
The last problem is making the whole chain come out in the right order while a clock is running and another person is listening.

That is why the final chapter is about practice order.
Not because practice is a separate topic after the real content, but because the whole course was quietly building toward spoken performance from the beginning.

## Scope Note: Readiness Has Three Extra Deliverables

The course's main job is still reasoning depth.
The interview performance you are training is the `7+1` opening, the `LGTC` compression, archetype or hybrid ownership, justified components, tradeoff, and first failure.

But a real interview may also ask you to sketch:

- a rough capacity estimate
- a small API contract
- a transport choice

Do not turn those into new framework buckets.
Treat them as outputs of the same reasoning.
Sizing should quantify the pressure.
The API contract should expose the product boundary and guarantee.
The transport choice should follow latency, directionality, connection count, and delivery expectations.

## Start With One Plausible But Unstable Week Of Preparation

Imagine a candidate who has spent a week doing full mocks.

On paper, that sounds serious.
In practice, every mock goes wrong in the same way.

The interviewer says:

> "Design Stripe."

The candidate has seen the common pieces and answers fast:

> "I would start with idempotency keys, a ledger-style write path, retries, an outbox or Kafka for webhooks, and maybe sagas for external payment flows."

That is a credible starting inventory, not the interview answer yet.
Several of those ideas may belong in a payment design.
The problem is that the answer gives likely infrastructure before it has named the payment promise, retry identity, consistency boundary, or failure mode those pieces are supposed to protect.

Then the interviewer asks:

> "How are you handling retries?"

The answer turns vague.

Then:

> "What exactly needs strong consistency?"

Still vague.

Then:

> "What breaks first?"

The answer becomes:

> "Maybe downtime or scale issues."

This is not mainly a vocabulary problem.
The candidate has seen the words.
The real problem is training order.

Mocks amplify your current habits.
They do not repair weak habits efficiently.

If you put full pressure on top of fuzzy concepts, fuzzy openings, and half-formed tradeoff language, the mock mostly teaches panic.
That is why this chapter exists.

The repair picture is:

```text
miss in a mock
      |
      v
find the earliest layer that owns the miss
      |
      v
drill that layer without full interview pressure
      |
      v
rerun the broken part
      |
      v
return to harder practice only after the repair is audible
```

This is how practice becomes a mental gym instead of a random calendar of mocks.

## What Practice Is Training

Practice here does not mean "touch many systems."
It means making one reasoning chain reliable enough that it still appears under pressure.

That chain is the same one the course kept building:

1. hear the `design ask` clearly
2. open with the `7+1`
3. compress into `LGTC`
4. name the `archetype` or split the `hybrid`
5. justify components
6. name the real `tradeoff`
7. explain what breaks first

When the chain snaps, diagnose the first broken link instead of repeating full mocks blindly:

| If the answer breaks here... | Repair here first |
|---|---|
| concept meaning is fuzzy | Stage 1: make one idea speakable |
| components appear before facts | Stage 2: stabilize the opening |
| product label is guessed | Stage 3: earn one clean archetype |
| mixed product becomes blurry | Stage 4: split path ownership |
| structure disappears under interruption | Stage 5: timed pressure and recovery |

The ladder is a repair loop because each stage locks behavior the next stage depends on.
If Stage 5 exposes a Stage 2 miss, do not do Stage 5 harder.
Repair the opening, rerun the broken slice, then return to pressure.

## Stage 1: Make One Idea Speakable

Start by taking one idea at a time and making it explainable out loud.

Not just definable.
Explainable.

If I ask:

> "Why is `idempotency` essential in payments but not equally heavy in search?"

you should be able to answer without needing a full system diagram.

This stage is where you train:

- one concept in plain language
- one concrete system where it matters
- one believable alternative
- one cost of that alternative
- one failure if you ignore the concept

The clearest drills here are very small.

Examples:

- `Stripe`: idempotency, transaction boundary, outbox
- `YouTube`: eager versus lazy transcoding
- `Google Docs`: `OT` versus `CRDT`
- `Elasticsearch`: freshness versus query latency
- `Uber`: optimistic versus pessimistic assignment locking

### Starter Concept Set

If you do not know where to begin Stage 1, use this set:

| Concept | Anchor system | One-minute question |
|---|---|---|
| fanout multiplier | Slack or WhatsApp | How can one send become thousands of delivery attempts? |
| rough capacity estimate | Slack | What hidden work per visible action changes the sizing story? |
| idempotency | Stripe | Why does retry safety need a stable business identity? |
| API contract | Slack | What should `POST message` promise, and what can lag after the response? |
| transport choice | Slack or Google Docs | Why would this path need WebSockets instead of plain HTTP? |
| OT versus CRDT | Google Docs | Where does merge authority live, and what breaks first? |
| raw retention versus rollup | Datadog-style metrics | What do you lose when old raw telemetry is downsampled? |

The point is not to memorize the table.
It is to give every fuzzy label a concrete system, an alternative, and a first failure.

If your explanation still sounds like glossary text, stay here.
If you can only name one side of the tradeoff, stay here.
If you can name a component but not the guarantee it is protecting, stay here.

You move on only when the idea becomes speakable in one minute and defendable in two.

## Stage 2: Make The Opening Stable

Now take a full design ask, but ban yourself from architecture for the first pass.

Your whole job is:

- ask the `7+1`
- compress to `LGTC`

Nothing else.

This stage exists because many weak interviews are already lost before the first component appears.

The strongest signal that Stage 2 is still weak is very easy to hear:
you say "Kafka," "Redis," or "database" before you can say what the main `pressure` actually is.

Use a few design asks repeatedly here:

- `Slack`
- `Stripe`
- `YouTube`
- `Uber`

Those four are enough because they force different openings.
`Slack` makes you hear fanout and local ordering.
`Stripe` forces correctness and retry language.
`YouTube` makes the `+1` question heavier.
`Uber` makes you separate live state from deferred work.

A strong Stage-2 run has a very specific feel:
the first two or three minutes sound slower than a component-first opening, but much more stable after that.

Do not leave this stage until you can run a clean opening without decorative boxes, and do it consistently.

## Stage 3: Make One Clean Archetype Feel Native

Once the opening is stable, you can train one full system family at a time.

This is where the design starts to feel interview-shaped.

Pick one clean system for each `archetype`:

- `WhatsApp` for messaging
- `YouTube upload/playback path` or a simple photo/video hosting product for media
- `Stripe` for transactional
- `Google Docs` for collaboration
- `Elasticsearch` for search
- `Datadog` for event ingestion
- `Uber` for geo / dispatch

At this stage, you are not trying to memorize a component list.
You are trying to make the archetype feel earned.

For each system, you should be able to say:

- why this `archetype` owns the path
- what components naturally follow
- what tradeoff interviewers expect you to notice
- what failure mode appears first

This is where many candidates sound knowledgeable but still unstable.
They can say the right nouns, but the components still feel detached from the pressure.

If I ask:

> "Why is the outbox there?"

or:

> "Why a queue here instead of a direct retry?"

and the answer becomes hand-wavy, Stage 3 is not locked yet.

## Stage 4: Learn To Step Into Mixed Ownership

Only after the clean families feel stable should you spend serious time on mixed products.

This stage matters because real interviews often use systems that stop making sense under one label.

Examples:

- `YouTube`
- `Airbnb`
- `Slack`
- `DoorDash`
- `Netflix`

The move here is not "say more labels."
The move is:

What path am I explaining right now, and who owns it?

If upload, playback, and discovery all get flattened into one media story, the answer blurs.
If booking, search, and messaging all become one Airbnb diagram, the answer blurs.

This stage is working when you can say:

- what owns the `write path`
- what owns the main `read path`
- when the read side itself needs to split again
- what stays secondary instead of becoming a fake co-owner

If every side feature becomes a co-equal subsystem, you are over-splitting.
If one product label hides real differences in tradeoffs and failures, you are under-splitting.

Stage 4 teaches the middle.

Use short timed reps before full mocks:

| Rep | Time box | Pass condition |
|---|---|---|
| path names only | 2 minutes | name the major paths without components |
| owner and reason | 4 minutes | assign owners from pressure, not product brand |
| secondary-path cut | 3 minutes | say what stays subordinate and why |
| interruption recovery | 5 minutes | handle "but what about search/payment/chat?" without losing the main owner |

For YouTube, a passing rep says upload and playback are media-owned, discovery is search-owned, and analytics stays secondary unless the design ask changes.
For Airbnb, a passing rep says discovery is search-owned, booking is transactional-owned, and messaging stays secondary unless it becomes the focus.

If the rep turns into a full architecture, stop.
Stage 4 is not drawing practice.
It is ownership practice.

## Stage 5: Add The Clock Only After Structure Exists

Now come the timed mocks.

Not because mocks are the most important part.
Because they are the most expensive part.

A mock should test structure that already mostly exists.
It should not be the place where structure is first invented.

At this stage, add:

- a timer
- interruptions
- new constraints midway
- follow-up questions on tradeoffs
- explicit failure probing

Good pressure challenges look like this:

- same system, now one region fails
- same system, now cost must drop by `10x`
- same system, now compliance becomes critical
- same system, now the main latency target is cut in half
- same system, now one side path becomes far more important

The goal is not a perfect performance.
The goal is recovery without losing the framework.

When pressure rises, the answer should still land back on:
`LGTC`, owner, components, tradeoff, failure mode.

If the clock makes you forget the whole shape, the fix is rarely "do mocks harder."
It is usually to step back one layer and repair the exact piece that disappeared.

Progressive overload matters here.
Do not jump from calm reading to a 45-minute mock and call that training.
Increase pressure one variable at a time:

| Overload step | What changes |
|---|---|
| no timer | explain the idea cleanly |
| soft timer | keep the same structure with mild time pressure |
| interviewer interruption | recover without losing the current layer |
| new constraint | feed the new fact back into `LGTC` or ownership |
| full mock | run the whole chain while being probed |

The point is not comfort.
The point is controlled difficulty.
If a new pressure makes the whole answer collapse, lower the pressure and repair the missing layer.

Use exit criteria before you promote yourself to harder practice:

| Before moving on... | Evidence |
|---|---|
| from Stage 1 to Stage 2 | you can explain the concept in one minute and defend one tradeoff in two |
| from Stage 2 to Stage 3 | three component-ban openings reach `LGTC` cleanly |
| from Stage 3 to Stage 4 | one clean archetype answer names components, tradeoff, and first failure without notes |
| from Stage 4 to Stage 5 | three hybrid splits name owners and secondary paths under a short timer |
| from Stage 5 to full mocks | you can recover from two interruptions without abandoning the current layer |

That is progressive overload.
The load increases only after the current movement is stable enough to survive it.

## Three Session Modes Keep Practice Honest

By this point, you should stop treating every session as the same kind of session.

Use three modes deliberately:

### `Teach`

Use this when one concept still feels verbal but not owned.

Examples:

- you keep saying "strong consistency" without naming the exact shared state
- you know `OT` and `CRDT` as labels but cannot explain why one is cheaper in one situation
- you can say "use a queue" but not what that queue is protecting

Teach mode means:
anchor the concept to its bucket, explain it through one concrete system, state the alternative, then answer one retention question.

### `Quiz`

This should be the default mode.

A cold system is better than a rehearsed monologue because it tells you whether the framework is actually available under mild pressure.

Quiz mode means:
run the whole flow, then pressure-test the weak sections immediately.

### `Test`

Use this only when the earlier layers are mostly stable.

Test mode should feel like an interview:
less coaching, more constraints, more interruptions, sharper scoring.

If test mode keeps exposing the same weakness, do not stay in test mode out of pride.
Step back to teach or quiz mode and repair it directly.

## Handling Interviewer-Directed Deep Dives

Most real interviews do not let you give a perfect lecture.
After the opening, the interviewer will usually point at one part and ask:

> "Tell me more about that."

That is the intended format.
It is not automatically a sign that you are failing.
The skill is to move without losing the structure you just built.

Use three response patterns.

| Situation | Response pattern |
|---|---|
| premature interrupt before the opening is complete | acknowledge it once, then finish the opening |
| post-opening deep dive | pivot cleanly and own the topic |
| a broad prompt that forces you to skip something | say what you are focusing on and what you are leaving for later |

For a premature interrupt, keep the sentence short:

> "I will come back to that; let me finish the opening so the answer is grounded."

Then continue.
Do not abandon the opening at minute four and spend the rest of the interview answering from an unstable shape.

For a post-opening deep dive, take the prompt directly.
Trace the path, name the tradeoff, and use the Chapter 05 sentence shape:
"I am choosing `[X]` over `[Y]` because `[pressure]`; the cost is `[tradeoff]`."

For skip-flagging, be explicit:

> "I am going to focus on write-path durability here. I am not covering search freshness yet, but I can circle back."

Common deep-dive prompts usually map back to a course layer:

| Interviewer prompt | Response tactic |
|---|---|
| "Why not just use Postgres for this?" | state the pressure Postgres may not absorb, then name the tradeoff |
| "How does this handle a node failure?" | trace the failure path on the component map instead of naming a pattern |
| "What happens when volume doubles overnight?" | rerun the load read on the new number |
| "Walk me through a write from user to storage." | trace one path end to end and name each hop's purpose |
| "What if the message queue falls behind?" | return to the guarantee: what does the user see and what promise weakens? |
| "How would you handle a hot partition?" | name the key shape that caused it, then the mitigation |
| "What is your biggest risk in this design?" | lead with the weakest `LGTC` dimension, not a generic concern |

## One Useful 45-Minute Practice Session

A good session does not need to be long.
It needs to close a loop.

One reliable pattern is:

1. `5 minutes`: review the last weak spot
2. `10 minutes`: drill one concept or one Stage-2 opening
3. `15 minutes`: run one full system
4. `10 minutes`: rerun only the part that broke
5. `5 minutes`: update the ledger with the exact miss and the next repair

Notice what is not in that plan:

- random extra reading
- starting a second full system because the first one felt uncomfortable
- ending right after the mock exposed the weakness

The rerun is where most learning happens.

Here is what that looks like with a real miss:

```text
miss:
  In a Stripe mock, I said "retry with Kafka" but never explained duplicate-charge prevention.

owning layer:
  Stage 1 + Stage 3

repair:
  Explain idempotency in payments for 5 minutes.
  Then rerun only the Stripe charge hot path.

close when:
  I can say how a stable idempotency key prevents a repeated client request from creating a second business effect.
```

Notice that the repair is smaller than another full mock.
That is why it can actually change tomorrow's answer.

## Production Case Files: Borrowed Experience, Not Passive Reading

After the course has built the full map, you can finally use real company writeups at full strength.

Use each case as a simulation before opening the source:

1. read the short setup
2. make your own pressure read
3. choose the tradeoff or recovery move you would try
4. only then open the source
5. compare what the real team did against your reasoning
6. write one interview-ready sentence you want to keep

### Worked Model: Discord Message Storage Migration

Setup:

Discord had message history at enormous scale, with some channels and servers far hotter than ordinary ones. The team faced unpredictable latency, high operational toil, hot local slices of data, and a major migration.

Before opening the source, answer:

- Chapter 01: what is the dominant pressure?
- Chapter 02: what data/query shape makes message storage special?
- Chapter 04: what runtime protection would reduce repeated reads against the same hot data?
- Interview line: how would you explain the first failure without saying only "database scale"?

One worked answer:

Chapter 01 pressure read:

> "The dominant pressure is skewed message-history traffic: a few channels or servers become much hotter than the average, so local tail latency appears before fleet-wide request count sounds impossible."

Chapter 02 data/query-shape read:

> "The natural query is recent messages for one channel in time order. That suggests a local ordered-history shape, but it also creates a hot-slice risk when one channel becomes unusually active."

Chapter 04 runtime read:

> "Repeated reads against the same hot history need protection such as request coalescing, caching where freshness allows it, and clear signals for database latency and repeated hot-key pressure."

Tradeoff:

- Keeping recent channel history local makes common reads simple and fast.
- But the same locality can concentrate pain when one channel becomes huge or suddenly active.

Interview line to keep:

> "This is not just database scale; it is a skewed ordered-history workload where the hottest channel slices dominate tail latency and force careful partitioning plus runtime shielding."

Now use the remaining case files the same way:

1. name the first pressure
2. name the shape or guarantee that explains it
3. name one runtime or migration risk
4. compress the lesson into one interview-ready sentence

Source: [Discord Engineering, "How Discord Stores Trillions of Messages"](https://discord.com/blog/how-discord-stores-trillions-of-messages)

### Case File 1: Cloudflare Global WAF Outage

Setup:

A globally deployed rule change made request handling far more CPU-expensive and caused widespread failures. The issue was not just a bad rule; it was also about rollout safety, detection, emergency controls, and recovery path design.

Before opening the source, answer:

- Chapter 01: what pressure changed if traffic volume alone was not enough to explain the incident?
- Chapter 04: what rollout and rollback protections would you want?
- Chapter 08: what would you drill afterward so the same class of failure is less likely?
- Interview line: how would you say "deployment pipeline is part of architecture" without sounding vague?

One worked answer:

Chapter 01 pressure read:

> "The pressure was not only more requests; the per-request CPU cost changed globally, so ordinary traffic became much heavier and saturation appeared fast."

Chapter 04 runtime read:

> "A globally executed rule needs staged rollout, resource-saturation signals, and a rollback path that stays reachable when the normal control plane is degraded."

Drill decision:

> "I would practice turning deployment choices into runtime promises: what slice sees the change first, what signal stops rollout, and what independent control path reverses it."

Interview line to keep:

> "For globally executed request-path logic, rollout safety is part of architecture because a small rule change can multiply CPU cost across every request before traffic volume changes."

Source: [Cloudflare, "Details of the Cloudflare outage on July 2, 2019"](https://blog.cloudflare.com/details-of-the-cloudflare-outage-on-july-2-2019/)

### Case File 2: GitHub October 2018 Incident

Setup:

A brief network partition triggered database topology changes, inconsistent replication state, degraded service, delayed replicas, and large downstream backlogs. The recovery had to prioritize data integrity even though service usability suffered.

Before opening the source, answer:

- Chapter 03: what correctness boundary mattered more than fast recovery?
- Chapter 04: what recovery backlog and stale-read signals would you track?
- Chapter 05: what is the `LGTC` summary?
- Interview line: how would you defend choosing data integrity over shorter outage time?

Source: [GitHub, "October 21 post-incident analysis"](https://github.blog/news-insights/company-news/oct21-post-incident-analysis/)

### Case File 3: Stripe Idempotent Requests

Setup:

Payment APIs face timeouts and retries, but retrying must not create duplicate business effects. The system needs the same logical request to be recognized across attempts.

Before opening the source, answer:

- Chapter 03: what exactly does idempotency protect?
- Chapter 04: what retry behavior is safe and what retry behavior is dangerous?
- Chapter 06: why does this smell transactional rather than generic event processing?
- Interview line: how would you explain exactly-once business outcome without promising magical exactly-once transport?

Source: [Stripe API docs, "Idempotent requests"](https://docs.stripe.com/api/idempotent_requests)

### Case File 4: Slack Shared Channels

Setup:

Slack added channels shared across workspace boundaries. That broke assumptions about where channel data lived, how user visibility worked, and how caches or APIs should reason about external users.

Before opening the source, answer:

- Chapter 02: what old storage boundary stopped fitting the product?
- Chapter 07: which path remains messaging-owned, and which ownership boundary changed?
- Chapter 08: what migration risk would you drill before implementation?
- Interview line: how would you say "product boundary changed, so data ownership changed"?

One worked answer:

Chapter 02 boundary read:

> "The old assumption was that a channel and its data lived cleanly inside one workspace boundary. Shared channels break that assumption because membership, visibility, API behavior, and cache reads now cross workspace ownership."

Chapter 07 ownership read:

> "Live messaging still owns the send path, but the seam changes: channel identity and visibility can no longer be treated as purely local to one workspace."

Migration drill:

> "I would drill dual-read or compatibility behavior around old and new channel ownership, cache invalidation for external visibility, and rollback behavior if one workspace sees a different channel state from the other."

Interview line to keep:

> "Slack shared channels are not a new archetype; they are a messaging path whose product boundary changed, forcing data ownership, visibility, and migration safety to become first-class design concerns."

Source: [Slack Engineering, "How Slack Built Shared Channels"](https://slack.engineering/how-slack-built-shared-channels/)

## The Weak-Spot Ledger Should Close Loops, Not Decorate Them

A weak-spot ledger is useful only if it changes tomorrow's drill.

Do not record:

- "Need to get better at scalability"
- "Need to be sharper"
- "Need more practice"

Those are moods, not repair instructions.

Record something concrete:

| Date | System | Exact miss | Owning stage | Repair drill | Ready to close when |
|---|---|---|---|---|---|
| 2026-04-15 | Stripe | said retries but never named an idempotency key | Stage 1 + 3 | 10-minute idempotency explanation, then rerun Stripe hot path | I can explain retry safety and duplicate prevention without notes |
| 2026-04-16 | YouTube | kept describing the whole product as media | Stage 4 | split upload, playback, and discovery aloud three times | I can name path owners before components |
| 2026-04-17 | Slack | said WebSockets before finishing the `7+1` | Stage 2 | component-ban opening drill on Slack and WhatsApp | I can reach `LGTC` before naming boxes |

That last column matters most.
Without a closure condition, weak spots just accumulate emotionally and never retire operationally.

## Readiness Is Audible, Not Internal

One of the easiest ways to fool yourself is to confuse internal recognition with interview readiness.

You may feel that you "know" a system because the diagram makes sense when you read it.
But the interview only scores what became audible.

A strong answer has to be heard:

- the opening questions were actually asked
- the `LGTC` summary was actually spoken
- the chosen `archetype` was actually justified
- each component had an actual reason
- the tradeoff named both sides
- the failure mode had a mechanism, not just the word "scale"

That is why the mock rubric scores spoken behavior, not private understanding.

Use the rubric this way:

- `1` means missing
- `2` means present but still soft
- `3` means clear, justified, and interviewer-ready

The score is seven dimensions, three points each:

| Dimension | What a `3` sounds like |
|---|---|
| requirements opening | the `7+1` is used to extract facts, not recited |
| dominant stress | load, guarantees, topology, and constraints are prioritized |
| archetype recognition | the label is earned from pressure |
| hybrid ownership | write/read/path owners are explicit when needed |
| components | every component has a reason tied to stress or guarantee |
| tradeoff | both sides and the chosen side are named |
| failure mode | the first break has a mechanism, not just a scary word |

Anything below `15` usually means structural gaps are still visible.
But even a higher score can hide one repeated weakness.
If the same miss appears twice, treat it as a real repair target immediately.

## Annotated Partial Score: Slack

Here is a realistic partial answer:

> "For Slack, users send messages in channels and DMs. I would use WebSockets for live updates, Kafka for fanout, a database for messages, and Elasticsearch for search. The system needs to scale to big channels, keep messages ordered, and avoid losing messages."

This is not bad.
It earns some `2`s because the right ideas are present.
But it is not a `3` yet because the ideas are not controlled.

| Dimension | Why this earns `2` | What would make it `3` |
|---|---|---|
| requirements opening | users and broad actions are named | run the `7+1` enough to expose latency, wrong-delivery risk, compliance, and data/query shape |
| dominant stress | big channels and scale are mentioned | say bursty fanout on hot channels, tail-latency risk, and hidden delivery work before tools |
| components | plausible boxes appear | attach each component to a reason: durable log for accepted truth, connection layer for active delivery, index for search |
| API contract | missing | sketch `POST message` as durable accept with retry identity, then say delivery/search can lag |
| transport defense | WebSockets are named | explain why active live delivery is bidirectional/low-latency, while send, history, and search can stay plain HTTP |
| failure mode | "scale" is vague | name large-channel fanout, hot partition, lagging search index, or notification backlog as the mechanism |

A `3`-level repair could start like this:

> "I would first extract Slack's shape: sends and recent reads are latency-sensitive, large channels create bursty fanout and hot-channel skew, accepted messages need durable per-channel order, and search/compliance paths can lag behind the live send path. The `POST message` contract should mean durable accept with a retry identity, not delivery to every recipient. For active recipients I would defend WebSockets because the path needs low-latency server push, while history and search can stay plain HTTP. The first failure I would watch is large-channel fanout or a hot channel partition stretching tail latency."

## Difficulty Ladder: Practice Decisions

### Easy: One Concept Is Fuzzy

You can say `eventual consistency`, but you cannot explain where it is safe.

Do not run a full mock yet.
Run Stage 1:
explain one product state that can lag and one state that cannot.
Use Airbnb search versus booking until the contrast is automatic.

### Medium: Opening Keeps Collapsing Into Components

You hear `Design Slack` and immediately reach for WebSockets, Kafka, and Redis before saying what they protect.

Do not memorize a better Slack architecture yet.
Run Stage 2:
three openings with a component ban.
You only pass when you reach `LGTC` before any component name appears.

### Hard: Hybrid Product Becomes A Blur Under Pressure

You can explain YouTube slowly, but in mocks you collapse upload, discovery, and playback into one path.

Do not add more systems.
Run Stage 4:
repeat only the path split until ownership is audible:
creator upload, viewer discovery, viewer playback.
Then add a timer.

### Interview Mode: Constraint Change Midway

The interviewer says:
"Now assume one region fails during peak traffic."

Do not throw away the answer.
Feed the new fact back into the map:
load changes, topology changes, availability constraints get heavier, and the first failure mode may shift.
Then continue from the current layer.

## Phrase Drill: Diagnose The Miss

Use this sentence when practice goes badly:

> "The miss was ___. The earliest layer that owns it is ___. I will repair it by ___, and I will close it when ___."

Examples:

| Bad note | Repair note |
|---|---|
| "Need better scalability." | "The miss was vague peak-load reading. The owning layer is Stage 2. I will run three `LGTC` openings for Slack, YouTube, and Uber, and close it when I can name burst, skew, or fanout before components." |
| "Need to know Kafka better." | "The miss was not Kafka knowledge; I could not say what deferred work the queue protected. The owning layer is Stage 1 + Stage 4. I will explain queue purpose on YouTube upload and close it when I can name the response promise and backlog signal." |
| "Bad at hybrids." | "The miss was path blur. The owning layer is Stage 4. I will split YouTube and Airbnb into owners out loud and close it when I can name what stays secondary." |

## A Better Readiness Standard Than "I Did Many Mocks"

Before calling yourself interview-ready, look for evidence like this:

- you can explain five to ten core concepts cleanly without notes
- you can run `7+1` plus `LGTC` for several systems without rushing into components
- you can do a rough pressure-first sizing pass without hiding behind exact math
- you can sketch one or two core APIs and say what each response promises
- you can defend transport choices from latency, directionality, connection count, and delivery expectations
- you can do one clean system from each major `archetype`
- you can split hybrid products by path without blur
- you can survive constraint changes without abandoning structure
- your last few mocks still contain stress, but not collapse

That is a much better signal than the raw number of systems you touched.

## A Seven-Day Ramp After The Course

Use the first week after reading to install the habits instead of starting random mocks.

| Day | Drill |
|---|---|
| 1 | Stage 1: explain five concepts for one minute each, then repair the weakest one |
| 2 | Stage 2: run three component-ban openings for Slack, Stripe, and YouTube |
| 3 | Stage 3: do two clean archetypes end to end, including tradeoff and first failure |
| 4 | Stage 3: do the remaining clean archetypes in shorter reps |
| 5 | Stage 4: split YouTube, Airbnb, Slack, and Uber by path and owner |
| 6 | Stage 5: run one 25-minute mock with two interruptions, then rerun only the broken slice |
| 7 | Run one scored mock, update the weak-spot ledger, and choose next week's repair target |

The point is not to finish a schedule.
The point is to make each miss create the next drill.

## Before You Leave The Course

The final operating rule is short:
practice where the miss is born, then prove the repair by rerunning the broken slice.

Your next move after finishing the course should be simple:

1. run concept drills
2. run framework-only openings
3. run one clean system per `archetype`
4. run hybrid splits
5. run timed mocks
6. whenever something breaks, step back to the earliest owning layer and repair it

If you do that, the course stops being eight pages you read once.
It becomes a practice system you can keep using until the interview feels normal.
