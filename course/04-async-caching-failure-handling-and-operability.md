# 04 - Async, Caching, Failure Handling, and Operability

You now know how to read pressure, choose where data lives, and draw a narrow correctness boundary.

That still leaves a question many shallow answers skip: even if the state model is right, what is the system actually allowed to do before it responds, what can wait, and how does it stay sane when the world gets noisy?

This chapter is trying to build one new habit:
read a design as a timeline, not just as a box diagram.

## Start With One Honest Timeline

Imagine a creator uploads a breaking-news clip to YouTube just as millions of viewers are starting to search for it.

A shallow answer sounds productive:

> "Store it, transcode it, update search, warm caches, send notifications, and record analytics."

But that answer only lists work.
It does not say when each piece must happen, which means it still has not decided what "upload succeeded" really means.

An honest reading is more useful:

1. The platform must not say "upload succeeded" until the original file and core metadata are durably stored.
2. The creator does not need every rendition, thumbnail, search update, and recommendation refresh to finish before the upload becomes trustworthy.
3. Viewers do need some playable path soon, but they do not need every quality level immediately.
4. Popular watch paths will benefit from caching, but the upload commit itself cannot be cached into correctness.
5. When a big event creates a spike, the real question becomes whether deferred work is buffered and controlled or whether it quietly turns into runaway lag.

Chapter 03 protected the truth that must not be wrong.
This chapter protects the timeline:
which promise becomes true now, which work can safely lag, and which lag would eventually become a product failure.

The useful picture is:

```text
creator clicks upload
        |
        v
accept only the facts needed to make "upload succeeded" honest
        |
        v
return success
        |
        v
finish expensive derived work while measuring lag and failure
```

If the first box is too small, the response lies.
If the first box is too large, the user waits for work that did not need to block the response.
That tension is the center of this chapter.

## What "Upload Succeeded" Must Really Mean

The hot path, or critical path, is the minimum work that must finish before the system can respond honestly.

In plain language:
if the response says success, what had better be true already?

For the YouTube upload, that usually means things like:

- the caller passed the checks that gate acceptance, such as auth, ownership, or quota
- the original blob is durably stored
- the core metadata row exists
- the processing state exists, so the rest of the pipeline knows what was accepted

It usually does not mean:

- every bitrate is transcoded
- thumbnails are finished
- search is updated
- recommendations are refreshed
- analytics and dashboards are current
- every CDN edge is warm

This is the first discipline of the chapter:

every synchronous step must defend its place on the hot path.

If you leave a correctness-critical step out, the system lies.
If you keep too much extra work in, the user pays latency for tasks that could have happened later.

### Two Promises, Two Timelines

A YouTube-like upload has at least two promises that are easy to blur.

The creator-facing promise is:

> "We accepted your upload."

The viewer-facing promise is:

> "Someone can watch it."

Those are not the same moment.

| Promise | What must be true first | What can still be catching up |
|---|---|---|
| upload accepted | original file is durable, core metadata exists, processing state exists | transcodes, thumbnails, search, recommendations, CDN warming |
| first playable | at least one usable rendition is ready and reachable | higher qualities, recommendations, analytics, long-tail cache warmth |

This split keeps the answer honest.
If the creator sees success before durable accept, the system lies.
If the viewer is promised playback before a usable rendition exists, the product lies in a different way.

## Async Is Not "Unimportant"

Async work is work the system still cares about, but the user does not need it finished before the current response can be trusted.

That distinction matters because many candidates say "make it async" as if they are throwing work away.
They are not.
They are changing the time at which the promise becomes due.

In the YouTube story, async work naturally includes:

- transcoding new renditions
- generating thumbnails
- pushing the video into search and recommendation pipelines
- sending notifications
- updating derived analytics
- warming or refreshing caches

What async buys you:

- a smaller hot path
- better burst absorption
- independent retries for slow or failure-prone work

What async costs you:

- lag between source truth and derived views
- duplicate delivery or duplicate processing attempts
- more state transitions to track
- more ways for hidden backlog to accumulate

That last point is the trap.
Moving work out of the response path is useful only if you also own the lag you just created.

## A Queue Buys Time, Not Magic

A queue is often the simplest way to separate acceptance from deferred work.

In the YouTube story, the upload service can durably accept the original video and enqueue jobs for transcode workers.
That lets creators get a truthful acknowledgment without waiting for heavy CPU work.

This is good design when bursts happen.
A sports final ends, thousands of clips arrive, and workers drain them over time instead of forcing every uploader to sit behind everyone else's transcode.

But a queue is not a solution by itself.
It is a waiting room, and waiting rooms can become liabilities.

Once you introduce a queue, you now have to answer:

- how much lag is acceptable before the experience becomes broken?
- what happens when one bad job keeps failing?
- how do retries avoid multiplying the same work forever?
- which jobs deserve priority when capacity is tight?

The important mental move is this:

a queue converts immediate overload into delayed work.
It does not remove the overload.
It only gives you a place to manage it.

So a queue answer is incomplete until it also says:

```text
what waits there
how old it is allowed to get
what retries safely
what gets priority
what users see when it falls behind
```

Those five lines are the difference between "we used a queue" and "we designed deferred work."

## Backpressure Keeps Delay From Turning Into Collapse

Backpressure is the system's way of refusing to pretend it can process infinite work.

Without it, overload spreads.
Queues grow, workers fall behind, callers retry, and a short spike turns into a broad failure.

In the YouTube story, imagine transcoding falls behind during a breaking-news surge.
A weak design just keeps accepting every derived job at full speed and hopes workers catch up later.
A stronger design starts making choices:

- keep upload acceptance healthy, because that is the creator-facing promise
- slow or cap low-value derived work before the backlog becomes unbounded
- prioritize the first playable renditions before the long tail of expensive formats
- let recommendation freshness lag before you let upload acceptance fail

That is what good degradation looks like in this chapter.

You are not "handling failure" only after the system is down.
You are deciding, in advance, which promise weakens first so the core promise survives.

### Queue, Backpressure, And Degradation Are Different Moves

These words often get mashed together.
Keep them separate:

| Move | Plain meaning | You owe this answer |
|---|---|---|
| queue | "This work can wait here." | what waits, how old it may get, and who drains it |
| backpressure | "We must slow or reject incoming work before collapse." | who gets slowed, capped, or refused |
| degradation | "Some product promise weakens before a more important one fails." | which experience gets worse first and what users see |

A queue buys time.
Backpressure stops the waiting room from growing without limit.
Degradation chooses the least damaging promise to weaken when capacity is still not enough.

## Cache Is A Speed Bet On Reuse

Caching enters the story on the read path.

Once the video is live, many viewers may request the same metadata, thumbnail, or video segments again and again.
That repeated work is exactly where caching helps.

A cache is a good fit when three things are true at the same time:

1. many reads reuse the same result
2. the origin is expensive enough to protect
3. some bounded staleness is acceptable

That is why CDNs and metadata caches make sense for YouTube watch traffic.
The same video segments, titles, and thumbnails are read repeatedly, and a little lag is usually far cheaper than hammering the origin on every request.

But caches are never free wins.

The moment you say "cache it," you also owe an answer for:

- how long the cached answer may stay stale
- what expires or invalidates it
- what happens when a suddenly popular item causes many misses at once

Even in the same product, different readers may tolerate different freshness.

For a casual viewer, view counts being a little old is usually fine.
For the creator dashboard, processing status may need to be much fresher because it changes whether the creator trusts the pipeline.

This is the rule worth keeping:

use caches to save repeated work, not to avoid thinking about truth.

A cache is therefore a poor answer for scarce inventory, money truth, or the commit decision itself.
For example, do not "cache the last room availability" as if that solves double-booking.
You may cache search results that say a room looks available, but the booking commit still needs fresh conflict-safe truth at the source of record.

## Retries Need Safe Replays

Failures on the network and in worker pools are normal.
The dangerous question is not "Will anything fail?"
The dangerous question is "What happens when the same work is attempted again?"

In the YouTube story, safe retries are often possible:

- a chunk upload can use a stable chunk identifier so a repeated attempt does not create a second logical chunk
- a transcode job can use a stable job identity so a crash and retry do not create uncontrolled duplicate outcomes
- search indexing can often replay the latest state safely if the update logic is designed around replacement rather than blind append

Now compare that with a money-moving system.
A repeated payout to a creator is not harmless just because the first attempt timed out.

That is why retries are not a universal good.
They are safe only when the handler is idempotent or the side effect is otherwise made replay-safe.

The identity of the replay matters:

| Replayed work | Stable identity | What it prevents |
|---|---|---|
| upload chunk | chunk ID inside the upload session | duplicate bytes or corrupt assembly |
| transcode job | job ID and target rendition | duplicate uncontrolled outputs |
| index update | source record version or event ID | stale updates overwriting newer state |
| payment or payout | idempotency key or business attempt ID | duplicate money movement |

Retrying is a design decision, not a reflex.
If you cannot say what identity makes the replay safe, the retry path may be adding load and risk instead of repair.

Once again, the theme of the chapter stays the same:
the timeline matters more than the component name.

## Degradation Means Choosing Which Experience Weakens First

When capacity gets tight or a dependency fails, a strong system does not always try to preserve every feature equally.

It chooses.

In the YouTube story, reasonable degradation might look like this:

- uploads still get durably accepted
- viewers still get at least a basic playable version
- 4K and less-used renditions arrive later
- recommendation freshness lags
- non-critical analytics lag even more

That is a thoughtful trade.
The core user promise survives, and the derived experiences weaken in an order that matches product value.

A weak answer says, "The system degrades gracefully."

A stronger answer says what degrades, why it degrades first, and which promise stays protected.

## Operability Lets You See Time And Failure

Operability is the part many candidates mention in one rushed sentence at the end, even though it is what tells you whether the design is actually alive.

For this chapter, operability is mostly about seeing four things clearly:

- hot-path health
- backlog growth
- retry behavior
- stale or failing derived views

For the YouTube story, useful signals include:

- upload acceptance latency and failure rate
- queue depth for transcode and indexing work
- age of the oldest waiting job
- retry counts and repeated-failure counts
- time from upload accepted to first playable rendition
- cache hit rate on the watch path
- freshness lag for search, recommendations, and creator-facing processing state

Notice how these are not random dashboards.
They are measurements of the promises the chapter asked you to separate.

If you say work is async, you should know how to see lag.
If you say a cache is helping, you should know how to see misses and staleness.
If you say the system degrades safely, you should know how to tell when it has crossed into a worse mode.

A design that cannot be understood in production is not finished.

## Two More Quick Timeline Reads

Once the YouTube story is clear, the same habit transfers quickly.

### WhatsApp

The message should be durably accepted in the conversation log before send success is shown.
Offline delivery, push notifications, and search indexing can happen later.
If delivery workers fall behind, the product should preserve durable send acceptance before it worries about secondary features.

### Stripe

The charge or ledger state that defines money truth stays on the hot path.
Merchant webhooks, email, and analytics can happen later through an outbox and workers.
Retries are much more dangerous here because duplicated business effects are far more expensive than delayed derived views.

Different systems choose different boundaries.
The habit is the same:
name what must be true now, what can be true later, and what weakens first under stress.

## Production Lab: Runtime Scars

By Chapter 04, you can read the same production stories as timelines. The useful question becomes: what happened before response, what moved later, what fed overload, and what signal or rollback path mattered?

### Cloudflare: Rollout Safety Is Part Of Runtime Design

Cloudflare's July 2019 outage involved a globally deployed WAF rule that caused severe CPU exhaustion. Chapter 01 used it only as a pressure story. Now the Chapter 04 reading is different: fast global rollout is powerful, but it needs staged rollout, rollback controls, and a way to reach those controls even when the normal internal tools are impaired.

Staged rollout means the change touches a small, watched slice before it touches the whole world. A separate rollback path means responders are not trapped if the broken feature also hurts the usual control panel or login path.

Decision simulation:

A rules change can execute on every request globally. What should the runtime design make visible before full rollout?

Interview-ready answer:

> "The rollout path itself is part of the system. I would try the change on a small slice first, watch resource saturation and error signals, and keep rollback controls reachable even if the normal internal path is unhealthy."

Source: [Cloudflare, "Details of the Cloudflare outage on July 2, 2019"](https://blog.cloudflare.com/details-of-the-cloudflare-outage-on-july-2-2019/)

### GitHub: Recovery Creates Its Own Backlog

GitHub's October 2018 incident did not end when the primary topology became healthy again. There were delayed replicas and queued downstream work to process. Chapter 04's lesson is that recovery has a timeline too.

Decision simulation:

The source of truth is safe again, but webhooks, builds, and read replicas are still behind. What should the answer say?

Interview-ready answer:

> "Recovery is not complete when the primary path is back. I need to track backlog age, replay rate, stale reads, and downstream catch-up so the system does not silently stay inconsistent from the user's point of view."

Source: [GitHub, "October 21 post-incident analysis"](https://github.blog/news-insights/company-news/oct21-post-incident-analysis/)

### Google SRE: Cascades Are Feedback Loops

Google's SRE chapter on cascading failures gives the operational version of this chapter's queue and retry warning. A slow or overloaded path can cause more concurrent work, requests that run too long, retries, and load shifting, which then makes the original overload worse.

Decision simulation:

If clients retry aggressively when a backend is already saturated, what should the system do?

Interview-ready answer:

> "I would treat retries as load, not as free repair. The design needs backoff, request time limits, deliberate refusal or slowdown of excess work, and clear overload signals so retry traffic does not become the failure amplifier."

Source: [Google SRE Book, "Addressing Cascading Failures"](https://sre.google/sre-book/addressing-cascading-failures/)

### Netflix Open Connect: Cache Placement Is Product Experience

Netflix Open Connect describes serving content through ISP partnerships, embedded appliances, peering, and delivery paths that can move around unhealthy routes. At this chapter's depth, the lesson is that caching is not just "add a CDN." Placement changes bandwidth cost, origin pressure, failure behavior, and playback experience.

Decision simulation:

If millions of viewers repeatedly request the same popular content, where should repeated work be absorbed?

Interview-ready answer:

> "The repeated playback work should move close to viewers through edge delivery, while the design still needs origin fallback and health signals because cache placement changes both latency and failure behavior."

Source: [Netflix Open Connect](https://openconnect.netflix.com/en/)

## Difficulty Ladder: Timeline Reads

The same runtime habit should survive easy, medium, and hard situations.

### Easy: Profile Photo Upload

A user uploads a new profile photo.
The system should not say success until the original image is durably accepted and linked to the user's profile state.
Cropping variants, thumbnails, and CDN warming can happen after that.

A weak answer says:

> "Put image processing on a queue."

A better answer says:

> "Return success after durable accept and profile-state update. Generate thumbnails and warm caches after the response, while tracking how long those derived views lag."

That answer is better because the queue is attached to a promise boundary.

### Medium: Product Search Refresh

A seller updates the price of an item.
The item page should show the new price quickly.
Search results may show the old price briefly, but not forever.

A weak answer says:

> "Cache the product page and update search async."

A better answer says:

> "The source product record should update before success. Search can lag behind that source truth, but the design needs a freshness budget and a signal for indexing lag because stale prices become user-visible trust pain."

That answer is better because it separates source truth from derived search truth.

### Hard: Payment, Webhook, And Retry

A payment succeeds.
The merchant webhook fails three times.
The customer refreshes the checkout page.
The merchant dashboard still needs to converge on the successful payment without charging again.

A weak answer says:

> "Retry the webhook and use monitoring."

A better answer says:

> "The money truth stays on the hot path with idempotency around the payment request. Webhook delivery is deferred and retryable, but the retry loop needs a stable event identity, backoff, failure visibility, and a clear merchant-facing state while delivery is delayed."

That answer is better because it says which promise is already true, which promise is still pending, and how repeated attempts stay safe.

## Phrase Drill: Runtime Language

Practice replacing component-first phrases with timeline-first phrases.

| Rough answer | Interview-ready version |
|---|---|
| "Use a queue for transcode." | "Durable upload acceptance stays on the hot path; transcode moves behind the response, with backlog age and retry failures tracked." |
| "Add Redis." | "Cache repeated watch-path reads where bounded staleness is acceptable and expiry or invalidation is explicit." |
| "Retry failures." | "Retry only replay-safe work, using stable identities so repeated attempts do not create duplicate business effects." |
| "Degrade gracefully." | "Let lower-value derived views lag before the core promise fails, and name what users will see in that weakened mode." |
| "Add monitoring." | "Measure the promises directly: hot-path latency, backlog age, retry counts, cache hit rate, and freshness lag." |

The test is simple:
if your sentence names a component but not the promise, lag, or failure it manages, it is still too shallow.

## Repair The Shopping List

If your answer starts like this, it sounds busy but not designed:

> "I would use queues, retries, Redis, and monitoring."

Repair it by putting each runtime tool on a timeline:

> "First I want to define what success means on the hot path. For a YouTube upload, durable acceptance of the original file and core metadata must happen before the response. Heavy derived work like transcoding, indexing, notifications, and cache warming should move behind queues. That means I now owe designs for lag, retries, and backpressure. On the read path, I can cache repeated video and metadata reads, but only where bounded staleness and clear expiry are acceptable. Under stress, I would degrade recommendation freshness and long-tail renditions before I let upload acceptance or first-playable availability fail."

That answer is better for a simple reason:
it treats time, failure, and runtime visibility as part of the architecture, not as cleanup work after the boxes are drawn.

## Mini Drill: Read YouTube As A Timeline

Run the system as a sequence of promises.
At each step, ask what has to be true before the next step is allowed:

- what exact facts must be true before "upload succeeded" can be returned?
- which expensive steps become deferred work immediately after that?
- where does a queue help, and what lag would make the product feel broken?
- what is safe to cache, and what freshness budget makes that safe?
- which retries are safe, and which ones would duplicate business effects?
- if the system is overloaded, what degrades first?
- what signals tell you the backlog is growing before users start complaining?

Expected direction:

The hot path should end only after the original blob and core metadata are durably accepted, while transcoding, search updates, notifications, analytics, and cache warming move behind workers. Queues help absorb spikes, but backlog age and retry behavior must stay visible. Popular watch-path data can be cached if staleness is bounded and expiry or invalidation is clear. Retry safety depends on idempotent job or chunk identities. Under stress, recommendation freshness and expensive renditions should weaken before upload acceptance or first-playable availability. Operability should measure latency, lag, retries, and cache behavior directly.

If your answer still sounds like a shopping list of "Kafka, Redis, and dashboards," rerun the sequence and attach every tool to a promise, lag, or failure signal.

## Before You Move To Lesson 05

Leave this chapter only when you can replace:

> "Put heavy work on a queue and add a cache."

with a timeline that states:

- what the response is actually promising
- which work becomes deferred right after that promise is made
- how lag is buffered and controlled
- where staleness is acceptable and where it is not
- how retries stay safe
- how the system degrades under stress
- how you would notice the design falling behind in production

Lesson `05` takes the pieces you now have, and turns them into one repeatable interview flow.
