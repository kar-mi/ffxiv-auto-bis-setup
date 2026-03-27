const API_BASE = "http://localhost:3000";

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

// ---- DOM helpers -------------------------------------------------------

function el(id) {
  return document.getElementById(id);
}

function setStatus(msg, isError = false) {
  const s = el("status");
  s.textContent = msg;
  s.className = `text-sm mb-6 ${isError ? "text-red-400" : "text-gray-400"}`;
  s.classList.remove("hidden");
}

function clearStatus() {
  el("status").classList.add("hidden");
}

// ---- Rendering ---------------------------------------------------------

function renderMateria(materia) {
  if (!materia.length) return "";
  return `
    <div class="flex gap-1 flex-wrap mt-1">
      ${materia.map(m => `
        <span class="text-xs bg-ffxiv-border text-ffxiv-gold px-2 py-0.5 rounded">
          ${m}
        </span>
      `).join("")}
    </div>
  `;
}

function renderGearItem(slot, item) {
  const label = SLOT_LABELS[slot] ?? slot;

  if (!item) {
    return `
      <div class="flex items-center gap-4 bg-ffxiv-panel border border-ffxiv-border rounded px-4 py-3 opacity-40">
        <div class="w-10 h-10 rounded bg-ffxiv-border flex-shrink-0"></div>
        <div>
          <p class="text-xs text-gray-500">${label}</p>
          <p class="text-sm text-gray-600 italic">Empty</p>
        </div>
      </div>
    `;
  }

  const icon = item.iconUrl
    ? `<img src="${item.iconUrl}" alt="${item.name}" class="w-10 h-10 rounded flex-shrink-0" />`
    : `<div class="w-10 h-10 rounded bg-ffxiv-border flex-shrink-0"></div>`;

  const glam = item.glamourName
    ? `<span class="text-xs text-gray-500 ml-1">(${item.glamourName})</span>`
    : "";

  const dye = item.dye
    ? `<span class="text-xs text-gray-400 ml-1">· ${item.dye}</span>`
    : "";

  return `
    <div class="flex items-start gap-4 bg-ffxiv-panel border border-ffxiv-border rounded px-4 py-3 hover:border-ffxiv-gold transition-colors">
      ${icon}
      <div class="flex-1 min-w-0">
        <div class="flex items-baseline justify-between gap-2">
          <div class="flex items-baseline gap-1 flex-wrap">
            <p class="text-xs text-gray-500">${label}</p>
            <p class="text-sm font-medium text-gray-100 truncate">${item.name}${glam}</p>
            ${dye}
          </div>
          <span class="text-xs text-ffxiv-gold font-mono flex-shrink-0">iLvl ${item.itemLevel}</span>
        </div>
        ${renderMateria(item.materia)}
      </div>
    </div>
  `;
}

function renderCharacter(character) {
  el("char-name").textContent = character.name;
  el("char-meta").textContent = `${character.world} [${character.dc}] · Level ${character.level}`;
  el("character-header").classList.remove("hidden");

  const gearList = el("gear-list");
  gearList.innerHTML = Object.entries(character.gear)
    .map(([slot, item]) => renderGearItem(slot, item))
    .join("");
  gearList.classList.remove("hidden");
}

// ---- API calls ---------------------------------------------------------

async function loadCharacter(lodestoneId) {
  setStatus("Loading...");
  const res = await fetch(`${API_BASE}/user/${lodestoneId}`);
  const data = await res.json();
  if (!res.ok) {
    setStatus(data.error, true);
    return;
  }
  clearStatus();
  renderCharacter(data);
}

async function refreshCharacter(lodestoneId) {
  setStatus("Fetching from Lodestone — this may take a moment...");
  const res = await fetch(`${API_BASE}/user/${lodestoneId}`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) {
    setStatus(data.error, true);
    return;
  }
  clearStatus();
  renderCharacter(data);
}

// ---- Event listeners ---------------------------------------------------

el("btn-load").addEventListener("click", () => {
  const id = el("lodestone-id").value.trim();
  if (!id) return;
  loadCharacter(id);
});

el("btn-refresh").addEventListener("click", () => {
  const id = el("lodestone-id").value.trim();
  if (!id) return;
  refreshCharacter(id);
});

el("lodestone-id").addEventListener("keydown", (e) => {
  if (e.key === "Enter") el("btn-load").click();
});
