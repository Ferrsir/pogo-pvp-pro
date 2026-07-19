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
  dex: number;
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
  notes?: string;
};

export type TeamRole = "Lead" | "Safe switch" | "Closer";

export type TeamRoleAssignment = {
  role: TeamRole;
  pokemonId: string;
  score: number;
  reason: string;
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
  answers?: Array<{
    pokemonId: string;
    moveNames: string[];
  }>;
  weakPokemonIds?: string[];
  resistPokemonIds?: string[];
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
  roles: TeamRoleAssignment[];
  metaSampleSize: number;
  sourceUpdatedAt: string;
  sourceUrl: string;
};

export type TeamRecommendationSet<T extends TeamPokemonInput> = {
  lineups: Array<{ team: T[]; analysis: TeamAnalysis }>;
  candidateCount: number;
  shortlistCount: number;
  evaluatedCount: number;
  exact: boolean;
};

export type TeamAdditionRecommendation<T extends TeamPokemonInput> = {
  pokemon: T;
  team: T[];
  analysis: TeamAnalysis;
  role: TeamRoleAssignment;
  scoreGain: number | null;
};

export type TeamAdditionRecommendationSet<T extends TeamPokemonInput> = {
  additions: TeamAdditionRecommendation<T>[];
  baselineScore: number | null;
  candidateCount: number;
  shortlistCount: number;
  evaluatedCount: number;
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
type MemberRoleProfile = {
  ranking: Ranking | null;
  metaScore: number;
  buildQuality: number;
  ratings: Map<string, { rating: number; evidence: "PvPoke matchup" | "moves + typing" }>;
  lead: number;
  safeSwitch: number;
  closer: number;
  leadReason: string;
  safeSwitchReason: string;
  closerReason: string;
};
const roleProfileCache = new WeakMap<TeamRankingsData, Map<string, MemberRoleProfile>>();

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
  const moveTypes = currentCoverageMoves(pokemon).map((move) => move.type);
  return [...new Set(moveTypes.length ? moveTypes : fallbackTypes.slice(0, 1))];
}

function currentCoverageMoves(pokemon: TeamPokemonInput) {
  const seen = new Set<string>();
  return [pokemon.fastMove, ...pokemon.chargedMoves]
    .filter((move) => move && move !== "Not unlocked")
    .flatMap((move) => MOVES_BY_NAME.get(move)?.map((variant) => ({ name: move, type: variant.type })) ?? [])
    .filter((move) => {
      const key = `${move.name}|${move.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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

function average(values: number[]) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

function roleProfileKey(pokemon: TeamPokemonInput, league: AnalysisLeague) {
  return [league, pokemon.id, pokemon.catalogId ?? "", pokemon.fastMove, ...pokemon.chargedMoves, pokemon.cp, pokemon.level, pokemon.rank].join("|");
}

function memberRoleProfile(pokemon: TeamPokemonInput, league: AnalysisLeague, rankings: TeamRankingsData) {
  let cache = roleProfileCache.get(rankings);
  if (!cache) {
    cache = new Map();
    roleProfileCache.set(rankings, cache);
  }
  const cacheKey = roleProfileKey(pokemon, league);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const ranking = rankingForPokemon(pokemon, rankings, league);
  const metaField = rankings.leagues[league].slice(0, META_FIELD_SIZE);
  const ratings = new Map<string, { rating: number; evidence: "PvPoke matchup" | "moves + typing" }>();
  for (const target of metaField) {
    const targetCatalog = POKEMON_BY_ID.get(target.id);
    ratings.set(target.id, targetCatalog
      ? estimateMemberIntoTarget(pokemon, ranking, target, targetCatalog)
      : { rating: 40, evidence: "moves + typing" });
  }

  const orderedRatings = [...ratings.values()].map((result) => result.rating).sort((left, right) => left - right);
  const averageRating = average(orderedRatings);
  const floor = average(orderedRatings.slice(0, Math.max(1, Math.ceil(orderedRatings.length * 0.2))));
  const ceiling = average(orderedRatings.slice(-Math.max(1, Math.ceil(orderedRatings.length * 0.2))));
  const positiveCount = orderedRatings.filter((rating) => rating >= 55).length;
  const neutralCount = orderedRatings.filter((rating) => rating >= 45).length;
  const hardLosses = orderedRatings.filter((rating) => rating < 40).length;
  const metaScore = ranking?.score ?? 42;
  const buildQuality = buildQualityForPokemon(pokemon, ranking, league);
  const notes = ranking?.notes?.toLowerCase() ?? "";
  const leadHint = /\blead\b/.test(notes) ? 5 : 0;
  const switchHint = /safe (swap|switch)/.test(notes) ? 7 : 0;
  const closerHint = /\bcloser\b|closing/.test(notes) ? 5 : 0;
  const positiveRate = (positiveCount / META_FIELD_SIZE) * 100;
  const neutralRate = (neutralCount / META_FIELD_SIZE) * 100;

  const profile: MemberRoleProfile = {
    ranking,
    metaScore,
    buildQuality,
    ratings,
    lead: Math.round(clamp(averageRating * 0.48 + positiveRate * 0.24 + metaScore * 0.18 + buildQuality * 0.1 + leadHint)),
    safeSwitch: Math.round(clamp(floor * 0.5 + neutralRate * 0.25 + metaScore * 0.15 + buildQuality * 0.1 + switchHint)),
    closer: Math.round(clamp(ceiling * 0.42 + averageRating * 0.18 + metaScore * 0.2 + buildQuality * 0.2 + closerHint)),
    leadReason: `${Math.round(averageRating)} average · ${positiveCount}/${META_FIELD_SIZE} positive`,
    safeSwitchReason: `${hardLosses} hard losses · ${neutralCount}/${META_FIELD_SIZE} neutral+`,
    closerReason: `${Math.round(ceiling)} ceiling · ${Math.round(buildQuality)} build`,
  };
  cache.set(cacheKey, profile);
  return profile;
}

export function pokemonRoleScores(pokemon: TeamPokemonInput, league: AnalysisLeague, rankings: TeamRankingsData) {
  const profile = memberRoleProfile(pokemon, league, rankings);
  return { lead: profile.lead, safeSwitch: profile.safeSwitch, closer: profile.closer };
}

function assignTeamRoles(team: TeamPokemonInput[], profiles: MemberRoleProfile[]): TeamRoleAssignment[] {
  const permutations = [
    [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
  ];
  const best = permutations
    .map((order) => ({
      order,
      score: profiles[order[0]].lead + profiles[order[1]].safeSwitch + profiles[order[2]].closer,
      tieBreak: order.map((index) => team[index].id).join("|"),
    }))
    .sort((left, right) => right.score - left.score || left.tieBreak.localeCompare(right.tieBreak))[0].order;
  return [
    { role: "Lead", pokemonId: team[best[0]].id, score: profiles[best[0]].lead, reason: profiles[best[0]].leadReason },
    { role: "Safe switch", pokemonId: team[best[1]].id, score: profiles[best[1]].safeSwitch, reason: profiles[best[1]].safeSwitchReason },
    { role: "Closer", pokemonId: team[best[2]].id, score: profiles[best[2]].closer, reason: profiles[best[2]].closerReason },
  ];
}

export function analyzeTeam(
  team: TeamPokemonInput[],
  league: AnalysisLeague,
  rankings: TeamRankingsData | null,
): TeamAnalysis | null {
  if (team.length !== 3 || !rankings) return null;

  const leagueRankings = rankings.leagues[league];
  const memberData = team.map((pokemon) => {
    const catalogPokemon = catalogPokemonForTeam(pokemon);
    const types = catalogPokemon?.types ?? pokemon.types;
    const profile = memberRoleProfile(pokemon, league, rankings);
    const coverageMoves = currentCoverageMoves(pokemon);
    return { pokemon, profile, types, coverageMoves, moveTypes: currentMoveTypes(pokemon, types) };
  });

  const metaStrength = Math.round(memberData.reduce((sum, member) => sum + member.profile.metaScore, 0) / team.length);
  const buildQuality = Math.round(memberData.reduce((sum, member) => sum + member.profile.buildQuality, 0) / team.length);

  const offense = ATTACK_TYPES.map((defenseType) => {
    const memberMultipliers = memberData.map((member) => Math.max(...member.moveTypes.map((moveType) => effectiveness(moveType, [defenseType])), 1));
    const answers = memberData.flatMap((member) => {
      const moveNames = [...new Set(member.coverageMoves
        .filter((move) => effectiveness(move.type, [defenseType]) > 1.01)
        .map((move) => move.name))];
      return moveNames.length ? [{ pokemonId: member.pokemon.id, moveNames }] : [];
    });
    const superEffectiveAnswers = answers.length;
    const best = Math.max(...memberMultipliers);
    const value = best > 1.01 ? clamp(72 + superEffectiveAnswers * 8 + (best >= 2.5 ? 8 : 0)) : best < 0.99 ? 24 : 50;
    return { type: defenseType, value: Math.round(value), detail: superEffectiveAnswers ? `${superEffectiveAnswers} equipped answer${superEffectiveAnswers === 1 ? "" : "s"}` : "neutral pressure", answers };
  }).sort((left, right) => right.value - left.value || left.type.localeCompare(right.type));

  let weaknessSlots = 0;
  let protectedWeaknessSlots = 0;
  let sharedWeaknesses = 0;
  const threats = ATTACK_TYPES.map((attackType) => {
    const multipliers = memberData.map((member) => effectiveness(attackType, member.types));
    const weakMembers = multipliers.map((multiplier, index) => ({ multiplier, index })).filter((item) => item.multiplier > 1.01);
    const resistMembers = multipliers.filter((multiplier) => multiplier < 0.99).length;
    const weakPokemonIds = weakMembers.map((member) => memberData[member.index].pokemon.id);
    const resistPokemonIds = multipliers.flatMap((multiplier, index) => multiplier < 0.99 ? [memberData[index].pokemon.id] : []);
    weaknessSlots += weakMembers.length;
    for (const weakMember of weakMembers) {
      if (multipliers.some((multiplier, index) => index !== weakMember.index && multiplier < 0.99)) protectedWeaknessSlots += 1;
    }
    if (weakMembers.length >= 2) sharedWeaknesses += 1;
    const value = clamp(18 + weakMembers.length * 27 - resistMembers * 12 + (weakMembers.length >= 2 ? 14 : 0), 5, 98);
    return { type: attackType, value: Math.round(value), detail: weakMembers.length ? `${weakMembers.length} weak · ${resistMembers} resist` : resistMembers ? `${resistMembers} resist` : "neutral", weakPokemonIds, resistPokemonIds };
  }).sort((left, right) => right.value - left.value || left.type.localeCompare(right.type));

  const protectionRate = weaknessSlots ? protectedWeaknessSlots / weaknessSlots : 1;
  const safety = Math.round(clamp(32 + protectionRate * 68 - sharedWeaknesses * 8, 5, 100));

  const metaField = leagueRankings.slice(0, META_FIELD_SIZE);
  const targetResults: TeamMetaTarget[] = metaField.map((target) => {
    const memberResults = memberData.map((member) => ({
      pokemon: member.pokemon,
      ...(member.profile.ratings.get(target.id) ?? { rating: 40, evidence: "moves + typing" as const }),
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
  const roles = assignTeamRoles(team, memberData.map((member) => member.profile));

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
    roles,
    metaSampleSize: META_FIELD_SIZE,
    sourceUpdatedAt: rankings.source.sourceUpdatedAt,
    sourceUrl: rankings.source.urls[league],
  };
}

function combinationCount(total: number, selected: number) {
  if (selected < 0 || selected > total) return 0;
  if (selected === 0 || selected === total) return 1;
  let result = 1;
  const count = Math.min(selected, total - selected);
  for (let index = 1; index <= count; index += 1) result = (result * (total - count + index)) / index;
  return Math.round(result);
}

function visitCombinations<T>(values: T[], count: number, visit: (selected: T[]) => void) {
  const selected: T[] = [];
  function collect(start: number) {
    if (selected.length === count) {
      visit([...selected]);
      return;
    }
    for (let index = start; index <= values.length - (count - selected.length); index += 1) {
      selected.push(values[index]);
      collect(index + 1);
      selected.pop();
    }
  }
  collect(0);
}

function speciesKey(pokemon: TeamPokemonInput) {
  return catalogPokemonForTeam(pokemon)?.dex.toString() ?? pokemon.species.toLowerCase();
}

function isLegalOpenLeagueTeam(team: TeamPokemonInput[]) {
  if (new Set(team.map(speciesKey)).size !== team.length) return false;
  return team.every((pokemon) => !/_(mega|primal)(?:_|$)/.test(catalogPokemonForTeam(pokemon)?.id ?? ""));
}

function recommendationComparator<T extends TeamPokemonInput>(
  left: { team: T[]; analysis: TeamAnalysis },
  right: { team: T[]; analysis: TeamAnalysis },
) {
  const leftRoleFit = left.analysis.roles.reduce((sum, role) => sum + role.score, 0);
  const rightRoleFit = right.analysis.roles.reduce((sum, role) => sum + role.score, 0);
  return right.analysis.score - left.analysis.score
    || right.analysis.metaCoverage - left.analysis.metaCoverage
    || right.analysis.safety - left.analysis.safety
    || rightRoleFit - leftRoleFit
    || right.analysis.buildQuality - left.analysis.buildQuality
    || left.team.map((pokemon) => pokemon.id).sort().join("|").localeCompare(right.team.map((pokemon) => pokemon.id).sort().join("|"));
}

export function recommendTeams<T extends TeamPokemonInput>(
  candidates: T[],
  lockedIds: string[],
  league: AnalysisLeague,
  rankings: TeamRankingsData,
  resultLimit = 12,
): TeamRecommendationSet<T> {
  const eligible = candidates.filter((pokemon) => !/_(mega|primal)(?:_|$)/.test(catalogPokemonForTeam(pokemon)?.id ?? ""));
  const lockedMembers = lockedIds.map((id) => eligible.find((pokemon) => pokemon.id === id)).filter(Boolean) as T[];
  const available = eligible
    .filter((pokemon) => !lockedIds.includes(pokemon.id))
    .sort((left, right) => pokemonMetaScore(right, rankings, league) - pokemonMetaScore(left, rankings, league) || left.id.localeCompare(right.id));
  const needed = 3 - lockedMembers.length;
  const empty: TeamRecommendationSet<T> = {
    lineups: [],
    candidateCount: eligible.length,
    shortlistCount: eligible.length,
    evaluatedCount: 0,
    exact: true,
  };
  if (needed < 1 || available.length < needed || lockedMembers.length + available.length < 3) return empty;

  const maxEvaluations = 12_000;
  let searchPool = available;
  if (combinationCount(available.length, needed) > maxEvaluations) {
    let maximumPoolSize = needed;
    while (maximumPoolSize < available.length && combinationCount(maximumPoolSize + 1, needed) <= maxEvaluations) maximumPoolSize += 1;
    const perRole = Math.max(1, Math.ceil(maximumPoolSize / 3));
    const profiles = available.map((pokemon) => ({ pokemon, ...pokemonRoleScores(pokemon, league, rankings) }));
    const finalistIds = new Set<string>();
    const finalists: T[] = [];
    const addFinalist = (pokemon: T) => {
      if (finalistIds.has(pokemon.id) || finalists.length >= maximumPoolSize) return;
      finalistIds.add(pokemon.id);
      finalists.push(pokemon);
    };
    for (const role of ["lead", "safeSwitch", "closer"] as const) {
      [...profiles]
        .sort((left, right) => right[role] - left[role] || pokemonMetaScore(right.pokemon, rankings, league) - pokemonMetaScore(left.pokemon, rankings, league))
        .slice(0, perRole)
        .forEach((profile) => addFinalist(profile.pokemon));
    }
    for (const pokemon of available) {
      if (finalists.length >= maximumPoolSize) break;
      addFinalist(pokemon);
    }
    searchPool = finalists;
  }

  const lineups: Array<{ team: T[]; analysis: TeamAnalysis }> = [];
  let evaluatedCount = 0;
  visitCombinations(searchPool, needed, (members) => {
    const team = [...lockedMembers, ...members];
    if (!isLegalOpenLeagueTeam(team)) return;
    const analysis = analyzeTeam(team, league, rankings);
    if (!analysis) return;
    evaluatedCount += 1;
    const orderedTeam = analysis.roles.map((assignment) => team.find((pokemon) => pokemon.id === assignment.pokemonId)!).filter(Boolean);
    lineups.push({ team: orderedTeam, analysis });
    lineups.sort(recommendationComparator);
    if (lineups.length > resultLimit) lineups.pop();
  });

  return {
    lineups,
    candidateCount: eligible.length,
    shortlistCount: searchPool.length + lockedMembers.length,
    evaluatedCount,
    exact: searchPool.length === available.length,
  };
}

export function recommendTeamAdditions<T extends TeamPokemonInput>(
  uploadedCandidates: T[],
  missingCandidates: T[],
  lockedIds: string[],
  league: AnalysisLeague,
  rankings: TeamRankingsData,
  resultLimit = 6,
): TeamAdditionRecommendationSet<T> {
  const uploaded = uploadedCandidates.filter((pokemon) => !/_(mega|primal)(?:_|$)/.test(catalogPokemonForTeam(pokemon)?.id ?? ""));
  const missing = missingCandidates.filter((pokemon) => !/_(mega|primal)(?:_|$)/.test(catalogPokemonForTeam(pokemon)?.id ?? ""));
  const lockedMembers = lockedIds.map((id) => uploaded.find((pokemon) => pokemon.id === id)).filter(Boolean) as T[];
  const availableUploaded = uploaded.filter((pokemon) => !lockedMembers.some((locked) => locked.id === pokemon.id));
  const baseline = uploaded.length >= 3 ? recommendTeams(uploaded, lockedMembers.map((pokemon) => pokemon.id), league, rankings, 1).lineups[0] ?? null : null;
  const empty: TeamAdditionRecommendationSet<T> = {
    additions: [],
    baselineScore: baseline?.analysis.score ?? null,
    candidateCount: missing.length,
    shortlistCount: 0,
    evaluatedCount: 0,
  };

  const neededUploaded = 2 - lockedMembers.length;
  if (neededUploaded < 0 || availableUploaded.length < neededUploaded || !missing.length) return empty;

  const supportLimit = 30;
  const supportPool = availableUploaded.length <= supportLimit
    ? availableUploaded
    : [...availableUploaded]
      .map((pokemon) => {
        const roles = pokemonRoleScores(pokemon, league, rankings);
        return { pokemon, fit: Math.max(roles.lead, roles.safeSwitch, roles.closer) };
      })
      .sort((left, right) => right.fit - left.fit || pokemonMetaScore(right.pokemon, rankings, league) - pokemonMetaScore(left.pokemon, rankings, league))
      .slice(0, supportLimit)
      .map(({ pokemon }) => pokemon);

  const additionLimit = 48;
  const additionShortlist = missing
    .map((pokemon) => {
      const roles = pokemonRoleScores(pokemon, league, rankings);
      const bestRoleFit = Math.max(roles.lead, roles.safeSwitch, roles.closer);
      return { pokemon, acquisitionFit: pokemonMetaScore(pokemon, rankings, league) * 0.55 + bestRoleFit * 0.45 };
    })
    .sort((left, right) => right.acquisitionFit - left.acquisitionFit || left.pokemon.id.localeCompare(right.pokemon.id))
    .slice(0, additionLimit)
    .map(({ pokemon }) => pokemon);

  let evaluatedCount = 0;
  const additions: TeamAdditionRecommendation<T>[] = [];
  for (const pokemon of additionShortlist) {
    let best: { team: T[]; analysis: TeamAnalysis } | null = null;
    visitCombinations(supportPool, neededUploaded, (support) => {
      const team = [...lockedMembers, pokemon, ...support];
      if (!isLegalOpenLeagueTeam(team)) return;
      const analysis = analyzeTeam(team, league, rankings);
      if (!analysis) return;
      evaluatedCount += 1;
      const candidate = { team, analysis };
      if (!best || recommendationComparator(candidate, best) < 0) best = candidate;
    });
    if (!best) continue;
    const selected = best as { team: T[]; analysis: TeamAnalysis };
    const orderedTeam = selected.analysis.roles.map((assignment) => selected.team.find((member) => member.id === assignment.pokemonId)!).filter(Boolean);
    const role = selected.analysis.roles.find((assignment) => assignment.pokemonId === pokemon.id)!;
    additions.push({
      pokemon,
      team: orderedTeam,
      analysis: selected.analysis,
      role,
      scoreGain: baseline ? selected.analysis.score - baseline.analysis.score : null,
    });
  }

  additions.sort((left, right) => (right.scoreGain ?? -Infinity) - (left.scoreGain ?? -Infinity)
    || right.analysis.score - left.analysis.score
    || right.role.score - left.role.score
    || left.pokemon.id.localeCompare(right.pokemon.id));

  return {
    additions: additions.slice(0, resultLimit),
    baselineScore: baseline?.analysis.score ?? null,
    candidateCount: missing.length,
    shortlistCount: additionShortlist.length,
    evaluatedCount,
  };
}
