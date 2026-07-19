import catalog from "../src/data/pvpoke-catalog.json" with { type: "json" };
import rankings from "../src/data/pvpoke-rankings.json" with { type: "json" };
import { analyzeTeam, recommendTeamAdditions, recommendTeams } from "../src/lib/team-analysis.ts";

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
  if (analysis.roles.map((role) => role.role).join("|") !== "Lead|Safe switch|Closer") throw new Error("Role assignment is incomplete.");
  if (new Set(analysis.roles.map((role) => role.pokemonId)).size !== 3) throw new Error("A Pokémon was assigned to more than one role.");
  for (const coverage of analysis.offense) {
    if (coverage.detail.includes("equipped answer") && !coverage.answers?.length) throw new Error(`Coverage for ${coverage.type} is missing its answer Pokémon.`);
    for (const answer of coverage.answers ?? []) {
      if (!team.some((pokemon) => pokemon.id === answer.pokemonId) || !answer.moveNames.length) throw new Error(`Coverage for ${coverage.type} points to an invalid team answer.`);
    }
  }
  for (const pressure of analysis.threats) {
    for (const pokemonId of [...(pressure.weakPokemonIds ?? []), ...(pressure.resistPokemonIds ?? [])]) {
      if (!team.some((pokemon) => pokemon.id === pokemonId)) throw new Error(`Defensive pressure for ${pressure.type} points to a Pokémon outside the active team.`);
    }
    if (/[1-9]\d* weak/.test(pressure.detail) && !pressure.weakPokemonIds?.length) throw new Error(`Defensive pressure for ${pressure.type} is missing its weak Pokémon.`);
    if (/[1-9]\d* resist/.test(pressure.detail) && !pressure.resistPokemonIds?.length) throw new Error(`Defensive pressure for ${pressure.type} is missing its resisting Pokémon.`);
  }
  return analysis;
});

const scores = new Set(analyses.map((analysis) => analysis.score));
const coverageMaps = new Set(analyses.map((analysis) => analysis.offense.map((row) => `${row.type}:${row.value}`).join("|")));
const threatMaps = new Set(analyses.map((analysis) => analysis.threats.map((row) => `${row.type}:${row.value}`).join("|")));

if (scores.size < 2) throw new Error("Distinct lineups produced the same team score.");
if (coverageMaps.size < 2) throw new Error("Distinct lineups produced the same offensive coverage map.");
if (threatMaps.size < 2) throw new Error("Distinct lineups produced the same defensive threat map.");

const exactCandidates = rankings.leagues[league].slice(0, 30).map(savedBuild);
const exactRecommendations = recommendTeams(exactCandidates, [], league, rankings);
if (!exactRecommendations.exact || exactRecommendations.evaluatedCount < 3_000) throw new Error("The recommender did not exhaustively test the uploaded roster.");
if (exactRecommendations.lineups.length < 2 || exactRecommendations.lineups[0].analysis.score < exactRecommendations.lineups[1].analysis.score) throw new Error("Recommendations are not sorted by best score.");
if (exactRecommendations.lineups[0].team.map((pokemon) => pokemon.id).join("|") !== exactRecommendations.lineups[0].analysis.roles.map((role) => role.pokemonId).join("|")) throw new Error("Recommended lineup is not ordered by assigned role.");

const largeCandidates = rankings.leagues[league].slice(0, 50).map(savedBuild);
const recommendations = recommendTeams(largeCandidates, [], league, rankings);
const repeatedRecommendations = recommendTeams(largeCandidates, [], league, rankings);
if (recommendations.exact || recommendations.shortlistCount >= largeCandidates.length || recommendations.evaluatedCount > 12_000) throw new Error("Large-roster role screening did not stay within its deterministic search budget.");
if (recommendations.lineups[0].team.map((pokemon) => pokemon.id).join("|") !== repeatedRecommendations.lineups[0].team.map((pokemon) => pokemon.id).join("|")) throw new Error("The same roster produced a different top recommendation.");

const uploadedForAdditions = rankings.leagues[league].slice(0, 12).map(savedBuild);
const missingForAdditions = rankings.leagues[league].slice(12, 36).map((ranking, index) => ({ ...savedBuild(ranking, index + 100), owned: false }));
const additions = recommendTeamAdditions(uploadedForAdditions, missingForAdditions, [], league, rankings);
if (!additions.additions.length || additions.candidateCount !== missingForAdditions.length || additions.evaluatedCount < 1) throw new Error("The roster-upgrade recommender did not evaluate missing catalog builds.");
for (const addition of additions.additions) {
  if (!addition.team.some((pokemon) => pokemon.id === addition.pokemon.id)) throw new Error("An upgrade recommendation is missing from its proposed lineup.");
  if (addition.team.filter((pokemon) => pokemon.owned === false).length !== 1) throw new Error("A one-addition recommendation requires more than one missing Pokémon.");
  if (!addition.analysis.roles.some((role) => role.pokemonId === addition.pokemon.id && role.role === addition.role.role)) throw new Error("An upgrade recommendation is missing its role assignment.");
}
if (additions.additions.some((addition, index) => index > 0 && (addition.scoreGain ?? -Infinity) > (additions.additions[index - 1].scoreGain ?? -Infinity))) throw new Error("Upgrade recommendations are not sorted by collection score gain.");

console.log(`Validated ${analyses.length} distinct lineups: ${scores.size} scores, ${coverageMaps.size} coverage maps, ${threatMaps.size} threat maps.`);
console.log(`Validated exhaustive recommendations across ${exactRecommendations.evaluatedCount} legal uploaded-roster combinations.`);
console.log(`Validated deterministic large-roster screening across ${recommendations.evaluatedCount} finalist combinations.`);
console.log(`Validated ${additions.additions.length} best-value additions across ${additions.evaluatedCount} uploaded-roster lineups.`);
