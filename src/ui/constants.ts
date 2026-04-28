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
  classId: number;
}

// FFXIV ClassJob sheet IDs are encoded directly in the JOBS table below.
// Base classes (GLA, MRD, etc.) are excluded — only jobs are tracked.
export const JOBS: Job[] = [
  { label: "Paladin",     abbrev: "PLD", role: "tanks",   job: "paladin",      classId: 19 },
  { label: "Warrior",     abbrev: "WAR", role: "tanks",   job: "warrior",      classId: 21 },
  { label: "Dark Knight", abbrev: "DRK", role: "tanks",   job: "dark-knight",  classId: 32 },
  { label: "Gunbreaker",  abbrev: "GNB", role: "tanks",   job: "gunbreaker",   classId: 37 },
  { label: "White Mage",  abbrev: "WHM", role: "healers", job: "white-mage",   classId: 24 },
  { label: "Scholar",     abbrev: "SCH", role: "healers", job: "scholar",      classId: 28 },
  { label: "Astrologian", abbrev: "AST", role: "healers", job: "astrologian",  classId: 33 },
  { label: "Sage",        abbrev: "SGE", role: "healers", job: "sage",         classId: 40 },
  { label: "Monk",        abbrev: "MNK", role: "melee",   job: "monk",         classId: 20 },
  { label: "Dragoon",     abbrev: "DRG", role: "melee",   job: "dragoon",      classId: 22 },
  { label: "Ninja",       abbrev: "NIN", role: "melee",   job: "ninja",        classId: 30 },
  { label: "Samurai",     abbrev: "SAM", role: "melee",   job: "samurai",      classId: 34 },
  { label: "Reaper",      abbrev: "RPR", role: "melee",   job: "reaper",       classId: 39 },
  { label: "Viper",       abbrev: "VPR", role: "melee",   job: "viper",        classId: 41 },
  { label: "Bard",        abbrev: "BRD", role: "ranged",  job: "bard",         classId: 23 },
  { label: "Machinist",   abbrev: "MCH", role: "ranged",  job: "machinist",    classId: 31 },
  { label: "Dancer",      abbrev: "DNC", role: "ranged",  job: "dancer",       classId: 38 },
  { label: "Black Mage",  abbrev: "BLM", role: "casters", job: "black-mage",   classId: 25 },
  { label: "Summoner",    abbrev: "SMN", role: "casters", job: "summoner",     classId: 27 },
  { label: "Red Mage",    abbrev: "RDM", role: "casters", job: "red-mage",     classId: 35 },
  { label: "Pictomancer", abbrev: "PCT", role: "casters", job: "pictomancer",  classId: 42 },
];

export const JOB_ABBREV_TO_CLASS_ID: Record<string, number> = Object.fromEntries(
  JOBS.map(j => [j.abbrev, j.classId]),
);

export const CLASS_ID_TO_JOB_ABBREV: Record<number, string> = Object.fromEntries(
  JOBS.map(j => [j.classId, j.abbrev]),
);
