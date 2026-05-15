import fs from "node:fs/promises";
import path from "node:path";
import { glossaryEntries, glossaryGroups } from "../course/glossary.mjs";

const rootDir = process.cwd();
const courseDir = path.join(rootDir, "course");
const webDir = path.join(rootDir, "web");
const siteDir = path.join(rootDir, "site");
const assetsDir = path.join(siteDir, "assets");

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function stripTrailingWhitespace(value) {
  return value.replace(/[ \t]+$/gm, "");
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[`~!@#$%^&*()+=[\]{}|\\:;"'<>,.?/]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function rewriteHref(href) {
  if (href.endsWith(".md")) {
    const base = path.basename(href, ".md");
    return `${base}.html`;
  }

  if (href.startsWith("course/") && href.endsWith(".md")) {
    const base = path.basename(href, ".md");
    return `${base}.html`;
  }

  return href;
}

function renderInline(text) {
  const codeTokens = [];
  let value = escapeHtml(text);

  value = value.replace(/`([^`]+)`/g, (_, code) => {
    const token = `__CODE_${codeTokens.length}__`;
    codeTokens.push(`<code>${escapeHtml(code)}</code>`);
    return token;
  });

  value = value.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const safeLabel = label;
    const safeHref = escapeHtml(rewriteHref(href));
    return `<a href="${safeHref}">${safeLabel}</a>`;
  });

  value = value.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  value = value.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  codeTokens.forEach((replacement, index) => {
    value = value.replace(`__CODE_${index}__`, replacement);
  });

  return value;
}

function plainTextInline(text) {
  return text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

const glossaryById = new Map(glossaryEntries.map((entry) => [entry.id, entry]));
const glossaryAliasMap = new Map(
  glossaryEntries.flatMap((entry) =>
    [entry.term, ...(entry.aliases ?? [])].map((alias) => [alias.toLowerCase(), entry]),
  ),
);
const glossaryPattern = [...glossaryAliasMap.keys()]
  .sort((left, right) => right.length - left.length)
  .map((alias) => escapeRegex(alias).replaceAll(" ", "\\s+"))
  .join("|");
const glossaryRegex = new RegExp(`(?<![A-Za-z0-9])(${glossaryPattern})(?![A-Za-z0-9])`, "gi");

function glossaryHref(entry) {
  return `glossary.html#${entry.id}`;
}

function updateBlockedTagCount(tagCounts, token) {
  const closingTag = token.match(/^<\s*\/\s*([a-z0-9]+)\s*>/i);
  if (closingTag) {
    const tag = closingTag[1].toLowerCase();
    tagCounts.set(tag, Math.max((tagCounts.get(tag) ?? 0) - 1, 0));
    return;
  }

  const openingTag = token.match(/^<\s*([a-z0-9]+)\b[^>]*>/i);
  if (!openingTag) {
    return;
  }

  const tag = openingTag[1].toLowerCase();
  const selfClosing =
    /\/\s*>$/.test(token) ||
    ["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source"].includes(tag);

  if (!selfClosing) {
    tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }
}

function linkGlossaryTermsInHtml(html, excludeId = null) {
  const blockedTags = new Set(["a", "h1", "h2", "h3", "h4", "h5", "h6", "pre", "script", "style"]);
  const tagCounts = new Map();

  return html
    .split(/(<[^>]+>)/g)
    .map((token) => {
      if (token.startsWith("<")) {
        updateBlockedTagCount(tagCounts, token);
        return token;
      }

      const isBlocked = [...blockedTags].some((tag) => (tagCounts.get(tag) ?? 0) > 0);
      if (isBlocked) {
        return token;
      }

      return token.replace(glossaryRegex, (match) => {
        const entry = glossaryAliasMap.get(match.toLowerCase());
        if (!entry || entry.id === excludeId) {
          return match;
        }

        return `<a class="term-link" href="${glossaryHref(entry)}" title="${escapeHtml(entry.summary)}">${match}</a>`;
      });
    })
    .join("");
}

function renderLinkedInline(text, excludeId = null) {
  return linkGlossaryTermsInHtml(renderInline(text), excludeId);
}

function isTableStart(lines, index) {
  const header = lines[index] ?? "";
  const separator = lines[index + 1] ?? "";
  return (
    header.trim().startsWith("|") &&
    header.trim().endsWith("|") &&
    /^\|(?:\s*:?-+:?\s*\|)+$/.test(separator.trim())
  );
}

function splitTableRow(line) {
  return line
    .trim()
    .slice(1, -1)
    .split("|")
    .map((cell) => renderInline(cell.trim()));
}

function parseMarkdown(markdown) {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const html = [];
  const toc = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const language = trimmed.slice(3).trim();
      const codeLines = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      index += 1;
      const className = language ? ` class="language-${escapeHtml(language)}"` : "";
      html.push(
        `<pre class="code-block"><code${className}>${escapeHtml(codeLines.join("\n"))}</code></pre>`,
      );
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      const id = slugify(text);
      if (level >= 2 && level <= 3) {
        toc.push({ level, text: plainTextInline(text), id });
      }
      html.push(`<h${level} id="${id}">${renderInline(text)}</h${level}>`);
      index += 1;
      continue;
    }

    if (isTableStart(lines, index)) {
      const headers = splitTableRow(lines[index]);
      const rows = [];
      index += 2;
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }

      const thead = `<thead><tr>${headers.map((cell) => `<th>${cell}</th>`).join("")}</tr></thead>`;
      const tbody = `<tbody>${rows
        .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
        .join("")}</tbody>`;
      html.push(`<div class="table-wrap"><table>${thead}${tbody}</table></div>`);
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines = [];
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      html.push(`<blockquote>${renderInline(quoteLines.join(" "))}</blockquote>`);
      continue;
    }

    if (/^- /.test(trimmed)) {
      const items = [];
      while (index < lines.length && /^- /.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^- /, ""));
        index += 1;
      }
      html.push(`<ul>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      html.push(`<ol>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ol>`);
      continue;
    }

    const paragraph = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].trim().startsWith("```") &&
      !/^(#{1,6})\s+/.test(lines[index]) &&
      !/^- /.test(lines[index].trim()) &&
      !/^\d+\.\s+/.test(lines[index].trim()) &&
      !/^>\s?/.test(lines[index].trim()) &&
      !isTableStart(lines, index)
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    html.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
  }

  return { html: html.join("\n"), toc };
}

function extractTitle(markdown) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "Untitled";
}

function extractSummary(markdown) {
  const lines = markdown.replace(/\r/g, "").split("\n");
  let sawTitle = false;
  const paragraph = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (paragraph.length > 0) {
        break;
      }
      continue;
    }

    if (!sawTitle && /^#\s+/.test(trimmed)) {
      sawTitle = true;
      continue;
    }

    if (/^(##|###|####|- |\d+\.\s+)/.test(trimmed)) {
      continue;
    }

    paragraph.push(trimmed);
    if (paragraph.join(" ").length > 180) {
      break;
    }
  }

  return paragraph.join(" ");
}

function shortTitle(title) {
  return title.replace(/^\d+\s*-\s*/, "").trim();
}

const lessonMeta = {
  "00-study-method": {
    stage: "Start Here",
    teaser: "Understand why this course starts from pressure instead of components, and what habit of reasoning the later chapters are trying to build.",
    why: "A reader should know what kind of thinking the course is training before the technical journey starts. This opening chapter explains why the subject is taught as one reasoning story instead of a pile of disconnected topics.",
    where: "You are at the threshold of the course. Nothing technical is assumed yet; this is where the lens is set.",
    fit: "This opening chapter defines the lens for the rest of the course. Later lessons deepen each part of the same reasoning sequence: pressure, data, guarantees, time, tradeoffs, and failure.",
    goals: [
      "Understand why the course begins from pressure instead of components",
      "See the sequence of questions the course is building in your head",
      "Know why the site uses prose first, interaction second, and quiz third",
      "Recognize sizing, API contracts, and transport choice as interview deliverables built on the same reasoning map",
    ],
    takeaways: [
      "Strong answers begin from what makes the system hard, not from a tool list.",
      "The course is building one reasoning map: pressure, data, guarantees, time, tradeoffs, and failure.",
      "Each chapter is meant to be learned in a rhythm: language first, interaction next, quiz last.",
      "Capacity estimates, API sketches, and transport choices should follow the pressure read instead of becoming new framework buckets.",
    ],
    visualTitle: "The Mind Map We Are Building",
    visualPrompt: "Click through the course path and see how each lesson adds a layer to the same picture.",
  },
  "01-load-latency-and-data-shape": {
    stage: "Layer 1 of 8",
    teaser: "Every design starts by reading one user action honestly: hidden work, waiting pain, hotspots, and access shape before naming components.",
    why: "If you cannot feel where the pressure is coming from, every later design choice becomes decorative. This chapter teaches you to read burst load, fanout, skew, retry amplification, tail pain, data shape, and query shape by first grounding them in a real system read instead of a headline number.",
    where: "You are starting with the outside force hitting the system: traffic, timing, and access pattern.",
    fit: "This is the foundation layer. Storage, consistency, and topology only make sense after the pressure is visible.",
    goals: [
      "Read one visible action in terms of hidden work, peaks, tails, fanout, and skew instead of one headline number",
      "Turn hidden work into rough sizing estimates for QPS, fanout, storage, bandwidth, peak multiplier, and hot-key risk",
      "Separate the underlying pressure from the downstream symptom it creates",
      "Distinguish data shape from query shape with concrete system examples",
      "Build the instinct to ask what actually makes the system hard before choosing components",
      "Practice saying the pressure read in short interview-ready language",
    ],
    takeaways: [
      "Average QPS is rarely the full story; peaks, burstiness, fanout, and hot spots often dominate.",
      "Capacity estimates are strongest when they quantify hidden work per visible action.",
      "One user action is often much larger than one backend operation.",
      "Latency needs tail thinking and user-tolerance thinking, not just average thinking.",
      "A visible symptom like queue growth or delayed delivery is weaker than naming the pressure that created it.",
      "Data shape and query shape are the bridge into later storage and topology choices.",
    ],
    visualTitle: "One Action Becomes System Pressure",
    visualPrompt: "Watch the causal path: a visible product action turns into hidden work, the hidden work concentrates somewhere, and the user finally feels the slowest path.",
    visualGuideTitle: "How To Use This Panel",
    visualGuide: [
      "Start with the default state and read the loudest pressure before touching any controls.",
      "Move one pressure control at a time so you can see which change made the dominant pain shift.",
      "After that, change the data shape and query shape one at a time and read what questions should carry into the storage chapter.",
    ],
    visualGuideNote: "This is not asking you to design the system yet. It is helping you rehearse the reading move the chapter just taught.",
  },
  "02-storage-partitioning-and-replication": {
    stage: "Layer 2 of 8",
    teaser: "Now that you can read pressure, the next question is where each kind of data should live, how it should be split, and when it should be copied.",
    why: "Pressure alone is not enough. Once you know what the system is being asked to do, you have to place each kind of data honestly: blobs, structured metadata, document-shaped records, per-channel ordered message histories, search views, graphs, and analytics paths do not naturally want the same storage shape.",
    where: "You are now inside the system, looking at the physical life of data.",
    fit: "This chapter turns traffic intuition into storage and scaling intuition.",
    goals: [
      "Match storage patterns to data shape and query shape instead of product name",
      "Recognize when document, wide-column, graph, search, or time-series families are the honest fit",
      "Understand what partitioning changes and what replication solves",
      "Avoid using brand names where reasoning should be",
    ],
    takeaways: [
      "One product can legitimately need multiple storage families when its data shapes differ.",
      "Storage choice is driven by data shape and query shape, not by popularity.",
      "Some storage families are specialized because the dominant read is specialized, such as traversal, full-text search, or time-window aggregation.",
      "Partitioning and replication solve different problems.",
      "Partition and shard vocabulary changes across products, so define which level is logical ownership, physical serving, and replication.",
      "A partition key should align with the access pattern and the work that most wants to stay local.",
    ],
    visualTitle: "Data Shape Narrows Storage Choices",
    visualPrompt: "Watch one product split into different data shapes. Each shape pulls toward a different storage discussion before any database brand is named.",
  },
  "03-consistency-ordering-idempotency-and-transactions": {
    stage: "Layer 3 of 8",
    teaser: "Once data has a shape and a home, the next question is what product truth must stay protected when data changes.",
    why: "A booking flow can look well-designed until the last room is sold twice, a retry creates two charges, or the host and guest see contradictory facts. This chapter starts from that product damage, then names the narrow promise that prevents it.",
    where: "You are at the promise layer of the map: what readers may safely believe, what repeated requests must not repeat, and what updates must move together.",
    fit: "This chapter turns storage placement into a protection question: which small truth must survive races, retries, and partial failure?",
    goals: [
      "Explain the product failure before using terms like consistency or transaction",
      "Differentiate fresh-truth needs from reads that can safely lag",
      "Scope ordering to the smallest place where sequence changes meaning",
      "See retry-safe identity and narrow all-or-nothing boundaries as practical answers to partial failure",
      "Tie every guarantee word to the product risk or state boundary it protects",
    ],
    takeaways: [
      "Correctness boundaries should be narrow and explicit.",
      "Per-key or local ordering is often enough; global ordering is usually overkill.",
      "Exactly-once outcomes usually come from idempotent design rather than magical transport guarantees.",
      "The transaction boundary should protect the core truth, not every downstream side effect.",
      "Interview-ready guarantee language names the protected state before the mechanism.",
    ],
    visualTitle: "Guarantees Protect A Narrow Boundary",
    visualPrompt: "Watch product risk move inward until it becomes a small state boundary. Only then do consistency, ordering, idempotency, and transactions have meaning.",
  },
  "04-async-caching-failure-handling-and-operability": {
    stage: "Layer 4 of 8",
    teaser: "A YouTube upload can be accepted before every expensive follow-up finishes. This chapter teaches where the response line belongs.",
    why: "A video upload can be accepted before every thumbnail, search update, recommendation refresh, and cache warmup is finished. This chapter teaches what must be true before the response and what can safely lag after it.",
    where: "You are deciding the response line: what must finish before success is honest, what can happen later, and what signals show that later work is falling behind.",
    fit: "This chapter turns a static design into a timeline of promises, delayed work, and visible failure.",
    goals: [
      "Explain the response promise before naming queues, caches, or workers",
      "Move work after the response only when the product can tolerate that lag",
      "Use queues and backpressure without pretending overload disappeared",
      "Use caches only when reuse, freshness, and expiry are explicit",
      "Explain how the system bends under failure and how humans would notice",
    ],
    takeaways: [
      "Async is about truth versus delay, not importance versus unimportance.",
      "A queue helps only if lag, retries, priority, and overload behavior are intentionally designed.",
      "Caches trade origin work for freshness risk and need explicit expiry or invalidation.",
      "Production-ready answers say how the system bends under failure and how you would notice.",
      "A queue converts immediate overload into delayed work; it does not remove the overload.",
    ],
    visualTitle: "Truth Before The Response, Work After It",
    visualPrompt: "Watch the response boundary separate work that makes the answer truthful from work that can lag behind safely.",
  },
  "05-the-interview-framework-7-plus-1-and-lgtc": {
    stage: "Layer 5 of 8",
    teaser: "When someone says \"Design Slack,\" this chapter teaches the first two minutes before boxes: extract facts, then summarize them.",
    why: "When the interviewer says something broad like \"Design Slack,\" the dangerous move is drawing boxes before you know the workload, wrong-data risk, slowness pain, peak shape, delayed work, obligations, and data shape.",
    where: "You are turning the first two minutes into fact finding before architecture, so later component choices have reasons.",
    fit: "This chapter turns the ideas from earlier chapters into a repeatable opening move.",
    goals: [
      "Open a broad system-design request before drawing components",
      "Ask the opening questions as fact extraction, not ceremony",
      "Compress the extracted facts into a short summary after the facts exist",
      "Sketch small API contracts only after pressure, guarantees, and boundaries are visible",
      "Translate 7+1 questions into the FR/NFR vocabulary interviewers use to score you",
      "Know where API sketch belongs relative to extraction and component choice",
      "Build a first-two-minute answer that sounds like reasoning, not recall",
    ],
    takeaways: [
      "The framework exists to stop premature architecture and force justified reading first.",
      "LGTC does not add new facts; it compresses the extracted facts into design-ready buckets.",
      "API contracts are post-extraction deliverables that should expose promises, retry identity, boundaries, and allowed lag.",
      "Scope sub-questions answer FRs; LGTC answers NFRs across load, guarantees, topology, and constraints.",
      "Speak load, guarantees, topology, and constraints in the room; LGTC is the mnemonic, not the script.",
      "A strong interview opening sounds like clarified pressure, guarantees, topology, and constraints before components.",
      "The +1 becomes central when data shape or query shape starts deciding whether the design is credible.",
    ],
    visualTitle: "Extraction Before Architecture",
    visualPrompt: "Watch the design ask move through extraction, compression, shape recognition, and only then component choice.",
  },
  "06-archetypes-and-component-maps": {
    stage: "Layer 6 of 8",
    teaser: "After you can read a system clearly, repeated kinds of pain start to sound familiar before any boxes are drawn.",
    why: "WhatsApp, Stripe, and YouTube feel different before you name databases or queues. This chapter teaches how to hear that difference first, then use labels and component memory only after the pain has been earned.",
    where: "You are at the recognition layer: repeated product pains, the usual parts those pains pull in, and the first failures they tend to create.",
    fit: "This chapter converts a clear system read into a faster architectural starting point without turning labels into shortcuts.",
    goals: [
      "Recognize recurring system pain from concrete product reads",
      "Use a label only after the plain-language pain is clear",
      "Connect each expected component to the stress or failure it answers",
      "Defend transport choices from latency, directionality, connection count, and delivery expectations",
      "Avoid brand-name pattern matching and memorized box lists",
    ],
    takeaways: [
      "Archetypes compress repeated kinds of system pain, not product branding.",
      "A correct label is justified by dominant stress after LGTC, not by the company name.",
      "A good archetype read naturally pulls in expected components, a core tradeoff, and an early failure mode.",
      "Component maps are useful only when each component is tied back to a stress, guarantee, or failure.",
      "WebSockets, SSE, long polling, and plain HTTP are transport answers only after the path earns them.",
    ],
    visualTitle: "Archetype Labels Are Earned",
    visualPrompt: "Watch a product name turn into dominant stress, then into an archetype, and finally into components with reasons.",
  },
  "07-hybrid-systems-and-guided-walkthroughs": {
    stage: "Layer 7 of 8",
    teaser: "Design YouTube cannot be answered by one label. This chapter splits the product into upload, playback, search, recommendations, and the pressure each path owns.",
    why: "Real products such as YouTube, Airbnb, and Slack stop making sense when flattened into one system shape. This chapter teaches path ownership so different stresses, tradeoffs, and failure modes can be explained cleanly.",
    where: "You are at the composition layer of the map: one product, several meaningful paths, and different archetypes owning different slices.",
    fit: "This chapter is where single-shape intuition turns into real-product reasoning.",
    goals: [
      "Split a product into meaningful paths before drawing one architecture",
      "Assign path owners from dominant stress instead of product branding",
      "Distinguish true co-owners from subordinate supporting paths",
      "Split observability products into ingest, query, alerting, and retention paths when their promises differ",
      "Use a path-owner test so hybrid thinking does not become over-splitting",
    ],
    takeaways: [
      "Hybrid systems are about path ownership, not technology count.",
      "Start with the write/read split, then split again if one side is still mixed.",
      "A path deserves separate ownership only when it changes components, tradeoffs, or first failures.",
      "Hybrid answers should name what stays secondary as clearly as what owns the main path.",
      "Datadog-style systems should not flatten ingest, dashboard query, alerting, and retention into one generic event pipeline.",
    ],
    visualTitle: "Hybrid Systems Split By Path",
    visualPrompt: "Watch one product split into paths. Each path earns its own owner only when the stress, tradeoff, or first failure changes.",
  },
  "08-drill-order-and-mock-interview-prep": {
    stage: "Layer 8 of 8",
    teaser: "This lesson turns the map you built into a repair loop, so practice stops being random and starts fixing the right weakness at the right layer.",
    why: "Most candidates practice too hard too early. This chapter teaches how to move from concepts to openings to archetypes to hybrids to mocks, and how to step back to the earliest layer that owns a miss.",
    where: "You are at the performance layer: not learning new ideas, but making the whole chain stay available under pressure.",
    fit: "This final chapter closes the loop by turning course knowledge into a deliberate training system.",
    goals: [
      "Practice in the right order instead of jumping straight into full-pressure mocks",
      "Diagnose which stage owns a miss and step back deliberately to repair it",
      "Use teach, quiz, and test sessions to turn the full design map into spoken fluency",
      "Calibrate readiness with sizing, API contract, and transport defense reps in addition to mocks",
      "Handle interviewer-directed deep dives without losing opening structure",
      "Increase practice pressure gradually so the structure survives timer, interruption, and new constraints",
    ],
    takeaways: [
      "The ladder is a dependency order, not just a syllabus order.",
      "Mocks expose weaknesses, but earlier drill layers usually repair them faster.",
      "Interview readiness comes from audible structure, justified choices, tradeoff clarity, and failure thinking under pressure.",
      "Sizing, API, and transport questions are readiness checks when they follow the same pressure-first reasoning chain.",
      "One sentence can acknowledge a premature interrupt; then continue, because abandoning the opening loses the foundation.",
      "Progressive overload works only when the previous layer is already audible.",
    ],
    visualTitle: "Practice Repairs The Earliest Miss",
    visualPrompt: "Watch practice move from concept to opening to archetype to hybrid to mock pressure, stepping back whenever an earlier habit breaks.",
  },
};

function getLessonMeta(slug) {
  return lessonMeta[slug] ?? {
    stage: "Lesson",
    teaser: "",
    why: "",
    where: "",
    fit: "",
    goals: [],
    takeaways: [],
    visualTitle: "Chapter Diagram",
    visualPrompt: "",
    visualGuideTitle: "",
    visualGuide: [],
    visualGuideNote: "",
  };
}

function renderSidebar(lessons, currentSlug) {
  const lessonLinks = lessons
    .map((lesson, index) => {
      const active = lesson.slug === currentSlug ? " class=\"is-active\"" : "";
      return `<li${active}><a href="${lesson.slug}.html"><span class="lesson-index">${String(
        index,
      ).padStart(2, "0")}</span><span>${escapeHtml(lesson.title)}</span></a></li>`;
    })
    .join("");

  return `
    <aside class="sidebar">
      <a class="brand" href="index.html">
        <span class="brand-mark">SD</span>
        <span class="brand-copy">
          <strong>System Design Course</strong>
          <small>Interview-grade fundamentals and drills</small>
        </span>
      </a>
      <nav class="sidebar-nav" aria-label="Course lessons">
        <p class="sidebar-label">Read In Order</p>
        <ol>${lessonLinks}</ol>
      </nav>
      <div class="sidebar-card">
        <p class="sidebar-label">Practice</p>
        <a class="sidebar-link" href="labs.html">Interactive Intuition Labs</a>
        <p>Use labs and quizzes to stabilize the mental map as each lesson adds a new layer.</p>
        <a class="sidebar-link" href="arena.html">Practice Arena</a>
        <p>Use adaptive circuits when you want repeated transfer, pressure, and interviewer-style pushback on the ideas you have already studied.</p>
        <a class="sidebar-link" href="glossary.html">Contextual Glossary</a>
      </div>
      <div class="sidebar-card learner-sidebar-card" data-learner-sidebar>
        <p class="sidebar-label">Learner Context</p>
        <p>Use the top-right profile menu to sign in, save progress, and unlock coaching once you have started the course.</p>
        <a class="sidebar-link" href="index.html#personal-coach">Open Personal Coach</a>
      </div>
    </aside>
  `;
}

function renderTopbar(currentSlug, variant = "default") {
  if (variant === "home") {
    const homeActive = currentSlug === "home" ? " is-current" : "";

    return `
      <header class="topbar">
        <nav class="topbar-nav" aria-label="Primary">
          <a class="topbar-link${homeActive}" href="index.html">Course Home</a>
          <a class="topbar-link" href="00-study-method.html">Start Here</a>
          <a class="topbar-link" href="#course-lessons">Read In Order</a>
          <a class="topbar-link" href="#study-tools">Study Tools</a>
        </nav>
        <div class="topbar-utility" data-topbar-personalization></div>
      </header>
    `;
  }

  const homeActive = currentSlug === "home" ? " is-current" : "";
  const labsActive = currentSlug === "labs" ? " is-current" : "";
  const arenaActive = currentSlug === "arena" ? " is-current" : "";
  const glossaryActive = currentSlug === "glossary" ? " is-current" : "";

  return `
    <header class="topbar">
      <nav class="topbar-nav" aria-label="Primary">
        <a class="topbar-link${homeActive}" href="index.html">Course Home</a>
        <a class="topbar-link${labsActive}" href="labs.html">Labs</a>
        <a class="topbar-link${arenaActive}" href="arena.html">Arena</a>
        <a class="topbar-link${glossaryActive}" href="glossary.html">Glossary</a>
        <a class="topbar-link" href="00-study-method.html">Start Here</a>
      </nav>
      <div class="topbar-utility" data-topbar-personalization></div>
    </header>
  `;
}

function renderToc(toc) {
  if (toc.length === 0) {
    return `
      <aside class="toc">
        <p class="toc-label">On This Page</p>
        <p class="toc-empty">This page is meant to be read straight through.</p>
      </aside>
    `;
  }

  return `
    <aside class="toc">
      <p class="toc-label">On This Page</p>
      <ul>
        ${toc
          .map(
            (item) =>
              `<li class="level-${item.level}"><a href="#${item.id}">${escapeHtml(item.text)}</a></li>`,
          )
          .join("")}
      </ul>
    </aside>
  `;
}

function compressLessonToc(toc) {
  if (toc.length <= 18) {
    return toc;
  }

  return toc.filter((item) => item.level === 2);
}

function renderShell({
  title,
  currentSlug,
  content,
  toc = [],
  bodyClass = "",
  showSidebar = true,
  showToc = true,
  topbarVariant = "default",
  shellClassName = "",
  extraHead = "",
  extraScripts = "",
}) {
  const shellClasses = ["page-shell"];
  if (!showSidebar && !showToc) {
    shellClasses.push("page-shell--single");
  }
  if (shellClassName) {
    shellClasses.push(shellClassName);
  }
  const renderedExtraHead = extraHead ? `\n    ${extraHead}` : "";
  const renderedExtraScripts = extraScripts ? `\n    ${extraScripts}` : "";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)} | System Design Course</title>
    <meta
      name="description"
      content="A structured system design course with hyperlinks, lesson navigation, and interactive labs."
    />
    <link rel="icon" href="assets/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="assets/style.css" />${renderedExtraHead}
  </head>
  <body class="${bodyClass}">
    <div class="ambient ambient-one"></div>
    <div class="ambient ambient-two"></div>
    ${renderTopbar(currentSlug, topbarVariant)}
    <div class="${shellClasses.join(" ")}">
      ${showSidebar ? renderSidebar(lessons, currentSlug) : ""}
      <main class="main-content">
        ${content}
      </main>
      ${showToc ? renderToc(toc) : ""}
    </div>
    <script src="assets/app.js"></script>${renderedExtraScripts}
  </body>
</html>`;
}

function renderPager(lessons, lessonIndex) {
  const previous = lessonIndex > 0 ? lessons[lessonIndex - 1] : null;
  const next = lessonIndex < lessons.length - 1 ? lessons[lessonIndex + 1] : null;

  return `
    <nav class="lesson-pager" aria-label="Lesson navigation">
      ${
        previous
          ? `<a class="pager-card" href="${previous.slug}.html"><span>Previous</span><strong>${escapeHtml(
              previous.title,
            )}</strong></a>`
          : `<span class="pager-card is-empty"><span>Previous</span><strong>Course Start</strong></span>`
      }
      ${
        next
          ? `<a class="pager-card" href="${next.slug}.html"><span>Next</span><strong>${escapeHtml(
              next.title,
            )}</strong></a>`
          : `<span class="pager-card is-empty"><span>Next</span><strong>Final Lesson</strong></span>`
      }
    </nav>
  `;
}

function renderGoalList(goals) {
  return `<ul class="framed-list">${goals.map((goal) => `<li>${renderLinkedInline(goal)}</li>`).join("")}</ul>`;
}

function renderTakeawayList(items) {
  return `<ul class="takeaway-list">${items
    .map((item) => `<li><strong>Remember:</strong> ${renderLinkedInline(item)}</li>`)
    .join("")}</ul>`;
}

function renderCourseMap(currentSlug) {
  const current = getLessonMeta(currentSlug);
  const nodes = lessons
    .map((lesson, index) => {
      const meta = getLessonMeta(lesson.slug);
      const active = lesson.slug === currentSlug ? " is-current" : "";
      return `
        <button
          class="map-node${active}"
          type="button"
          data-map-node
          data-map-title="${escapeHtml(shortTitle(lesson.title))}"
          data-map-stage="${escapeHtml(meta.stage)}"
          data-map-summary="${escapeHtml(meta.teaser || lesson.summary)}"
        >
          <span class="map-node-index">${String(index).padStart(2, "0")}</span>
          <span class="map-node-label">${escapeHtml(shortTitle(lesson.title))}</span>
        </button>
      `;
    })
    .join("");

  return `
    <section class="course-map-panel" id="course-map">
      <div class="section-heading">
        <p class="eyebrow">Mind Map</p>
        <h2>Where We Are In The Story</h2>
        <p>Click a node to see what that chapter adds to the picture.</p>
      </div>
      <div class="course-map-shell" data-course-map>
        <div class="course-map-track">
          ${nodes}
        </div>
        <div class="map-detail" data-map-detail>
          <p class="panel-label" data-map-detail-stage>${escapeHtml(current.stage)}</p>
          <h3 data-map-detail-title>${escapeHtml(shortTitle(lessons.find((lesson) => lesson.slug === currentSlug)?.title ?? currentSlug))}</h3>
          <p data-map-detail-summary>${escapeHtml(current.teaser)}</p>
        </div>
      </div>
    </section>
  `;
}

function renderChapterFrame(lesson) {
  const meta = getLessonMeta(lesson.slug);
  return `
    <section class="chapter-frame" id="chapter-frame">
      <div class="section-heading">
        <p class="eyebrow">${escapeHtml(meta.stage)}</p>
        <h2>This Chapter In The Story</h2>
        <p>${renderLinkedInline(meta.teaser)}</p>
      </div>
      <div class="chapter-frame-grid">
        <article class="frame-card">
          <p class="panel-label">Why This Chapter</p>
          <p>${renderLinkedInline(meta.why)}</p>
        </article>
        <article class="frame-card">
          <p class="panel-label">Where We Are</p>
          <p>${renderLinkedInline(meta.where)}</p>
        </article>
        <article class="frame-card">
          <p class="panel-label">How It Fits</p>
          <p>${renderLinkedInline(meta.fit)}</p>
        </article>
        <article class="frame-card">
          <p class="panel-label">Goals</p>
          ${renderGoalList(meta.goals)}
        </article>
      </div>
    </section>
  `;
}

function renderDiagramGuide(meta) {
  if (!meta.visualGuide?.length) {
    return "";
  }

  return `
    <div class="diagram-guide" aria-label="How to use this panel">
      <p class="panel-label">${escapeHtml(meta.visualGuideTitle || "How To Use This Panel")}</p>
      <ol class="diagram-guide-list">
        ${meta.visualGuide.map((step) => `<li>${renderLinkedInline(step)}</li>`).join("")}
      </ol>
      ${
        meta.visualGuideNote
          ? `<p class="diagram-guide-note">${renderLinkedInline(meta.visualGuideNote)}</p>`
          : ""
      }
    </div>
  `;
}

function renderChapterIntuition(lesson) {
  const meta = getLessonMeta(lesson.slug);
  return `
    <section class="section-block chapter-intuition" id="chapter-intuition">
      <div class="section-heading">
        <p class="eyebrow">After Reading</p>
        <h2>Now See The Concept Move</h2>
        <p>You have the chapter vocabulary now. Use this as a moving picture, not a mini simulator. The chapter diagram teaches the concept; the Arena is where you will make and break systems.</p>
      </div>
      <section class="diagram-panel" id="chapter-diagram">
        <div class="section-heading">
          <p class="eyebrow">Animated Concept Diagram</p>
          <h2>${escapeHtml(meta.visualTitle)}</h2>
          <p>${renderLinkedInline(meta.visualPrompt)}</p>
        </div>
        <div class="chapter-visual-shell" data-concept-diagram="${lesson.slug}"></div>
        <p class="concept-lab-note">
          Want to test the physics by changing load, shape, scale, and failure? Use the
          <a href="arena.html">Practice Arena</a>. Chapters stay focused on concept clarity.
        </p>
      </section>
      ${renderCourseMap(lesson.slug)}
    </section>
  `;
}

function renderStartLessonPractice() {
  return `
    <section class="section-block start-practice" id="practice-the-lens">
      <div class="section-heading">
        <p class="eyebrow">After Reading</p>
        <h2>Practice The Lens</h2>
        <p>Choose the statement that sounds more like the way this course wants you to reason. The point is not fancy wording. The point is whether the answer starts from pressure and explanation instead of component name-dropping.</p>
      </div>
      <div data-start-lens-root></div>
    </section>
  `;
}

function renderKeyLearnings(lesson) {
  const meta = getLessonMeta(lesson.slug);
  return `
    <section class="chapter-summary" id="key-learnings">
      <div class="section-heading">
        <p class="eyebrow">Before You Move On</p>
        <h2>Key Learnings</h2>
        <p>These are the ideas that should stay in your head after you finish the chapter.</p>
      </div>
      ${renderTakeawayList(meta.takeaways)}
    </section>
  `;
}

function renderLessonPage(lesson, lessonIndex, parsed) {
  const meta = getLessonMeta(lesson.slug);
  const isStartLesson = lesson.slug === "00-study-method";
  const coachTocLabel = isStartLesson ? "Questions Before Lesson 01" : "Chapter Coach";
  const toc = compressLessonToc([
    ...(!isStartLesson
      ? [
          { level: 2, text: "This Chapter In The Story", id: "chapter-frame" },
        ]
      : []),
    ...parsed.toc,
    ...(!isStartLesson
      ? [
          { level: 2, text: "Now See The Concept Move", id: "chapter-intuition" },
          { level: 2, text: "Animated Concept Diagram", id: "chapter-diagram" },
          { level: 2, text: "Where We Are In The Story", id: "course-map" },
        ]
      : []),
    ...(isStartLesson ? [{ level: 2, text: "Practice The Lens", id: "practice-the-lens" }] : []),
    { level: 2, text: "Key Learnings", id: "key-learnings" },
    { level: 2, text: "Lesson Check", id: "lesson-check" },
    { level: 2, text: coachTocLabel, id: "chapter-coach" },
  ]);
  const coachEyebrow = isStartLesson ? "Questions Before Lesson 01" : "Chapter Coach";
  const coachTitle = isStartLesson ? "Ask About The Course Approach" : "Ask Questions And Prove The Chapter";
  const coachIntro = isStartLesson
    ? "Use the left panel to ask about why this course starts the way it does. The right panel explains what changes once lesson 01 begins."
    : "Use the left panel to clear doubts about this chapter in plain language. Use the right panel after the lesson check to keep answering chapter-specific probes until the main understanding is stable.";
  const coachBody = isStartLesson
    ? `
      <div class="chapter-coach-grid">
        <div data-chapter-doubt-chat="${lesson.slug}"></div>
        <article class="result-card coach-panel coach-panel--orientation">
          <p class="panel-label">What Starts In Lesson 01</p>
          <div class="coach-panel-intro">
            <div class="coach-card-title">Chapter-specific practice begins after the first real lesson check</div>
            <p class="result-copy">Lesson 00 is here to set the lens. The course starts checking chapter mastery after lesson 01 and its quiz, once you have actual chapter content to reason about.</p>
          </div>
        </article>
      </div>
    `
    : `
      <div class="chapter-coach-grid">
        <div data-chapter-doubt-chat="${lesson.slug}"></div>
        <div data-chapter-mastery="${lesson.slug}"></div>
      </div>
    `;
  const content = `
    <section class="hero hero-lesson">
      ${isStartLesson ? "" : `<p class="eyebrow">${escapeHtml(meta.stage)}</p>`}
      <h1>${escapeHtml(lesson.title)}</h1>
      <p class="hero-copy">${renderLinkedInline(meta.teaser || lesson.summary)}</p>
      <div class="hero-actions">
        <a class="button button-primary" href="labs.html">Practice This In Labs</a>
        <a class="button button-secondary" href="index.html">Back To Overview</a>
      </div>
    </section>
    ${renderPager(lessons, lessonIndex)}
    ${isStartLesson ? "" : renderChapterFrame(lesson)}
    <article class="prose">
      ${linkGlossaryTermsInHtml(parsed.html)}
    </article>
    ${isStartLesson ? renderStartLessonPractice() : ""}
    ${isStartLesson ? "" : renderChapterIntuition(lesson)}
    ${renderKeyLearnings(lesson)}
    <section class="quiz-panel" id="lesson-check" data-lesson-quiz="${lesson.slug}">
      <div class="section-heading">
        <p class="eyebrow">Lesson Check</p>
        <h2>Interactive Quiz</h2>
        <p>Answer these before moving on. The goal is explanation-grade understanding, not lucky guesses.</p>
      </div>
      <div class="quiz-root"></div>
    </section>
    <section class="section-block chapter-coach-block" id="chapter-coach">
      <div class="section-heading">
        <p class="eyebrow">${escapeHtml(coachEyebrow)}</p>
        <h2>${escapeHtml(coachTitle)}</h2>
        <p>${renderLinkedInline(coachIntro)}</p>
      </div>
      ${coachBody}
    </section>
    ${renderPager(lessons, lessonIndex)}
  `;

  return renderShell({
    title: lesson.title,
    currentSlug: lesson.slug,
    content,
    toc,
    bodyClass: "lesson-body",
    extraHead: isStartLesson ? "" : '<link rel="stylesheet" href="assets/concept-diagrams.css" />',
    extraScripts: isStartLesson ? "" : '<script src="assets/concept-diagrams.js"></script>',
  });
}

function renderIndexPage() {
  const lessonCards = lessons
    .map(
      (lesson, index) => `
        <a class="lesson-card" href="${lesson.slug}.html">
          <span class="lesson-card-index">${String(index).padStart(2, "0")}</span>
          <strong>${escapeHtml(lesson.title)}</strong>
          <p>${escapeHtml(getLessonMeta(lesson.slug).teaser || lesson.summary)}</p>
        </a>
      `,
    )
    .join("");

  const content = `
    <section class="hero hero-home">
      <div class="hero-grid">
        <div>
          <p class="eyebrow">Start Here</p>
          <h1>Build one clear picture of system design, then learn how to speak it under interview pressure.</h1>
          <p class="hero-copy">${renderLinkedInline(
            "The course is designed as a sequence of layers in your head: pressure, data placement, correctness, movement, system shape, hybrid ownership, and finally timed interview fluency.",
          )}</p>
          <div class="hero-actions">
            <a class="button button-primary" href="00-study-method.html">Read Chapter 00</a>
            <a class="button button-ghost" href="#course-path">See The Path</a>
          </div>
          <p class="small-copy home-hero-note">Chapter 00 teaches the study habit. Lesson 01 is the first real checkpoint where the site should start tracking understanding.</p>
        </div>
        <div class="hero-panel">
          <p class="panel-label">What Happens Next</p>
          <ol class="flow-list">
            <li>Read chapter 00 to learn the reasoning habit the rest of the course keeps using.</li>
            <li>Read lesson 01 and finish its quiz. That is the first real checkpoint.</li>
            <li>Only after that do saved progress, follow-up questions, and adaptive practice become useful.</li>
            <li>Keep reading in order so each chapter earns the next one.</li>
          </ol>
        </div>
      </div>
    </section>

    <section class="section-block" id="course-path">
      <div class="section-heading">
        <p class="eyebrow">One Path</p>
        <h2>Follow one study path before you touch the extra tools</h2>
        <p>${renderLinkedInline(
          "This site works best when it feels like one story, not a pile of features. Start with the habit, then earn the first checkpoint, then let support tools appear when they can actually help.",
        )}</p>
      </div>
      <div class="path-grid">
        <article class="path-card">
          <span class="path-card-index">00</span>
          <h3>Learn how this course thinks</h3>
          <p>${renderLinkedInline(
            "Chapter 00 explains why the course begins from the hard pressure in the system instead of from a memorized box diagram.",
          )}</p>
          <a class="button button-secondary" href="00-study-method.html">Open Chapter 00</a>
        </article>
        <article class="path-card">
          <span class="path-card-index">01</span>
          <h3>Make the first hard thing visible</h3>
          <p>${renderLinkedInline(
            "Lesson 01 teaches the first real move: read hidden work, tail pain, fanout, skew, data shape, and query shape before architecture appears.",
          )}</p>
          <a class="button button-secondary" href="01-load-latency-and-data-shape.html">Open Lesson 01</a>
        </article>
        <article class="path-card">
          <span class="path-card-index">02-04</span>
          <h3>Place data, promises, and work honestly</h3>
          <p>${renderLinkedInline(
            "The middle lessons teach storage fit, correctness boundaries, and what must stay on the hot path versus what can move behind it.",
          )}</p>
        </article>
        <article class="path-card">
          <span class="path-card-index">05-08</span>
          <h3>Turn the map into interview speech</h3>
          <p>${renderLinkedInline(
            "Later lessons turn the mental map into openings, archetypes, hybrids, drills, and final timed practice.",
          )}</p>
        </article>
      </div>
    </section>

    <section class="section-block personalization-block" id="personal-coach">
      <div class="section-heading">
        <p class="eyebrow">Continue Your Path</p>
        <h2>Save your place and pick up support after the first checkpoint</h2>
        <p>${renderLinkedInline(
          "Use a reader profile when you want the site to remember your place. After lesson 01 and its quiz, this area will start showing saved progress, the next useful question, and chapter-linked support.",
        )}</p>
      </div>
      <div data-personalization-home></div>
    </section>

    <section class="section-block" id="course-lessons">
      <div class="section-heading">
        <p class="eyebrow">Read In Order</p>
        <h2>The full course still reads in order</h2>
        <p>${renderLinkedInline(
          "Use the first two chapters as your starting lane, then keep moving in sequence. The later chapters depend on the earlier mental picture being stable.",
        )}</p>
      </div>
      <div class="lesson-grid">${lessonCards}</div>
    </section>

    <section class="section-block" id="study-tools">
      <div class="section-heading">
        <p class="eyebrow">Study Tools</p>
        <h2>Use support when the story needs help, not before</h2>
        <p>${renderLinkedInline(
          "These tools are here to stabilize understanding after you have started, not to replace the reading path. Use them when a chapter needs another angle or when you want deliberate practice.",
        )}</p>
      </div>
      <div class="lesson-grid">
      <div class="feature-card">
        <p class="eyebrow">Interactive</p>
        <h2>Intuition Labs</h2>
        <p>${renderLinkedInline(
          "Build intuition with live exercises around system pressure, guarantees, and hot-path decisions once the chapter idea already exists in your head.",
        )}</p>
        <a class="button button-secondary" href="labs.html">Go To Labs</a>
      </div>
      <div class="feature-card">
        <p class="eyebrow">Reference</p>
        <h2>Contextual Glossary</h2>
        <p>${renderLinkedInline(
          "Use the glossary when a course word still feels slippery. It is there to recover meaning, not to become the main learning path.",
        )}</p>
        <a class="button button-secondary" href="glossary.html">Open Glossary</a>
      </div>
      <div class="feature-card">
        <p class="eyebrow">Adaptive</p>
        <h2>Practice Arena</h2>
        <p>${renderLinkedInline(
          "The arena is the mental gym for later repetition and pressure. It becomes useful after lesson 01 has given the first stable idea something real to practice.",
        )}</p>
        <a class="button button-secondary" href="arena.html">Open Arena</a>
      </div>
      </div>
    </section>
  `;

  return renderShell({
    title: "Course Home",
    currentSlug: "home",
    content,
    bodyClass: "home-body",
    showSidebar: false,
    showToc: false,
    topbarVariant: "home",
    shellClassName: "page-shell--home",
  });
}

function renderGlossaryPage() {
  const groups = glossaryGroups.map((group) => ({
    ...group,
    entries: glossaryEntries
      .filter((entry) => entry.group === group.id)
      .sort((left, right) => left.term.localeCompare(right.term)),
  }));

  const indexLinks = glossaryEntries
    .slice()
    .sort((left, right) => left.term.localeCompare(right.term))
    .map(
      (entry) =>
        `<a class="glossary-chip" href="#${entry.id}" title="${escapeHtml(entry.summary)}">${escapeHtml(entry.term)}</a>`,
    )
    .join("");

  const groupSections = groups
    .map(
      (group) => `
        <section class="section-block glossary-group" id="group-${group.id}">
          <div class="section-heading">
            <p class="eyebrow">Glossary</p>
            <h2>${escapeHtml(group.label)}</h2>
            <p>${renderLinkedInline(group.summary)}</p>
          </div>
          <div class="glossary-grid">
            ${group.entries
              .map((entry) => {
                const parsedDefinition = parseMarkdown(entry.body);
                return `
                  <article class="glossary-entry" id="${entry.id}">
                    <p class="panel-label">${escapeHtml(group.label)}</p>
                    <h3>${escapeHtml(entry.term)}</h3>
                    <p class="glossary-summary">${renderLinkedInline(entry.summary, entry.id)}</p>
                    <div class="prose glossary-definition">
                      ${linkGlossaryTermsInHtml(parsedDefinition.html, entry.id)}
                    </div>
                  </article>
                `;
              })
              .join("")}
          </div>
        </section>
      `,
    )
    .join("");

  const content = `
    <section class="hero hero-lesson">
      <p class="eyebrow">Contextual Definitions</p>
      <h1>Glossary</h1>
      <p class="hero-copy">${renderLinkedInline(
        "Terms with course-specific meaning are linked throughout the lessons. Use this page whenever you want the local meaning of pressure, guarantees, LGTC, archetype, hybrid, or related ideas.",
      )}</p>
      <div class="hero-actions">
        <a class="button button-primary" href="00-study-method.html">Back To Start</a>
        <a class="button button-secondary" href="labs.html">Open Labs</a>
      </div>
    </section>

    <section class="section-block" id="glossary-index">
      <div class="section-heading">
        <p class="eyebrow">Jump To A Term</p>
        <h2>Glossary Index</h2>
        <p>${renderLinkedInline(
          "Definitions cross-link to related terms, so you can keep following the local meaning without breaking the flow of the course.",
        )}</p>
      </div>
      <div class="glossary-chip-list">${indexLinks}</div>
    </section>

    ${groupSections}
  `;

  return renderShell({
    title: "Glossary",
    currentSlug: "glossary",
    content,
    toc: glossaryGroups.map((group) => ({
      level: 2,
      text: group.label,
      id: `group-${group.id}`,
    })),
    bodyClass: "glossary-body",
  });
}

function renderLabsPage() {
  const content = `
    <section class="hero hero-labs">
      <p class="eyebrow">Interactive Practice</p>
      <h1>Use live drills to strengthen the mental picture you are building, not just your recall.</h1>
      <p class="hero-copy">
        These labs sit beside the lessons. They help you feel dominant stress, see the consequences of
        guarantees, and separate hot-path work from deferred work.
      </p>
      <div class="hero-actions">
        <a class="button button-primary" href="#stress-mapper">Open Stress Mapper</a>
        <a class="button button-secondary" href="00-study-method.html">Back To Lessons</a>
      </div>
    </section>

    <section class="lab-section" id="stress-mapper">
      <div class="section-heading">
        <p class="eyebrow">Lab 01</p>
        <h2>Archetype Stress Mapper</h2>
        <p>Move the system pressures and watch which archetype becomes dominant.</p>
      </div>
      <div class="lab-grid">
        <form class="control-card" id="stress-form">
          <label>
            <span>Fanout pressure</span>
            <input type="range" min="0" max="4" value="2" name="fanout" data-live-value="fanout-value" />
            <strong id="fanout-value">2</strong>
          </label>
          <label>
            <span>Blob and media weight</span>
            <input type="range" min="0" max="4" value="1" name="blob" data-live-value="blob-value" />
            <strong id="blob-value">1</strong>
          </label>
          <label>
            <span>Correctness criticality</span>
            <input type="range" min="0" max="4" value="3" name="correctness" data-live-value="correctness-value" />
            <strong id="correctness-value">3</strong>
          </label>
          <label>
            <span>Concurrent shared editing</span>
            <input type="range" min="0" max="4" value="0" name="concurrency" data-live-value="concurrency-value" />
            <strong id="concurrency-value">0</strong>
          </label>
          <label>
            <span>Search and ranking pressure</span>
            <input type="range" min="0" max="4" value="1" name="search" data-live-value="search-value" />
            <strong id="search-value">1</strong>
          </label>
          <label>
            <span>Ingestion and analytics volume</span>
            <input type="range" min="0" max="4" value="1" name="ingestion" data-live-value="ingestion-value" />
            <strong id="ingestion-value">1</strong>
          </label>
          <label>
            <span>Geo-matching urgency</span>
            <input type="range" min="0" max="4" value="0" name="geo" data-live-value="geo-value" />
            <strong id="geo-value">0</strong>
          </label>
          <label>
            <span>Latency sensitivity</span>
            <input type="range" min="0" max="4" value="3" name="latency" data-live-value="latency-value" />
            <strong id="latency-value">3</strong>
          </label>
        </form>
        <div class="result-card">
          <p class="panel-label">Likely Archetype</p>
          <div id="stress-primary" class="result-headline"></div>
          <p id="stress-explanation" class="result-copy"></p>
          <div id="stress-bars" class="bar-stack"></div>
        </div>
      </div>
    </section>

    <section class="lab-section" id="guarantee-builder">
      <div class="section-heading">
        <p class="eyebrow">Lab 02</p>
        <h2>Guarantee Builder</h2>
        <p>Pick the guarantees and see which design consequences become mandatory.</p>
      </div>
      <div class="lab-grid">
        <form class="control-card" id="guarantee-form">
          <label>
            <span>Consistency requirement</span>
            <select name="consistency">
              <option value="eventual">Eventual is fine</option>
              <option value="bounded">Bounded staleness</option>
              <option value="strong" selected>Strong consistency on core state</option>
            </select>
          </label>
          <label>
            <span>Ordering requirement</span>
            <select name="ordering">
              <option value="none">No ordering</option>
              <option value="per-key" selected>Per-key ordering</option>
              <option value="causal">Causal ordering</option>
              <option value="total">Total ordering</option>
            </select>
          </label>
          <label>
            <span>Will clients or workers retry?</span>
            <select name="retries">
              <option value="yes" selected>Yes, retries happen</option>
              <option value="no">No meaningful retry path</option>
            </select>
          </label>
          <label>
            <span>Money / trust / legal risk</span>
            <select name="risk">
              <option value="low">Low</option>
              <option value="medium" selected>Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label>
            <span>Async side effects after commit</span>
            <select name="sideEffects">
              <option value="yes" selected>Yes</option>
              <option value="no">No</option>
            </select>
          </label>
        </form>
        <div class="result-card">
          <p class="panel-label">Design Consequences</p>
          <div id="guarantee-family" class="result-headline"></div>
          <p id="guarantee-summary" class="result-copy"></p>
          <ul id="guarantee-actions" class="insight-list"></ul>
        </div>
      </div>
    </section>

    <section class="lab-section" id="critical-path-studio">
      <div class="section-heading">
        <p class="eyebrow">Lab 03</p>
        <h2>Critical Path Studio</h2>
        <p>Classify work as synchronous or asynchronous, then check the reasoning.</p>
      </div>
      <div class="control-strip">
        <label class="select-inline">
          <span>Scenario</span>
          <select id="path-system">
            <option value="stripe">Stripe payments</option>
            <option value="youtube">YouTube upload</option>
            <option value="whatsapp">WhatsApp messaging</option>
            <option value="airbnb">Airbnb booking</option>
          </select>
        </label>
        <button class="button button-secondary" type="button" id="path-check">Check Answers</button>
        <button class="button button-ghost" type="button" id="path-reset">Reset</button>
      </div>
      <div class="result-card scenario-card">
        <p class="panel-label">Scenario framing</p>
        <div id="path-description" class="result-copy"></div>
      </div>
      <div id="path-tasks" class="task-grid"></div>
      <div class="result-card" id="path-score-card">
        <p class="panel-label">Result</p>
        <div id="path-score" class="result-headline">Pick a classification for each task.</div>
        <p id="path-feedback" class="result-copy">
          The goal is not to memorize. It is to justify why a task must be in or out of the user-facing path.
        </p>
      </div>
    </section>
  `;

  return renderShell({
    title: "Interactive Labs",
    currentSlug: "labs",
    content,
    toc: [
      { level: 2, text: "Archetype Stress Mapper", id: "stress-mapper" },
      { level: 2, text: "Guarantee Builder", id: "guarantee-builder" },
      { level: 2, text: "Critical Path Studio", id: "critical-path-studio" },
    ],
    bodyClass: "labs-body",
  });
}

function renderArenaPage() {
  const phaseCards = [
    {
      eyebrow: "Phase 01",
      title: "Settle The Idea",
      copy:
        "Start with one clean answer in spoken interview language. The arena should not add more pressure until the core idea is actually stable.",
    },
    {
      eyebrow: "Phase 02",
      title: "Move The Idea",
      copy:
        "The same idea is pushed into a different system or path so the learner proves transfer instead of replaying one remembered example.",
    },
    {
      eyebrow: "Phase 03",
      title: "Add Pressure",
      copy:
        "A real constraint appears: failure, skew, latency pain, or a tradeoff that forces a sharper answer than the calm version.",
    },
    {
      eyebrow: "Phase 04",
      title: "Hold The Line",
      copy:
        "The arena sounds like an interviewer now. The learner has to defend the choice, represent the strongest alternative, or name what breaks first.",
    },
  ];

  const content = `
    <section class="hero hero-labs">
      <p class="eyebrow">Final Practice Arena</p>
      <h1>Train the course until the reasoning chain still holds after transfer, pressure, and interviewer pushback.</h1>
      <p class="hero-copy">
        The arena is the mental gym for this course. It starts from the weakest useful layer for the active reader,
        forces one clean answer, then raises the heat only after that answer earns it.
      </p>
      <div class="hero-actions">
        <a class="button button-primary" href="#arena-live">Open The Arena</a>
        <a class="button button-secondary" href="08-drill-order-and-mock-interview-prep.html">Back To Chapter 08</a>
      </div>
    </section>

    <section class="section-block" id="arena-sets">
      <div class="section-heading">
        <p class="eyebrow">How A Set Works</p>
        <h2>Each arena set raises heat in four steps</h2>
        <p>${renderLinkedInline(
          "The arena follows the same teacher rhythm as the course itself: understand first, transfer second, pressure-test third, and defend the answer last.",
        )}</p>
      </div>
      <div class="chapter-frame-grid">
        ${phaseCards
          .map(
            (card) => `
              <article class="frame-card">
                <p class="panel-label">${escapeHtml(card.eyebrow)}</p>
                <h3>${escapeHtml(card.title)}</h3>
                <p>${renderLinkedInline(card.copy)}</p>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>

    <section class="section-block" id="arena-case-files">
      <div class="section-heading">
        <p class="eyebrow">Production Case Files</p>
        <h2>Use company writeups as decision simulations, not passive reading</h2>
        <p>${renderLinkedInline(
          "The arena can anchor later rounds in real engineering stories. Try to answer from the course lens first, then open the cited source and compare your reasoning with what the team actually faced.",
        )}</p>
      </div>
      <div class="chapter-frame-grid">
        <article class="frame-card">
          <p class="panel-label">Storage And Hotspots</p>
          <h3>Discord Message Storage</h3>
          <p>${renderLinkedInline(
            "Use this when practicing hot partitions, message-history shape, migration pressure, and shielding storage from repeated hot reads.",
          )}</p>
          <a class="sidebar-link" href="https://discord.com/blog/how-discord-stores-trillions-of-messages">Open source</a>
        </article>
        <article class="frame-card">
          <p class="panel-label">Rollout And Overload</p>
          <h3>Cloudflare WAF Outage</h3>
          <p>${renderLinkedInline(
            "Use this when practicing CPU pressure, global rollout safety, rollback access, and operational failure modes.",
          )}</p>
          <a class="sidebar-link" href="https://blog.cloudflare.com/details-of-the-cloudflare-outage-on-july-2-2019/">Open source</a>
        </article>
        <article class="frame-card">
          <p class="panel-label">Integrity And Recovery</p>
          <h3>GitHub 2018 Incident</h3>
          <p>${renderLinkedInline(
            "Use this when practicing data integrity, failover topology, stale replicas, backlog recovery, and LGTC extraction from a postmortem.",
          )}</p>
          <a class="sidebar-link" href="https://github.blog/news-insights/company-news/oct21-post-incident-analysis/">Open source</a>
        </article>
        <article class="frame-card">
          <p class="panel-label">Retries</p>
          <h3>Stripe Idempotency</h3>
          <p>${renderLinkedInline(
            "Use this when practicing retry-safe business effects, idempotency keys, and transactional archetype language.",
          )}</p>
          <a class="sidebar-link" href="https://docs.stripe.com/api/idempotent_requests">Open source</a>
        </article>
      </div>
    </section>

    <section class="section-block" id="arena-live">
      <div class="section-heading">
        <p class="eyebrow">Live Arena</p>
        <h2>Run adaptive circuits on the ideas you have already studied</h2>
        <p>${renderLinkedInline(
          "Sign in to a reader profile, then start a set. The arena tracks what has been cleared, what still breaks, and when to step back instead of pretending the answer is solid.",
        )}</p>
      </div>
      <div data-practice-arena></div>
    </section>

    <section class="section-block two-up" id="arena-rhythm">
      <div class="feature-card">
        <p class="eyebrow">Use It Well</p>
        <h2>One useful rhythm</h2>
        <ul>
          <li>Read a chapter and finish its lesson check.</li>
          <li>Use chapter mastery when one chapter still feels unstable.</li>
          <li>Use the arena when you want repeated transfer and pressure across the course.</li>
        </ul>
      </div>
      <div class="feature-card">
        <p class="eyebrow">What The Arena Tracks</p>
        <h2>Progress that matters</h2>
        <p>${renderLinkedInline(
          "The arena is not counting activity for its own sake. It tracks whether a reader can keep the right idea stable while the situation changes and the interviewer starts pushing back.",
        )}</p>
      </div>
    </section>
  `;

  return renderShell({
    title: "Practice Arena",
    currentSlug: "arena",
    content,
    toc: [
      { level: 2, text: "How A Set Works", id: "arena-sets" },
      { level: 2, text: "Production Case Files", id: "arena-case-files" },
      { level: 2, text: "Live Arena", id: "arena-live" },
      { level: 2, text: "Use It Well", id: "arena-rhythm" },
    ],
    bodyClass: "arena-body",
  });
}

const lessonFiles = (await fs.readdir(courseDir))
  .filter((file) => file.endsWith(".md"))
  .sort();

const lessons = [];
for (const [index, file] of lessonFiles.entries()) {
  const slug = file.replace(/\.md$/, "");
  const markdown = await fs.readFile(path.join(courseDir, file), "utf8");
  lessons.push({
    index,
    file,
    slug,
    title: extractTitle(markdown),
    summary: extractSummary(markdown),
    markdown,
  });
}

await fs.mkdir(assetsDir, { recursive: true });
if (process.env.SKIP_ASSET_COPY !== "1") {
  await fs.copyFile(path.join(webDir, "style.css"), path.join(assetsDir, "style.css"));
  await fs.copyFile(path.join(webDir, "app.js"), path.join(assetsDir, "app.js"));
  await fs.copyFile(path.join(webDir, "concept-diagrams.css"), path.join(assetsDir, "concept-diagrams.css"));
  await fs.copyFile(path.join(webDir, "concept-diagrams.js"), path.join(assetsDir, "concept-diagrams.js"));
  await fs.copyFile(path.join(webDir, "favicon.svg"), path.join(assetsDir, "favicon.svg"));
}

await fs.writeFile(path.join(siteDir, "index.html"), stripTrailingWhitespace(renderIndexPage()), "utf8");
await fs.writeFile(path.join(siteDir, "labs.html"), stripTrailingWhitespace(renderLabsPage()), "utf8");
await fs.writeFile(path.join(siteDir, "glossary.html"), stripTrailingWhitespace(renderGlossaryPage()), "utf8");
await fs.writeFile(path.join(siteDir, "arena.html"), stripTrailingWhitespace(renderArenaPage()), "utf8");

for (const lesson of lessons) {
  const parsed = parseMarkdown(lesson.markdown);
  const page = renderLessonPage(lesson, lesson.index, parsed);
  await fs.writeFile(path.join(siteDir, `${lesson.slug}.html`), stripTrailingWhitespace(page), "utf8");
}

console.log(`Built ${lessons.length + 4} pages into ${siteDir}`);
