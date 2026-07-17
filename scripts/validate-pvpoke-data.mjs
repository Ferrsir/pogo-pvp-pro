import { readFile } from "node:fs/promises";

const catalog = JSON.parse(await readFile(new URL("../src/data/pvpoke-catalog.json", import.meta.url), "utf8"));
const rankings = JSON.parse(await readFile(new URL("../src/data/pvpoke-rankings.json", import.meta.url), "utf8"));
const sprites = JSON.parse(await readFile(new URL("../src/data/pokeapi-sprites.json", import.meta.url), "utf8"));
const requiredVariants = [
  "raichu_alolan",
  "giratina_origin",
  "kyurem_black",
  "zacian_crowned_sword",
  "bulbasaur_shadow",
  "charizard_mega_x",
  "oricorio_pau",
];

if (catalog.pokemon.length !== catalog.source.pokemonCount) throw new Error("Catalog count does not match its source metadata.");
if (catalog.pokemon.length < 1_500) throw new Error("Catalog unexpectedly contains fewer than 1,500 released forms.");
if (new Set(catalog.pokemon.map((pokemon) => pokemon.id)).size !== catalog.pokemon.length) throw new Error("Catalog contains duplicate species IDs.");
if (!Array.isArray(catalog.moves) || catalog.moves.length < 300) throw new Error("Catalog move data is missing or incomplete.");
if (new Set(catalog.moves.map((move) => move.id)).size !== catalog.moves.length) throw new Error("Catalog contains duplicate move IDs.");

for (const move of catalog.moves) {
  if (!move.id || !move.name || !move.type || !move.category) throw new Error("Catalog contains an incomplete move.");
}

for (const pokemon of catalog.pokemon) {
  if (!pokemon.id || !pokemon.name || !pokemon.dex) throw new Error("Catalog contains an incomplete Pokémon identity.");
  if (!pokemon.types.length || !pokemon.fastMoves.length || !pokemon.chargedMoves.length) throw new Error(`${pokemon.id} is missing battle data.`);
}

const ids = new Set(catalog.pokemon.map((pokemon) => pokemon.id));
for (const id of requiredVariants) {
  if (!ids.has(id)) throw new Error(`Catalog is missing expected variant ${id}.`);
}

for (const pokemon of catalog.pokemon) {
  if (!sprites.spriteIds[pokemon.id]) throw new Error(`Sprite map is missing ${pokemon.id}.`);
}
if (sprites.source.mappedEntries !== catalog.pokemon.length) throw new Error("Sprite map count does not match the PvPoke catalog.");
if (sprites.source.exactFormEntries < 150) throw new Error("Sprite map unexpectedly contains too few form-specific images.");

for (const league of ["GL", "UL", "ML"]) {
  if (!Array.isArray(rankings.leagues[league]) || !rankings.leagues[league].length) throw new Error(`${league} rankings are missing.`);
  for (const [index, ranking] of rankings.leagues[league].entries()) {
    if (!ranking.id || ranking.rank !== index + 1 || !ranking.moveset.length) throw new Error(`${league} contains an invalid ranking entry.`);
    if (!Array.isArray(ranking.matchups) || !Array.isArray(ranking.counters)) throw new Error(`${league} ${ranking.id} is missing matchup data.`);
  }
}

console.log(`Validated ${catalog.pokemon.length} released PvPoke entries across ${catalog.source.pokedexCount} Pokédex species.`);
console.log(`Validated ${Object.values(rankings.leagues).reduce((total, league) => total + league.length, 0)} PvPoke ranking entries.`);
console.log(`Validated ${sprites.source.mappedEntries} PokeAPI artwork mappings, including ${sprites.source.exactFormEntries} form-specific images.`);
