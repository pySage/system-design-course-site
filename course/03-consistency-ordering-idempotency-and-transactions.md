# 03 - Consistency, Ordering, Idempotency, and Transactions

Imagine there is one last room left for a popular weekend on Airbnb.

Two users try to book the same dates within seconds.
One of them sees a timeout and retries.

Do not name a database feature yet.
Just look at what would be unacceptable to the product:

- both users are told they got the room
- one user is charged twice because they retried
- the host calendar says one thing while the guest confirmation says another
- search still showing the room for a few minutes is annoying, but it is not the same kind of failure as selling the room twice

That is the doorway into this chapter.
Before the course uses words like `correctness`, `consistency`, `idempotency`, or `transaction`, give them this plain meaning:

- `correctness` means the product does the thing that must be true, even when requests overlap, retry, or fail halfway
- `consistency` asks what a reader is allowed to believe after data changes
- `ordering` asks where sequence changes the meaning of the result
- `idempotency` asks whether repeating the same logical request repeats the business effect
- `transaction` asks which state changes must succeed or fail together

You do not learn those words by memorizing definitions first.
You learn them by pointing to the exact product damage they prevent.

This chapter trains the next move:
name the smallest product truth that must be protected before you name the mechanism.

## Start With One Room That Must Not Be Sold Twice

A shallow answer sounds like this:

> "Make everything strongly consistent and exactly once."

An honest reading is already more precise:

1. The listing calendar for those dates cannot end up double-booked.
2. Search results can be slightly stale for a while without breaking the product.
3. A retry after timeout must not create two bookings or two charges.
4. The core booking state changes that define success must move together or fail together.
5. Global ordering of all bookings on the platform is unnecessary. The real conflict is local to one scarce resource and date range.

Chapter 02 taught you not to put every kind of data in one mental bucket.
This chapter does the same thing for correctness:
do not put every path under the strongest guarantee just because one path can hurt the product.
Ask where wrongness is unacceptable, then choose the narrowest guarantee that protects that truth.

Here is the same story as a small map:

```text
two booking attempts
        |
        v
same listing + same date range
        |
        v
scarce state can be sold only once
        |
        v
fresh truth and conflict control belong here

search results, recommendations, emails, analytics
        |
        v
can be late without selling the room twice
```

The map matters because it keeps one phrase from taking over the whole answer.
`Strong consistency` is not the hero of the story.
The scarce booking state is.

## What A Guarantee Is Actually Protecting

In plain language, a guarantee is a promise the system makes when load, retries, races, or failure show up.

For this chapter, the main questions are:

- after a write, what can readers safely assume?
- where does sequence actually change meaning?
- what happens if the same request is retried?
- which related state changes must succeed or fail together?

If you cannot point to the product risk, the guarantee is probably still too vague.

Use this translation habit whenever a guarantee word appears:

| If you are about to say... | First say what it protects |
|---|---|
| `strong consistency` | which read must see fresh truth |
| `ordering` | which sequence changes the meaning of the result |
| `idempotency` | which repeated request must not repeat the business effect |
| `transaction` | which state changes must move together |
| `reliable side effect after commit` | which committed fact must not be lost before other systems hear about it |

This is not extra vocabulary.
It is how you stop guarantee language from floating away from the product.

## Consistency Means Fresh Truth Where Wrongness Hurts

Consistency is about what a reader is allowed to assume after writes happen.

### Strong Consistency Is For Fresh Truth That Cannot Be Stale

Strong consistency is useful when stale reads would violate product correctness.

In the Airbnb story:

- the booking calendar for the last room cannot be stale at commit time
- the availability decision for that scarce listing must reflect fresh truth

That is a narrow and concrete use of strong consistency.

What it buys you:

- correct decisions on correctness-critical state
- fewer dangerous races at the read/write boundary

What it costs:

- more coordination
- more latency
- more pain as distribution gets wider

### Eventual Consistency Is Fine Where Lag Is Acceptable

Not every read has the same consequence.

In the same product:

- the search index can lag
- recommendation views can lag
- analytics dashboards can lag

Those paths can often tolerate eventual consistency because temporary staleness is annoying, not correctness-destroying.

This is the key discipline:

Do not say "strong consistency" unless you can finish the sentence:

This exact state must be fresh because otherwise this exact product failure happens.

### Scope Changes The Cost

The word `strong` is not precise enough by itself.
Strong over what?
One row?
One booking workflow?
The whole world?

Imagine two guests try to book the same listing for the same nights.
The product failure you are trying to prevent is simple:
both guests should not walk away believing they own the same room.

That failure lives in a small place first.
It lives around the scarce inventory fact:

> listing `L` is either available or reserved for nights `D1-D3`.

If that fact is wrong, the product is broken.
So the first answer is not "make Airbnb strongly consistent globally."
The first answer is:

> "The strong boundary is the listing-date reservation decision. For one listing and one date range, only one booking should win."

Now widen the scope one step.
After the reservation decision, a few related facts must not contradict it:

- the host calendar should not still show those nights as open
- the booking record should not say confirmed while payment says failed without a repair path
- the guest confirmation should not be sent for a booking that did not actually reserve the room

That is still not global truth.
It is one booking workflow.
It may require a local transaction, idempotent payment attempt, outbox event, or compensation path, but the reason is still explainable:
all facts around this one booking should tell the same story.

The expensive version is much wider:
every search result, every region, every cache, and every user everywhere sees the newest booking state immediately.
That would reduce stale search results, but it forces far more coordination into read paths that usually do not need it.
A common design is cheaper and more honest:
search may lag, but the final booking commit checks the scarce listing-date truth before accepting the reservation.

Use this ladder:

| Scope | What it means in the booking story | What it protects | Cost shape |
|---|---|---|---|
| local scarce state | one listing and one date range decides the winner | the room is sold only once | narrowest correctness boundary; easiest to defend |
| bounded booking workflow | reservation, host calendar, payment attempt, and confirmation agree around one booking | the user does not see contradictory booking facts | more coordination, but still tied to one business action |
| global fresh truth | every region, search result, cache, and user reads the latest booking immediately | nobody anywhere sees stale availability | highest latency and coordination cost; rarely the first requirement |

Most strong interview answers do not jump to the third row.
They start with the smallest state that can create a real correctness failure, then expand only when the product forces it.

An interview-ready sentence:

> "I need strong consistency for the scarce listing-date reservation decision, not global fresh truth for every Airbnb read. Search can be slightly stale as long as the final booking commit checks the authoritative availability and rejects the loser safely."

## Ordering Means Sequence Only Where Sequence Changes Meaning

Ordering is one of the most over-requested guarantees in system design.

The useful question is not "Do I need ordering?"
The useful question is "Where does sequence actually matter?"

### Most Systems Need Local Ordering, Not Global Ordering

Examples:

- chat usually needs ordering per conversation
- a ledger usually needs ordering per account or transaction stream
- collaborative editing usually needs causality or one server-authoritative sequence

Global ordering across the whole product is expensive and rarely necessary.

Use this ladder before you ask for ordering:

| Ordering level | When it is enough | Example |
|---|---|---|
| no meaningful order | sequence does not change the product outcome | independent analytics events that are aggregated later |
| per-key order | one local stream needs a stable sequence | messages inside one conversation |
| causal order | later actions depend on earlier actions being seen first | edits or replies that build on previous state |
| total order | everyone must agree on one sequence | rare, expensive coordination around one shared log |

Booking usually does not need a platform-wide total order.
It needs conflict control for the scarce listing-date state.
That is a narrower problem than ordering every booking in the world.

### In Booking, Conflict Matters More Than Platform-Wide Sequence

In the Airbnb story, the product usually does not need one total order for every booking in the world.

It needs something much narrower:

- one scarce room should not be sold twice
- one local conflict should resolve correctly

That is why strong answers scope ordering to the smallest place where sequence changes the outcome.

## Idempotency Means Retries Stop Being Dangerous

Retries are normal.
Timeouts happen.
Clients resend.
Workers redeliver.

Idempotency is the promise that processing the same logical request twice produces the same final effect as processing it once.

### The Booking Retry Makes This Obvious

In the Airbnb story, if the first booking attempt times out and the client retries, the platform must not create a second booking or a second charge for the same logical request.

That is idempotency.

It is one of the most practical guarantees in the whole course because it turns unreliable delivery and retry behavior into something safe enough to build on.

### Exactly-Once Outcome Usually Comes From Simpler Pieces

Weak answers say:

> "Make the transport exactly once."

Stronger answers usually mean something more practical:

- at-least-once delivery or retry behavior
- a stable request ID or idempotency key
- deduplication at the handler or business boundary
- state transitions that are safe to replay

That is how most real systems achieve exactly-once business outcomes without magical infrastructure.

### Identity Has Boundaries Too

Idempotency becomes clearer when you ask which repeated thing should collapse into one effect.

| Repeated thing | Stable identity | Safe outcome |
|---|---|---|
| client request | request ID or idempotency key | one booking attempt or one payment attempt |
| worker job | job ID | one transcode result, one email task, or one webhook attempt state |
| downstream event | event ID | one consumed business event even if delivery repeats |
| business effect | domain key such as booking ID or charge ID | one visible outcome even if infrastructure retries |

This distinction prevents a common mistake:
the transport may deliver twice, but the business effect should still happen once.

## Transactions Mean A Narrow Atomic Boundary

Transactions answer a different question:

Which related state changes must succeed or fail together?

### The Boundary Should Be Smaller Than Your Fear

In the Airbnb story, you do not need one giant transaction that includes search refresh, email, analytics, and every other side effect.

You need a much narrower atomic boundary around the core booking state that determines whether the room is reserved.

This is the main instinct:

make the transaction boundary big enough to protect correctness and small enough to remain practical.

### Local Transactions Are The Cleanest Case

When the related writes live inside one database boundary, a local transaction is often the clearest answer.

That is the happy path of this chapter.

### Across Systems, You Usually Need A Different Shape

If the guarantee crosses several systems, you usually end up in the world of:

- local atomic state changes
- idempotent retries
- compensating steps when later work fails

The point is not to memorize one distributed pattern name.
The point is to stop promising impossible atomicity everywhere.

In the Airbnb story, a practical sequence might look like this:

1. reserve the scarce listing-date state inside the narrow booking boundary
2. record the payment attempt with a stable identity so retries are safe
3. publish confirmation, email, search refresh, and analytics after the core state is safe
4. if a later external step fails, run an explicit repair or compensation path instead of pretending the original transaction covered every system

The spoken answer should be plain:

> "I want local atomicity around the booking truth, retry-safe payment and confirmation identities, and safe downstream propagation. I do not want one giant transaction across search, email, analytics, and external payment systems."

## Conflict Control Means Choosing How Races Are Resolved

When two actors want the same scarce thing, you need a conflict strategy.

### Optimistic Control Assumes Collisions Are Rare

Optimistic control works well when:

- conflicts are uncommon
- you can detect them on update
- retrying the loser is acceptable

This is often good for high-throughput systems where most operations do not collide.

### Pessimistic Control Pays Early To Avoid Bad Conflict

Pessimistic control works better when:

- the conflict is expensive
- the resource is scarce
- selling the same thing twice is unacceptable

That is why scarce booking examples often push you toward stricter conflict control than a social product would need.

You pay in latency and throughput, but you buy safety under contention.

## One Classic Failure Worth Knowing

Here is a failure that shows up constantly:

1. the core database transaction commits
2. the process crashes before the downstream event is published

Now the source of truth changed, but dependent systems never hear about it.

The outbox pattern exists because this failure is so common.

Write the domain update and a pending event record in one local transaction.
Publish that event later from the outbox safely.

You do not need to turn this into an async chapter yet.
You only need to recognize it as a guarantee boundary problem:
the system must not lose the fact that a committed change still needs to be propagated.

## Two More Quick Guarantee Reads

Once the booking story is clear, the same guarantee-reading habit transfers quickly.

### WhatsApp

The message path usually needs ordering per conversation, not globally.
Delivery can be at-least-once as long as deduplication makes the user-visible effect safe.
Search over old messages can tolerate more lag than the send path.

### Stripe

A payment system needs idempotency on every client retry path.
Ledger truth must be much stricter than a derived dashboard.
The cost of a wrong answer is so high that the correctness boundary must be named explicitly.

## Production Lab: Correctness Before Convenience

Now the real stories can reveal correctness choices. The question is no longer only "where does data live?" It is "what truth must remain safe when retries, races, and failure appear?"

### Stripe: A Retry Needs The Same Business Identity

Stripe's idempotency documentation explains that clients can provide an idempotency key so a retried request does not accidentally perform the same operation twice. At this chapter's depth, the key lesson is not the exact API header. It is the guarantee boundary:

> "A repeated client request should map to the same logical business attempt."

Decision simulation:

A checkout request times out after the payment may already have started. The phone sends the request again. What must the server know?

Interview-ready answer:

> "The retry needs a stable idempotency key so the server can recognize the same logical payment attempt and avoid creating a duplicate business effect."

Source: [Stripe API docs, "Idempotent requests"](https://docs.stripe.com/api/idempotent_requests)

### GitHub: Data Integrity Can Beat Fast Recovery

GitHub's October 2018 incident analysis describes a database topology failure where the recovery path had to protect data integrity even though the site remained degraded for a long time. At this chapter's depth, do not focus on every operational detail. Notice the correctness decision:

> "When the choice was fast usability versus preserving the correctness of user data, the safer answer was to protect data integrity first."

Decision simulation:

Two data centers have writes that are not safely reconciled yet. Users want the service back quickly. What does the guarantee layer force you to say?

Interview-ready answer:

> "I would first protect the data-integrity boundary. Availability matters, but failing back too quickly while writes disagree can turn a service incident into a correctness incident."

Source: [GitHub, "October 21 post-incident analysis"](https://github.blog/news-insights/company-news/oct21-post-incident-analysis/)

### Google Spanner: Stronger Guarantees Are A Paid Choice

Google's Spanner paper is an advanced source, so this chapter should use it carefully. The beginner-safe lesson is not to memorize Spanner or to treat "strong everywhere" as the default advanced answer. The lesson is narrower: some systems deliberately pay coordination and operational complexity to provide stronger distributed consistency for state that deserves that cost.

Decision simulation:

A globally distributed product wants users in different regions to read and write shared state while still preserving a clear correctness story. What should your guarantee language avoid?

Interview-ready answer:

> "I should avoid saying 'strong consistency everywhere' as a slogan. If the product needs globally fresh shared truth, I need to say which state deserves that cost and what latency, coordination, and operational complexity I am accepting."

Source: [Google Research, "Spanner: Google's Globally Distributed Database"](https://research.google/pubs/spanner-googles-globally-distributed-database/)

## Difficulty Ladder: Guarantee Reads

The same chapter habit should work at several levels of messiness.

### Easy: One Seat Left

A ticketing system has one seat left for a concert.
Two buyers click purchase at almost the same time.

A weak answer says:

> "Use a transaction."

A better answer says:

> "The narrow correctness boundary is the seat inventory for that event and seat. It needs fresh truth and conflict control so the same scarce seat is not sold twice."

Why this is better:

- it names the state that must stay correct
- it says what product failure the guarantee prevents
- it does not accidentally make search, email, or analytics part of the atomic boundary

### Medium: Chat Message Retry

A user sends a chat message.
The phone times out before it receives the response, so it sends the same logical message again.

A weak answer says:

> "The network should be exactly once."

A better answer says:

> "The send path should be retry-safe. A stable client message ID lets the server accept the logical message once and return the same result when the phone retries."

Why this is better:

- it does not ask the transport for magic
- it explains the duplicate user-visible effect
- it keeps ordering local to the conversation instead of global to the whole platform

### Hard: Payment Plus Webhook

A payment succeeds in the core ledger.
Right after the commit, the process crashes before the merchant webhook is sent.
When the system restarts, the merchant still needs to hear about the successful payment exactly once from a business point of view.

An incomplete answer says:

> "Kafka will make the event reliable."

A better answer says:

> "The core payment commit and the pending event record should be written together, then a worker can publish that pending event safely. That protects the committed business fact from being lost between the database and the downstream notification."

Why this is better:

- it names the gap between committed truth and downstream side effects
- it keeps the atomic boundary local and practical
- it explains why the outbox exists before naming it as a pattern

## Phrase Drill: Make Guarantee Language Natural

The goal is not to memorize a sentence.
The goal is to make the right words come out with the right scope.

Practice these rewrites:

| Rough answer | Interview-ready version |
|---|---|
| "Use strong consistency for Airbnb." | "Use fresh, conflict-safe truth on the scarce listing-date state; search and recommendation views can lag." |
| "Make payments exactly once." | "Use idempotency at the business boundary so a retried payment request does not create a duplicate charge." |
| "Ordering matters." | "Ordering matters inside the account, conversation, or document where sequence changes the outcome; global order is unnecessary unless the product proves otherwise." |
| "Put it all in a transaction." | "Keep the transaction boundary around the state changes that define success, then handle downstream effects safely after commit." |

Now say one of those in your own words.
If your version still sounds like a pattern name without a product failure, repair it before moving on.

## Interruption Drill: Narrow The Guarantee

Imagine the interviewer interrupts your opening and asks:

> "You said strong consistency. Strong for what exact state?"

Your repaired answer should land on product risk before guarantee words:

> "Before naming guarantees everywhere, I want to identify the narrow correctness boundary. For booking, the scarce calendar state must stay fresh and conflict-safe, but search can lag. Retries need idempotency so a timeout does not create duplicate business effects. And the atomic boundary should cover only the state changes that define whether the booking succeeded."

That answer earns the guarantee because:

- it named the exact state that must stay correct
- it separated fresh-truth paths from lag-tolerant paths
- it explained retries and atomicity in product terms

If your sentence starts with "use strong consistency" and cannot answer "for what state?", it is still too broad.

## Mini Drill: Read Airbnb Without Saying "Strong Everywhere"

Do this as a boundary-marking drill.
For each question, point to the smallest product state that needs protection:

- what exact state must be strongly consistent?
- what read paths can tolerate some staleness?
- where does retry create danger unless idempotency exists?
- what ordering or conflict scope actually matters?
- what is the narrow transaction boundary?
- what failure would the outbox pattern prevent?

Expected direction:

The scarce booking calendar needs fresh truth, search and recommendation views can lag, booking and payment retries need idempotent handling, the real ordering/conflict scope is local to the listing and date range rather than global, the core transaction boundary should protect the booking-success state, and the outbox prevents committed state from being lost to downstream systems when publication fails after commit.

If the answer spreads to the whole product, pull it back to the smallest state where wrongness changes the outcome.

## Before You Move To Lesson 04

Your checkpoint is not whether you can list guarantee words.
It is whether you can replace:

> "This system needs strong consistency and exactly once."

with:

- what exact state must stay fresh
- where local ordering matters and where it does not
- how retries become safe
- which state changes must be atomic together
- what failure patterns still need a design answer after commit

Lesson `04` asks the next natural question:
which of these guarantees belong on the hot path, and which work can move out of it?
