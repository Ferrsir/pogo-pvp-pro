import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const catalogPath = resolve("src/data/pvpoke-catalog.json");
const outputPath = resolve("src/data/pokeapi-sprites.json");
const repository = "PokeAPI/sprites";
const branch = "master";
const homeArtworkPath = "sprites/pokemon/other/home";
const pokeapiNameAliases = {
  necrozma_dusk_mane: ["necrozma-dusk"],
  necrozma_dawn_wings: ["necrozma-dawn"],
  tauros_combat: ["tauros-paldea-combat-breed"],
  tauros_blaze: ["tauros-paldea-blaze-breed"],
  tauros_aqua: ["tauros-paldea-aqua-breed"],
  zacian_crowned_sword: ["zacian-crowned"],
  zamazenta_crowned_shield: ["zamazenta-crowned"],
};

async function readJson(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "Pogo-PVP-Pro-sprite-sync" },
  });
  if (!response.ok) throw new Error(`Could not download ${url}: ${response.status}`);
  return response.json();
}

function slug(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/♀/g, " f ")
    .replace(/♂/g, " m ")
    .replace(/[’']/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function pokemonNameParts(name) {
  const forms = Array.from(name.matchAll(/\(([^)]+)\)/g), (match) => match[1]);
  return {
    species: name.replace(/\s*\([^)]+\)/g, "").trim(),
    forms,
  };
}

function regionalize(value) {
  return value
    .replace(/(^|_)alolan(?=_|$)/g, "$1alola")
    .replace(/(^|_)galarian(?=_|$)/g, "$1galar")
    .replace(/(^|_)hisuian(?=_|$)/g, "$1hisui")
    .replace(/(^|_)paldean(?=_|$)/g, "$1paldea");
}

function spriteCandidates(pokemon) {
  const withoutBattleState = pokemon.id
    .replace(/_shadow$/, "")
    .replace(/_purified$/, "");
  const candidates = new Set([
    ...(pokeapiNameAliases[pokemon.id] ?? []),
    slug(withoutBattleState.replaceAll("_", " ")),
    slug(regionalize(withoutBattleState).replaceAll("_", " ")),
  ]);

  const name = pokemonNameParts(pokemon.name);
  const base = slug(name.species);
  const forms = name.forms
    .filter((form) => !/^(shadow|purified)$/i.test(form))
    .map((form) => form
      .replace(/^alolan$/i, "alola")
      .replace(/^galarian$/i, "galar")
      .replace(/^hisuian$/i, "hisui")
      .replace(/^paldean$/i, "paldea"));
  candidates.add(forms.length ? `${base}-${slug(forms.join(" "))}` : base);
  candidates.add(base);

  return [...candidates];
}

const [catalog, pokemonIndex, spriteTree, headCommit] = await Promise.all([
  readFile(catalogPath, "utf8").then(JSON.parse),
  readJson("https://pokeapi.co/api/v2/pokemon?limit=100000"),
  readJson(`https://api.github.com/repos/${repository}/git/trees/${branch}?recursive=1`),
  readJson(`https://api.github.com/repos/${repository}/commits/${branch}`),
]);

const availableIds = new Set(
  spriteTree.tree
    .map((entry) => entry.path.match(new RegExp(`^${homeArtworkPath}/(\\d+)\\.png$`))?.[1])
    .filter(Boolean)
    .map(Number),
);
const pokeapiByName = new Map(
  pokemonIndex.results.map((pokemon) => [pokemon.name, Number(pokemon.url.match(/\/(\d+)\/$/)?.[1])]),
);

const spriteIds = {};
let exactForms = 0;
for (const pokemon of catalog.pokemon) {
  const match = spriteCandidates(pokemon)
    .map((candidate) => pokeapiByName.get(candidate))
    .find((id) => id && availableIds.has(id));
  const fallback = availableIds.has(pokemon.dex) ? pokemon.dex : null;
  if (match) {
    spriteIds[pokemon.id] = match;
    if (match !== pokemon.dex) exactForms += 1;
  } else if (fallback) {
    spriteIds[pokemon.id] = fallback;
  }
}

const output = {
  source: {
    name: "PokeAPI sprites",
    repository: `https://github.com/${repository}`,
    commit: headCommit.sha,
    sourceUpdatedAt: headCommit.commit.author.date,
    generatedAt: new Date().toISOString(),
    artworkBaseUrl: `https://raw.githubusercontent.com/${repository}/${headCommit.sha}/${homeArtworkPath}`,
    mappedEntries: Object.keys(spriteIds).length,
    exactFormEntries: exactForms,
  },
  spriteIds,
};

await writeFile(outputPath, `${JSON.stringify(output)}\n`, "utf8");
console.log(`Mapped ${output.source.mappedEntries} PvPoke entries to PokeAPI Home artwork (${exactForms} form-specific).`);
