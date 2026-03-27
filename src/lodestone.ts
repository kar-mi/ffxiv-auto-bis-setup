import { Character } from "@xivapi/nodestone";
import { parseHTML } from "linkedom";
import type { LodestoneItem, LodestoneCharacter, SlotName } from "./types.ts";

export type { LodestoneItem, LodestoneCharacter };

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

// ---- Lodestone DOM slot indices ----------------------------------------------

// Maps canonical SlotName → icon-c--N index used in the Lodestone HTML.
const SLOT_INDICES: Partial<Record<SlotName, number>> = {
  mainHand:  0,
  offHand:   1,
  head:      2,
  chest:     3,
  gloves:    4,
  // belt: 5 — removed in Endwalker
  legs:      6,
  feet:      7,
  earRings:  8,
  necklace:  9,
  bracelet:  10,
  ring1:     11,
  ring2:     12,
  crystal:   13,
};

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

async function fetchSlotExtras(lodestoneId: string): Promise<Partial<Record<SlotName, SlotExtras>>> {
  const url = `https://na.finalfantasyxiv.com/lodestone/character/${lodestoneId}/`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ffxiv-gear-setup/1.0)" },
  });

  if (!res.ok) {
    throw new Error(`Lodestone request failed: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const { document } = parseHTML(html);

  const result: Partial<Record<SlotName, SlotExtras>> = {};

  for (const [slot, index] of Object.entries(SLOT_INDICES) as [SlotName, number][]) {
    const container = document.querySelector(`.icon-c--${index}`);
    if (!container) {
      result[slot] = { materia: [], iconUrl: null };
      continue;
    }

    const materiaEls = container.querySelectorAll(".db-tooltip__materia__txt");
    const materia = Array.from(materiaEls).map((el) => {
      // innerHTML is e.g. "Savage Might Materia XII<br><span>...</span>"
      const name = (el as Element).innerHTML.split("<br>")[0];
      return stripHtml(name);
    }).filter(Boolean);

    const iconEl = container.querySelector("img.character__item_icon__img");
    const iconUrl = iconEl?.getAttribute("src") ?? null;

    result[slot] = { materia, iconUrl };
  }

  return result;
}

function parseGearItem(raw: RawGearItem | null, extras: SlotExtras | undefined): LodestoneItem | null {
  if (!raw) return null;
  const e = extras ?? { materia: [], iconUrl: null };

  return {
    name: stripHtml(raw.Name),
    itemLevel: parseItemLevel(raw.ItemLevel),
    iconUrl: e.iconUrl,
    classJobs: parseClassJobs(raw.ClassList),
    glamourName: parseMirageName(raw.MirageName),
    dye: raw.Stain ?? null,
    materia: e.materia,
    crafterName: raw.CreatorName ?? null,
  };
}

// ---- Public API --------------------------------------------------------------

const parser = new Character();

export async function fetchCharacterGear(lodestoneId: string): Promise<LodestoneCharacter> {
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
      mainHand: parseGearItem(raw.Mainhand,   extras.mainHand),
      offHand:  parseGearItem(raw.Offhand,    extras.offHand),
      head:     parseGearItem(raw.Head,       extras.head),
      chest:    parseGearItem(raw.Body,       extras.chest),
      gloves:   parseGearItem(raw.Hands,      extras.gloves),
      legs:     parseGearItem(raw.Legs,       extras.legs),
      feet:     parseGearItem(raw.Feet,       extras.feet),
      earRings: parseGearItem(raw.Earrings,   extras.earRings),
      necklace: parseGearItem(raw.Necklace,   extras.necklace),
      bracelet: parseGearItem(raw.Bracelets,  extras.bracelet),
      ring1:    parseGearItem(raw.Ring1,      extras.ring1),
      ring2:    parseGearItem(raw.Ring2,      extras.ring2),
      crystal:  parseGearItem(raw.Soulcrystal, extras.crystal),
    },
  };
}
