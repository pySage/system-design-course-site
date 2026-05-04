# System Design Course Site

An ordered, local-first system design course for building interview-ready judgment from first principles.

The course follows the `system-design-teacher` philosophy: build the learner's mental map before introducing formal framework vocabulary. The site adds linked chapters, glossary anchors, quizzes, adaptive coach interactions, chapter probes, and a practice arena.

## What You Learn

The course builds one picture in stages:

1. Feel the pressure on a system before naming components.
2. Understand how data shape, access shape, storage, partitioning, and replication interact.
3. Name the guarantees the system must keep.
4. Separate what must happen now from what can happen later.
5. Use the formal `7+1` and `LGTC` framework after the raw intuition exists.
6. Recognize recurring system families and hybrid systems.
7. Practice until the reasoning becomes interview reflex.

## Reading Order

Read the chapters in order:

1. [Chapter 00: Study Method](course/00-study-method.md)
2. [Chapter 01: Load, Latency, and Data Shape](course/01-load-latency-and-data-shape.md)
3. [Chapter 02: Storage, Partitioning, and Replication](course/02-storage-partitioning-and-replication.md)
4. [Chapter 03: Consistency, Ordering, Idempotency, and Transactions](course/03-consistency-ordering-idempotency-and-transactions.md)
5. [Chapter 04: Async, Caching, Failure Handling, and Operability](course/04-async-caching-failure-handling-and-operability.md)
6. [Chapter 05: The Interview Framework, 7+1, and LGTC](course/05-the-interview-framework-7-plus-1-and-lgtc.md)
7. [Chapter 06: Archetypes and Component Maps](course/06-archetypes-and-component-maps.md)
8. [Chapter 07: Hybrid Systems and Guided Walkthroughs](course/07-hybrid-systems-and-guided-walkthroughs.md)
9. [Chapter 08: Drill Order and Mock Interview Prep](course/08-drill-order-and-mock-interview-prep.md)

Chapter `00` explains the teaching philosophy and study method. Chapters `01-04` build raw system-design intuition before framework vocabulary appears. Chapter `05` introduces the formal organizing frame. Chapters `06-08` turn the frame into pattern recognition, hybrid-system reasoning, and repeated practice.

## Local Setup

Prerequisites:

- Node.js 18 or newer.
- Git.
- Codex CLI authenticated with OAuth if you want AI-backed coaching. The app does not require OpenAI API keys.

Clone and start:

```bash
git clone https://github.com/pySage/system-design-course-site.git
cd system-design-course-site
mkdir -p runtime/private
cp server/learner_accounts.example.json runtime/private/learner_accounts.json
```

Edit `runtime/private/learner_accounts.json` and replace the placeholder passwords with local passwords for your readers.

Then run:

```bash
./start.sh
```

Open:

```text
http://localhost:9999/
```

Stop the server with:

```bash
./stop.sh
```

## Learner Profiles

Learner accounts are loaded from:

```text
runtime/private/learner_accounts.json
```

That file is intentionally ignored by Git. Do not commit real learner names, passwords, progress files, Codex session ids, or any other private runtime data.

Use this shape:

```json
{
  "users": [
    {
      "id": "reader-one",
      "name": "Reader One",
      "username": "reader-one",
      "password": "replace-with-a-local-password"
    }
  ]
}
```

The local setup supports up to five reader profiles. Each profile keeps separate quiz progress, coach history, adaptive probe history, and practice-arena state.

Runtime learner data is also ignored by Git:

```text
runtime/personalization/users.json
runtime/personalization/attempts.json
```

## Build The Static Site

The server can serve the current files directly. To rebuild generated site pages from course Markdown, run:

```bash
node scripts/build_site.mjs
```

Generated pages live under `site/`.

## Codex Coaching

The adaptive coach uses the local `codex` CLI with the machine's existing OAuth login.

Important constraints:

- No OpenAI API key is required.
- No API key should be stored in this repository.
- If Codex review is unavailable, the app falls back to deterministic review so the learner flow still works.
- Learner-specific Codex conversation state belongs under ignored runtime files only.

## Development Checks

Use these before publishing changes:

```bash
node --check server/course_server.mjs
node --check server/learner_accounts.mjs
node scripts/build_site.mjs
git diff --check
git grep -n -E 'api[_-]?key|OPENAI_API_KEY|secret[[:space:]]*[:=]|token[[:space:]]*[:=]' -- . ':!course'
git ls-files runtime
```

`git ls-files runtime` should print nothing. If it prints a file, private runtime state has been staged or tracked by mistake.

## Security Hygiene

Before pushing:

- Keep real credentials only in ignored files under `runtime/` or in your local environment.
- Do not commit `.env`, logs, local databases, browser automation output, learner progress, or Codex session state.
- Treat `server/learner_accounts.example.json` as documentation only. It must contain placeholders, not usable passwords.
- Review `git diff --cached` before every commit that touches auth, runtime, or configuration.

## Project Layout

- `course/`: source course chapters and glossary content.
- `server/`: local app server, personalization engine, coach integration, and learner account loader.
- `web/`: browser-side app assets used by the local server.
- `site/`: generated static pages.
- `scripts/`: build tooling.
- `runtime/`: ignored local learner data and private account configuration.
