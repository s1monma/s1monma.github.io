/* Multilingual Overlapping Vocabulary Explorer — Client Application
 *
 * Visualizations & Features:
 *   1. Language Combination & Permutation Selector (G001 to G120 subsets, e.g. KO-JA, CJK, FR-ES-EN)
 *   2. Concentric Ring Map (Rings by Overlap Tier: Universal, Exact Cognates, False Friends/Semantic Shift, Language-Specific)
 *   3. Network Graph (Force-directed relationship map by linguistic roots & semantic connections)
 *   4. KO-JA Overlap Spotlight (Highlighting false friends & shared Hanzi between Japanese & Korean)
 *   5. Multilingual Reading & Comparative Definition Inspector
 */

const state = {
  terms: [],
  meta: null,
  clusters: {},
  filtered: [],
  selected: null,
  query: "",
  group: "ko-ja",           // "all" | "ko-ja" | "zh-ja-ko" | "fr-es-en" | "fr-ko-ja-es-ru-en-de" | G001..G120
  filter: "all",           // "all" | "ko_ja" | "shift" | "exact"
  clusterFilter: "all",    // "all" | clusterId
  letter: null,
  view: "list",            // "list" | "cluster" | "network" | "concentric"
  activeLetters: new Set(),
};

const CLUSTER_CONFIG = {
  "cjk_false_friends": {
    name: "KO-JA & CJK False Friends (同形異義)",
    icon: "⚠️",
    color: "#DC2626",
    desc: "Identical written characters with distinct meanings in Korean, Japanese, or Chinese."
  },
  "cjk_exact_overlaps": {
    name: "CJK Cognates & Shared Vocabulary",
    icon: "☯️",
    color: "#059669",
    desc: "Common East Asian terms with near-identical meanings across C, J, K."
  },
  "ko_ja_spotlight": {
    name: "Japanese-Korean Overlaps (韓日同形)",
    icon: "🇰🇷🇯🇵",
    color: "#7C3AED",
    desc: "Terms and modern coinages shared specifically between Japanese and Korean."
  },
  "global_cognates": {
    name: "Global & International Cognates",
    icon: "🌍",
    color: "#0284C7",
    desc: "Loanwords and international terms transparent across Western & Asian languages."
  },
  "abstract_concepts": {
    name: "Abstract & Philosophical Terms",
    icon: "🧠",
    color: "#D97706",
    desc: "Vocabulary representing abstract logic, time, state, and mental processes."
  },
  "daily_commerce": {
    name: "Daily Life, Travel & Commerce",
    icon: "🏢",
    color: "#DB2777",
    desc: "Practical vocabulary for transport, hospitality, exchange, and community."
  }
};

const RING_COLORS = ["#032D60", "#059669", "#DC2626", "#7C3AED"];
const RING_LABELS = [
  "Universal Overlap (All Selected)",
  "Exact Cognates (Shared Root)",
  "False Friends (Semantic Shift)",
  "Language Nuance / Partial"
];
const LETTERS = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z","#"];

const LANG_NAMES = {
  zh: "Chinese (中文)",
  ja: "Japanese (日本語)",
  ko: "Korean (한국어)",
  en: "English",
  fr: "French (Français)",
  es: "Spanish (Español)",
  ru: "Russian (Русский)",
  de: "German (Deutsch)"
};

/* ═══════════════════════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════════════════════ */
function escapeHTML(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function findBySlug(slug) { return state.terms.find(t => t.slug === slug) || null; }
function findByName(name) {
  const n = (name || "").trim().toLowerCase();
  return state.terms.find(t => t.term.toLowerCase().includes(n) || (t.slug && t.slug.includes(n))) || null;
}
function clusterOf(t) { return t.cluster || "cjk_exact_overlaps"; }
function clusterColorOf(t) {
  const c = clusterOf(t);
  return CLUSTER_CONFIG[c]?.color || "#0284C7";
}

/* ═══════════════════════════════════════════════════════════════
   FILTERING LOGIC
   ═══════════════════════════════════════════════════════════════ */
function applyFilters() {
  const q = state.query.trim().toLowerCase();
  state.activeLetters = new Set();
  
  state.filtered = state.terms.filter(t => {
    // 1. Language Permutation / Subset Group Filter
    if (state.group !== "all") {
      const matchGroup = (t.groups || []).includes(state.group);
      const reqLangs = state.group.split("-");
      const matchLangs = reqLangs.every(l => (t.langs || []).includes(l));
      if (!matchGroup && !matchLangs) return false;
    }

    // 2. Type Filter (all, ko_ja, shift, exact)
    if (state.filter === "ko_ja" && !t.ko_ja_overlap) return false;
    if (state.filter === "shift" && t.overlap_type !== "semantic_shift") return false;
    if (state.filter === "exact" && t.overlap_type !== "exact") return false;

    // 3. Cluster Category Filter
    if (state.clusterFilter !== "all" && clusterOf(t) !== state.clusterFilter) return false;

    // 4. Search Query in Term, Definition, Readings, Example, Context
    if (q) {
      const readingsText = Object.values(t.readings || {}).join(" ");
      const hay = (t.term + " " + (t.definition || "") + " " + (t.example || "") + " " + (t.context || "") + " " + readingsText).toLowerCase();
      if (!hay.includes(q)) return false;
    }

    state.activeLetters.add(t.letter);

    // 5. Letter Jump Filter
    if (state.letter && t.letter !== state.letter) return false;

    return true;
  });
}

/* ═══════════════════════════════════════════════════════════════
   UI RENDERING — STATS & FILTERS
   ═══════════════════════════════════════════════════════════════ */
function renderStats() {
  const totalInGroup = state.filtered.length;
  const koJaCount = state.filtered.filter(t => t.ko_ja_overlap).length;
  const shiftCount = state.filtered.filter(t => t.overlap_type === "semantic_shift").length;
  const exactCount = state.filtered.filter(t => t.overlap_type === "exact").length;

  const groupLabel = state.group === "all" ? "All Languages" : state.group.toUpperCase();

  document.getElementById("stats").innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Active Subset Terms</div>
      <div class="stat-value">${totalInGroup}<span class="muted">of ${state.terms.length}</span></div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Active Group ID</div>
      <div class="stat-value small" style="color:#0284C7;">${groupLabel}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">KO-JA Overlaps</div>
      <div class="stat-value" style="color:#7C3AED;">${koJaCount}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">False Friends (Shifted)</div>
      <div class="stat-value" style="color:#DC2626;">${shiftCount}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Exact Cognates</div>
      <div class="stat-value" style="color:#059669;">${exactCount}</div>
    </div>
  `;
}

function renderClusterFilterChips() {
  const el = document.getElementById("cluster-filter-bar");
  if (!el) return;

  const chipsHtml = [
    `<span class="filters-label" style="margin-left: 8px;">Category:</span>`,
    `<button class="chip cluster-chip ${state.clusterFilter === "all" ? "active" : ""}" data-cluster="all">All Categories</button>`
  ];

  for (const [id, conf] of Object.entries(CLUSTER_CONFIG)) {
    const isActive = state.clusterFilter === id;
    chipsHtml.push(`
      <button class="chip cluster-chip ${isActive ? "active" : ""}" data-cluster="${id}">
        <span class="cluster-dot" style="background:${conf.color};"></span>
        ${escapeHTML(conf.name)}
      </button>
    `);
  }

  el.innerHTML = chipsHtml.join("");

  el.querySelectorAll("[data-cluster]").forEach(btn => {
    btn.addEventListener("click", () => {
      state.clusterFilter = btn.dataset.cluster;
      renderClusterFilterChips();
      applyFilters();
      renderAlphaJump();
      renderTermList();
      if (state.view === "cluster") renderClusterCards();
    });
  });
}

function renderAlphaJump() {
  const activeLetters = state.activeLetters || new Set(state.filtered.map(t => t.letter));
  const el = document.getElementById("alpha-jump");
  el.innerHTML = LETTERS.map(L => {
    const label = L === "#" ? "0–9" : L;
    const cls = [];
    if (activeLetters.has(L)) cls.push("has-terms");
    if (state.letter === L) cls.push("active");
    return `<button data-letter="${L}" class="${cls.join(" ")}" ${activeLetters.has(L) ? "" : "disabled"}>${label}</button>`;
  }).join("");

  el.querySelectorAll("button.has-terms").forEach(b => {
    b.addEventListener("click", () => {
      state.letter = state.letter === b.dataset.letter ? null : b.dataset.letter;
      applyFilters();
      renderAlphaJump();
      renderTermList();
    });
  });
}

function renderTermList() {
  const el = document.getElementById("term-list");
  if (!state.filtered.length) {
    el.innerHTML = `<div class="no-results">No vocabulary matching active language combination and filters. Try selecting another language group or clearing search.</div>`;
    return;
  }
  const groups = {};
  for (const t of state.filtered) (groups[t.letter] ||= []).push(t);

  const html = LETTERS.filter(L => groups[L]).map(L => {
    const rows = groups[L].sort((a, b) => a.term.localeCompare(b.term)).map(t => {
      const cColor = clusterColorOf(t);
      const isSel = state.selected?.slug === t.slug;
      
      const langBadges = (t.langs || []).map(l => `<span class="badge-lang badge-lang-${l}">${l.toUpperCase()}</span>`).join(" ");

      return `
        <div class="term-row ${isSel ? "selected" : ""}" data-slug="${t.slug}">
          <span class="term-cluster-indicator" style="background:${cColor};" title="${escapeHTML(CLUSTER_CONFIG[clusterOf(t)]?.name || '')}"></span>
          <span class="term-num">${String(t.num).padStart(2, "0")}</span>
          <span class="term-name">${escapeHTML(t.term)}</span>
          <span class="term-badges">
            ${t.ko_ja_overlap ? `<span class="badge badge-ko-ja" title="Notable KO-JA Overlap">🇰🇷🇯🇵 KO-JA</span>` : ""}
            ${t.overlap_type === "semantic_shift" ? `<span class="badge badge-shift">False Friend</span>` : ""}
            ${langBadges}
          </span>
        </div>`;
    }).join("");
    return `<div class="term-group-header">${L === "#" ? "0–9" : L}</div>${rows}`;
  }).join("");

  el.innerHTML = html;
  el.querySelectorAll(".term-row").forEach(row =>
    row.addEventListener("click", () => selectTerm(row.dataset.slug)));
}

/* ═══════════════════════════════════════════════════════════════
   DETAIL RENDERER (Multi-language readings, Etymology, Shifts)
   ═══════════════════════════════════════════════════════════════ */
function buildDetailHTML(t, compact = false) {
  if (!t) return compact
    ? `<div class="map-detail-placeholder">Click any word node in the map or graph to inspect its multi-language definitions, readings, and overlaps.</div>`
    : `<div class="detail-empty">Select a vocabulary item from the list or explore the Concentric Rings / Network Graph.</div>`;

  const clusterConf = CLUSTER_CONFIG[clusterOf(t)] || CLUSTER_CONFIG["cjk_exact_overlaps"];
  const sections = [];

  // Multi-Language Readings Grid
  if (t.readings) {
    const boxes = Object.entries(t.readings).map(([langKey, val]) => `
      <div class="reading-box">
        <div class="reading-label"><span class="badge-lang badge-lang-${langKey}">${langKey.toUpperCase()}</span> ${LANG_NAMES[langKey] || langKey}</div>
        <div class="reading-val">${escapeHTML(val)}</div>
      </div>
    `).join("");
    sections.push(`
      <div class="section">
        <div class="section-label">🗣️ Multi-Language Readings &amp; Transcripts</div>
        <div class="readings-grid">${boxes}</div>
      </div>
    `);
  }

  // False Friend Alert Box
  if (t.overlap_type === "semantic_shift") {
    sections.push(`
      <div class="shift-alert-box">
        <div class="shift-alert-title">⚠️ False Friend / Semantic Shift Alert (同形異義)</div>
        <div class="shift-alert-body">
          This written term exists in multiple languages but carries shifted or distinct meanings! Always verify target language context before translating.
        </div>
      </div>
    `);
  }

  // Definition
  if (t.definition) {
    sections.push(`
      <div class="section">
        <div class="section-label">📖 Definition &amp; Cross-Linguistic Comparison</div>
        <div class="section-body">${escapeHTML(t.definition)}</div>
      </div>`);
  }

  // Example
  if (t.example) {
    sections.push(`
      <div class="section">
        <div class="section-label">💬 Contextual Examples across Languages</div>
        <div class="section-body">${escapeHTML(t.example)}</div>
      </div>`);
  }

  // Etymology / Context
  if (t.context) {
    sections.push(`
      <div class="section">
        <div class="section-label">📜 Historical Origin &amp; Etymological Notes</div>
        <div class="section-body">${escapeHTML(t.context)}</div>
      </div>`);
  }

  const ringIdx = t.ring ?? 2;
  const ringLabel = RING_LABELS[ringIdx] || "Applied";

  const langPills = (t.langs || []).map(l => `<span class="badge-lang badge-lang-${l}">${l.toUpperCase()}</span>`).join(" ");

  const header = compact ? `
    <div class="detail-header-top">
      <div class="cluster-pill-badge" style="background:${clusterConf.color}15; color:${clusterConf.color};">
        <span>${clusterConf.icon}</span> ${escapeHTML(clusterConf.name)}
      </div>
      <span class="ref-num">#${String(t.num).padStart(2, "0")}</span>
    </div>
    <h2 class="detail-title" style="font-size:20px;">${escapeHTML(t.term)}</h2>
    <div class="detail-meta">
      <span class="badge" style="background:${RING_COLORS[ringIdx]}20; color:${RING_COLORS[ringIdx]};">Ring: ${ringLabel}</span>
      ${t.ko_ja_overlap ? `<span class="badge badge-ko-ja">🇰🇷🇯🇵 KO-JA Overlap</span>` : ""}
      ${langPills}
    </div>` : `
    <div class="detail-header-top">
      <div class="breadcrumb">
        <span class="ref-num">#${String(t.num).padStart(2, "0")}</span>
        <span>·</span>
        <span>Vocabulary Library</span>
        <span class="crumb-sep">›</span>
        <span class="crumb-current">${escapeHTML(t.term)}</span>
      </div>
      <div class="cluster-pill-badge" style="background:${clusterConf.color}15; color:${clusterConf.color}; border: 1px solid ${clusterConf.color}40;">
        <span>${clusterConf.icon}</span> ${escapeHTML(clusterConf.name)}
      </div>
    </div>
    <h1 class="detail-title">${escapeHTML(t.term)}</h1>
    <div class="detail-meta">
      <div class="meta-item">
        <strong>Overlap Tier:</strong>
        <span class="badge" style="background:${RING_COLORS[ringIdx]}20; color:${RING_COLORS[ringIdx]};">${ringLabel}</span>
      </div>
      ${t.ko_ja_overlap ? `<div class="meta-item"><span class="badge badge-ko-ja">🇰🇷🇯🇵 KO-JA Overlap</span></div>` : ""}
      ${t.overlap_type === "semantic_shift" ? `<div class="meta-item"><span class="badge badge-shift">False Friend</span></div>` : ""}
      ${t.overlap_type === "exact" ? `<div class="meta-item"><span class="badge badge-exact">Exact Cognate</span></div>` : ""}
      <div class="meta-item"><strong>Languages:</strong> ${langPills}</div>
    </div>`;

  return header + sections.join("");
}

function renderDetail() {
  const el = document.getElementById("detail");
  if (el) el.innerHTML = buildDetailHTML(state.selected, false);
}

function renderRightRail() {
  const el = document.getElementById("right-rail");
  if (!el) return;
  const t = state.selected;
  if (!t) {
    el.innerHTML = `
      <div class="right-rail-card">
        <div class="right-rail-title">💡 Explorer Guide</div>
        <div class="help-text">Select any word from the left list or switch to <strong>Concentric Rings</strong> / <strong>Network Graph</strong> to inspect language overlap subsets.</div>
      </div>`;
    return;
  }

  // Cross-linked terms
  const relatedNames = new Set(t.related || []);
  for (const other of state.terms) {
    if ((other.related || []).some(r => r.toLowerCase().includes(t.term.toLowerCase()))) {
      relatedNames.add(other.term);
    }
  }

  const links = [...relatedNames].map(n => findByName(n)).filter(Boolean);
  const linksHtml = links.length
    ? `<ul class="mentioned-list">${links.map(l =>
        `<li><a href="#" data-slug="${l.slug}"><span>›</span> ${escapeHTML(l.term)}</a></li>`).join("")}</ul>`
    : `<div class="right-rail-empty">No direct cross-links found.</div>`;

  // Domain Cluster siblings
  const cId = clusterOf(t);
  const cConf = CLUSTER_CONFIG[cId] || CLUSTER_CONFIG["cjk_exact_overlaps"];
  const siblings = state.terms.filter(x => clusterOf(x) === cId && x.slug !== t.slug).slice(0, 6);
  const siblingsHtml = siblings.map(s => `<a href="#" class="sibling-tag" data-slug="${s.slug}">${escapeHTML(s.term)}</a>`).join("");

  el.innerHTML = `
    <div class="right-rail-card">
      <div class="right-rail-title">🏷️ Category</div>
      <div class="cluster-info-box" style="border-left: 3px solid ${cConf.color};">
        <div class="cluster-info-title">${cConf.icon} ${escapeHTML(cConf.name)}</div>
        <div class="cluster-info-desc">${escapeHTML(cConf.desc)}</div>
        ${siblings.length ? `<div class="cluster-siblings">${siblingsHtml}</div>` : ""}
      </div>
    </div>
    <div class="right-rail-card">
      <div class="right-rail-title">🔗 Cognate &amp; Semantic Links (${links.length})</div>
      ${linksHtml}
    </div>
  `;

  el.querySelectorAll("a[data-slug]").forEach(a =>
    a.addEventListener("click", e => {
      e.preventDefault();
      selectTerm(a.dataset.slug);
    }));
}

/* ═══════════════════════════════════════════════════════════════
   2. CATEGORIES / OVERLAPS VIEW
   ═══════════════════════════════════════════════════════════════ */
function renderClusterCards() {
  const grid = document.getElementById("cluster-cards-grid");
  if (!grid) return;

  const cardsHtml = Object.entries(CLUSTER_CONFIG).map(([cId, conf]) => {
    const clusterTerms = state.filtered.filter(t => clusterOf(t) === cId);
    if (!clusterTerms.length) return "";

    const termsPillsHtml = clusterTerms.map(t => `
      <span class="cluster-term-pill" data-slug="${t.slug}" title="${escapeHTML(t.term)}">
        ${escapeHTML(t.term)} ${t.ko_ja_overlap ? `<strong>🇰🇷🇯🇵</strong>` : ""}
      </span>
    `).join("");

    return `
      <div class="cluster-card" data-cluster-id="${cId}">
        <div class="cluster-card-top-bar" style="background: ${conf.color};"></div>
        <div class="cluster-card-header">
          <div class="cluster-card-title">
            <div class="cluster-card-icon" style="background: ${conf.color}20; color: ${conf.color};">
              ${conf.icon}
            </div>
            <span>${escapeHTML(conf.name)}</span>
          </div>
          <div class="cluster-card-counts">
            <span class="cluster-count-badge">${clusterTerms.length} words</span>
          </div>
        </div>
        <div class="cluster-card-desc">${escapeHTML(conf.desc)}</div>
        
        <div class="cluster-card-terms-header">Overlapping Vocabulary:</div>
        <div class="cluster-card-terms">${termsPillsHtml}</div>
      </div>
    `;
  }).join("");

  grid.innerHTML = cardsHtml;

  grid.querySelectorAll(".cluster-term-pill").forEach(pill => {
    pill.addEventListener("click", (e) => {
      e.stopPropagation();
      openTermModal(pill.dataset.slug);
    });
  });
}

function openTermModal(slug) {
  const t = findBySlug(slug);
  if (!t) return;

  const existingModal = document.querySelector(".term-modal-backdrop");
  if (existingModal) existingModal.remove();

  const modalHtml = `
    <div class="term-modal-backdrop">
      <div class="term-modal">
        <button class="term-modal-close" title="Close">✕</button>
        ${buildDetailHTML(t, false)}
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", modalHtml);

  const backdrop = document.querySelector(".term-modal-backdrop");
  backdrop.querySelector(".term-modal-close").addEventListener("click", () => backdrop.remove());
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) backdrop.remove();
  });
}

/* ═══════════════════════════════════════════════════════════════
   3. NETWORK MAP — FORCE-DIRECTED GRAPH FOR LANGUAGE COMBINATIONS
   ═══════════════════════════════════════════════════════════════ */
const NET = {
  canvas: null, ctx: null,
  nodes: [], edges: [],
  zoom: 1, panX: 0, panY: 0,
  dragging: false, lastX: 0, lastY: 0,
  animId: null
};

function netBuildGraph() {
  const visibleTerms = state.filtered;
  NET.nodes = visibleTerms.map((t, i) => {
    const cId = clusterOf(t);
    const angle = (i / visibleTerms.length) * Math.PI * 2;
    const radius = 120 + Math.random() * 80;
    return {
      t,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      vx: 0, vy: 0,
      cluster: cId,
      color: clusterColorOf(t),
      ring: t.ring ?? 2
    };
  });

  const nameToIdx = {};
  NET.nodes.forEach((n, i) => { nameToIdx[n.t.term.toLowerCase()] = i; });
  NET.edges = [];
  visibleTerms.forEach((t, i) => {
    (t.related || []).forEach(r => {
      const j = NET.nodes.findIndex(n => n.t.term.toLowerCase().includes(r.toLowerCase()));
      if (j >= 0 && j > i) NET.edges.push([i, j]);
    });
  });
}

function netForceStep() {
  const nodes = NET.nodes;
  const K = 90, repulse = 4200, damping = 0.85, alpha = 0.35;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[j].x - nodes[i].x, dy = nodes[j].y - nodes[i].y;
      const d2 = dx * dx + dy * dy + 1;
      const f = repulse / d2;
      const fx = f * dx / Math.sqrt(d2), fy = f * dy / Math.sqrt(d2);
      nodes[i].vx -= fx; nodes[i].vy -= fy;
      nodes[j].vx += fx; nodes[j].vy += fy;
    }
  }

  NET.edges.forEach(([a, b]) => {
    if (!nodes[a] || !nodes[b]) return;
    const dx = nodes[b].x - nodes[a].x, dy = nodes[b].y - nodes[a].y;
    const d = Math.sqrt(dx * dx + dy * dy) + 0.01;
    const f = alpha * (d - K) / d;
    const fx = f * dx, fy = f * dy;
    nodes[a].vx += fx; nodes[a].vy += fy;
    nodes[b].vx -= fx; nodes[b].vy -= fy;
  });

  nodes.forEach(n => {
    n.vx -= 0.008 * n.x;
    n.vy -= 0.008 * n.y;
    n.vx *= damping;
    n.vy *= damping;
    n.x += n.vx;
    n.y += n.vy;
  });
}

function netDraw() {
  const canvas = NET.canvas, ctx = NET.ctx;
  if (!canvas || !ctx) return;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = "#F8FAFC";
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(W / 2 + NET.panX, H / 2 + NET.panY);
  ctx.scale(NET.zoom, NET.zoom);

  const sel = state.selected;
  const selIdx = sel ? NET.nodes.findIndex(n => n.t.slug === sel.slug) : -1;
  const linkedIdxs = new Set();
  if (selIdx >= 0) {
    NET.edges.forEach(([a, b]) => {
      if (a === selIdx) linkedIdxs.add(b);
      if (b === selIdx) linkedIdxs.add(a);
    });
  }

  const dim = selIdx >= 0;

  // Draw Edges
  NET.edges.forEach(([a, b]) => {
    const na = NET.nodes[a], nb = NET.nodes[b];
    if (!na || !nb) return;
    const isActive = selIdx >= 0 && (a === selIdx || b === selIdx);
    ctx.beginPath();
    ctx.moveTo(na.x, na.y);
    ctx.lineTo(nb.x, nb.y);
    ctx.strokeStyle = isActive ? "#0284C7" : (dim ? "#E2E8F0" : "#CBD5E1");
    ctx.lineWidth = isActive ? 2.5 : 1.2;
    ctx.globalAlpha = isActive ? 0.9 : (dim ? 0.25 : 0.6);
    ctx.stroke();
    ctx.globalAlpha = 1;
  });

  // Draw Nodes
  NET.nodes.forEach((n, i) => {
    const isSel = i === selIdx;
    const isLinked = linkedIdxs.has(i);
    const faded = dim && !isSel && !isLinked;
    const r = isSel ? 12 : isLinked ? 10 : 8;

    ctx.globalAlpha = faded ? 0.2 : 1;

    if (isSel) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 6, 0, Math.PI * 2);
      ctx.fillStyle = `${n.color}30`;
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fillStyle = isSel ? n.color : (isLinked ? "#FFFFFF" : n.color);
    ctx.strokeStyle = isSel ? "#FFFFFF" : (isLinked ? "#0284C7" : "#FFFFFF");
    ctx.lineWidth = isSel ? 2.5 : isLinked ? 3 : 1.5;
    ctx.fill();
    ctx.stroke();

    if (!faded || isSel || isLinked) {
      ctx.font = `${isSel ? "800" : isLinked ? "700" : "600"} ${isSel ? 12 : 10.5}px -apple-system, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 3.5;
      ctx.strokeText(n.t.term, n.x, n.y + r + 10);

      ctx.fillStyle = isSel ? "#032D60" : isLinked ? "#0284C7" : "#334155";
      ctx.fillText(n.t.term, n.x, n.y + r + 10);
    }
    ctx.globalAlpha = 1;
  });

  ctx.restore();
}

function netHitTest(mx, my) {
  const canvas = NET.canvas;
  if (!canvas) return null;
  const W = canvas.width, H = canvas.height;
  const wx = (mx - W / 2 - NET.panX) / NET.zoom;
  const wy = (my - H / 2 - NET.panY) / NET.zoom;
  let best = null, bestD = 20;
  NET.nodes.forEach((n, i) => {
    const d = Math.hypot(n.x - wx, n.y - wy);
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

function netInit() {
  NET.canvas = document.getElementById("net-canvas");
  if (!NET.canvas) return;
  NET.ctx = NET.canvas.getContext("2d");

  const resize = () => {
    const rect = NET.canvas.parentElement.getBoundingClientRect();
    NET.canvas.width = rect.width;
    NET.canvas.height = rect.height;
    netDraw();
  };
  new ResizeObserver(resize).observe(NET.canvas.parentElement);
  resize();

  netBuildGraph();

  const legendEl = document.getElementById("net-cluster-legend-items");
  if (legendEl) {
    legendEl.innerHTML = Object.entries(CLUSTER_CONFIG).map(([id, c]) => `
      <div class="legend-row">
        <span class="leg-dot" style="background:${c.color};"></span>
        <span>${escapeHTML(c.name)}</span>
      </div>
    `).join("");
  }

  for (let i = 0; i < 200; i++) netForceStep();
  netFitAll();
  netDraw();

  let remaining = 140;
  const tick = () => {
    if (remaining-- > 0) {
      netForceStep();
      netDraw();
      NET.animId = requestAnimationFrame(tick);
    }
  };
  if (NET.animId) cancelAnimationFrame(NET.animId);
  NET.animId = requestAnimationFrame(tick);

  NET.canvas.onmousedown = e => {
    NET.dragging = true; NET.lastX = e.clientX; NET.lastY = e.clientY;
    NET.canvas.classList.add("panning");
  };
  window.onmousemove = e => {
    if (!NET.dragging) return;
    NET.panX += e.clientX - NET.lastX;
    NET.panY += e.clientY - NET.lastY;
    NET.lastX = e.clientX; NET.lastY = e.clientY;
    netDraw();
  };
  window.onmouseup = () => {
    NET.dragging = false;
    if (NET.canvas) NET.canvas.classList.remove("panning");
  };
  NET.canvas.onwheel = e => {
    e.preventDefault();
    NET.zoom = Math.max(0.2, Math.min(4, NET.zoom * (e.deltaY < 0 ? 1.12 : 0.89)));
    netDraw();
  };

  NET.canvas.onclick = e => {
    if (Math.abs(e.clientX - NET.lastX) > 4) return;
    const rect = NET.canvas.getBoundingClientRect();
    const idx = netHitTest(e.clientX - rect.left, e.clientY - rect.top);
    if (idx !== null && NET.nodes[idx]) selectTerm(NET.nodes[idx].t.slug);
  };

  document.getElementById("net-zoom-in").onclick = () => { NET.zoom = Math.min(4, NET.zoom * 1.2); netDraw(); };
  document.getElementById("net-zoom-out").onclick = () => { NET.zoom = Math.max(0.2, NET.zoom * 0.83); netDraw(); };
  document.getElementById("net-fit").onclick = () => { netFitAll(); netDraw(); };
}

function netFitAll() {
  const canvas = NET.canvas;
  if (!canvas || !NET.nodes.length) return;
  const xs = NET.nodes.map(n => n.x), ys = NET.nodes.map(n => n.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const W = canvas.width, H = canvas.height;
  const margin = 60;
  NET.zoom = Math.min(
    (W - 2 * margin) / (maxX - minX + 1),
    (H - 2 * margin) / (maxY - minY + 1),
    1.2
  );
  NET.panX = -((minX + maxX) / 2) * NET.zoom;
  NET.panY = -((minY + maxY) / 2) * NET.zoom;
}

/* ═══════════════════════════════════════════════════════════════
   4. CONCENTRIC RINGS MAP FOR LANGUAGE OVERLAP TIERS
   ═══════════════════════════════════════════════════════════════ */
const CONC = {
  canvas: null, ctx: null,
  nodes: [],
  zoom: 1, panX: 0, panY: 0,
  dragging: false, lastX: 0, lastY: 0,
};
const RING_RADII = [0, 140, 280, 420];

function concBuildLayout() {
  const visibleTerms = state.filtered;
  const rings = [[], [], [], []];
  visibleTerms.forEach(t => {
    const r = t.ring ?? 2;
    rings[Math.min(3, Math.max(0, r))].push(t);
  });

  CONC.nodes = [];
  rings.forEach((group, ring) => {
    const r = RING_RADII[ring];
    group.forEach((t, i) => {
      const angle = (i / Math.max(1, group.length)) * Math.PI * 2 - Math.PI / 2;
      CONC.nodes.push({
        t,
        ring,
        color: clusterColorOf(t),
        x: r * Math.cos(angle),
        y: r * Math.sin(angle),
      });
    });
  });
}

function concDraw() {
  const canvas = CONC.canvas, ctx = CONC.ctx;
  if (!canvas || !ctx) return;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = "#F8FAFC";
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(W / 2 + CONC.panX, H / 2 + CONC.panY);
  ctx.scale(CONC.zoom, CONC.zoom);

  // Draw Concentric Dashed Rings
  RING_RADII.forEach((r, i) => {
    if (r === 0) return;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.setLineDash([4, 8]);
    ctx.strokeStyle = "#CBD5E1";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.setLineDash([]);

    // Ring Labels
    ctx.font = "700 11px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = RING_COLORS[i] || "#94A3B8";
    ctx.fillText(RING_LABELS[i].toUpperCase(), 0, -r - 8);
  });

  const sel = state.selected;
  const selIdx = sel ? CONC.nodes.findIndex(n => n.t.slug === sel.slug) : -1;
  const linkedSlugs = new Set();
  if (sel) {
    (sel.related || []).forEach(r => {
      const found = findByName(r);
      if (found) linkedSlugs.add(found.slug);
    });
  }
  const dim = selIdx >= 0;

  // Selected Links
  if (selIdx >= 0) {
    const sn = CONC.nodes[selIdx];
    CONC.nodes.forEach((n, i) => {
      if (i === selIdx || !linkedSlugs.has(n.t.slug)) return;
      ctx.beginPath();
      ctx.moveTo(sn.x, sn.y);
      ctx.lineTo(n.x, n.y);
      ctx.strokeStyle = "#0284C7";
      ctx.lineWidth = 2.2;
      ctx.globalAlpha = 0.75;
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
  }

  // Draw Nodes
  CONC.nodes.forEach((n, i) => {
    const isSel = i === selIdx;
    const isLinked = linkedSlugs.has(n.t.slug);
    const faded = dim && !isSel && !isLinked;
    const r = isSel ? 12 : isLinked ? 10 : n.t.ko_ja_overlap ? 9 : 7;

    ctx.globalAlpha = faded ? 0.2 : 1;

    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fillStyle = isSel ? n.color : (isLinked ? "#FFFFFF" : n.color);
    ctx.strokeStyle = isSel ? "#032D60" : (isLinked ? "#0284C7" : "#FFFFFF");
    ctx.lineWidth = isSel ? 3 : isLinked ? 2.5 : 1.5;
    ctx.fill();
    ctx.stroke();

    if (!faded) {
      const lx = n.x, ly = n.y + r + 9;
      ctx.font = `${isSel ? "800" : "600"} ${isSel ? 12 : 10.5}px -apple-system, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 3.5;
      ctx.strokeText(n.t.term, lx, ly);
      ctx.fillStyle = isSel ? "#032D60" : isLinked ? "#0284C7" : "#334155";
      ctx.fillText(n.t.term, lx, ly);
    }
    ctx.globalAlpha = 1;
  });

  ctx.restore();
}

function concHitTest(mx, my) {
  const canvas = CONC.canvas;
  if (!canvas) return null;
  const W = canvas.width, H = canvas.height;
  const wx = (mx - W / 2 - CONC.panX) / CONC.zoom;
  const wy = (my - H / 2 - CONC.panY) / CONC.zoom;
  let best = null, bestD = 20;
  CONC.nodes.forEach((n, i) => {
    const d = Math.hypot(n.x - wx, n.y - wy);
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

function concFitAll() {
  const canvas = CONC.canvas;
  if (!canvas) return;
  const W = canvas.width, H = canvas.height;
  const maxR = RING_RADII[RING_RADII.length - 1] + 60;
  CONC.zoom = Math.min(W, H) / (2 * maxR);
  CONC.panX = 0; CONC.panY = 0;
}

function concInit() {
  CONC.canvas = document.getElementById("conc-canvas");
  if (!CONC.canvas) return;
  CONC.ctx = CONC.canvas.getContext("2d");

  const resize = () => {
    const rect = CONC.canvas.parentElement.getBoundingClientRect();
    CONC.canvas.width = rect.width;
    CONC.canvas.height = rect.height;
    concDraw();
  };
  new ResizeObserver(resize).observe(CONC.canvas.parentElement);
  concBuildLayout();
  resize();
  concFitAll();
  concDraw();

  CONC.canvas.onmousedown = e => {
    CONC.dragging = true; CONC.lastX = e.clientX; CONC.lastY = e.clientY;
    CONC.canvas.classList.add("panning");
  };
  window.onmousemove = e => {
    if (!CONC.dragging) return;
    CONC.panX += e.clientX - CONC.lastX;
    CONC.panY += e.clientY - CONC.lastY;
    CONC.lastX = e.clientX; CONC.lastY = e.clientY;
    concDraw();
  };
  window.onmouseup = () => {
    CONC.dragging = false;
    if (CONC.canvas) CONC.canvas.classList.remove("panning");
  };
  CONC.canvas.onwheel = e => {
    e.preventDefault();
    CONC.zoom = Math.max(0.2, Math.min(4, CONC.zoom * (e.deltaY < 0 ? 1.12 : 0.89)));
    concDraw();
  };

  CONC.canvas.onclick = e => {
    if (Math.abs(e.clientX - CONC.lastX) > 4) return;
    const rect = CONC.canvas.getBoundingClientRect();
    const idx = concHitTest(e.clientX - rect.left, e.clientY - rect.top);
    if (idx !== null && CONC.nodes[idx]) selectTerm(CONC.nodes[idx].t.slug);
  };

  document.getElementById("conc-zoom-in").onclick = () => { CONC.zoom = Math.min(4, CONC.zoom * 1.2); concDraw(); };
  document.getElementById("conc-zoom-out").onclick = () => { CONC.zoom = Math.max(0.2, CONC.zoom * 0.83); concDraw(); };
  document.getElementById("conc-fit").onclick = () => { concFitAll(); concDraw(); };
}

/* ═══════════════════════════════════════════════════════════════
   SELECTION & VIEW SWITCHING
   ═══════════════════════════════════════════════════════════════ */
function selectTerm(slug) {
  const t = findBySlug(slug);
  if (!t) return;
  state.selected = t;
  renderTermList();
  renderDetail();
  renderRightRail();

  if (state.view === "network") {
    const netDet = document.getElementById("net-detail");
    if (netDet) netDet.innerHTML = buildDetailHTML(t, true);
    netDraw();
  } else if (state.view === "concentric") {
    const concDet = document.getElementById("conc-detail");
    if (concDet) concDet.innerHTML = buildDetailHTML(t, true);
    concDraw();
  }
}

function switchView(v) {
  state.view = v;
  ["list", "cluster", "network", "concentric"].forEach(name => {
    const viewEl = document.getElementById("view-" + name);
    if (viewEl) viewEl.hidden = name !== v;
    const tab = document.querySelector(`[data-view="${name}"]`);
    if (tab) {
      tab.classList.toggle("active", name === v);
      tab.setAttribute("aria-selected", name === v ? "true" : "false");
    }
  });

  const filterBar = document.getElementById("filter-bar");
  if (filterBar) filterBar.style.display = (v === "list" || v === "cluster") ? "flex" : "none";

  const metaNote = document.getElementById("view-meta-note");
  if (metaNote) {
    if (v === "list") metaNote.textContent = `Vocabulary List · ${state.filtered.length} terms displayed`;
    if (v === "cluster") metaNote.textContent = `Categories View · ${Object.keys(CLUSTER_CONFIG).length} linguistic domains`;
    if (v === "network") metaNote.textContent = `Network Graph · Interactive relationship map for active group (${state.group.toUpperCase()})`;
    if (v === "concentric") metaNote.textContent = `Concentric Rings · Overlap hierarchy map for active group (${state.group.toUpperCase()})`;
  }

  if (v === "cluster") renderClusterCards();
  if (v === "network") { netBuildGraph(); netInit(); }
  if (v === "concentric") { concBuildLayout(); concInit(); }
}

/* ═══════════════════════════════════════════════════════════════
   INTERACTIONS & EVENT WIRING
   ═══════════════════════════════════════════════════════════════ */
function updateActiveGroup(groupVal) {
  state.group = groupVal;
  const activeLabelEl = document.getElementById("combo-active-name");
  if (activeLabelEl) activeLabelEl.textContent = groupVal === "all" ? "All Combinations" : groupVal.toUpperCase();

  // Sync quick preset buttons
  document.querySelectorAll(".combo-chip[data-group]").forEach(b => {
    b.classList.toggle("active", b.dataset.group === groupVal);
  });

  // Sync select dropdown
  const groupSelect = document.getElementById("group-select");
  if (groupSelect && groupSelect.value !== groupVal) {
    groupSelect.value = groupVal;
  }

  applyFilters();
  renderStats();
  renderAlphaJump();
  renderTermList();

  if (state.view === "cluster") renderClusterCards();
  if (state.view === "network") { netBuildGraph(); netDraw(); }
  if (state.view === "concentric") { concBuildLayout(); concDraw(); }
}

function wireInteractions() {
  const searchInput = document.getElementById("search-input");
  const globalSearch = document.getElementById("global-search");

  const handleSearch = (val) => {
    state.query = val;
    if (searchInput && searchInput.value !== val) searchInput.value = val;
    if (globalSearch && globalSearch.value !== val) globalSearch.value = val;
    applyFilters();
    renderStats();
    renderAlphaJump();
    renderTermList();
    if (state.view === "cluster") renderClusterCards();
    if (state.view === "network") { netBuildGraph(); netDraw(); }
    if (state.view === "concentric") { concBuildLayout(); concDraw(); }
  };

  if (searchInput) searchInput.addEventListener("input", e => handleSearch(e.target.value));
  if (globalSearch) globalSearch.addEventListener("input", e => handleSearch(e.target.value));

  // Filter Chips (All, KO-JA, Shift, Exact)
  document.querySelectorAll(".chip[data-filter]").forEach(btn =>
    btn.addEventListener("click", () => {
      state.filter = btn.dataset.filter;
      document.querySelectorAll(".chip[data-filter]").forEach(b => {
        b.classList.toggle("active", b.dataset.filter === state.filter);
        b.setAttribute("aria-pressed", b.dataset.filter === state.filter ? "true" : "false");
      });
      applyFilters();
      renderStats();
      renderAlphaJump();
      renderTermList();
      if (state.view === "cluster") renderClusterCards();
    }));

  // View tabs
  document.querySelectorAll(".view-tab").forEach(tab =>
    tab.addEventListener("click", () => switchView(tab.dataset.view)));

  // Language combination presets
  document.querySelectorAll(".combo-chip[data-group]").forEach(chip => {
    chip.addEventListener("click", () => updateActiveGroup(chip.dataset.group));
  });

  // Language combination dropdown
  const groupSelect = document.getElementById("group-select");
  if (groupSelect) {
    groupSelect.addEventListener("change", e => updateActiveGroup(e.target.value));
  }

  // KO-JA Spotlight Buttons
  const btnKoJa = document.getElementById("btn-ko-ja-spotlight");
  const navKoJa = document.getElementById("nav-ko-ja");
  const navAll = document.getElementById("nav-all");

  const triggerKoJaSpotlight = () => {
    updateActiveGroup("ko-ja");
    state.filter = "ko_ja";
    document.querySelectorAll(".chip[data-filter]").forEach(b => {
      b.classList.toggle("active", b.dataset.filter === "ko_ja");
    });
    if (navKoJa) navKoJa.classList.add("active");
    if (navAll) navAll.classList.remove("active");
    const firstShift = state.filtered.find(t => t.overlap_type === "semantic_shift") || state.filtered[0];
    if (firstShift) selectTerm(firstShift.slug);
  };

  if (btnKoJa) btnKoJa.addEventListener("click", triggerKoJaSpotlight);
  if (navKoJa) navKoJa.addEventListener("click", e => { e.preventDefault(); triggerKoJaSpotlight(); });
  if (navAll) navAll.addEventListener("click", e => {
    e.preventDefault();
    if (navAll) navAll.classList.add("active");
    if (navKoJa) navKoJa.classList.remove("active");
    updateActiveGroup("ko-ja");
    state.filter = "all";
    document.querySelectorAll(".chip[data-filter]").forEach(b => {
      b.classList.toggle("active", b.dataset.filter === "all");
    });
  });
}

/* ═══════════════════════════════════════════════════════════════
   BOOTSTRAP
   ═══════════════════════════════════════════════════════════════ */
async function boot() {
  let data = null;

  if (typeof window !== "undefined" && window.GLOSSARY_DATA) {
    data = window.GLOSSARY_DATA;
  } else {
    try {
      const res = await fetch("data.json", { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    } catch (err) {
      console.error("Failed to load glossary data:", err);
      return;
    }
  }

  state.terms = (data.terms || []).slice().sort((a, b) => (a.num || 0) - (b.num || 0));
  state.terms.forEach((t, i) => {
    if (!t.slug) t.slug = t.term.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    if (!t.letter) t.letter = /^[A-Z]/i.test(t.term) ? t.term[0].toUpperCase() : "#";
    if (t.num === undefined) t.num = i + 1;
    if (!t.cluster) t.cluster = "cjk_exact_overlaps";
  });

  state.meta = data.meta || {};
  state.clusters = data.clusters || CLUSTER_CONFIG;

  // Initialize UI
  updateActiveGroup("ko-ja");
  renderClusterFilterChips();
  wireInteractions();

  if (state.filtered.length) {
    selectTerm(state.filtered[0].slug);
  }
}

boot();
