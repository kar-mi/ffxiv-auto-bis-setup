import { Character } from "@xivapi/nodestone";
import { parseHTML } from "linkedom";

// ---- Raw types from @xivapi/nodestone ----------------------------------------

interface RawGearItem {
  Name: string;
  DbLink: string;
  MirageName?: string;
  MirageDbLink?: string;
  Stain?: string;
  CreatorName?: string;
  ClassList?: string;
  ItemLevel?: string;
}

interface RawCharacter {
  Name: string;
  World: string;
  DC: string;
  Level: number;
  Title: string | null;
  Race: string;
  Tribe: string;
  Gender: string;
  Mainhand: RawGearItem | null;
  Offhand: RawGearItem | null;
  Head: RawGearItem | null;
  Body: RawGearItem | null;
  Hands: RawGearItem | null;
  Waist: RawGearItem | null;
  Legs: RawGearItem | null;
  Feet: RawGearItem | null;
  Earrings: RawGearItem | null;
  Necklace: RawGearItem | null;
  Bracelets: RawGearItem | null;
  Ring1: RawGearItem | null;
  Ring2: RawGearItem | null;
  Soulcrystal: RawGearItem | null;
  [key: string]: unknown;
}

// ---- Clean types -------------------------------------------------------------

export interface GearItem {
  name: string;
  itemLevel: number;
  iconUrl: string | null;
  classJobs: string[];
  glamourName: string | null;
  dye: string | null;
  materia: string[];
  crafterName: string | null;
}

export interface GearSlots {
  mainhand: GearItem | null;
  offhand: GearItem | null;
  head: GearItem | null;
  body: GearItem | null;
  hands: GearItem | null;
  legs: GearItem | null;
  feet: GearItem | null;
  earrings: GearItem | null;
  necklace: GearItem | null;
  bracelets: GearItem | null;
  ring1: GearItem | null;
  ring2: GearItem | null;
  soulcrystal: GearItem | null;
}

export interface CharacterGear {
  name: string;
  world: string;
  dc: string;
  level: number;
  gear: GearSlots;
}

// Slot index matches nodestone's .icon-c--N ordering
const SLOT_INDICES = {
  mainhand: 0,
  offhand: 1,
  head: 2,
  body: 3,
  hands: 4,
  // waist: 5 — removed in Endwalker
  legs: 6,
  feet: 7,
  earrings: 8,
  necklace: 9,
  bracelets: 10,
  ring1: 11,
  ring2: 12,
  soulcrystal: 13,
} as const;

type SlotName = keyof typeof SLOT_INDICES;

// ---- Parsing helpers ---------------------------------------------------------

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

function parseMirageName(raw: string | undefined): string | null {
  if (!raw) return null;
  return stripHtml(raw) || null;
}

function parseItemLevel(raw: string | undefined): number {
  if (!raw) return 0;
  const match = raw.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function parseClassJobs(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.trim().split(/\s+/);
}

interface SlotExtras {
  materia: string[];
  iconUrl: string | null;
}

async function fetchSlotExtras(lodestoneId: string): Promise<Record<SlotName, SlotExtras>> {
  const url = `https://na.finalfantasyxiv.com/lodestone/character/${lodestoneId}/`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ffxiv-gear-setup/1.0)" },
  });

  if (!res.ok) {
    throw new Error(`Lodestone request failed: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const { document } = parseHTML(html);

  const result = {} as Record<SlotName, SlotExtras>;

  for (const [slot, index] of Object.entries(SLOT_INDICES) as [SlotName, number][]) {
    const container = document.querySelector(`.icon-c--${index}`);
    if (!container) {
      result[slot] = { materia: [], iconUrl: null };
      continue;
    }

    const materiaEls = container.querySelectorAll(".db-tooltip__materia__txt");
    const materia = Array.from(materiaEls).map((el) => {
      // innerHTML is e.g. "Savage Might Materia XII<br><span>...</span>"
      const name = el.innerHTML.split("<br>")[0];
      return stripHtml(name);
    }).filter(Boolean);

    const iconEl = container.querySelector("img.character__item_icon__img");
    const iconUrl = iconEl?.getAttribute("src") ?? null;

    result[slot] = { materia, iconUrl };
  }

  return result;
}

function parseGearItem(raw: RawGearItem | null, extras: SlotExtras): GearItem | null {
  if (!raw) return null;

  return {
    name: stripHtml(raw.Name),
    itemLevel: parseItemLevel(raw.ItemLevel),
    iconUrl: extras.iconUrl,
    classJobs: parseClassJobs(raw.ClassList),
    glamourName: parseMirageName(raw.MirageName),
    dye: raw.Stain ?? null,
    materia: extras.materia,
    crafterName: raw.CreatorName ?? null,
  };
}

// ---- Public API --------------------------------------------------------------

const parser = new Character();

export async function fetchCharacterGear(lodestoneId: string): Promise<CharacterGear> {
  const [raw, extras] = await Promise.all([
    parser.parse({ params: { characterId: lodestoneId } }) as Promise<RawCharacter>,
    fetchSlotExtras(lodestoneId),
  ]);

  return {
    name: raw.Name,
    world: raw.World,
    dc: raw.DC,
    level: raw.Level,
    gear: {
      mainhand: parseGearItem(raw.Mainhand, extras.mainhand),
      offhand: parseGearItem(raw.Offhand, extras.offhand),
      head: parseGearItem(raw.Head, extras.head),
      body: parseGearItem(raw.Body, extras.body),
      hands: parseGearItem(raw.Hands, extras.hands),
      legs: parseGearItem(raw.Legs, extras.legs),
      feet: parseGearItem(raw.Feet, extras.feet),
      earrings: parseGearItem(raw.Earrings, extras.earrings),
      necklace: parseGearItem(raw.Necklace, extras.necklace),
      bracelets: parseGearItem(raw.Bracelets, extras.bracelets),
      ring1: parseGearItem(raw.Ring1, extras.ring1),
      ring2: parseGearItem(raw.Ring2, extras.ring2),
      soulcrystal: parseGearItem(raw.Soulcrystal, extras.soulcrystal),
    },
  };
}
