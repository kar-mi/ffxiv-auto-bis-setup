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

const SLOT_ORDER = [
  "mainHand", "offHand",
  "head", "chest", "gloves", "legs", "feet",
  "earRings", "necklace", "bracelet", "ring1", "ring2",
  "crystal",
];

// ---- XIVAPI item cache --------------------------------------------------

const itemCache = new Map();

async function fetchItemData(itemId) {
  if (itemCache.has(itemId)) return itemCache.get(itemId);
  const promise = fetch(`${XIVAPI_BASE}/sheet/Item/${itemId}?fields=Name,Icon,LevelItem`)
    .then(res => (res.ok ? res.json() : null))
    .then(data => {
      if (!data?.fields) return { name: `Item #${itemId}`, icon: null, itemLevel: 0 };
      const { Name, Icon, LevelItem } = data.fields;
      const iconUrl = Icon ? `${XIVAPI_BASE}/asset/${Icon}?format=jpg` : null;
      const itemLevel = typeof LevelItem === "number" ? LevelItem
        : typeof LevelItem?.value === "number" ? LevelItem.value : 0;
      return { name: Name ?? `Item #${itemId}`, icon: iconUrl, itemLevel };
    })
    .catch(() => ({ name: `Item #${itemId}`, icon: null, itemLevel: 0 }));
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

function renderMateria(materias, itemDataMap) {
  const filled = materias.filter(id => id !== 0);
  if (!filled.length) return "";
  const chips = filled.map(id => {
    const data = itemDataMap.get(id);
    const name = data?.name ?? `Materia #${id}`;
    return `<span class="text-xs bg-ffxiv-border text-ffxiv-gold px-2 py-0.5 rounded">${name}</span>`;
  }).join("");
  return `<div class="flex gap-1 flex-wrap mt-1">${chips}</div>`;
}

function renderGearItem(slot, piece, itemDataMap) {
  const label = SLOT_LABELS[slot] ?? slot;

  if (!piece) {
    return `
      <div class="flex items-center gap-4 bg-ffxiv-panel border border-ffxiv-border rounded px-4 py-3 opacity-40">
        <div class="w-10 h-10 rounded bg-ffxiv-border flex-shrink-0"></div>
        <div>
          <p class="text-xs text-gray-500">${label}</p>
          <p class="text-sm text-gray-600 italic">Empty</p>
        </div>
      </div>`;
  }

  const data = itemDataMap.get(piece.itemId);
  const name = data?.name ?? `Item #${piece.itemId}`;
  const itemLevel = data?.itemLevel ?? "?";
  const icon = data?.icon
    ? `<img src="${data.icon}" alt="${name}" class="w-10 h-10 rounded flex-shrink-0" onerror="this.style.display='none'">`
    : `<div class="w-10 h-10 rounded bg-ffxiv-border flex-shrink-0"></div>`;
  const hq = piece.hq ? ` <span class="text-xs text-ffxiv-gold">HQ</span>` : "";

  return `
    <div class="flex items-start gap-4 bg-ffxiv-panel border border-ffxiv-border rounded px-4 py-3 hover:border-ffxiv-gold transition-colors">
      ${icon}
      <div class="flex-1 min-w-0">
        <div class="flex items-baseline justify-between gap-2">
          <div class="flex items-baseline gap-1 flex-wrap">
            <p class="text-xs text-gray-500">${label}</p>
            <p class="text-sm font-medium text-gray-100">${name}${hq}</p>
          </div>
          <span class="text-xs text-ffxiv-gold font-mono flex-shrink-0">iLvl ${itemLevel}</span>
        </div>
        ${renderMateria(piece.materias ?? [], itemDataMap)}
      </div>
    </div>`;
}

// ---- Load & render gear -------------------------------------------------

async function loadGear() {
  el("gear-list").classList.add("hidden");
  el("snapshot-meta").classList.add("hidden");
  setStatus("Fetching gear from packet capture...");

  let snapshot;
  try {
    const res = await fetch(`${API_BASE}/pcap/gear`);
    const data = await res.json();
    if (!res.ok) { setStatus(data.error ?? "Failed to load gear", true); return; }
    snapshot = data;
  } catch {
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

  setStatus("Resolving item names...");
  const resolved = await Promise.all([...allIds].map(id => fetchItemData(id).then(d => [id, d])));
  const itemDataMap = new Map(resolved);

  clearStatus();

  const gearList = el("gear-list");
  gearList.innerHTML = SLOT_ORDER
    .map(slot => renderGearItem(slot, snapshot.items[slot] ?? null, itemDataMap))
    .join("");
  gearList.classList.remove("hidden");

  const meta = el("snapshot-meta");
  if (snapshot.capturedAt) {
    meta.textContent = `Captured ${new Date(snapshot.capturedAt).toLocaleString()}`;
    meta.classList.remove("hidden");
  }
}

// ---- Init ---------------------------------------------------------------

el("btn-refresh").addEventListener("click", loadGear);
loadGear();
