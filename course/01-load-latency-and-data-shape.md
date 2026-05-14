# 01 - Load, Latency, and Data Shape

If Chapter 00 gave you the lens, this is the first chapter where you use it on a moving system instead of on course philosophy.

The story begins with a mistake almost everyone makes the first time they answer a system-design question. They hear the product name, they feel some vague sense of scale, and then they jump straight to tools:

> "We probably need a scalable database, a queue, and a cache."

That answer feels like progress because it sounds technical. But it is weak for a simple reason: the system has not been read yet.

This chapter slows that moment down. It teaches one habit that the rest of the course will keep using:

before you name architecture, read what is making the system hard.

## Start With One Honest Read

Imagine you are on-call during an incident. Someone posts a message into a huge company-wide Slack channel. People are already watching that channel because production is on fire.

The shallow reading is:

> "That is one message write in a chat system."

The honest reading is already richer:

1. The visible user action is one send, but the backend work is larger than one write.
2. The sender is sensitive to latency. If the send spinner hangs, the product already feels broken.
3. A giant channel can create skew. One hot conversation can stress one partition, one queue, or one downstream path far ahead of the fleet average.
4. Delivery and notifications can create fanout after the first durable accept.
5. The core data shape looks like append-heavy message history.
6. The core query shape is not just "read by ID." It includes recent channel history now, and search over old messages later.

That is Chapter 01 in miniature.

No database has been named yet.
No topology has been chosen yet.
No storage family has been selected yet.

But the problem already looks sharper.

That is the point of this whole chapter.

## One User Action, Many Hidden Pressures

The first thing Chapter 01 is trying to install in your mind is this:

one user action is almost never one unit of system difficulty.

The user sees:

```text
tap send
```

The system may see:

```text
accept write
-> order it in a conversation
-> fan out delivery work
-> update unread state
-> trigger push notifications
-> refresh live readers
-> update future search/index paths
```

That is why this chapter talks about pressure, not just traffic.

Pressure means the force that is making the system difficult right now. Sometimes that force is raw arrival rate. Sometimes it is one hot entity. Sometimes it is one action exploding into many downstream actions. Sometimes it is the fact that the slowest normal requests hurt the product before the average metrics look scary.

The rest of this chapter simply teaches you to notice the main kinds of pressure hiding inside that one action.

## Load And Burst Pressure

In plain language, load means how much work arrives and how unevenly it hits the system.

That sounds obvious until you notice how often people reduce it to one average request number and stop there.

### One Number Can Lie

Imagine two systems:

- System A does `50k QPS` of steady point reads against evenly spread keys.
- System B does `1k QPS` on average, but one action can trigger many downstream operations, traffic arrives in bursts, and a few hot entities dominate the hardest moments.

Which one is harder?

The point is not that one answer is always correct. The point is that average `QPS` alone cannot tell you.

If you only carry request count in your head, System B can look small. If you also carry burstiness, hidden work, fanout, and skew, System B starts to look dangerous very quickly.

That is why this chapter comes before storage. Before you can ask where data should live, you need an honest reading of what the system is being asked to endure.

### Average Is Only The Calmest Number

Average traffic matters, but it is one of the least trustworthy numbers when used alone.

You also need to ask:

- what is the peak?
- how sharp are the spikes?
- do reads and writes spike together?
- does traffic arrive smoothly, or in shocks?

Real systems often fail in short ugly windows: a ticket drop, a viral post, a flash sale, a market open, an outage-driven query surge.

When an answer stops at "the system does 10k QPS," it usually sounds unfinished because the real question is still missing:

What kind of load is that number hiding?

When this chapter says load shape, it means the character of the work, not only the amount. Ask:

- did it arrive gradually or all at once?
- did one visible action multiply into many internal actions?
- did the work spread evenly or concentrate on one hot thing?
- did the painful user action need an immediate answer?

That is why "traffic went up" is usually too vague. A better first read says what changed about the traffic.

### Easy Example: Ticket Drop

A concert ticket system can look simple if you say, "many users are hitting buy at once."

The stronger read is:

- traffic arrives in one violent burst, not as a smooth average
- many users want the same tiny set of seats
- correctness and latency both matter because delay changes the outcome

Even before architecture, that already sounds much more like the real problem.

The move to notice here is simple: load is not just quantity. It is also shape.

## Fanout Pressure

Fanout means one accepted action expands into many downstream actions.

This is one of the most useful interview words in the whole chapter because it helps you stop describing only the button click.

### One Send Can Become Many Jobs

In a large messaging system, one sent message can create:

- one durable write
- many recipient deliveries
- unread counter updates
- push notifications
- analytics events
- search or indexing updates

So when you say, "this is one write," you are usually describing only the front edge of the work, not the real workload.

### Why Fanout Matters Early

Fanout matters early because it changes the pressure read before any component choice appears.

If one user action multiplies into thousands of downstream actions, then:

- average request count understates the real work
- tail latency can blow up even when the visible input rate looks modest
- retries can multiply the work further
- one hot conversation can punish the system much earlier than the fleet average suggests

That is why messaging, feeds, notifications, and collaboration systems are often harder than their headline traffic suggests.

### Medium Example: Breaking-News Feed

A social feed sees one celebrity post.

A weak answer says:

> "The system has high traffic."

A stronger answer says:

> "The dominant pressure is fanout amplification. One write now explodes into many deliveries and refreshes, so the downstream work grows much faster than the visible write rate."

Notice how that second version already sounds more interview-ready. It is not more complicated. It is just more honest.

## Skew And Hotspots

The second big way averages lie is distribution.

Even if total capacity looks healthy, a few keys, groups, regions, or time windows can become much hotter than the rest.

### Hot Things Break First

One celebrity account.
One giant group chat.
One trending search term.
One city center in rush hour.
One dashboard query during an incident.

This is skew.

The important intuition is that systems often fail locally before they fail globally.

You can have enough total machines, enough total storage, and enough total network capacity and still have a bad incident because one partition, one group, one shard, or one dependency is overloaded far ahead of the average.

### Viral Moments Do Not Arrive Fairly

Real traffic is not polite.

It clusters.
It surges.
It fixates on the same hot thing.

That is why "well distributed on paper" is not the same as "safe under real use."

Strong answers name skew explicitly because it shows you are thinking about how the system breaks, not only how it looks when everything is evenly spread.

### Diagram: Healthy Average, Unhealthy Hotspot

```text
fleet average:      looks calm
hot key / hot room: already melting

global graph:       acceptable
local graph:        overloaded
```

That simple picture is enough for the Chapter 01 lesson:

do not let the fleet average hide the first thing that breaks.

## Tail-Latency Pressure

Load tells you how much work is arriving.
Latency tells you how that waiting is felt.

The easiest mistake here is to treat latency as one average comfort number.

### Tail Latency Is Where Production Pain Lives

Average latency is useful, but users and on-call engineers often suffer at the tail.

`p95` and `p99` are asking:

How bad are the slow requests that still happen often enough to matter?

That is where overloaded dependencies, long queues, retries, and cross-service amplification usually show up first.

A system can have:

- acceptable average latency
- healthy-looking dashboards
- a bad real user experience

all at the same time.

Users do not remember your average. They remember when the product felt broken.

### Latency Sensitivity Depends On The User Moment

Not every slow path hurts equally.

In the Slack example:

- sending a message is latency-sensitive
- opening recent channel history is also latency-sensitive
- full-history search can often tolerate more work than live send
- exports and offline analysis can usually tolerate much more delay

That distinction matters because later chapters will ask what belongs on the hot path and what can happen later.

For now, the key idea is simpler:

when you say "latency matters," the next sentence should be "Which action is sensitive, and how sensitive is it?"

## Retry Amplification

Retry amplification belongs in this chapter in a light but important way.

You do not need a full async architecture lesson yet. You only need the intuition that retries are not free.

When a path is already under stress, retries can multiply the same work that was already struggling.

That means:

- more requests land on the same user-visible path
- internal backlog can grow faster
- tail latency stretches further
- symptoms can look like "delay" while the real problem is repeated work

This is especially important in systems with:

- users who are not connected right now
- flaky mobile networks
- confirmations from other systems or devices
- apps or users trying again because the first attempt still has not clearly finished

A plain example is enough here:

The first send attempt is still in flight, but it feels slow. Before that first attempt clearly finishes, either the user taps send again or the app retries on its own. Now the system may have to carry the original attempt and the repeated attempt at the same time.

In this chapter, do not jump yet to duplicate-message correctness. That is a later lesson. The Chapter 01 point is narrower: slowness can create overlapping work, and overlapping work adds pressure to the same path that was already slow.

### Pressure Before Mechanism

When a system hurts, you may notice the internal symptom first:

> "A queue is filling up."

That can be true, but it is not always the best first sentence.

Use this order:

1. What changed in the workload?
2. What multiplier or concentration made it worse?
3. What user-visible pain appeared?
4. Which internal mechanism might be showing the symptom?

For the first line of an interview answer, usually stop at the first three. The mechanism matters later, but the pressure read should come first.

So if your instinct is "the queue is full," repair it into:

> "The pressure is bursty write fanout on one latency-sensitive path; the growing queue is the symptom."

### Hard Example: Large Group Messaging

A WhatsApp-like group suddenly becomes extremely active during a release. Hundreds of people are typing and reading at once. A new message is supposed to feel instant, but active members now see the latest messages arriving several seconds late.

A weak opening answer would be:

> "Some internal backlog is growing."

That might become true, but it is still something an engineer might discover later inside the system. It does not name what changed in the workload itself. It is like walking into a traffic jam and saying, "the road is crowded," without first noticing that one small bridge is forcing thousands of cars through a narrow point. The jam is visible. The pressure that created it came earlier.

A stronger opening answer would be:

> "The dominant pressure is bursty write fanout on a latency-sensitive path, so the newest messages can feel delayed even while fleet-wide averages still look normal."

Why is that better?

- Start with what actually changed. One user action is no longer "one message." In a large active group, one send now creates delivery work for many recipients at once.
- Add the user moment. Seeing the newest group messages is latency-sensitive, so even a few seconds of delay is felt as breakage.
- Now the visible pain makes sense. If each new message creates work for many active readers at once, the slow edge stretches first. People see the latest messages arrive late even if the whole fleet does not look overloaded yet.
- Only after that should you talk about which worker pool, backlog, or storage path is struggling. Those are internal mechanisms and later consequences. The first job in this chapter is to name the pressure honestly.

So the difference is:

- "Some internal backlog is growing" starts with what you might later observe inside the system.
- "Bursty write fanout on a latency-sensitive path" starts with the workload change that is creating the pain.

That is exactly the habit this chapter wants.

## Production Echoes: Read Only The Pressure

These are not full case studies yet. At this point in the course, you are allowed to notice only the Chapter 01 layer: pressure, skew, fanout, latency, and access shape. The deeper storage, consistency, and operations details will appear later.

### Discord: One Place Gets Hot Before The Whole Fleet Looks Hot

Discord's engineering writeup on storing trillions of messages describes how some channels and time windows could receive far more traffic than ordinary ones. For Chapter 01, do not worry yet about the specific database machinery. Read only this much: one local slice of message history can get much hotter than the rest, and that local heat can create latency pain even while fleet-wide average traffic still looks harmless.

Decision simulation:

You are on-call. A large community server has one announcement channel where everyone opens the app after a major update. What do you name first?

A weak answer says:

> "The database is slow."

A stronger Chapter 01 answer says:

> "The first pressure is skew on one hot message history path, so tail latency can appear locally before fleet-average traffic looks scary."

Source: [Discord Engineering, "How Discord Stores Trillions of Messages"](https://discord.com/blog/how-discord-stores-trillions-of-messages)

### Cloudflare: Request Count Was Not The Only Pressure

Cloudflare's July 2019 outage writeup describes a global WAF rule change that exhausted CPU on machines serving HTTP traffic. For Chapter 01, ignore rollout process and rollback mechanics. The pressure read is simpler: the limiting resource was CPU work per request, not merely request count.

Decision simulation:

Traffic volume has not changed enough to explain the pain, but every request now costs far more CPU than before. What should your opening name?

A stronger Chapter 01 answer says:

> "The dominant pressure is CPU saturation from heavier per-request work, so latency and errors can spike even if headline traffic is not the whole story."

Source: [Cloudflare, "Details of the Cloudflare outage on July 2, 2019"](https://blog.cloudflare.com/details-of-the-cloudflare-outage-on-july-2-2019/)

### Google SRE: Overload Feeds On Itself

Google's SRE chapter on cascading failures explains that overload can create positive feedback: slow work creates more in-flight work, retries add more load, and resource exhaustion spreads. For Chapter 01, the useful lesson is not the whole recovery playbook. It is this pressure sentence:

> "When a path is near the edge, retries and slower responses can multiply the same pressure that caused the slowdown."

Source: [Google SRE Book, "Addressing Cascading Failures"](https://sre.google/sre-book/addressing-cascading-failures/)

## Hidden Work Per User Action

By now, several ideas are starting to rhyme:

- load is not just average request count
- fanout can hide inside one action
- skew can make one local path fail first
- retries can multiply existing work
- tail latency is where the pain becomes visible

All of them point to the same deeper instinct:

one user action often creates much more backend work than it first appears to.

That is why weak sizing begins with sentences like:

> "A group message is one write."

The better question is:

What work does this action create besides the first obvious write?

Once you ask that question, you start hearing the system more honestly.

## Pressure-First Capacity Estimation

Capacity estimation is not a separate personality from the rest of this chapter.
It is the same hidden-work read with rough numbers attached.

A weak sizing answer starts with a memorized formula.
A stronger sizing answer starts with the visible user action and asks how much hidden work it creates.

Use this small loop:

1. Count the visible action rate in rough `QPS`.
2. Multiply by the hidden work: fanout, retries, indexing, notifications, or derived writes.
3. Apply a peak multiplier instead of trusting the average.
4. Estimate storage per day from event count times approximate record size.
5. Estimate bandwidth from payload size times deliveries or reads per second.
6. Ask whether one key, channel, user, region, or time window can become hot before the average looks scary.

The goal is not perfect arithmetic.
The goal is to make the pressure concrete enough that your next design choice has a scale reason.

### Slack-Style Worked Example

Suppose a Slack-like workspace has an incident channel where traffic spikes to about `30` message sends per second.
That sounds small if you stop at visible writes.

Now attach the hidden work:

- if `1,000` active members are watching the channel, live delivery can become roughly `30,000` delivery attempts per second
- if each message record is about `3 KB`, the visible write storage during the spike is only about `90 KB/s`, but the live delivery bandwidth is closer to `90 MB/s` before protocol overhead
- if the calm rate was `5` sends per second, the visible write peak is `6x`, but the delivery pressure can be much worse if the active-reader count also jumped
- if the partition key is `channel_id`, this is not evenly spread pressure; one channel can become the hot ownership slice

That estimate is intentionally rough.
It still teaches the important lesson:
the hard part is probably not raw message storage first.
It is fanout, live delivery, tail latency, and hot-channel skew.

If the interviewer asks for daily storage, keep the same spirit.
For example, `5 million` messages per day at about `3 KB` each is roughly `15 GB/day` of raw message records before replicas, indexes, attachments, compression, and retention policy.
With replicas and search/index overhead, the planning number may be several times higher.
That does not choose the database for you, but it tells you storage growth is a real axis while the spike path is dominated by delivery work.

### Small Sizing Exercise

Try this without drawing architecture:

A notification system accepts `200` events per second on average.
Each event fans out to `50` recipients.
The peak multiplier is `5x`.
Each notification payload is roughly `1 KB`.

Before naming components, answer:

- what is the visible event rate at peak?
- what is the hidden delivery attempt rate at peak?
- what is the rough outbound payload bandwidth at peak?
- what hot-key or skew risk could make the average lie?

Expected direction:
`200` events per second becomes `1,000` events per second at peak.
At `50` recipients each, that is roughly `50,000` delivery attempts per second.
At `1 KB` each, the payload alone is about `50 MB/s` before overhead.
If one tenant, topic, celebrity, or region owns a large fraction of those events, the first failure may be local even if the global average looks affordable.

## Data Shape And Query Shape Complete The Read

So far you have read how work hits the system.
Now you need to read what kind of data that work is acting on.

This is the bridge into Chapter 02, but it is still part of pressure reading.

### Data Shape: What Kind Of Thing Exists

Data shape asks:

What does the stored thing actually look like, and how does it live over time?

Examples:

- mutable records
- append-only history
- blobs
- time-series points
- documents
- graph-like relationships

This is about the form and lifecycle of the data itself.
Does it update in place?
Does it mostly grow by append?
Is history part of the product?
Are the payloads tiny or enormous?

In the Slack example, the core message path looks like append-heavy conversation history.

### Query Shape: What The Product Needs From That Data

Query shape asks:

How does the product need to read, filter, rank, or aggregate that data?

Examples:

- point lookup by ID
- recent range by time
- full-text search
- aggregation across many rows
- top-N ranking
- geo lookup

This is not the same as data shape.
The stored thing and the read pattern are related, but they are not interchangeable.

In the Slack example, recent history reads and message search are different query shapes even though they touch related data.

### The Pair Matters More Than Either One Alone

Two systems can both store documents and still need very different designs if one mainly does point lookup and the other does full-text search.

Two systems can both be append-heavy and still differ if one reads recent history by entity while the other aggregates across huge time windows.

That is the key lesson:

Data shape tells you what exists.
Query shape tells you what the product needs from it.

The next storage discussion is only credible when both are visible.

### Comparison Table

| Situation | Data shape | Query shape |
| --- | --- | --- |
| Slack message history | append-heavy conversation timeline | recent range reads, search later |
| Metrics platform | time-series points | time-window scans and aggregation |
| YouTube video metadata | structured document plus blob pointer | object fetch now, discovery/search later |

The point of the table is not storage selection yet.
The point is to train your eye to say two different true things about the same system.

## Practice The Same Move At Three Difficulty Levels

Now the chapter starts repeating the same habit under different amounts of mess.

### Easy: Ticket Drop

Scenario:

A ticketing site opens sales for one major concert. The first minute is a rush of buyers trying to reserve the same small set of seats.

Pressure read:

- bursty load
- intense hotspot/skew on the same inventory
- latency and correctness both matter

Interview-ready line:

> "The dominant pressure is bursty demand on the same tiny seat pool, so many buyers are competing to update the same scarce inventory and the slowest reservation attempts get painful first."

If you later hear the phrase localized write contention, this is all it means here: the write pressure is concentrated on one small hot place, not spread across the whole system.

### Medium: Slack Incident Channel

Scenario:

A previously quiet incident channel suddenly becomes the center of a company outage. Hundreds of people post, refresh history, and search old messages at the same time.

Pressure read:

- bursty writes
- one channel becoming much hotter than the rest
- recent-read latency pressure
- different query shape for live history versus search

Interview-ready line:

> "The most important thing to say first is that one channel has suddenly become much hotter than the rest, with both writes and recent reads surging, so I would name skew and tail-latency risk before any architecture."

### Hard: Large Group Messaging

Scenario:

A WhatsApp-like group jumps from calm traffic to thousands of recipients actively posting during a release. New messages are supposed to feel instant, but the latest messages now arrive late for active readers.

Pressure read:

- bursty write load
- large-group fanout
- one group becoming much hotter than the rest
- tail-latency pain

Interview-ready line:

> "The dominant pressure is bursty write fanout on one suddenly hot group, so the system first risks long delays on the newest messages even if overall traffic still looks moderate."

## Voice Rehearsal: Cause Before Remedy

This chapter is not asking you to sound fancy.
It is asking you to say the cause before the remedy.

If your opening is:

> "This probably needs a scalable database and some background processing."

repair it into:

> "Before choosing components, I want to read the pressure honestly. Is the hard part burst load, hidden fanout, skew, repeated retries, or tail latency? I also want to know whether the core data is append-only history, mutable records, blobs, or time-series, and whether the main reads are recent ranges, point lookups, search-like queries, or wide aggregation."

Keep a few sentence stems ready, but use them as scaffolding, not as memorized lines:

- "The dominant pressure here is..."
- "The visible symptom is..., but the underlying pressure is..."
- "One user action is hiding more backend work than it looks like."
- "The first concrete pain is tail latency on..."
- "This is likely to fail locally before it fails globally."
- "The data shape is..., while the query shape is..."

Now use those stems to repair three shallow answers:

| Shallow answer | Pressure-first repair |
|---|---|
| "The system is overloaded." | "The dominant pressure is bursty write load with hidden fanout, so tail latency can spike before the average tells the truth." |
| "Some internal backlog is growing." | "Growing internal backlogs may be the symptom, but the most important thing to say first is that bursty write fanout is hitting the main path users feel directly." |
| "We should shard the database." | "Before naming topology, I want to know whether the real stress is skew on one hot entity or broad fleet-wide load." |

## Timed Opener Drill

Do not solve the whole system.
Give yourself 45 seconds and practice this opening shape:

```text
The dominant pressure is <what changed in the workload>,
so <where the user first feels pain>.
```

For each scenario below, answer in one short line first.
Then add one sentence of reasoning.
Stop before architecture.

1. A giant Slack incident channel is exploding with messages.
2. A metrics dashboard query is slow only during outages.
3. A viral post causes one feed item to dominate reads.
4. A ticket drop sends everyone to the same small seat block.

The four scenarios are not random:

- Slack tests bursty writes plus fanout on one hot channel.
- The metrics dashboard tests read pressure that appears during outage windows.
- The viral post tests hot-key read skew.
- The ticket drop tests bursty demand on scarce hot inventory.

What should the one line do?

- name the dominant pressure
- say why it comes before components
- hint at the first concrete pain

If your first line still starts with a tool, start again.

## Mini Drill: Read Pressure Before Symptoms

For each statement, ask yourself whether it is naming a pressure or only a symptom.

- "Some internal backlog is growing."
- "The dominant pressure is bursty write fanout on the main user-visible path."
- "Search feels stale."
- "The dominant pressure is one incident channel becoming much hotter than the rest."
- "Message delivery is delayed."
- "The dominant pressure is bursty writes plus latency-sensitive reads on the same hot path."

The habit you are building is this:

do not stop at the symptom if the cause can be spoken more honestly.

## Mini Drill: Read Slack Without Naming Components

Use this as a final pressure read for Slack:

- what is the real load, not just the average request count?
- where does fanout appear?
- which actions are most sensitive to latency?
- what could go hot first under skew?
- where can retries multiply already-stressed work?
- what is the data shape of message history?
- what is the query shape for recent channel reads versus old-message search?

Expected direction:

Slack is not just "chat."
The core message path is append-heavy, recent-history reads matter, fanout appears in delivery and notifications, large channels can become hot, retries can amplify pain once delivery starts struggling, and message search introduces a different query shape from the live conversation path.

If tools appear first, rerun just the first three questions until the pressure is audible before any component appears.

## Before You Move To Lesson 02

The checkpoint is the ability to replace:

> "This system has a lot of traffic."

with a pressure read that names:

- what kind of load it has
- where latency pain lives
- whether one action causes hidden fanout
- whether retries multiply the same work
- whether skew is likely to dominate before average capacity does
- what the data shape is
- what the query shape is
- what an interview-ready pressure read sounds like in one line

Lesson `02` asks the next natural question:
now that you can feel the pressure and describe the access shape honestly, where should the data live, and how should it spread as the system scales?
