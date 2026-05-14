# 00 - Start Here: The Habit This Course Builds

Before a system design course starts naming databases, queues, and caches, it makes one quiet decision: what kind of thinking is it trying to train?

This course chooses to train reasoning before recall. That choice is the teaching philosophy and the course structure at the same time. The chapters appear in this order because strong design explanations usually emerge in this order.

## The Wrong Instinct

Imagine two candidates are asked to design a large group chat system.

The first candidate starts like this:

> "I would probably use Kafka, Redis, WebSockets, Cassandra, and a notification service."

The second candidate starts like this:

> "Before I name components, I want to know what is actually making this system hard. Is the main problem fanout to huge groups, latency for online users, correctness of message state, or something else?"

The first answer sounds borrowed.
The second answer sounds designed.

That difference is the whole reason this course exists.

System design interviews do not mainly reward the person who can recite the most architecture boxes. They reward the person who can stay coherent while the problem is still blurry. The real skill is moving from uncertainty to justified structure.

When this course says pressure, it means the force that makes the easy version of the system stop being enough. In one product that pressure is raw load. In another it is fanout. In another it is correctness around scarce state. In another it is the cost of storing and serving giant blobs. Pressure is not just traffic. Pressure is the thing that should change your first serious design decision.

That is why the course begins there.
Architecture is not the starting point.
Architecture is the response.

## The Story We Will Build

Picture one user action entering a blank system. It might be a message send, a booking request, or a video upload. The first useful question is not "Which database should I use?" The first useful question is "What makes this action dangerous, expensive, slow, or easy to get wrong?"

Once that becomes visible, the next questions arrive naturally. What data does this action touch? What guarantee must remain true if the same action is retried, if two users race, or if one dependency slows down? What must happen before the user can trust the result, and what can move later? Only after that do components begin to earn their place.

At that point, the design stops sounding like a shopping list and starts sounding like a response. Maybe you need a queue because some work can safely happen later. Maybe you need a cache because the same reads repeat and a little staleness is acceptable. Maybe you need replication because failure tolerance matters. Maybe you need a partition key because one boundary of work needs to stay together. The important part is not the component name. The important part is that each choice is answering a pressure you already uncovered.

By the time those questions line up in your head, you have the mind map this course is building. It is not a map of technologies. It is a map of reasoning: pressure, data, guarantees, time, tradeoffs, and failure. Each chapter sharpens one part of that picture until the sequence becomes hard to lose.

## Watch The Method Once

You do not need the full framework yet. You only need to see the order of thought once.

Take the design ask: "Design large group chat."

A borrowed answer sounds like this:

> "I would use WebSockets, Kafka, Redis, Cassandra, and push notifications."

A reasoned answer starts differently:

1. The first pressure is fanout. One user action may create delivery work for hundreds or thousands of recipients.
2. The second pressure is latency. The sender expects the message to feel accepted quickly even though not every recipient is online.
3. The data has an ordering boundary. People care that one conversation reads in the right order. They usually do not care about one global order for the whole product.
4. That means the hot path should stay narrow: accept the message durably, preserve the local ordering boundary, and acknowledge the sender.
5. Delivery, retries, offline handling, notifications, and search can be reasoned about after that, because they are downstream of the core commit.

You do not need to know every implementation detail yet. The point of the example is simpler: notice how the answer moved from pressure to boundary to path before it named components. That is the habit this course is training.

## Why The Site Is Built This Way

The website follows the same philosophy as the prose.

Each later chapter first gives you the idea in language. Then it gives you interaction so you can push on the idea and feel how it changes. Then it gives you a quiz so you can find out whether the idea is stable enough to explain without leaning on the page.

That order matters. If you meet an interaction before the concept exists in your head, you are mostly guessing. If you skip the quiz, you can mistake recognition for understanding. If you can close the page and explain the chapter aloud in your own words, the chapter is doing its job.

When that does not happen, do not rush forward. A fuzzy term becomes a vague answer later.

## How Production Stories Will Appear

The course will also borrow experience from real engineering writeups and incident reports, but it will not throw those stories at you all at once.

A full production story usually contains many layers at the same time: pressure, storage layout, replication, rollout safety, retry behavior, monitoring, team process, and recovery. If you meet all of that before the mental slots exist, the story becomes impressive but not useful.

So the course uses a progressive reveal.

Early chapters show only the slice you can reason about at that point. Chapter 01 may show the pressure part of a Discord or Cloudflare story without asking you to understand the storage or rollout machinery yet. Chapter 02 may return to the same story when storage placement becomes the topic. Chapter 04 may return again when runtime protection, backpressure, or rollout safety becomes meaningful.

That is why these sections are called production echoes or production labs, not required external reading. The goal is to make real systems feel lived, but not to make the beginner carry a full postmortem before the course has built the vocabulary.

Every real story or company writeup will cite its source where it appears. You can open the original when you want the deeper context, but the course page should always tell you exactly what to notice at this point in the journey.

## What This Course Does Not Replace

This course trains system-design reasoning depth: how to read pressure, protect truth, split paths, choose components with reasons, and explain failure clearly.

That is necessary for interviews, but it is not the whole interview surface.

You should also be ready to produce three practical deliverables:

- a rough capacity estimate that turns the pressure read into numbers
- a small API contract sketch that shows the product boundary before the component diagram
- a transport choice that defends why this path needs plain HTTP, long polling, SSE, WebSockets, or something else

The course will add those in the same order as everything else: concrete story first, plain-language meaning second, technical label third, component choice last.
Do not treat them as new framework buckets.
They are interview deliverables that sit on top of the same `7+1` and `LGTC` read.

## Carry This Into Lesson 01

If one sentence survives this chapter, make it this one:

Architecture is not the beginning of the answer. Architecture is the consequence of pressure.

Lesson 01 begins by teaching you how to see that pressure clearly: load, latency, fanout, skew, and the shape of the data being touched. If you carry the habit above into that chapter, the rest of the course will feel like one continuous story instead of a stack of topics.
