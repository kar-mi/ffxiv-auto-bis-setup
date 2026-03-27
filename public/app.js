const logger = {
  debug: (...a) => console.debug(...a),
  info:  (...a) => console.info(...a),
  warn:  (...a) => console.warn(...a),
  error: (...a) => console.error(...a),
};
logger.info("[app] app.js loaded");

const API_BASE = "http://localhost:3000";
const XIVAPI_BASE = "https://v2.xivapi.com/api";

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

// ---- XIVAPI item cache --------------------------------------------------

const itemCache = new Map();

async function fetchItemData(itemId) {
  if (itemCache.has(itemId)) return itemCache.get(itemId);
  const url = `${XIVAPI_BASE}/sheet/Item/${itemId}?fields=Name,Icon,LevelItem`;
  logger.debug(`[xivapi] GET ${url}`);
  const promise = fetch(url)
    .then(res => {
      logger.debug(`[xivapi] item ${itemId} → HTTP ${res.status}`);
      return res.ok ? res.json() : null;
    })
    .then(data => {
      if (!data?.fields) {
        logger.warn(`[xivapi] item ${itemId} — no fields in response`);
        return { name: `Item #${itemId}`, icon: null, itemLevel: 0 };
      }
      const { Name, Icon, LevelItem } = data.fields;
      const iconPath = Icon?.path_hr1 ?? Icon?.path ?? null;
      const iconUrl = iconPath ? `${XIVAPI_BASE}/asset/${iconPath}?format=png` : null;
      logger.debug(`[xivapi] item ${itemId} — Name="${Name}" iconUrl="${iconUrl}"`);
      const itemLevel = typeof LevelItem === "number" ? LevelItem
        : typeof LevelItem?.value === "number" ? LevelItem.value : 0;
      return { name: Name ?? `Item #${itemId}`, icon: iconUrl, itemLevel };
    })
    .catch(err => {
      logger.error(err, `[xivapi] item ${itemId} fetch error`);
      return { name: `Item #${itemId}`, icon: null, itemLevel: 0 };
    });
  itemCache.set(itemId, promise);
  return promise;
}

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
  const totalSlots = piece.canOvermeld ? 5 : 2;
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

function renderGearItem(slot, piece, itemDataMap) {
  const label = SLOT_LABELS[slot] ?? slot;

  if (!piece) {
    return `
      <div class="flex items-start gap-2 bg-ffxiv-panel border border-ffxiv-border rounded p-2 opacity-40">
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

  return `
    <div class="flex items-start gap-2 bg-ffxiv-panel border border-ffxiv-border rounded p-2 hover:border-ffxiv-gold transition-colors">
      ${icon}
      <div class="flex-1 min-w-0">
        <p class="text-[10px] text-gray-500 uppercase tracking-wide leading-none mb-0.5">${label}</p>
        <p class="text-xs font-medium text-gray-100 truncate">${name}${hq}</p>
        <p class="text-[10px] text-ffxiv-gold font-mono mt-0.5">iLvl ${itemLevel}</p>
        ${renderMateria(piece, itemDataMap)}
      </div>
    </div>`;
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
    const data = await res.json();
    if (!res.ok) { setStatus(data.error ?? "Failed to load gear", true); return; }
    snapshot = data;
    logger.debug({ slots: Object.keys(snapshot.items ?? {}) }, "[app] snapshot received");
  } catch (err) {
    logger.error(err, "[app] fetch /pcap/gear failed");
    setStatus("Could not reach the server — is it running?", true);
    return;
  }

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
  const itemDataMap = new Map(resolved);

  clearStatus();

  const gearList = el("gear-list");
  const leftHtml    = LEFT_SLOTS.map(slot  => renderGearItem(slot, snapshot.items[slot] ?? null, itemDataMap)).join("");
  const rightHtml   = RIGHT_SLOTS.map(slot => renderGearItem(slot, snapshot.items[slot] ?? null, itemDataMap)).join("");
  const crystalHtml = renderCrystal(snapshot.items["crystal"] ?? null, itemDataMap);
  gearList.innerHTML = `
    <div class="flex gap-3 items-start">
      <div class="flex-1 min-w-0 space-y-2">${leftHtml}</div>
      <div class="flex-shrink-0 flex items-center justify-center self-center">${crystalHtml}</div>
      <div class="flex-1 min-w-0 space-y-2">${rightHtml}</div>
    </div>`;
  gearList.classList.remove("hidden");

  const meta = el("snapshot-meta");
  if (snapshot.capturedAt) {
    meta.textContent = `Captured ${new Date(snapshot.capturedAt).toLocaleString()}`;
    meta.classList.remove("hidden");
  }
}

// ---- Init ---------------------------------------------------------------

el("btn-refresh").addEventListener("click", loadGear);

el("btn-win-close").addEventListener("click", () => fetch("/window/close", { method: "POST" }));
el("btn-win-minimize").addEventListener("click", () => fetch("/window/minimize", { method: "POST" }));
el("btn-win-maximize").addEventListener("click", () => fetch("/window/maximize", { method: "POST" }));

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
  }).catch(() => {}); // suppress AbortError
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
