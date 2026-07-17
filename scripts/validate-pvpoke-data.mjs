import { readFile } from "node:fs/promises";

const catalog = JSON.parse(await readFile(new URL("../src/data/pvpoke-catalog.json", import.meta.url), "utf8"));
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

for (const pokemon of catalog.pokemon) {
  if (!pokemon.id || !pokemon.name || !pokemon.dex) throw new Error("Catalog contains an incomplete Pokémon identity.");
  if (!pokemon.types.length || !pokemon.fastMoves.length || !pokemon.chargedMoves.length) throw new Error(`${pokemon.id} is missing battle data.`);
}

const ids = new Set(catalog.pokemon.map((pokemon) => pokemon.id));
for (const id of requiredVariants) {
  if (!ids.has(id)) throw new Error(`Catalog is missing expected variant ${id}.`);
}

console.log(`Validated ${catalog.pokemon.length} released PvPoke entries across ${catalog.source.pokedexCount} Pokédex species.`);
