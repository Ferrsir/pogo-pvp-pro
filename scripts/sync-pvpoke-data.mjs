import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const repository = "pvpoke/pvpoke";
const branch = "master";
const pokemonPath = "src/data/gamemaster/pokemon.json";
const movesPath = "src/data/gamemaster/moves.json";
const rawBase = `https://raw.githubusercontent.com/${repository}/${branch}`;

async function readJson(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "Pogo-PVP-Pro-data-sync" },
  });
  if (!response.ok) throw new Error(`Could not download ${url}: ${response.status}`);
  return response.json();
}

function titleCase(value) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

const [pokemonSource, moveSource, headCommit] = await Promise.all([
  readJson(`${rawBase}/${pokemonPath}`),
  readJson(`${rawBase}/${movesPath}`),
  readJson(`https://api.github.com/repos/${repository}/commits/${branch}`),
]);

const moveNames = new Map(moveSource.map((move) => [move.moveId, move.name]));
const released = pokemonSource
  .filter((pokemon) => pokemon.released === true)
  .map((pokemon) => ({
    id: pokemon.speciesId,
    dex: pokemon.dex,
    name: pokemon.speciesName,
    types: pokemon.types.map(titleCase),
    baseStats: pokemon.baseStats,
    fastMoves: pokemon.fastMoves.map((move) => moveNames.get(move) ?? titleCase(move.replaceAll("_", " "))),
    chargedMoves: pokemon.chargedMoves.map((move) => moveNames.get(move) ?? titleCase(move.replaceAll("_", " "))),
    eliteMoves: (pokemon.eliteMoves ?? []).map((move) => moveNames.get(move) ?? titleCase(move.replaceAll("_", " "))),
    tags: pokemon.tags ?? [],
  }))
  .sort((left, right) => left.dex - right.dex || left.name.localeCompare(right.name));

const catalog = {
  source: {
    name: "PvPoke",
    repository: `https://github.com/${repository}`,
    pokemonUrl: `https://github.com/${repository}/blob/${headCommit.sha}/${pokemonPath}`,
    movesUrl: `https://github.com/${repository}/blob/${headCommit.sha}/${movesPath}`,
    commit: headCommit.sha,
    sourceUpdatedAt: headCommit.commit.author.date,
    generatedAt: new Date().toISOString(),
    license: "MIT",
    pokemonCount: released.length,
    pokedexCount: new Set(released.map((pokemon) => pokemon.dex)).size,
  },
  pokemon: released,
};

const outputPath = resolve("src/data/pvpoke-catalog.json");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(catalog)}\n`, "utf8");
console.log(`Wrote ${released.length} released PvPoke entries to ${outputPath}.`);
