import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const repository = "pvpoke/pvpoke";
const branch = "master";
const pokemonPath = "src/data/gamemaster/pokemon.json";
const movesPath = "src/data/gamemaster/moves.json";
const rankingPaths = {
  GL: "src/data/rankings/all/overall/rankings-1500.json",
  UL: "src/data/rankings/all/overall/rankings-2500.json",
  ML: "src/data/rankings/all/overall/rankings-10000.json",
};
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

const [pokemonSource, moveSource, headCommit, ...rankingSources] = await Promise.all([
  readJson(`${rawBase}/${pokemonPath}`),
  readJson(`${rawBase}/${movesPath}`),
  readJson(`https://api.github.com/repos/${repository}/commits/${branch}`),
  ...Object.values(rankingPaths).map((path) => readJson(`${rawBase}/${path}`)),
]);

const moveNames = new Map(moveSource.map((move) => [move.moveId, move.name]));
const moves = moveSource
  .map((move) => ({
    id: move.moveId,
    name: move.name,
    type: titleCase(move.type),
    category: move.energyGain > 0 ? "fast" : "charged",
    power: move.power,
    energy: move.energy,
    energyGain: move.energyGain,
    turns: move.turns,
  }))
  .sort((left, right) => left.name.localeCompare(right.name));
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
  moves,
  pokemon: released,
};

function compactRanking(entry, index) {
  return {
    id: entry.speciesId,
    name: entry.speciesName,
    rank: index + 1,
    score: entry.score,
    rating: entry.rating,
    moveset: entry.moveset.map((move) => moveNames.get(move) ?? titleCase(move.replaceAll("_", " "))),
    matchups: entry.matchups.map((matchup) => ({ id: matchup.opponent, rating: matchup.rating })),
    counters: entry.counters.map((counter) => ({ id: counter.opponent, rating: counter.rating })),
    notes: entry.editorNotes ?? "",
    stats: entry.stats,
  };
}

const rankings = {
  source: {
    name: "PvPoke Open League overall rankings",
    repository: `https://github.com/${repository}`,
    commit: headCommit.sha,
    sourceUpdatedAt: headCommit.commit.author.date,
    generatedAt: new Date().toISOString(),
    urls: Object.fromEntries(Object.entries(rankingPaths).map(([league, path]) => [league, `https://github.com/${repository}/blob/${headCommit.sha}/${path}`])),
  },
  leagues: Object.fromEntries(
    Object.keys(rankingPaths).map((league, index) => [league, rankingSources[index].map(compactRanking)]),
  ),
};

const outputPath = resolve("src/data/pvpoke-catalog.json");
const rankingsOutputPath = resolve("src/data/pvpoke-rankings.json");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(catalog)}\n`, "utf8");
await writeFile(rankingsOutputPath, `${JSON.stringify(rankings)}\n`, "utf8");
console.log(`Wrote ${released.length} released PvPoke entries to ${outputPath}.`);
console.log(`Wrote ${Object.values(rankings.leagues).reduce((total, league) => total + league.length, 0)} PvPoke league rankings to ${rankingsOutputPath}.`);
