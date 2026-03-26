import type { CharacterGear } from "./lodestone.ts";

const DATA_DIR = "data";

function filePath(lodestoneId: string): string {
  return `${DATA_DIR}/${lodestoneId}.json`;
}

export async function readCharacter(lodestoneId: string): Promise<CharacterGear | null> {
  const file = Bun.file(filePath(lodestoneId));
  const exists = await file.exists();
  if (!exists) return null;
  return file.json() as Promise<CharacterGear>;
}

export async function writeCharacter(lodestoneId: string, data: CharacterGear): Promise<void> {
  await Bun.write(filePath(lodestoneId), JSON.stringify(data, null, 2));
}
