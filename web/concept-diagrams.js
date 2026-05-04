(() => {
  const diagrams = {
    "01-load-latency-and-data-shape": {
      theme: "pressure",
      label: "Pressure Physics",
      headline: "One visible action is not one unit of work.",
      copy:
        "Follow a product action into hidden backend work, then into the place where pain becomes visible.",
      nodes: [
        ["Visible action", "One person sends a message."],
        ["Hidden work", "Delivery, unread state, notifications, and live readers expand the work."],
        ["Concentrated pressure", "A hot channel or group takes more pain than the average path shows."],
        ["User pain", "The latest message path becomes slow first."],
      ],
      takeaway:
        "Interview sentence: name the pressure and the first failure risk before naming components.",
    },
    "02-storage-partitioning-and-replication": {
      theme: "storage",
      label: "Storage Physics",
      headline: "One product can contain several storage problems.",
      copy:
        "The stored thing, read pattern, write pattern, and history need separate attention before a storage family can be defended.",
      nodes: [
        ["Product surface", "A video app looks like one product."],
        ["Data shapes", "Blob bytes, metadata, search text, graph links, and event history split apart."],
        ["Access shapes", "Point lookup, range read, traversal, search, and aggregation pull differently."],
        ["Placement choice", "Partitioning and replication follow the shape instead of the brand name."],
      ],
      takeaway:
        "Interview sentence: I would split the data shapes first, then choose storage and partitioning per path.",
    },
    "03-consistency-ordering-idempotency-and-transactions": {
      theme: "promise",
      label: "Promise Physics",
      headline: "Guarantee words only matter after the protected boundary is clear.",
      copy:
        "Correctness starts with product risk. The mechanism should be scoped to the smallest state boundary that owns that risk.",
      nodes: [
        ["Product risk", "Two users might claim the same scarce thing."],
        ["Protected state", "The exact record or invariant that cannot be wrong is named."],
        ["Required guarantee", "Freshness, ordering, idempotency, or transaction scope is chosen for that boundary."],
        ["Safe retry", "Repeated attempts preserve the same outcome instead of creating duplicates."],
      ],
      takeaway:
        "Interview sentence: I only want the stronger guarantee around the state whose wrongness breaks the product.",
    },
    "04-async-caching-failure-handling-and-operability": {
      theme: "runtime",
      label: "Runtime Physics",
      headline: "The response boundary decides what can safely wait.",
      copy:
        "Queues, caches, retries, degradation, and observability make sense only after the system states what the user response promises.",
      nodes: [
        ["Request arrives", "A user action asks the system to make a promise."],
        ["Truth boundary", "Only the work needed to make that promise belongs before the response."],
        ["Deferred work", "Processing, fanout, indexing, and notifications may lag with explicit ownership."],
        ["Operational signal", "Lag, retry age, freshness, and degradation tell you whether the promise is bending."],
      ],
      takeaway:
        "Interview sentence: async moves work in time; it does not delete the obligation to track and recover it.",
    },
    "05-the-interview-framework-7-plus-1-and-lgtc": {
      theme: "framework",
      label: "Opening Physics",
      headline: "Extract facts before drawing boxes.",
      copy:
        "The opening minutes should turn a vague design ask into pressure, guarantees, topology, constraints, and data/query shape.",
      nodes: [
        ["Design ask", "The interviewer gives a product-shaped problem."],
        ["7 questions", "Universal opening questions extract load, guarantees, topology, and constraints."],
        ["+1 bridge", "Data/query shape becomes heavy only when it changes the design."],
        ["LGTC summary", "The answer compresses what matters before components appear."],
      ],
      takeaway:
        "Interview sentence: I will first clarify the design forces, then choose the architecture that answers them.",
    },
    "06-archetypes-and-component-maps": {
      theme: "archetype",
      label: "Recognition Physics",
      headline: "An archetype is earned by stress, not by product name.",
      copy:
        "Component maps are useful only after the dominant stress explains why that map fits this design ask.",
      nodes: [
        ["Product name", "Slack, Uber, YouTube, or Stripe is still too broad."],
        ["Dominant stress", "Messaging, dispatch, blob serving, payment correctness, or search pressure becomes visible."],
        ["Archetype", "The system shape is justified by that stress."],
        ["Component reason", "Every box is tied to a pressure, guarantee, tradeoff, or first failure."],
      ],
      takeaway:
        "Interview sentence: this looks like this archetype because this path is dominated by this stress.",
    },
    "07-hybrid-systems-and-guided-walkthroughs": {
      theme: "hybrid",
      label: "Composition Physics",
      headline: "Hybrid systems split when paths stop sharing the same pain.",
      copy:
        "A real product earns multiple owners only when different paths have different stresses, tradeoffs, or first failures.",
      nodes: [
        ["Whole product", "One product name hides several user journeys."],
        ["Path split", "Write, read, search, media, analytics, and notification paths separate."],
        ["Owner per path", "Each meaningful path gets the archetype that explains its pressure."],
        ["Walkthrough", "The final answer follows request paths instead of dumping a component list."],
      ],
      takeaway:
        "Interview sentence: I would split the product by path because each path fails for a different reason.",
    },
    "08-drill-order-and-mock-interview-prep": {
      theme: "practice",
      label: "Practice Physics",
      headline: "Practice should overload the next weak habit, not everything at once.",
      copy:
        "Full mocks expose misses, but repair usually happens by stepping back to the earliest broken layer.",
      nodes: [
        ["Concept", "Say the idea plainly."],
        ["Opening", "Use it in the first two minutes."],
        ["Archetype", "Recognize the system shape with reasons."],
        ["Mock pressure", "Add timer, interruption, and failure only after earlier habits hold."],
      ],
      takeaway:
        "Interview sentence: when an answer breaks, step back to the earliest habit that was not automatic.",
    },
  };

  function escapeHtml(value) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function renderNode([title, body], index, count) {
    const delay = `${index * 0.42}s`;
    return `
      <article class="concept-node" style="--node-delay:${delay}">
        <span>${String(index + 1).padStart(2, "0")}</span>
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(body)}</p>
      </article>
      ${
        index < count - 1
          ? `<div class="concept-link" aria-hidden="true" style="--node-delay:${delay}"><span></span></div>`
          : ""
      }
    `;
  }

  function renderDiagram(root) {
    const diagram = diagrams[root.dataset.conceptDiagram];
    if (!diagram) return;

    root.innerHTML = `
      <section class="concept-diagram concept-diagram--${escapeHtml(diagram.theme)}" aria-label="${escapeHtml(diagram.label)}">
        <div class="concept-diagram__intro">
          <p class="panel-label">${escapeHtml(diagram.label)}</p>
          <h3>${escapeHtml(diagram.headline)}</h3>
          <p>${escapeHtml(diagram.copy)}</p>
        </div>
        <div class="concept-flow" style="--node-count:${diagram.nodes.length}">
          ${diagram.nodes.map((node, index) => renderNode(node, index, diagram.nodes.length)).join("")}
        </div>
        <div class="concept-takeaway">
          <span>Carry Forward</span>
          <p>${escapeHtml(diagram.takeaway)}</p>
        </div>
      </section>
    `;
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-concept-diagram]").forEach(renderDiagram);
  });
})();
