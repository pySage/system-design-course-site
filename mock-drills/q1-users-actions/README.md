# Q1 Users And Actions Drill

This workbook practices only the first `7+1` question:

> Who or what interacts with the system, and what action or event do they produce or consume?

The goal is to make path discovery automatic before moving into correctness, latency, load, or components.

## How To Use

1. Pick one file.
2. Fill only `Aman Attempt`.
3. Do not name architecture components yet.
4. Keep each actor tied to a concrete action, event, or read.
5. Leave `Coach Feedback` blank until review.
6. Revise in `Revised Answer` after feedback.
7. Only after the Q1 answer is corrected, fill `Standard Interview Translation`.

## Active Threads

| File | Archetype | Focus |
|---|---|---|
| `stripe-transactional.md` | Transactional / Ledger | API actor, money movement, merchant/customer split |
| `whatsapp-messaging.md` | Messaging / Delivery | Sender, receiver, group fanout, online/offline state |
| `datadog-observability.md` | Event Ingestion / Observability | Producers, ingestion, query readers, alert consumers |
| `google-docs-collaboration.md` | Real-Time Collaboration | Concurrent editors, sessions, presence, document reads |
| `youtube-media-delivery.md` | Media Storage / Delivery | Uploaders, viewers, processing events, serving reads |
| `elasticsearch-search.md` | Search / Discovery | Index producers, query users, document updates |
| `uber-dispatch.md` | Geo / Dispatch | Riders, drivers, location producers, matching actions |
| `stock-notifications.md` | Hybrid notification problem | Human traders, market/order/holding event producers, delivery providers |

## Q1 Acceptance Bar

A solid Q1 answer should reveal:

- external human users
- internal services or event producers
- third-party providers, if they affect delivery or reliability
- write paths
- read paths
- fanout/fanin candidates
- paths that may need separate correctness, latency, and load analysis later

## Standard Interview Translation

After the raw Q1 drill is reviewed, translate the same facts into the interviewer's familiar surface:

| Section | What Q1 contributes |
|---|---|
| functional requirements | actor actions and in-scope paths |
| non-functional requirements | only hints so far; Q2-Q7 will complete them |
| core entities | nouns touched by actors and actions |
| API sketch | candidate product contracts, not final components |
| high-level design implication | path split candidates that later need LGTC |

This second pass is not a replacement for `7+1`.
It trains you to think in the course framework while speaking in standard interview language.
