# 02 - Storage, Partitioning, and Replication

Now that you can read pressure, the next question is where each kind of data should live, how it should be split, and when it should be copied.

The mistake this chapter is trying to prevent is also simple: people notice scale, then answer with a database brand. They say "use PostgreSQL," "use Cassandra," or "use S3" before they have said what kind of data they are storing, how it changes, or how the product needs to read it.

This chapter trains the next move:
pick storage as a response to data shape, query shape, and growth pressure.

## Start With One Honest Placement

Imagine a creator uploads a video to YouTube.

A shallow storage answer sounds like this:

> "Store the video in the database."

An honest storage reading is already more precise:

1. The raw video file is a giant blob. It is large, mostly immutable, and awkward to keep inside the kind of store that is best at small structured records and strict updates.
2. The video metadata is small structured state: title, owner, processing status, visibility, and timestamps.
3. Search and discovery need a different read shape from direct metadata lookup.
4. View analytics and watch-time reporting behave differently again: append-heavy and aggregation-heavy.

That one product already contains several different kinds of data.
If you say only "the video," you have already blurred several different storage problems together.

You do not choose one store because the product has one name.
You choose storage based on what each kind of data is and what each kind of read needs from it.
That is the new layer this chapter adds on top of pressure reading:
once you can see the pressure, you stop pretending all data in the product has the same job.

## What A Storage Choice Is Actually Answering

In plain language, a storage choice is answering three questions:

- what kind of thing is this data?
- how does it change over time?
- how does the product need to read it?

If you cannot answer those, the storage choice is probably branding rather than reasoning.

### The Bridge From Chapter 01: Users Hit Owners, Not Averages

Chapter 01 said a system can feel broken even when average traffic looks calm.
This chapter explains one common reason:
the user is often hitting one owner of the data, not the whole fleet.

For now, owner simply means:
the logical slice of data that one part of the system is responsible for.
Later that logical slice may live on a shard, node, or region, but the first idea is ownership.
The formal partitioning section comes later; this bridge only needs the intuition.

Imagine a Slack-like system where each channel's recent messages are owned by one storage slice:

```text
channel ownership

#incident      -> partition A   very hot
#random        -> partition B   calm
#pets          -> partition C   calm
#announcements -> partition D   calm
```

If `#incident` is melting partition A, users reading that channel wait behind partition A's queue.
The average across partitions can still look acceptable because B, C, and D are mostly idle.

That is why storage placement is not just about where bytes sit.
It decides which ownership slice has to absorb the pressure from a particular product path, and which machine, shard, or region may become hot because it owns that slice.

The interview sentence is:

> "The fleet average is misleading here because the hot product object maps to one ownership slice; users on that slice feel tail latency before the whole storage tier looks saturated."

### One Product Can Need More Than One Storage Family

The YouTube example makes this easy to see:

- raw media wants cheap durable blob storage
- metadata wants structured lookup and update
- search wants indexing by text and ranking signals
- analytics wants efficient range scans and aggregation

This is normal, not a smell.

Real systems often need a mix of storage families because real products have several data shapes and query shapes living side by side.

### Storage Follows Shape, Not Popularity

The right question is not "Which database is best?"

The right question is:

What kind of storage behavior fits this data and this access pattern?

Once you ask that, the common storage families stop feeling like trivia and start feeling like tools with clear jobs.

## Storage Families And Query Views

This section is not a vendor catalog.
It is a set of natural fits.

Read it in two layers:

- some choices are common source-of-truth homes for product data
- some choices are query-shaped indexes or views built to answer one kind of read quickly

In an interview, say which role the choice is playing.
An inverted index for search may be a derived copy of metadata.
A geo-index for nearby drivers may be a live query view over driver state.
Those are not the same as saying "all truth lives in the index."

The habit is the same for all of them:
name the family only after you can say what read shape and write shape make it feel natural.

### Relational Store: Structured State With Clear Relationships

A relational store feels natural when:

- the data is structured and changes in place
- related records are queried together
- the product cares about strong rules on that state

Typical fit:

- account state
- booking records
- payment metadata
- user profiles

What it buys you:

- clear modeling of structured state
- strong support for related queries
- rules that help keep data sane

What it makes harder:

- very large write scaling on one busy write path
- large blobs
- access patterns that do not look relational at all

In the YouTube story, metadata fits this shape much more naturally than raw video files do.

### Key-Value Store: Predictable Lookup By Key

A key-value store feels natural when:

- the main operation is fetch by key
- the access pattern is narrow and predictable
- throughput matters more than free-form querying across many fields

Typical fit:

- session state
- feature flags
- per-user settings
- fast lookup tables

What it buys you:

- simple operational shape
- predictable read and write paths
- good fit for direct lookup workloads

What it makes harder:

- wide analytical scans
- rich filtering
- complex joins or search-like access

### Document Store: One Entity Carries Its Own Nested Shape

A document store feels natural when:

- one entity is usually read and written as one record
- fields can be nested or vary a bit across records
- joins and hard cross-record constraints are not the dominant need

Typical fit:

- product catalog entries
- CMS records or posts
- flexible user preference objects
- content or profile documents

What it buys you:

- natural storage for nested records
- flexibility when record shape evolves over time
- a good fit when whole-document reads are common

What it makes harder:

- cross-document joins and strong relational constraints
- global analytical scans
- relationship-heavy multi-hop queries

Document stores are often chosen too vaguely.
The right reason is not "JSON exists."
The right reason is:
the entity itself wants to live as one flexible nested document.

### Wide-Column Store: One Partition Owns Many Ordered Rows

This family becomes easier to picture if you imagine one shelf per user, conversation, or device. You usually begin by naming that shelf, and then you read or write many ordered entries inside it.

A wide-column store feels natural when:

- access begins with one partition key
- each partition owns many related rows or cells
- reads often scan a local ordered range inside that partition more than they ask global free-form questions

Typical fit:

- per-user or per-conversation timelines
- device telemetry by device and time bucket
- inbox or activity slices
- large sparse per-entity datasets

What it buys you:

- high write throughput when each partition mostly handles its own rows
- natural reads over ordered rows inside one partition
- a good fit for sparse wide records and denormalized query-shaped models

What it makes harder:

- cross-partition joins
- broad filtering across the whole dataset when the query does not start from the partition key
- changing the primary access pattern later

If key-value feels too small and a relational model feels too cross-connected, wide-column is often the middle ground interviewers want you to hear.

### Append-Only Log: History Is The Product

An append-only log feels natural when:

- order matters locally
- history matters
- replay or audit is useful

Typical fit:

- message history
- ledgers
- operation streams
- event capture

What it buys you:

- natural history
- replay
- a good fit for append-heavy write patterns

What it makes harder:

- direct current-state lookup if you have no derived view
- read paths that want a compact current snapshot

### Object Storage: Large Immutable Blobs

Object storage feels natural when the data is:

- large
- binary
- mostly immutable or versioned

Typical fit:

- raw videos
- images
- audio files
- attachments

What it buys you:

- cheap durable storage at huge scale
- a natural fit for blob retrieval
- separation between file storage and structured metadata

What it makes harder:

- small in-place record updates
- rich filtering on the blob contents themselves
- relational queries over the object body

This is why the YouTube raw file belongs here much more naturally than in a relational table.

### Search / Inverted Index: Retrieval By Terms And Ranking

This is usually a query-shaped copy, not the only source of truth.

An inverted index feels natural when:

- the product asks keyword or text retrieval questions
- ranking or relevance matters
- the search copy does not need to match the main stored record exactly

Typical fit:

- document or product search
- history search in messaging tools
- search bars over large text-heavy corpora

What it buys you:

- fast term-based retrieval
- ranking-friendly structures
- a natural fit for search-specific query operators

What it makes harder:

- being the only place where the product keeps its core mutable records
- immediate freshness on every write
- rich non-search business constraints

### Time-Series / Columnar Store: Window Reads And Rollups

This heading groups two families because this chapter is focusing on the shared workload shape: append-heavy writes plus window or aggregate reads.
They are not identical technologies.

A time-series or columnar store feels natural when:

- writes are append-heavy
- reads ask for time windows, rollups, or aggregates
- compression and scan efficiency matter more than row-by-row mutation

Typical fit:

- metrics
- observability data
- sensor streams
- analytical event summaries

What it buys you:

- efficient time-window scans
- strong compression and aggregation behavior
- a natural fit for rollups and retention policies

What it makes harder:

- frequent per-record updates under strict rules
- rich cross-record constraints
- low-latency point mutations as the dominant path

### Graph Store: Relationships Are The Query

A graph store feels natural when:

- the hard question is about edges and traversal, not just entity lookup
- multi-hop paths, reachability, or neighborhood expansion matter
- the product keeps asking who connects to whom

Typical fit:

- social graph exploration
- fraud-ring analysis
- permission ancestry
- dependency or lineage traversal

What it buys you:

- natural relationship traversal
- a good fit for variable-depth path queries
- direct modeling of nodes and edges when the relationship is first-class

What it makes harder:

- flat high-throughput lookup workloads that do not need traversal
- simple aggregate scans over huge raw event streams
- pretending every query is a graph when it is not

### Geo-Index: Location Is The Query

A geo-index is usually a specialized access path over live or stored entities, not the only record of those entities.

A geo-index feels natural when:

- nearby lookup is the dominant read
- location and distance shape the product answer
- nearest-neighbor or within-radius queries matter more than rich joins

Typical fit:

- driver lookup
- nearby restaurants or stores
- asset or device proximity search

What it buys you:

- location-aware retrieval
- fast spatial filtering
- a natural fit for nearest-entity questions

What it makes harder:

- acting as the only place where the product keeps its main mutable records
- purely non-spatial access patterns
- avoiding hot geo cells when demand is uneven

The important habit is not to memorize a bigger list.
It is to notice when the read shape is so specific that a general-purpose store will fight the workload.

## Similar Names, Different Jobs

Some storage choices sound close enough that learners blur them together.
Use the product question to separate them.

| Product question | Natural shape | Why |
|---|---|---|
| "Fetch this user's current settings by ID." | key-value | one key points to one current value |
| "Read the latest messages in this conversation." | wide-column / ordered-row layout | one conversation owns many ordered rows |
| "Keep the permanent sequence of accepted messages or money movements." | append-only log | history and replay are part of correctness |
| "Search old messages containing a word." | inverted index | the read starts from terms, not from conversation ID |
| "Find drivers near this rider." | geo-index | the read starts from spatial proximity |

The same product can use several of these at once.
For a chat product, recent conversation history and old-message search are not the same read path.
The first starts from a conversation and asks for a time-ordered range.
The second starts from words and asks for matching messages.

That also answers a common confusion:
Discord-style message history can be append-only in product meaning while using a wide-column-shaped layout for efficient local range reads.
Those are not contradictory.
One describes what the data means; the other describes how the common read is laid out.

If you treat both as "message reads," you lose the reason storage choices diverge.

## Indexes Are Extra Structure, Not Free Speed

An index is extra organized data that makes a specific query faster.

That sounds wonderful until you remember the bill:

- every useful index costs write work
- every useful index costs storage
- every useful index has to be maintained as the data changes

So the interview-standard question is always:

What exact query is this index accelerating, and what write penalty am I accepting for it?

If you cannot answer both sides, the index has not earned its place yet.

An index is often a derived view, not the product's only truth.
For example:

```text
metadata store       search index
source of truth  ->  query-shaped copy
video exists         video can be found by title or keywords
```

If the search index is late, the video may still exist and be playable by direct link.
The failure is search freshness, not necessarily data loss.
That distinction matters because Chapter 03 will ask which truths must be strict and which views can lag.

## Partitioning Means Splitting Ownership

Once one machine is no longer enough to store or serve the workload comfortably, you stop asking only "what store fits?" and start asking "how is ownership split?"

That is partitioning.

### Why Partition

You partition because one machine is no longer enough for:

- dataset size
- write throughput
- read throughput on hot ranges
- isolation of independent slices of work

Partitioning is about splitting load and ownership.
It is not the same thing as making copies.

Keep two words separate:

- a `partition` is a logical ownership slice
- a `shard` is a physical serving unit, often a node or replica group, that owns one or more partitions

People often use the words loosely in interviews, but the distinction matters when you explain hot spots.
A hot partition is the data slice or key range receiving too much work.
A hot shard is the machine or replica group suffering because it owns that hot partition.

The picture is:

```text
before partitioning

all channel history -> one owner

after partitioning

channel A history -> partition P1 -> shard 1
channel B history -> partition P2 -> shard 2
channel C history -> partition P3 -> shard 3
```

Each partition is a logical slice.
Each shard is where one or more of those slices are served.
That is why one hot channel can still hurt badly:
partitioning spreads ownership, but it does not magically make one hot partition cold.

### A Partition Key Should Match The Work That Wants To Stay Together

This is the main instinct.

A good partition key aligns with:

- the dominant lookup pattern
- the main chunk of work that usually wants to stay together
- the local ordering or history boundary

Examples:

- chat messages -> `conversation_id`
- metrics -> metric key plus time bucket
- bookings -> often `listing_id`, region, or another key tied to the hot contention path

The rule is practical:
keep the reads and writes that most want to stay together inside the same logical partition whenever possible.
In plain language, choose a key so the common path usually talks to one ownership slice, and therefore usually one serving shard, instead of scattering one request everywhere.

There is always a tension:

- if the key keeps related data together, common reads are cheap
- if one related group becomes extremely hot, that same locality can concentrate pain

For Slack-like history, `conversation_id` is natural because recent reads usually ask for one conversation.
But a company-wide incident channel can make that exact conversation slice hot.
That does not make the key wrong automatically.
It means the design must admit the skew risk and have a later answer for hot channels.

This is the causal loop from Chapter 01:
the same key that keeps normal conversation reads local is also why one incident channel can create a hot partition.
If that partition is owned by one shard, that shard can melt while average fleet traffic still looks calm.

### Bad Keys Create Predictable Pain

Bad partition keys usually create one or more of these:

- one logical partition becoming much hotter than the rest
- one physical shard becoming hot because it owns that partition
- scattered reads
- expensive fan-out queries
- awkward resharding later

That is why strong answers do not stop at "we will shard it."
They say what the partition key is, what logical slice it creates, and what physical hot-spot risk that slice can create.

### Repartitioning Is Easy To Say And Hard To Live Through

Partitioning decisions become expensive to change once the system is large.

If you expect growth or skew, mention ideas such as:

- virtual partitions, sometimes called virtual shards
- consistent hashing
- background resharding

`Virtual shards` are better understood here as virtual partitions:
start with more logical slices than physical machines, then move those slices between shards later without redesigning the whole key.

The point is not to deep-dive implementation here.
The point is to show you know a partition key is an early design decision with long consequences.

## Replication Means Copies, Not Splits

Replication is different.

Partitioning splits ownership across machines.
Replication makes copies of owned data.

That means replication helps different things.

Keep the two pictures separate:

```text
partitioning splits ownership

conversation A -> partition P1 -> shard 1
conversation B -> partition P2 -> shard 2

replication copies ownership

primary replica for shard 1 -> follower replica for shard 1
primary replica for shard 2 -> follower replica for shard 2
```

If partition P1 for conversation A is owned by shard 1, adding followers may help reads and failure recovery.
It does not remove the fact that writes for conversation A still queue behind the primary replica for the shard that serves P1.

### Why Replicate

You replicate to:

- survive node failure
- reduce read pressure on one primary owner
- place copies closer to readers

### Leader-Follower Is The First Intuition

The simplest useful mental model is:

- one machine accepts writes first
- one or more follower copies stay in sync and may serve some reads

What it buys you:

- simpler write coordination
- better read scaling
- better failure tolerance than one single node with no copy

What it does not buy you:

- relief from a machine that still has to accept every write
- perfectly fresh copies everywhere at all times

That is the line many candidates blur.
Replication is not a fix for one write owner staying overloaded.

### Multi-Region Adds Reach And Complexity

Multi-region copies can help with:

- disaster recovery
- reader latency for global users
- locality or regulatory needs

But they also raise harder questions about:

- failover behavior
- reads from copies that have not caught up yet
- which region should accept writes
- operational complexity

You do not need to solve all of that in chapter 02.
You only need to see that copies across regions are powerful and costly at the same time.

## A Few More Quick Placements

Once the YouTube example is clear, the same instinct transfers quickly.

### WhatsApp

The main message history looks much more like append-heavy conversation data than mutable account state.
Media attachments look like blobs.
Search, if present, is a separate read shape again.

Already you can see why "use one database for all of WhatsApp" is not a serious storage answer.
A simple key-value read for "message by ID" is not enough to explain recent ordered history, offline replay, attachments, and search.

### Metrics Platform

Raw metric events look append-heavy.
Dashboard reads often look like range scans plus aggregation.
One hot metric can make partitioning strategy matter early.

That reading already tells you why a time-series or columnar shape can fit better than a generic row store for the analytics path.
A generic row store may hold metadata about a metric, but the hot path is usually "give me this window and rollup fast," not "update one business row."

### Product Catalog Or CMS

If one item is usually read and written as one nested record, with fields that vary a bit across item types, a document shape becomes natural early.

That does not automatically ban relational storage.
It only means the first honest storage read is about document-shaped ownership, not joins.
The wrong shortcut is "it is JSON, so use a document store."
The better reason is "the product usually reads and writes this whole nested item together."

### Fraud Or Permission Graph

If the hard question is who connects to whom, which nodes are two or three hops away, or whether suspicious entities share neighbors, the relationship itself becomes the read path.

That is when a graph store or graph-shaped index earns attention early instead of being treated as an afterthought.

## Production Lab: Same Stories, Now Data Placement

Chapter 01 only let you read pressure. Now you are allowed to ask where the data lives and how the access pattern makes that placement painful or useful.

### Discord: Channel-Local History Is Fast Until One Channel Gets Hot

The source here is Discord Engineering's public article, ["How Discord Stores Trillions of Messages"](https://discord.com/blog/how-discord-stores-trillions-of-messages).
When this course says "Discord's message-storage article," it means that article about how Discord stored and migrated message history at very large scale.
It does not mean "Discord has one database trick you should copy."

At this chapter's depth, the article is useful because it shows a storage shape:
messages can be organized around the channel they belong to and the time period they were written in.
The lesson is to see why that shape fits the read.

Imagine a user opens `#incident` and the app loads the latest 50 messages.
That read is not asking:

> "Search every message in Discord."

It is asking:

> "Give me the newest messages for this one channel, in time order."

That query naturally wants nearby data:

```text
channel_id = #incident
time range = now backwards
        |
        v
recent #incident messages in order
```

This is what "channel-local timeline" means here:

- `channel-local` means scoped to one channel, such as `#incident`, not all Discord messages globally
- `timeline` means the messages are read as a time-ordered sequence, newest-to-older or older-to-newer
- `channel-local timeline` therefore means "the ordered message history for one channel"

Keeping that channel's recent messages close together means reading recent history does not scatter across the whole storage fleet.

That locality is useful because the common read is cheap.
The product often asks for "recent history in this channel," so the storage layout matches that access pattern.

But the same locality creates the danger.
If `#incident` becomes a huge live channel during an outage, many users read the same recent history while many users also write new messages into that same channel-local timeline.
The owner of that channel-time slice can become overloaded even if most other channels are calm.

So the tradeoff is not:

> "channel-local timeline good or bad?"

The tradeoff is:

> "Keep the normal read cheap by clustering one channel's recent history, while admitting that a very large channel can concentrate reads and writes on the same ownership slice."

Decision simulation:

You are designing message history. If most reads ask for recent messages in one channel, what storage shape does that suggest, and what risk does it create?

Interview-ready answer:

> "The data wants a per-channel ordered history shape, but that also means a very large channel can create a hot ownership slice, so the partitioning choice has to be made with skew in mind."

Source: [Discord Engineering, "How Discord Stores Trillions of Messages"](https://discord.com/blog/how-discord-stores-trillions-of-messages)

### Slack: A Product Feature Broke The Old Placement Assumption

Slack's shared-channels writeup describes a product change that crossed workspace boundaries. The old assumption was that channel data belonged cleanly inside one workspace-owned slice, which would then be served by that workspace's storage placement. Shared channels made that assumption weaker because members from different workspaces needed to interact with the same channel.

Wrong instinct:

> "Keep every channel under the workspace that created it."

That may have worked before the product boundary changed.
The Chapter 02 lesson is:

> "A storage boundary that matches the old product can become wrong when the product boundary changes."

If a channel is shared between two workspaces, do you duplicate the channel data into both places, or keep one owner and route requests there?

The tradeoff starts here:

- duplication keeps reads local but risks inconsistent copies and higher write cost
- single ownership avoids duplicate truth but requires cross-boundary routing

Source: [Slack Engineering, "How Slack Built Shared Channels"](https://slack.engineering/how-slack-built-shared-channels/)

### Uber H3: Location Is Not A Generic Lookup

Uber's H3 writeup describes a spatial indexing system based on hexagonal cells. For this chapter, the lesson is narrow: nearby lookup is a specialized query shape. If the product keeps asking "what is near this point?", a generic key lookup is not enough.

Failure-mode check:

A dispatch system needs nearby drivers quickly. What is the storage/query-shape read?
What goes wrong if you store latitude and longitude as ordinary fields but have no spatial access path?

Short answer:

> "The query shape is spatial proximity, so I need a geo-indexed view of live entities instead of treating location as just another field in a generic record."

Source: [Uber Engineering, "H3: Uber's Hexagonal Hierarchical Spatial Index"](https://www.uber.com/blog/h3/)

### Google Bigtable: Layout Matters Because Access Patterns Differ

Google's Bigtable paper is a more advanced wrinkle, so do not treat it as required background yet.
It is useful here for one narrow reason:
the paper says one storage system served very different Google workloads, including web indexing, Google Earth, and Google Finance.
Those workloads did not become identical just because they used the same storage family.

For this chapter, layout means the shape you choose inside the storage family:

- what the row key starts with
- which rows end up near each other
- which columns are grouped together
- whether time is part of the key
- which common read becomes cheap because of that arrangement

Think of it as shelf placement in a huge warehouse.
Two products may use the same warehouse, but one may put items by `web page`, another by `location tile`, and another by `financial object`.
The warehouse is shared.
The shelf order is not.

That is the lesson:

> "A storage family tells you the kind of warehouse you are using. The layout tells you which product read you are making cheap."

Now apply it to the paper without needing to know Bigtable internals:

| Workload | The layout question |
|---|---|
| web indexing | "Should nearby rows follow page, URL, domain, crawl, or indexing access?" |
| map or earth imagery | "Should nearby rows follow spatial tiles or another location-shaped read?" |
| finance-style serving | "Should nearby rows follow the entity and time range users or jobs read together?" |

So the interview question is not:

> "Would Bigtable work?"

The better question is:

> "If this wide-column-style store is the family, what row key and locality make the main read cheap without creating a hot slice?"

Layout answer:

> "The storage family may be shared, but the layout is still product-specific. I would choose the row key and locality around the main query shape, then check whether that choice scatters common reads or concentrates too much heat on one range."

Source: [Google Research, "Bigtable: A Distributed Storage System for Structured Data"](https://research.google/pubs/bigtable-a-distributed-storage-system-for-structured-data/)

## Repair The First Minute

Suppose your first minute starts like this:

> "I would use PostgreSQL and add sharding later."

Repair it by separating the data before naming the store:

> "Before naming a store, I want to separate the data types. The raw blob, structured metadata, search view, and analytics path do not all want the same storage shape. Then I want to ask which reads and writes most want to stay on one machine so the partition key matches the common path. Replication can help with availability and read scale after that, but it will not remove write pressure if one machine still has to accept every write first."

The repaired version works because it changes the unit of reasoning:

- it separated the data by storage needs
- it made the partition key earn its place
- it named what replication helps and what it does not

The voice is not "I know more database names."
The voice is "I know what each piece of data is trying to survive."

## Mini Drill: Place YouTube Data Without Naming Vendors

Run this as a placement exercise.
For each item, say the storage behavior first and the technology name last, if at all:

- where should the raw uploaded file live, and why?
- where should the small structured metadata live, and why?
- what path needs a search-oriented shape rather than plain lookup?
- what data is append-heavy enough to make analytics storage look different?
- if one part gets hot first, what would you partition by?
- what would replication help here, and what would it not help?

Expected direction:

Raw video wants blob storage, metadata wants a structured store, search wants an index-shaped access pattern, analytics wants an append-heavy aggregation-friendly shape, partitioning should follow the dominant ownership and access path for each part, and replication helps failure tolerance and read scale rather than removing write pressure from the machine that still accepts all writes first.

If your answer collapses back to one database for the whole product, rerun only the part where the data shapes first split apart.

## Before You Move To Lesson 03

The exit check for this chapter is simple.
Replace:

> "We should use a scalable database."

with a placement read that says:

- what kind of data this is
- what kind of reads it needs
- which storage family fits that shape
- what a good partition key might be
- what replication helps
- what replication does not solve

Lesson `03` adds the next layer to the map:
once you know where data lives, you need to decide what promises the system must keep when that data changes.
