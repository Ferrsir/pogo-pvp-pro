import pvpokeCatalog from "../data/pvpoke-catalog.json" with { type: "json" };

export type AnalysisLeague = "GL" | "UL" | "ML";

export type TeamPokemonInput = {
  id: string;
  catalogId?: string;
  species: string;
  form: string;
  cp: number;
  level: number;
  attackIv: number;
  defenseIv: number;
  hpIv: number;
  fastMove: string;
  chargedMoves: string[];
  types: string[];
  rating: number;
  rank: number;
  leagues: AnalysisLeague[];
  ready: boolean;
};

type CatalogPokemon = {
  id: string;
  name: string;
  types: string[];
};

type CatalogMove = {
  id: string;
  name: string;
  type: string;
  category: "fast" | "charged";
  power: number;
  energy: number;
  energyGain: number;
  turns: number;
};

type Ranking = {
  id: string;
  name: string;
  rank: number;
  score: number;
  rating: number;
  moveset: string[];
  matchups: Array<{ id: string; rating: number }>;
  counters: Array<{ id: string; rating: number }>;
};

export type TeamRankingsData = {
  source: {
    sourceUpdatedAt: string;
    urls: Record<AnalysisLeague, string>;
  };
  leagues: Record<AnalysisLeague, Ranking[]>;
};

export type TeamCoverageRow = {
  type: string;
  value: number;
  detail: string;
};

export type TeamMetaTarget = {
  id: string;
  name: string;
  rank: number;
  rating: number;
  answerPokemon: string;
  evidence: "PvPoke matchup" | "moves + typing";
};

export type TeamAnalysis = {
  score: number;
  metaStrength: number;
  metaCoverage: number;
  safety: number;
  buildQuality: number;
  offense: TeamCoverageRow[];
  threats: TeamCoverageRow[];
  targets: TeamMetaTarget[];
  metaThreats: TeamMetaTarget[];
  metaSampleSize: number;
  sourceUpdatedAt: string;
  sourceUrl: string;
};

const catalog = pvpokeCatalog as unknown as { moves: CatalogMove[]; pokemon: CatalogPokemon[] };
const POKEMON_BY_ID = new Map(catalog.pokemon.map((pokemon) => [pokemon.id, pokemon]));
const MOVES_BY_NAME = catalog.moves.reduce((moves, move) => {
  const variants = moves.get(move.name) ?? [];
  variants.push(move);
  moves.set(move.name, variants);
  return moves;
}, new Map<string, CatalogMove[]>());
const ATTACK_TYPES = ["Normal", "Fire", "Water", "Electric", "Grass", "Ice", "Fighting", "Poison", "Ground", "Flying", "Psychic", "Bug", "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy"];
const META_FIELD_SIZE = 30;

const TYPE_RULES: Record<string, { weak?: string[]; resist?: string[]; immune?: string[] }> = {
  Normal: { weak: ["Fighting"], immune: ["Ghost"] },
  Fire: { weak: ["Water", "Ground", "Rock"], resist: ["Fire", "Grass", "Ice", "Bug", "Steel", "Fairy"] },
  Water: { weak: ["Electric", "Grass"], resist: ["Fire", "Water", "Ice", "Steel"] },
  Electric: { weak: ["Ground"], resist: ["Electric", "Flying", "Steel"] },
  Grass: { weak: ["Fire", "Ice", "Poison", "Flying", "Bug"], resist: ["Water", "Electric", "Grass", "Ground"] },
  Ice: { weak: ["Fire", "Fighting", "Rock", "Steel"], resist: ["Ice"] },
  Fighting: { weak: ["Flying", "Psychic", "Fairy"], resist: ["Bug", "Rock", "Dark"] },
  Poison: { weak: ["Ground", "Psychic"], resist: ["Grass", "Fighting", "Poison", "Bug", "Fairy"] },
  Ground: { weak: ["Water", "Grass", "Ice"], resist: ["Poison", "Rock"], immune: ["Electric"] },
  Flying: { weak: ["Electric", "Ice", "Rock"], resist: ["Grass", "Fighting", "Bug"], immune: ["Ground"] },
  Psychic: { weak: ["Bug", "Ghost", "Dark"], resist: ["Fighting", "Psychic"] },
  Bug: { weak: ["Fire", "Flying", "Rock"], resist: ["Grass", "Fighting", "Ground"] },
  Rock: { weak: ["Water", "Grass", "Fighting", "Ground", "Steel"], resist: ["Normal", "Fire", "Poison", "Flying"] },
  Ghost: { weak: ["Ghost", "Dark"], resist: ["Poison", "Bug"], immune: ["Normal", "Fighting"] },
  Dragon: { weak: ["Ice", "Dragon", "Fairy"], resist: ["Fire", "Water", "Electric", "Grass"] },
  Dark: { weak: ["Fighting", "Bug", "Fairy"], resist: ["Ghost", "Dark"], immune: ["Psychic"] },
  Steel: { weak: ["Fire", "Fighting", "Ground"], resist: ["Normal", "Grass", "Ice", "Flying", "Psychic", "Bug", "Rock", "Dragon", "Steel", "Fairy"], immune: ["Poison"] },
  Fairy: { weak: ["Poison", "Steel"], resist: ["Fighting", "Bug", "Dark"], immune: ["Dragon"] },
};

const rankingMapCache = new WeakMap<TeamRankingsData, Map<AnalysisLeague, Map<string, Ranking>>>();

function clamp(value: number, minimum = 0, maximum = 100) {
  return Math.min(maximum, Math.max(minimum, value));
}

function rankingMap(rankings: TeamRankingsData, league: AnalysisLeague) {
  let byLeague = rankingMapCache.get(rankings);
  if (!byLeague) {
    byLeague = new Map();
    rankingMapCache.set(rankings, byLeague);
  }
  let byPokemon = byLeague.get(league);
  if (!byPokemon) {
    byPokemon = new Map(rankings.leagues[league].map((ranking) => [ranking.id, ranking]));
    byLeague.set(league, byPokemon);
  }
  return byPokemon;
}

function catalogPokemonForTeam(pokemon: TeamPokemonInput) {
  const directId = pokemon.catalogId ?? pokemon.id;
  if (POKEMON_BY_ID.has(directId)) return POKEMON_BY_ID.get(directId)!;
  return catalog.pokemon.find((candidate) => candidate.name === pokemon.species)
    ?? catalog.pokemon.find((candidate) => candidate.name.startsWith(`${pokemon.species} (`) && candidate.name.includes(pokemon.form))
    ?? null;
}

function effectiveness(attackType: string, defenseTypes: string[]) {
  return defenseTypes.reduce((multiplier, defenseType) => {
    const rule = TYPE_RULES[defenseType];
    if (rule?.weak?.includes(attackType)) multiplier *= 1.6;
    if (rule?.resist?.includes(attackType)) multiplier *= 0.625;
    if (rule?.immune?.includes(attackType)) multiplier *= 0.390625;
    return multiplier;
  }, 1);
}

function currentMoveTypes(pokemon: TeamPokemonInput, fallbackTypes: string[]) {
  const moveTypes = [pokemon.fastMove, ...pokemon.chargedMoves]
    .flatMap((move) => MOVES_BY_NAME.get(move)?.map((variant) => variant.type) ?? []);
  return [...new Set(moveTypes.length ? moveTypes : fallbackTypes.slice(0, 1))];
}

function rankingForPokemon(pokemon: TeamPokemonInput, rankings: TeamRankingsData, league: AnalysisLeague) {
  const catalogPokemon = catalogPokemonForTeam(pokemon);
  return catalogPokemon ? rankingMap(rankings, league).get(catalogPokemon.id) ?? null : null;
}

export function pokemonMetaScore(pokemon: TeamPokemonInput, rankings: TeamRankingsData | null, league: AnalysisLeague) {
  if (!rankings) return pokemon.rating;
  return rankingForPokemon(pokemon, rankings, league)?.score ?? Math.min(pokemon.rating, 55);
}

function typeEdgeScore(multiplier: number) {
  if (multiplier >= 2.5) return 24;
  if (multiplier > 1.01) return 13;
  if (multiplier <= 0.4) return -24;
  if (multiplier < 0.99) return -13;
  return 0;
}

function buildQualityForPokemon(pokemon: TeamPokemonInput, ranking: Ranking | null, league: AnalysisLeague) {
  const currentMoves = [pokemon.fastMove, ...pokemon.chargedMoves.filter((move) => move && move !== "Not unlocked")];
  const recommendedFast = ranking?.moveset[0];
  const recommendedCharged = ranking?.moveset.slice(1, 3) ?? [];
  const fastScore = recommendedFast ? (pokemon.fastMove === recommendedFast ? 40 : 0) : (MOVES_BY_NAME.has(pokemon.fastMove) ? 30 : 0);
  const chargedMatches = recommendedCharged.filter((move) => currentMoves.includes(move)).length;
  const chargedScore = recommendedCharged.length ? (chargedMatches / recommendedCharged.length) * 60 : Math.min(60, (currentMoves.length - 1) * 30);
  const moveScore = fastScore + chargedScore;
  const cap = league === "GL" ? 1500 : 2500;
  const powerScore = league === "ML" ? clamp((pokemon.level / 50) * 100) : clamp((pokemon.cp / cap) * 100);
  const ivScore = pokemon.rank > 0 ? clamp(100 - ((pokemon.rank - 1) / 4095) * 100) : 50;
  return clamp(moveScore * 0.55 + powerScore * 0.3 + ivScore * 0.15);
}

function estimateMemberIntoTarget(
  member: TeamPokemonInput,
  memberRanking: Ranking | null,
  target: Ranking,
  targetCatalog: CatalogPokemon,
) {
  const memberCatalog = catalogPokemonForTeam(member);
  const memberTypes = memberCatalog?.types ?? member.types;
  const memberMoveTypes = currentMoveTypes(member, memberTypes);
  const targetMoveTypes = target.moveset
    .flatMap((move) => MOVES_BY_NAME.get(move)?.map((variant) => variant.type) ?? []);
  const offensiveMultiplier = Math.max(...memberMoveTypes.map((type) => effectiveness(type, targetCatalog.types)), 1);
  const incomingMultiplier = Math.max(...targetMoveTypes.map((type) => effectiveness(type, memberTypes)), 1);
  const metaDelta = (memberRanking?.score ?? 50) - target.score;
  const estimate = clamp(50 + typeEdgeScore(offensiveMultiplier) - typeEdgeScore(incomingMultiplier) + metaDelta * 0.22, 5, 95);
  const direct = memberRanking?.matchups.find((matchup) => matchup.id === target.id)
    ?? memberRanking?.counters.find((counter) => counter.id === target.id);
  return {
    rating: direct ? clamp((direct.rating / 10) * 0.82 + estimate * 0.18, 5, 95) : estimate,
    evidence: direct ? "PvPoke matchup" as const : "moves + typing" as const,
  };
}

export function analyzeTeam(
  team: TeamPokemonInput[],
  league: AnalysisLeague,
  rankings: TeamRankingsData | null,
): TeamAnalysis | null {
  if (team.length !== 3 || !rankings) return null;

  const leagueRankings = rankings.leagues[league];
  const byPokemon = rankingMap(rankings, league);
  const memberData = team.map((pokemon) => {
    const catalogPokemon = catalogPokemonForTeam(pokemon);
    const ranking = catalogPokemon ? byPokemon.get(catalogPokemon.id) ?? null : null;
    const types = catalogPokemon?.types ?? pokemon.types;
    return { pokemon, catalogPokemon, ranking, types, moveTypes: currentMoveTypes(pokemon, types) };
  });

  const metaStrength = Math.round(memberData.reduce((sum, member) => sum + (member.ranking?.score ?? 42), 0) / team.length);
  const buildQuality = Math.round(memberData.reduce((sum, member) => sum + buildQualityForPokemon(member.pokemon, member.ranking, league), 0) / team.length);

  const offense = ATTACK_TYPES.map((defenseType) => {
    const memberMultipliers = memberData.map((member) => Math.max(...member.moveTypes.map((moveType) => effectiveness(moveType, [defenseType])), 1));
    const superEffectiveAnswers = memberMultipliers.filter((multiplier) => multiplier > 1.01).length;
    const best = Math.max(...memberMultipliers);
    const value = best > 1.01 ? clamp(72 + superEffectiveAnswers * 8 + (best >= 2.5 ? 8 : 0)) : best < 0.99 ? 24 : 50;
    return { type: defenseType, value: Math.round(value), detail: superEffectiveAnswers ? `${superEffectiveAnswers} equipped answer${superEffectiveAnswers === 1 ? "" : "s"}` : "neutral pressure" };
  }).sort((left, right) => right.value - left.value || left.type.localeCompare(right.type));

  let weaknessSlots = 0;
  let protectedWeaknessSlots = 0;
  let sharedWeaknesses = 0;
  const threats = ATTACK_TYPES.map((attackType) => {
    const multipliers = memberData.map((member) => effectiveness(attackType, member.types));
    const weakMembers = multipliers.map((multiplier, index) => ({ multiplier, index })).filter((item) => item.multiplier > 1.01);
    const resistMembers = multipliers.filter((multiplier) => multiplier < 0.99).length;
    weaknessSlots += weakMembers.length;
    for (const weakMember of weakMembers) {
      if (multipliers.some((multiplier, index) => index !== weakMember.index && multiplier < 0.99)) protectedWeaknessSlots += 1;
    }
    if (weakMembers.length >= 2) sharedWeaknesses += 1;
    const value = clamp(18 + weakMembers.length * 27 - resistMembers * 12 + (weakMembers.length >= 2 ? 14 : 0), 5, 98);
    return { type: attackType, value: Math.round(value), detail: weakMembers.length ? `${weakMembers.length} weak · ${resistMembers} resist` : resistMembers ? `${resistMembers} resist` : "neutral" };
  }).sort((left, right) => right.value - left.value || left.type.localeCompare(right.type));

  const protectionRate = weaknessSlots ? protectedWeaknessSlots / weaknessSlots : 1;
  const safety = Math.round(clamp(32 + protectionRate * 68 - sharedWeaknesses * 8, 5, 100));

  const metaField = leagueRankings.slice(0, META_FIELD_SIZE);
  const targetResults: TeamMetaTarget[] = metaField.map((target) => {
    const targetCatalog = POKEMON_BY_ID.get(target.id);
    if (!targetCatalog) return { id: target.id, name: target.name, rank: target.rank, rating: 40, answerPokemon: team[0].species, evidence: "moves + typing" };
    const memberResults = memberData.map((member) => ({
      pokemon: member.pokemon,
      ...estimateMemberIntoTarget(member.pokemon, member.ranking, target, targetCatalog),
    })).sort((left, right) => right.rating - left.rating);
    return {
      id: target.id,
      name: target.name,
      rank: target.rank,
      rating: Math.round(memberResults[0].rating),
      answerPokemon: memberResults[0].pokemon.species,
      evidence: memberResults[0].evidence,
    };
  });

  const weightedCoverage = targetResults.reduce((total, target) => {
    const weight = 1 - ((target.rank - 1) / META_FIELD_SIZE) * 0.45;
    const answerScore = clamp(((target.rating - 40) / 20) * 100);
    return total + answerScore * weight;
  }, 0);
  const totalWeight = targetResults.reduce((total, target) => total + (1 - ((target.rank - 1) / META_FIELD_SIZE) * 0.45), 0);
  const metaCoverage = Math.round(weightedCoverage / totalWeight);
  const score = Math.round(metaStrength * 0.3 + metaCoverage * 0.3 + safety * 0.25 + buildQuality * 0.15);

  const answeredTargets = targetResults.filter((target) => target.rating >= 55).sort((left, right) => left.rank - right.rank);
  const targets = [...answeredTargets, ...targetResults.filter((target) => target.rating < 55).sort((left, right) => right.rating - left.rating)]
    .filter((target, index, list) => list.findIndex((candidate) => candidate.id === target.id) === index)
    .slice(0, 3);
  const metaThreats = [...targetResults].sort((left, right) => left.rating - right.rating || left.rank - right.rank).slice(0, 3);

  return {
    score: clamp(score),
    metaStrength: clamp(metaStrength),
    metaCoverage: clamp(metaCoverage),
    safety: clamp(safety),
    buildQuality: clamp(buildQuality),
    offense: offense.slice(0, 4),
    threats: threats.slice(0, 4),
    targets,
    metaThreats,
    metaSampleSize: META_FIELD_SIZE,
    sourceUpdatedAt: rankings.source.sourceUpdatedAt,
    sourceUrl: rankings.source.urls[league],
  };
}
