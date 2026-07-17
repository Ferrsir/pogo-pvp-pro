import catalog from "../src/data/pvpoke-catalog.json" with { type: "json" };
import rankings from "../src/data/pvpoke-rankings.json" with { type: "json" };
import { analyzeTeam } from "../src/lib/team-analysis.ts";

const byId = new Map(catalog.pokemon.map((pokemon) => [pokemon.id, pokemon]));
const league = "GL";

function savedBuild(ranking, index) {
  const pokemon = byId.get(ranking.id);
  if (!pokemon) throw new Error(`Missing catalog entry for ${ranking.id}.`);
  return {
    id: `qa-${index}-${ranking.id}`,
    catalogId: ranking.id,
    species: pokemon.name,
    form: "PvPoke build",
    cp: 1500,
    level: 40,
    attackIv: 0,
    defenseIv: 15,
    hpIv: 15,
    fastMove: ranking.moveset[0] ?? pokemon.fastMoves[0] ?? "",
    chargedMoves: [ranking.moveset[1] ?? pokemon.chargedMoves[0] ?? "", ranking.moveset[2] ?? pokemon.chargedMoves[1] ?? "Not unlocked"],
    types: pokemon.types,
    rating: ranking.score,
    rank: 1,
    leagues: [league],
    ready: true,
  };
}

const analyses = [0, 3, 6, 9].map((start) => {
  const team = rankings.leagues[league].slice(start, start + 3).map(savedBuild);
  const analysis = analyzeTeam(team, league, rankings);
  if (!analysis) throw new Error(`Analysis failed for lineup starting at rank ${start + 1}.`);
  for (const value of [analysis.score, analysis.metaStrength, analysis.metaCoverage, analysis.safety, analysis.buildQuality]) {
    if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error(`Invalid analysis grade ${value}.`);
  }
  return analysis;
});

const scores = new Set(analyses.map((analysis) => analysis.score));
const coverageMaps = new Set(analyses.map((analysis) => analysis.offense.map((row) => `${row.type}:${row.value}`).join("|")));
const threatMaps = new Set(analyses.map((analysis) => analysis.threats.map((row) => `${row.type}:${row.value}`).join("|")));

if (scores.size < 2) throw new Error("Distinct lineups produced the same team score.");
if (coverageMaps.size < 2) throw new Error("Distinct lineups produced the same offensive coverage map.");
if (threatMaps.size < 2) throw new Error("Distinct lineups produced the same defensive threat map.");

console.log(`Validated ${analyses.length} distinct lineups: ${scores.size} scores, ${coverageMaps.size} coverage maps, ${threatMaps.size} threat maps.`);
