export const API_BASE = "http://localhost:3000";

export const SLOT_LABELS: Record<string, string> = {
  mainHand: "Main Hand",
  offHand:  "Off Hand",
  head:     "Head",
  chest:    "Body",
  gloves:   "Hands",
  legs:     "Legs",
  feet:     "Feet",
  earRings: "Earrings",
  necklace: "Necklace",
  bracelet: "Bracelets",
  ring1:    "Ring 1",
  ring2:    "Ring 2",
  crystal:  "Soul Crystal",
};

export const LEFT_SLOTS  = ["mainHand", "head", "chest", "gloves", "legs", "feet"] as const;
export const RIGHT_SLOTS = ["offHand", "earRings", "necklace", "bracelet", "ring1", "ring2"] as const;

export interface Job {
  label: string;
  abbrev: string;
  role: string;
  job: string;
}

// FFXIV ClassJob sheet IDs for each job. Used to key the per-job gear cache.
// Base classes (GLA, MRD, etc.) are excluded — only jobs are tracked.
export const JOB_ABBREV_TO_CLASS_ID: Record<string, number> = {
  PLD: 19, MNK: 20, WAR: 21, DRG: 22, BRD: 23,
  WHM: 24, BLM: 25, SMN: 27, SCH: 28, NIN: 30,
  MCH: 31, DRK: 32, AST: 33, SAM: 34, RDM: 35,
  GNB: 37, DNC: 38, RPR: 39, SGE: 40, VPR: 41, PCT: 42,
};

export const CLASS_ID_TO_JOB_ABBREV: Record<number, string> = Object.fromEntries(
  Object.entries(JOB_ABBREV_TO_CLASS_ID).map(([k, v]) => [v, k])
);

export const JOBS: Job[] = [
  { label: "Paladin",     abbrev: "PLD", role: "tanks",   job: "paladin" },
  { label: "Warrior",     abbrev: "WAR", role: "tanks",   job: "warrior" },
  { label: "Dark Knight", abbrev: "DRK", role: "tanks",   job: "dark-knight" },
  { label: "Gunbreaker",  abbrev: "GNB", role: "tanks",   job: "gunbreaker" },
  { label: "White Mage",  abbrev: "WHM", role: "healers", job: "white-mage" },
  { label: "Scholar",     abbrev: "SCH", role: "healers", job: "scholar" },
  { label: "Astrologian", abbrev: "AST", role: "healers", job: "astrologian" },
  { label: "Sage",        abbrev: "SGE", role: "healers", job: "sage" },
  { label: "Monk",        abbrev: "MNK", role: "melee",   job: "monk" },
  { label: "Dragoon",     abbrev: "DRG", role: "melee",   job: "dragoon" },
  { label: "Ninja",       abbrev: "NIN", role: "melee",   job: "ninja" },
  { label: "Samurai",     abbrev: "SAM", role: "melee",   job: "samurai" },
  { label: "Reaper",      abbrev: "RPR", role: "melee",   job: "reaper" },
  { label: "Viper",       abbrev: "VPR", role: "melee",   job: "viper" },
  { label: "Bard",        abbrev: "BRD", role: "ranged",  job: "bard" },
  { label: "Machinist",   abbrev: "MCH", role: "ranged",  job: "machinist" },
  { label: "Dancer",      abbrev: "DNC", role: "ranged",  job: "dancer" },
  { label: "Black Mage",  abbrev: "BLM", role: "casters", job: "black-mage" },
  { label: "Summoner",    abbrev: "SMN", role: "casters", job: "summoner" },
  { label: "Red Mage",    abbrev: "RDM", role: "casters", job: "red-mage" },
  { label: "Pictomancer", abbrev: "PCT", role: "casters", job: "pictomancer" },
];
