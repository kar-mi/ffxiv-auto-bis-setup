import type { LodestoneCharacter } from "./types.ts";

const DATA_DIR = "data";

function filePath(lodestoneId: string): string {
  return `${DATA_DIR}/${lodestoneId}.json`;
}

export async function readCharacter(lodestoneId: string): Promise<LodestoneCharacter | null> {
  const file = Bun.file(filePath(lodestoneId));
  const exists = await file.exists();
  if (!exists) return null;
  return file.json() as Promise<LodestoneCharacter>;
}

export async function writeCharacter(lodestoneId: string, data: LodestoneCharacter): Promise<void> {
  await Bun.write(filePath(lodestoneId), JSON.stringify(data, null, 2));
}
