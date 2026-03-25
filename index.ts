import { Character } from "@xivapi/nodestone";

const parser = new Character();

const character = await parser.parse({ params: { characterId: "31610743" } });
console.log(JSON.stringify(character, null, 2));
