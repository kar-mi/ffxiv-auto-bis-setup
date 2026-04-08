/**
 * Parser for FFXIV's ITEMODR.DAT binary file.
 *
 * ITEMODR.DAT stores the player's bag and armory display order — each entry
 * maps a visual position (array index) to an internal { slot, container } pair.
 * This is separate from the packet data, which uses internal slot indices that
 * do NOT match the visual position shown in the in-game bag UI.
 *
 * Reverse-engineered by the Teamcraft project; see:
 *   apps/electron/src/dat/dat-files-watcher.ts in ffxiv-teamcraft.
 *
 * Encoding: all fields are XOR-obfuscated.
 *   1-byte fields  ^ 0x73
 *   2-byte LE      ^ 0x7373
 *   4-byte LE      ^ 0x73737373
 */

const XOR8  = 0x73;
const XOR16 = 0x7373;
const XOR32 = 0x73737373;

/** Internal storage coordinate for one bag/armory slot. */
export interface SlotCoord {
  /** Internal slot index within the container. */
  slot: number;
  /** ContainerType ID (e.g. 0–3 for bags, 3201 for ArmoryHead). */
  container: number;
}

/**
 * Parsed item order: section name → ordered array of slot coords.
 * Array index = visual position shown in the game UI.
 */
export type ItemOdr = Partial<Record<string, SlotCoord[]>>;

/** Section names in the order they appear in the file. */
const SECTION_NAMES = [
  'Player',
  'ArmoryMain', 'ArmoryHead', 'ArmoryBody', 'ArmoryHand',
  'ArmoryWaist', 'ArmoryLegs', 'ArmoryFeet', 'ArmoryOff',
  'ArmoryEar', 'ArmoryNeck', 'ArmoryWrist', 'ArmoryRing',
  'ArmorySoulCrystal',
  'SaddleBag', 'PremiumSaddlebag',
];

// ---- Sequential buffer reader -----------------------------------------------

class Reader {
  private pos = 0;
  constructor(private readonly buf: Buffer) {}

  move(n: number): void { this.pos += n; }

  u8(): number {
    return this.buf.readUInt8(this.pos++) ^ XOR8;
  }

  u16(): number {
    const v = this.buf.readUInt16LE(this.pos) ^ XOR16;
    this.pos += 2;
    return v;
  }

  u32(): number {
    const v = this.buf.readUInt32LE(this.pos) ^ XOR32;
    this.pos += 4;
    return v >>> 0; // keep unsigned
  }
}

// ---- Sub-parsers ------------------------------------------------------------

function readSlot(r: Reader): SlotCoord {
  const size = r.u8();
  if (size !== 4) throw new Error(`readSlot: unexpected size ${size}`);
  return { slot: r.u16(), container: r.u16() };
}

function readSection(r: Reader): SlotCoord[] {
  const size = r.u8();
  if (size !== 4) throw new Error(`readSection: unexpected size ${size}`);
  const count = r.u32();
  const slots: SlotCoord[] = [];
  for (let i = 0; i < count; i++) {
    const id = r.u8();
    if (id !== 0x69) throw new Error(`readSection: unexpected slot id 0x${id.toString(16)}`);
    slots.push(readSlot(r));
  }
  return slots;
}

// ---- Public API -------------------------------------------------------------

/**
 * Parse an ITEMODR.DAT buffer and return the visual order for each inventory
 * section.  Returns an empty object if the buffer cannot be parsed.
 */
export function parseItemOdr(buf: Buffer): ItemOdr {
  const r = new Reader(buf);
  const result: ItemOdr = {};
  let sectionIdx = 0;

  try {
    r.move(16); // file header
    r.move(1);  // unknown byte (appears to be main inventory size)

    while (true) {
      const id = r.u8();

      if (id === 0x56) {
        // Unknown section — skip payload
        r.move(r.u8());
      } else if (id === 0x6E) {
        // Inventory section
        const name = SECTION_NAMES[sectionIdx++];
        const slots = readSection(r);
        if (name) result[name] = slots;
      } else if (id === 0x4E || id === 0x73) {
        // 0x4E = retainers (not needed), 0x73 = end-of-file
        break;
      } else {
        throw new Error(`unexpected identifier 0x${id.toString(16)}`);
      }
    }
  } catch (err) {
    // Return whatever sections were successfully parsed before the error.
    console.warn('[itemodr] parse error (partial result returned):', err);
  }

  return result;
}

/**
 * Maps each ODR section name to the ContainerType ID used in packets.
 * For the Player section, the per-entry container value (0–3) is already the
 * correct containerId, so no override is needed.
 * For armory/saddlebag sections the per-entry container value is relative (often
 * always 0), so we substitute the known ContainerType ID.
 */
const SECTION_CONTAINER_ID: Partial<Record<string, number>> = {
  ArmoryOff:         3200,
  ArmoryHead:        3201,
  ArmoryBody:        3202,
  ArmoryHand:        3203,
  ArmoryWaist:       3204,
  ArmoryLegs:        3205,
  ArmoryFeet:        3206,
  ArmoryNeck:        3207,
  ArmoryEar:         3208,
  ArmoryWrist:       3209,
  ArmoryRing:        3300,
  ArmorySoulCrystal: 3400,
  ArmoryMain:        3500,
  SaddleBag:         4000,
  PremiumSaddlebag:  4100,
};

/**
 * Build a lookup map from "containerId:slot" → visual position index.
 * Use this to sort inventory items into the same order the player sees in-game.
 *
 * For the Player section the per-entry container (0–3) is used as-is.
 * For all other sections the known ContainerType ID from SECTION_CONTAINER_ID
 * is used instead, because the per-entry value is typically 0 (relative).
 */
export function buildPosMap(odr: ItemOdr): Map<string, number> {
  const map = new Map<string, number>();
  for (const [section, coords] of Object.entries(odr)) {
    if (!coords) continue;
    const fixedId = SECTION_CONTAINER_ID[section];
    for (let i = 0; i < coords.length; i++) {
      const containerId = fixedId ?? coords[i].container;
      map.set(`${containerId}:${coords[i].slot}`, i);
    }
  }
  return map;
}
