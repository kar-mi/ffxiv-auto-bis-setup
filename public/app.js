const logger = {
  debug: (...a) => console.debug(...a),
  info:  (...a) => console.info(...a),
  warn:  (...a) => console.warn(...a),
  error: (...a) => console.error(...a),
};
logger.info("[app] app.js loaded");

const API_BASE = "http://localhost:3000";

// ---- Item data cache ----------------------------------------------------

const itemCache = new Map();

async function fetchItemData(itemId) {
  if (!itemCache.has(itemId)) {
    itemCache.set(itemId, fetch(`${API_BASE}/item/${itemId}`).then(r => r.json()));
  }
  return itemCache.get(itemId);
}

const SLOT_LABELS = {
  mainHand:  "Main Hand",
  offHand:   "Off Hand",
  head:      "Head",
  chest:     "Body",
  gloves:    "Hands",
  legs:      "Legs",
  feet:      "Feet",
  earRings:  "Earrings",
  necklace:  "Necklace",
  bracelet:  "Bracelets",
  ring1:     "Ring 1",
  ring2:     "Ring 2",
  crystal:   "Soul Crystal",
};

const LEFT_SLOTS   = ["mainHand", "head", "chest", "gloves", "legs", "feet"];
const RIGHT_SLOTS  = ["offHand", "earRings", "necklace", "bracelet", "ring1", "ring2"];

const JOBS = [
  { label: "Paladin",      role: "tanks",   job: "paladin" },
  { label: "Warrior",      role: "tanks",   job: "warrior" },
  { label: "Dark Knight",  role: "tanks",   job: "dark-knight" },
  { label: "Gunbreaker",   role: "tanks",   job: "gunbreaker" },
  { label: "White Mage",   role: "healers", job: "white-mage" },
  { label: "Scholar",      role: "healers", job: "scholar" },
  { label: "Astrologian",  role: "healers", job: "astrologian" },
  { label: "Sage",         role: "healers", job: "sage" },
  { label: "Monk",         role: "melee",   job: "monk" },
  { label: "Dragoon",      role: "melee",   job: "dragoon" },
  { label: "Ninja",        role: "melee",   job: "ninja" },
  { label: "Samurai",      role: "melee",   job: "samurai" },
  { label: "Reaper",       role: "melee",   job: "reaper" },
  { label: "Viper",        role: "melee",   job: "viper" },
  { label: "Bard",         role: "ranged",  job: "bard" },
  { label: "Machinist",    role: "ranged",  job: "machinist" },
  { label: "Dancer",       role: "ranged",  job: "dancer" },
  { label: "Black Mage",   role: "casters", job: "black-mage" },
  { label: "Summoner",     role: "casters", job: "summoner" },
  { label: "Red Mage",     role: "casters", job: "red-mage" },
  { label: "Pictomancer",  role: "casters", job: "pictomancer" },
];

// ---- Module state -------------------------------------------------------

let currentSnapshot = null;      // GearSnapshot | null
let currentItemDataMap = new Map(); // item data for equipped gear
let comparisonData = null;       // GearsetComparison | null
let currentBisSet = null;        // BisGearSet | null
let bisItemDataMap = new Map();  // item data for BIS items
let acquisitionData = null;      // SlotAcquisitionStatus[] | null
let currentJobKey = null;        // "role/job" slug, to avoid re-fetching BIS links on same job

// ---- DOM helpers --------------------------------------------------------

function el(id) { return document.getElementById(id); }

function setStatus(msg, isError = false) {
  const s = el("status");
  s.textContent = msg;
  s.className = `text-sm mb-6 ${isError ? "text-red-400" : "text-gray-400"}`;
  s.classList.remove("hidden");
}

function clearStatus() { el("status").classList.add("hidden"); }

// ---- Rendering ----------------------------------------------------------

function renderMateria(piece, itemDataMap) {
  const totalSlots = piece.materiaSlots ?? (piece.canOvermeld ? 5 : 2);
  const circles = Array.from({ length: totalSlots }, (_, i) => {
    const id = piece.materias[i] ?? 0;
    const filled = id !== 0;
    const isOvermeld = i >= 2;
    const data = filled ? itemDataMap.get(id) : null;
    const title = data?.name ?? (filled ? `Materia #${id}` : "");
    const titleAttr = title ? ` data-tooltip="${title}"` : "";
    if (!filled) {
      const borderColor = isOvermeld ? "border-red-800" : "border-blue-800";
      return `<span${titleAttr} class="w-2.5 h-2.5 rounded-full border ${borderColor} flex-shrink-0 inline-block"></span>`;
    }
    const bgColor = isOvermeld ? "bg-red-500" : "bg-blue-400";
    return `<span${titleAttr} class="w-2.5 h-2.5 rounded-full ${bgColor} flex-shrink-0 inline-block"></span>`;
  });
  return `<div class="flex gap-1 items-center mt-1">${circles.join("")}</div>`;
}

function renderMateriaCompare(piece, bisItem, itemDataMap) {
  const totalSlots = Math.max(piece?.materiaSlots ?? (piece?.canOvermeld ? 5 : 2), bisItem?.materias?.length ?? 0, 2);
  const circles = Array.from({ length: totalSlots }, (_, i) => {
    const equippedId = piece?.materias[i] ?? 0;
    const bisId = bisItem?.materias[i] ?? 0;
    const filled = equippedId !== 0;
    const isOvermeld = i >= 2;
    const matches = equippedId === bisId;
    const data = filled ? itemDataMap.get(equippedId) : null;
    const title = data?.name ?? (filled ? `Materia #${equippedId}` : "");
    const titleAttr = title ? ` data-tooltip="${title}"` : "";
    if (!filled) {
      const borderColor = isOvermeld ? "border-red-800" : "border-blue-800";
      return `<span${titleAttr} class="w-2.5 h-2.5 rounded-full border ${borderColor} flex-shrink-0 inline-block"></span>`;
    }
    // filled — color by match status
    const bgColor = matches ? "bg-blue-400" : (isOvermeld ? "bg-red-500" : "bg-yellow-500");
    return `<span${titleAttr} class="w-2.5 h-2.5 rounded-full ${bgColor} flex-shrink-0 inline-block"></span>`;
  });
  return `<div class="flex gap-1 items-center mt-1">${circles.join("")}</div>`;
}

function crystalJobName(name) {
  return name.replace(/^Soul of (?:the )?/i, "");
}

function renderCrystal(piece, itemDataMap) {
  if (!piece) {
    return `
      <div class="w-20 h-20 bg-ffxiv-panel border border-ffxiv-border rounded flex flex-col items-center justify-center gap-1 opacity-40">
        <div class="w-10 h-10 rounded bg-ffxiv-border"></div>
        <p class="text-[9px] text-gray-600 italic">None</p>
      </div>`;
  }
  const data = itemDataMap.get(piece.itemId);
  const jobName = data?.name ? crystalJobName(data.name) : `Item #${piece.itemId}`;
  const icon = data?.icon
    ? `<img src="${data.icon}" alt="" class="w-10 h-10 rounded object-cover"
         onerror="console.warn('[img] failed to load crystal icon:', this.src); this.style.display='none'">`
    : `<div class="w-10 h-10 rounded bg-ffxiv-border"></div>`;
  return `
    <div class="w-20 h-20 bg-ffxiv-panel border border-ffxiv-border rounded flex flex-col items-center justify-center gap-1 p-2 hover:border-ffxiv-gold transition-colors">
      ${icon}
      <p class="text-[9px] text-gray-300 font-medium text-center leading-tight">${jobName}</p>
    </div>`;
}

function borderClassForStatus(status) {
  if (!status) return "border-ffxiv-border";
  switch (status) {
    case "match":        return "border-green-600";
    case "wrong-materia": return "border-yellow-500";
    case "wrong-item":
    case "missing":      return "border-red-600";
    default:             return "border-ffxiv-border";
  }
}

function statusDotForStatus(status) {
  if (!status || status === "bis-empty") return "";
  const colors = {
    "match":         "bg-green-500",
    "wrong-materia": "bg-yellow-400",
    "wrong-item":    "bg-red-500",
    "missing":       "bg-red-500",
  };
  const color = colors[status] ?? "";
  return `<span class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${color} flex-shrink-0"></span>`;
}

function renderGearItem(slot, piece, itemDataMap, slotComp) {
  const label = SLOT_LABELS[slot] ?? slot;
  const status = slotComp?.status ?? null;
  const borderClass = borderClassForStatus(status);
  const isClickable = status && status !== "match" && status !== "bis-empty";
  const clickableClass = isClickable ? "cursor-pointer" : "";
  const dot = statusDotForStatus(status);

  if (!piece) {
    return `
      <div class="relative flex items-start gap-2 bg-ffxiv-panel border ${borderClass} rounded p-2 opacity-40 ${clickableClass}"
           ${isClickable ? `data-slot="${slot}"` : ""}>
        ${dot}
        <div class="w-10 h-10 rounded bg-ffxiv-border flex-shrink-0"></div>
        <div class="flex-1 min-w-0">
          <p class="text-[10px] text-gray-500 uppercase tracking-wide leading-none mb-0.5">${label}</p>
          <p class="text-xs font-medium text-gray-600 truncate italic">Empty</p>
          <p class="text-[10px] text-ffxiv-gold font-mono mt-0.5 invisible">iLvl 0</p>
          <div class="flex gap-1 items-center mt-1 invisible">
            <span class="w-2.5 h-2.5 rounded-full border border-blue-800 flex-shrink-0 inline-block"></span>
            <span class="w-2.5 h-2.5 rounded-full border border-blue-800 flex-shrink-0 inline-block"></span>
          </div>
        </div>
      </div>`;
  }

  const data = itemDataMap.get(piece.itemId);
  const name = data?.name ?? `Item #${piece.itemId}`;
  const itemLevel = data?.itemLevel ?? "?";
  const icon = data?.icon
    ? `<img src="${data.icon}" alt="" class="w-10 h-10 rounded flex-shrink-0 object-cover"
         onerror="console.warn('[img] failed to load icon for item ${piece.itemId}:', this.src); this.style.display='none'">`
    : `<div class="w-10 h-10 rounded bg-ffxiv-border flex-shrink-0"></div>`;
  const hq = piece.hq ? ` <span class="text-[10px] text-ffxiv-gold align-middle">HQ</span>` : "";
  const hoverClass = "hover:border-ffxiv-gold";

  return `
    <div class="relative flex items-start gap-2 bg-ffxiv-panel border ${borderClass} rounded p-2 transition-colors ${hoverClass} ${clickableClass}"
         ${isClickable ? `data-slot="${slot}"` : ""}>
      ${dot}
      ${icon}
      <div class="flex-1 min-w-0">
        <p class="text-[10px] text-gray-500 uppercase tracking-wide leading-none mb-0.5">${label}</p>
        <p class="text-xs font-medium text-gray-100 truncate">${name}${hq}</p>
        <p class="text-[10px] text-ffxiv-gold font-mono mt-0.5">iLvl ${itemLevel}</p>
        ${renderMateria(piece, itemDataMap)}
      </div>
    </div>`;
}

// ---- Acquisition panel --------------------------------------------------

function renderAcquisitionPanel() {
  const panel = el("acquisition-panel");
  if (!acquisitionData || acquisitionData.length === 0) {
    panel.classList.add("hidden");
    return;
  }

  const canNow = acquisitionData.filter(s => s.canAcquireNow).length;
  const total = acquisitionData.length;
  el("acquisition-summary").innerHTML =
    `<span class="text-gray-300">${total} slot${total !== 1 ? "s" : ""} need a new item</span>` +
    (canNow > 0 ? `<span class="ml-2 text-green-400">&mdash; ${canNow} can acquire now</span>` : "");

  el("acquisition-list").innerHTML = acquisitionData.map(s => {
    const label = SLOT_LABELS[s.slot] ?? s.slot;
    const pills = [];

    if (s.coffer) {
      const ok = s.coffer.available;
      pills.push(pill(ok ? "Coffer ready" : "Coffer", ok));
    }
    if (s.books) {
      const ok = s.books.available;
      pills.push(pill(ok ? "Books ready" : `Books ${s.books.book.have}/${s.books.book.need}`, ok));
    }
    if (s.upgrade) {
      const ok = s.upgrade.available;
      pills.push(pill(ok ? "Upgrade ready" : "Upgrade", ok));
    }
    if (pills.length === 0) {
      pills.push(`<span class="text-[10px] text-gray-600 italic">No data yet</span>`);
    }

    return `
      <div class="flex items-center gap-3 bg-ffxiv-panel border border-ffxiv-border rounded px-3 py-2 cursor-pointer hover:border-ffxiv-gold transition-colors" data-acq-slot="${s.slot}">
        <span class="text-xs text-gray-300 w-20 flex-shrink-0">${label}</span>
        <div class="flex gap-1.5 flex-wrap">${pills.join("")}</div>
      </div>`;
  }).join("");

  // Clicking a row opens the compare modal for that slot
  panel.querySelectorAll("[data-acq-slot]").forEach(row => {
    row.addEventListener("click", () => openCompareModal(row.dataset.acqSlot));
  });

  panel.classList.remove("hidden");
}

function pill(text, ready) {
  const cls = ready
    ? "bg-green-900/60 text-green-300 border-green-700"
    : "bg-ffxiv-dark text-gray-400 border-ffxiv-border";
  return `<span class="px-1.5 py-0.5 text-[10px] border rounded ${cls}">${text}</span>`;
}

// ---- Modal acquisition text ---------------------------------------------

function materiaSetDiff(equipped, bis) {
  const count = ids => {
    const m = new Map();
    for (const id of ids) if (id !== 0) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  };
  const eq = count(equipped);
  const bm = count(bis);
  const toAdd = [], toRemove = [];
  for (const [id, need] of bm) {
    const have = eq.get(id) ?? 0;
    for (let i = have; i < need; i++) toAdd.push(id);
  }
  for (const [id, have] of eq) {
    const need = bm.get(id) ?? 0;
    for (let i = need; i < have; i++) toRemove.push(id);
  }
  return { toAdd, toRemove };
}

function renderMateriaAdvice(slotComp, itemDataMap) {
  const equipped = slotComp.equippedMaterias ?? [];
  const bis = slotComp.bisMaterias ?? [];
  const { toAdd, toRemove } = materiaSetDiff(equipped, bis);
  const parts = [];

  if (toRemove.length > 0) {
    parts.push(`<p class="text-[10px] text-gray-500 uppercase tracking-wide font-semibold mb-1">Remove</p>`);
    for (const id of toRemove) {
      const name = itemDataMap.get(id)?.name ?? `Materia #${id}`;
      parts.push(`<p class="text-xs text-red-400">&minus; ${name}</p>`);
    }
  }
  if (toAdd.length > 0) {
    if (toRemove.length > 0) parts.push(`<div class="h-2"></div>`);
    parts.push(`<p class="text-[10px] text-gray-500 uppercase tracking-wide font-semibold mb-1">Add</p>`);
    for (const id of toAdd) {
      const name = itemDataMap.get(id)?.name ?? `Materia #${id}`;
      parts.push(`<p class="text-xs text-green-400">+ ${name}</p>`);
    }
  }

  const bisCount = bis.filter(id => id !== 0).length;
  if (bisCount > 2) {
    parts.push(`<p class="text-[10px] text-yellow-600 mt-2">${bisCount - 2} overmeld slot${bisCount - 2 !== 1 ? "s" : ""} required &mdash; success is not guaranteed.</p>`);
  }

  return parts.join("");
}

function renderAcquisitionAdvice(s, itemDataMap) {
  const name = id => itemDataMap.get(id)?.name;
  const sections = [];

  if (s.coffer) {
    const { coffer, available } = s.coffer;
    const cofferName = name(coffer.itemId) ?? coffer.name;
    sections.push(adviceBlock(
      "Coffer", available,
      available
        ? `You have the <strong>${cofferName}</strong> in your bags — open it to get this piece.`
        : `Need the <strong>${cofferName}</strong>. Drops from savage raid.`,
    ));
  }

  if (s.books) {
    const { book, available } = s.books;
    const bookName = name(book.itemId) ?? book.name;
    sections.push(adviceBlock(
      "Books", available,
      available
        ? `Trade ${book.need}&times; <strong>${bookName}</strong> at the vendor (you have ${book.have}).`
        : `Need ${book.need}&times; <strong>${bookName}</strong> to buy the raid piece (have ${book.have}).`,
    ));
  }

  if (s.upgrade) {
    const { base, material, available } = s.upgrade;
    const tomeName  = name(base.tomes.itemId)            ?? base.tomes.name;
    const matName   = name(material.material.itemId)     ?? material.material.name;
    const bookName  = name(material.bookCost.book.itemId) ?? material.bookCost.book.name;

    let detail = "";
    if (base.haveBase) {
      detail += `You have the 780 base piece. `;
    } else if (base.canBuyWithTomes) {
      detail += `Buy the 780 base with <strong>${base.tomes.need} ${tomeName}</strong> (have ${base.tomes.have}). `;
    } else {
      detail += `Need <strong>${base.tomes.need} ${tomeName}</strong> for the 780 base (have ${base.tomes.have}). `;
    }

    if (material.available) {
      detail += `<strong>${matName}</strong> is in your bags &mdash; ready to upgrade at the vendor.`;
    } else if (material.bookCost.available) {
      const bc = material.bookCost;
      detail += `Trade ${bc.book.need}&times; <strong>${bookName}</strong> for <strong>${matName}</strong> (have ${bc.book.have}).`;
    } else {
      const bc = material.bookCost;
      detail += `Need <strong>${matName}</strong> &mdash; costs ${bc.book.need}&times; <strong>${bookName}</strong> (have ${bc.book.have}).`;
    }

    sections.push(adviceBlock("Upgrade", available, detail));
  }

  return sections.length > 0
    ? sections.join("")
    : `<p class="text-xs text-gray-500 italic">No acquisition data for this slot yet.</p>`;
}

function adviceBlock(label, ready, html) {
  const labelColor = ready ? "text-green-400" : "text-gray-500";
  return `
    <div>
      <p class="text-[10px] ${labelColor} uppercase tracking-wide font-semibold mb-1">${label}</p>
      <p class="text-xs text-gray-300 leading-relaxed">${html}</p>
    </div>`;
}

// ---- Modal --------------------------------------------------------------

function renderModalItemColumn(heading, piece, bisItem, itemDataMap, status) {
  const isBis = heading === "BIS";
  const itemId = piece?.itemId;
  const data = itemId ? itemDataMap.get(itemId) : null;
  const name = data?.name ?? (itemId ? `Item #${itemId}` : "—");
  const itemLevel = data?.itemLevel ?? "?";
  const icon = data?.icon
    ? `<img src="${data.icon}" alt="" class="w-10 h-10 rounded object-cover flex-shrink-0"
         onerror="this.style.display='none'">`
    : `<div class="w-10 h-10 rounded bg-ffxiv-border flex-shrink-0"></div>`;

  const itemNameColor = status === "wrong-item"
    ? (isBis ? "text-green-400" : "text-red-400")
    : "text-gray-100";

  let materiaHtml = "";
  if (piece) {
    materiaHtml = status === "wrong-materia"
      ? renderMateriaCompare(piece, bisItem, itemDataMap)
      : renderMateria(piece, itemDataMap);
  }

  const emptyHtml = !piece ? `<p class="text-xs text-gray-500 italic">Empty</p>` : "";

  return `
    <div class="flex-1 min-w-0">
      <p class="text-[10px] text-gray-500 uppercase tracking-wide mb-2">${heading}</p>
      <div class="flex items-start gap-2 bg-ffxiv-dark border border-ffxiv-border rounded p-2">
        ${icon}
        <div class="flex-1 min-w-0">
          <p class="text-xs font-medium ${itemNameColor} truncate">${name}</p>
          ${piece ? `<p class="text-[10px] text-ffxiv-gold font-mono mt-0.5">iLvl ${itemLevel}</p>` : ""}
          ${emptyHtml}
          ${materiaHtml}
        </div>
      </div>
    </div>`;
}

function openCompareModal(slot) {
  if (!comparisonData || !currentBisSet) return;
  const slotComp = comparisonData.slots.find(s => s.slot === slot);
  if (!slotComp || slotComp.status === "match" || slotComp.status === "bis-empty") return;

  const equipped = currentSnapshot?.items[slot] ?? null;
  const bisItem  = currentBisSet.items[slot] ?? null;

  const merged = new Map([...currentItemDataMap, ...bisItemDataMap]);

  // For the BIS column we need a fake "piece" shaped object from BisItem
  const bisPiece = bisItem ? { itemId: bisItem.itemId, materias: bisItem.materias, hq: false, canOvermeld: false } : null;

  el("modal-slot-title").textContent = SLOT_LABELS[slot] ?? slot;
  el("modal-body").innerHTML = `
    ${renderModalItemColumn("Equipped", equipped, bisPiece, merged, slotComp.status)}
    <div class="w-px bg-ffxiv-border flex-shrink-0"></div>
    ${renderModalItemColumn("BIS", bisPiece, equipped, merged, slotComp.status)}
  `;

  const acqEl = el("modal-acquisition");
  if (slotComp.status === "wrong-materia") {
    acqEl.innerHTML = renderMateriaAdvice(slotComp, merged);
    acqEl.classList.remove("hidden");
  } else {
    const slotAcq = acquisitionData?.find(s => s.slot === slot) ?? null;
    acqEl.innerHTML = renderAcquisitionAdvice(slotAcq ?? { coffer: null, books: null, upgrade: null }, merged);
    acqEl.classList.remove("hidden");
  }

  el("compare-modal").classList.remove("hidden");
}

function closeModal() {
  el("compare-modal").classList.add("hidden");
}

// ---- Gear rendering -----------------------------------------------------

function renderGear() {
  if (!currentSnapshot) return;

  const merged = new Map([...currentItemDataMap, ...bisItemDataMap]);
  const slotCompMap = {};
  for (const sc of comparisonData?.slots ?? []) {
    slotCompMap[sc.slot] = sc;
  }

  const gearList = el("gear-list");
  const leftHtml    = LEFT_SLOTS.map(slot  => renderGearItem(slot, currentSnapshot.items[slot] ?? null, merged, slotCompMap[slot])).join("");
  const rightHtml   = RIGHT_SLOTS.map(slot => renderGearItem(slot, currentSnapshot.items[slot] ?? null, merged, slotCompMap[slot])).join("");
  const crystalHtml = renderCrystal(currentSnapshot.items["crystal"] ?? null, merged);
  gearList.innerHTML = `
    <div class="flex gap-3 items-start">
      <div class="flex-1 min-w-0 space-y-2">${leftHtml}</div>
      <div class="flex-shrink-0 flex items-center justify-center self-center">${crystalHtml}</div>
      <div class="flex-1 min-w-0 space-y-2">${rightHtml}</div>
    </div>`;
  gearList.classList.remove("hidden");

  // Attach click listeners to non-matching slots
  gearList.querySelectorAll("[data-slot]").forEach(card => {
    card.addEventListener("click", () => openCompareModal(card.dataset.slot));
  });
}

// ---- Load & render gear -------------------------------------------------

async function loadGear() {
  logger.debug("[app] loadGear called");
  el("gear-list").classList.add("hidden");
  el("snapshot-meta").classList.add("hidden");
  setStatus("Fetching gear from packet capture...");

  let snapshot;
  try {
    const res = await fetch(`${API_BASE}/pcap/gear`);
    logger.debug(`[app] /pcap/gear → HTTP ${res.status}`);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setStatus(data?.error ?? "Failed to load gear", true);
      return;
    }
    snapshot = await res.json();
    logger.debug({ slots: Object.keys(snapshot.items ?? {}) }, "[app] snapshot received");
  } catch (err) {
    logger.error(err, "[app] fetch /pcap/gear failed");
    setStatus("Could not reach the server — is it running?", true);
    return;
  }

  currentSnapshot = snapshot;

  // Collect all item IDs (gear + materia)
  const allIds = new Set();
  for (const piece of Object.values(snapshot.items)) {
    if (piece?.itemId) allIds.add(piece.itemId);
    for (const mid of piece?.materias ?? []) {
      if (mid !== 0) allIds.add(mid);
    }
  }
  logger.debug({ ids: [...allIds] }, `[app] resolving ${allIds.size} item IDs`);

  setStatus("Resolving item names...");
  const resolved = await Promise.all([...allIds].map(id => fetchItemData(id).then(d => [id, d])));
  currentItemDataMap = new Map(resolved);

  clearStatus();
  renderGear();

  const meta = el("snapshot-meta");
  if (snapshot.capturedAt) {
    meta.textContent = `Captured ${new Date(snapshot.capturedAt).toLocaleString()}`;
    meta.classList.remove("hidden");
  }

  // Auto-populate BIS links from equipped soul crystal
  await autoDetectJob(currentItemDataMap);

  // Re-run comparison if a BIS URL is already selected
  if (el("sel-bis-link").value) {
    await runComparison();
  }
}

// ---- BIS comparison -----------------------------------------------------

async function runComparison() {
  const url = el("sel-bis-link").value;
  if (!url) return;

  setStatus("Comparing gear...");
  let compRes, bisRes, acqRes;
  try {
    [compRes, bisRes, acqRes] = await Promise.all([
      fetch(`${API_BASE}/compare?url=${encodeURIComponent(url)}`),
      fetch(`${API_BASE}/bis?url=${encodeURIComponent(url)}`),
      fetch(`${API_BASE}/acquisition?url=${encodeURIComponent(url)}`),
    ]);
  } catch (err) {
    logger.error(err, "[app] comparison fetch failed");
    setStatus("Comparison request failed", true);
    return;
  }

  if (!compRes.ok) {
    const data = await compRes.json().catch(() => null);
    setStatus(data?.error ?? `Comparison failed (${compRes.status})`, true);
    return;
  }
  if (!bisRes.ok) {
    const data = await bisRes.json().catch(() => null);
    setStatus(data?.error ?? `BIS fetch failed (${bisRes.status})`, true);
    return;
  }

  comparisonData = await compRes.json();
  currentBisSet  = await bisRes.json();
  if (acqRes.ok) {
    acquisitionData = await acqRes.json();
    logger.debug({ count: acquisitionData.length, slots: acquisitionData.map(s => s.slot) }, "[app] acquisition data received");
  } else {
    const errBody = await acqRes.json().catch(() => null);
    logger.warn({ status: acqRes.status, body: errBody }, "[app] acquisition fetch failed");
    acquisitionData = null;
  }

  // Pre-fetch item data for all BIS items
  const bisIds = new Set();
  for (const item of Object.values(currentBisSet.items)) {
    if (item?.itemId) bisIds.add(item.itemId);
    for (const mid of item?.materias ?? []) { if (mid) bisIds.add(mid); }
  }
  const resolvedBis = await Promise.all([...bisIds].map(id => fetchItemData(id).then(d => [id, d])));
  bisItemDataMap = new Map(resolvedBis);

  clearStatus();
  el("btn-clear-compare").classList.remove("hidden");
  renderGear();
  renderAcquisitionPanel();
}

// ---- BIS selector -------------------------------------------------------

async function autoDetectJob(itemDataMap) {
  const crystal = currentSnapshot?.items?.crystal;
  if (!crystal) return;

  const data = itemDataMap.get(crystal.itemId);
  if (!data?.name) return;

  const jobLabel = crystalJobName(data.name);
  const job = JOBS.find(j => j.label.toLowerCase() === jobLabel.toLowerCase());
  if (!job) return;

  // Same job as last time — dropdown is already populated, leave selection intact
  const jobKey = `${job.role}/${job.job}`;
  if (jobKey === currentJobKey) return;
  currentJobKey = jobKey;

  // Reset BIS link dropdown
  el("bis-link-wrap").classList.add("hidden");
  el("btn-compare").classList.add("hidden");
  el("sel-bis-link").innerHTML = `<option value="">— Select —</option>`;

  setStatus(`Loading BIS sets for ${job.label}...`);
  let links;
  try {
    const res = await fetch(`${API_BASE}/balance/${job.role}/${job.job}`);
    if (!res.ok) {
      const data2 = await res.json().catch(() => null);
      setStatus(data2?.error ?? "Failed to load BIS links", true);
      return;
    }
    links = await res.json();
  } catch (err) {
    logger.error(err, "[app] /balance fetch failed");
    setStatus("Could not load BIS links", true);
    return;
  }

  clearStatus();
  if (!links.length) return;

  const sel = el("sel-bis-link");
  for (const { label: linkLabel, url } of links) {
    const opt = document.createElement("option");
    opt.value = url;
    opt.textContent = linkLabel;
    sel.appendChild(opt);
  }
  el("bis-link-wrap").classList.remove("hidden");

  // Auto-select and show Compare if only one option
  if (links.length === 1) {
    sel.value = links[0].url;
    onBisLinkChange();
  }
}

function onBisLinkChange() {
  el("btn-compare").classList[el("sel-bis-link").value ? "remove" : "add"]("hidden");
}

function clearComparison() {
  comparisonData  = null;
  currentBisSet   = null;
  bisItemDataMap  = new Map();
  acquisitionData = null;
  currentJobKey   = null;
  el("bis-link-wrap").classList.add("hidden");
  el("btn-compare").classList.add("hidden");
  el("btn-clear-compare").classList.add("hidden");
  el("acquisition-panel").classList.add("hidden");
  el("sel-bis-link").innerHTML = `<option value="">— Select —</option>`;
  renderGear();
}

// ---- Init ---------------------------------------------------------------

el("sel-bis-link").addEventListener("change", onBisLinkChange);
el("btn-compare").addEventListener("click", runComparison);
el("btn-clear-compare").addEventListener("click", clearComparison);

el("btn-refresh").addEventListener("click", loadGear);

el("btn-win-close").addEventListener("click", () => fetch("/window/close", { method: "POST" }));
el("btn-win-minimize").addEventListener("click", () => fetch("/window/minimize", { method: "POST" }));
el("btn-win-maximize").addEventListener("click", () => fetch("/window/maximize", { method: "POST" }));

el("modal-close").addEventListener("click", closeModal);
el("compare-modal").addEventListener("click", e => {
  if (e.target === el("compare-modal")) closeModal();
});

// ---- Window resize handles --------------------------------------------------

const MIN_W = 480;
const MIN_H = 320;

// Only n/w/nw/ne/sw edges need the screen position (to reposition while resizing).
const NEEDS_POSITION = new Set(["n", "w", "nw", "ne", "sw"]);

let resizeState = null;
let resizeRafId = null;
let resizeAbort = null;

document.querySelectorAll("[data-dir]").forEach((handle) => {
  handle.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const dir = handle.dataset.dir;

    // For edges that only grow right/down we can start immediately from the
    // current viewport size — no round-trip needed.
    if (!NEEDS_POSITION.has(dir)) {
      resizeState = {
        dir,
        startX: e.clientX,
        startY: e.clientY,
        startW: window.innerWidth,
        startH: window.innerHeight,
        startWinX: 0,
        startWinY: 0,
        pendingX: 0,
        pendingY: 0,
        pendingW: window.innerWidth,
        pendingH: window.innerHeight,
        dirty: false,
      };
      handle.setPointerCapture(e.pointerId);
    } else {
      // Edges that move the window need the real screen coordinates.
      fetch("/window/frame")
        .then((r) => r.json())
        .then((frame) => {
          resizeState = {
            dir,
            startX: e.clientX,
            startY: e.clientY,
            startW: frame.width,
            startH: frame.height,
            startWinX: frame.x,
            startWinY: frame.y,
            pendingX: frame.x,
            pendingY: frame.y,
            pendingW: frame.width,
            pendingH: frame.height,
            dirty: false,
          };
          handle.setPointerCapture(e.pointerId);
        });
    }
  });
});

function flushResize() {
  resizeRafId = null;
  if (!resizeState?.dirty) return;
  resizeState.dirty = false;

  // Cancel any in-flight request so stale responses can't jump the window back.
  resizeAbort?.abort();
  resizeAbort = new AbortController();

  fetch("/window/setFrame", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      x: resizeState.pendingX,
      y: resizeState.pendingY,
      width: resizeState.pendingW,
      height: resizeState.pendingH,
    }),
    signal: resizeAbort.signal,
  }).catch((err) => { if (err.name !== "AbortError") console.error("[resize]", err); });
}

document.addEventListener("pointermove", (e) => {
  if (!resizeState) return;
  const { dir, startX, startY, startW, startH, startWinX, startWinY } = resizeState;
  const dx = e.clientX - startX;
  const dy = e.clientY - startY;

  let x = startWinX, y = startWinY, w = startW, h = startH;
  if (dir.includes("e")) w = Math.max(MIN_W, startW + dx);
  if (dir.includes("s")) h = Math.max(MIN_H, startH + dy);
  if (dir.includes("w")) { w = Math.max(MIN_W, startW - dx); x = startWinX + (startW - w); }
  if (dir.includes("n")) { h = Math.max(MIN_H, startH - dy); y = startWinY + (startH - h); }

  resizeState.pendingX = x;
  resizeState.pendingY = y;
  resizeState.pendingW = w;
  resizeState.pendingH = h;
  resizeState.dirty = true;

  // Coalesce all moves in a frame into one request (~60 fps max).
  if (!resizeRafId) resizeRafId = requestAnimationFrame(flushResize);
});

document.addEventListener("pointerup", () => {
  if (resizeRafId) { cancelAnimationFrame(resizeRafId); resizeRafId = null; }
  resizeAbort?.abort();
  resizeAbort = null;
  resizeState = null;
});

loadGear();
