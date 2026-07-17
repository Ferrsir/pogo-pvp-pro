"use client";

import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import pvpokeCatalog from "@/data/pvpoke-catalog.json";

type View = "dashboard" | "collection" | "builder" | "import" | "teams" | "settings";
type League = "GL" | "UL" | "ML";
type TrainerTeam = "Mystic" | "Valor" | "Instinct" | "Unaffiliated";
type SaveStatus = "loading" | "saving" | "saved" | "error";

type UserProfile = {
  id: string;
  username: string;
  team: TrainerTeam;
  trainerLevel: number;
};

const TRAINER_TEAMS: TrainerTeam[] = ["Mystic", "Valor", "Instinct", "Unaffiliated"];

type Pokemon = {
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
  recommendedMoves: string[];
  types: string[];
  rating: number;
  rank: number;
  role: string;
  leagues: League[];
  ready: boolean;
  favorite: boolean;
  shadow?: boolean;
  elite?: boolean;
  owned?: boolean;
};

type ImportItem = {
  id: string;
  fileName: string;
  preview: string;
  species: string;
  fastMove: string;
  chargedMove1: string;
  chargedMove2: string;
  cp: number;
  attackIv: number;
  defenseIv: number;
  hpIv: number;
  confidence: number;
};

type PvpPokemon = {
  id: string;
  dex: number;
  name: string;
  types: string[];
  baseStats: { atk: number; def: number; hp: number };
  fastMoves: string[];
  chargedMoves: string[];
  eliteMoves: string[];
  tags: string[];
};

const PVP_POKEMON = pvpokeCatalog.pokemon as PvpPokemon[];
const PVP_NAME_COUNTS = new Map<string, number>();
for (const pokemon of PVP_POKEMON) PVP_NAME_COUNTS.set(pokemon.name, (PVP_NAME_COUNTS.get(pokemon.name) ?? 0) + 1);

function pokemonOptionLabel(pokemon: PvpPokemon) {
  const duplicateSuffix = (PVP_NAME_COUNTS.get(pokemon.name) ?? 0) > 1 ? ` · ${pokemon.id}` : "";
  return `${pokemon.name} · #${String(pokemon.dex).padStart(4, "0")}${duplicateSuffix}`;
}

const PVP_POKEMON_OPTIONS = PVP_POKEMON.map((pokemon) => ({ pokemon, label: pokemonOptionLabel(pokemon) }));
const PVP_POKEMON_BY_LABEL = new Map(PVP_POKEMON_OPTIONS.map((option) => [option.label, option.pokemon]));

function pokemonNameParts(name: string) {
  const forms = Array.from(name.matchAll(/\(([^)]+)\)/g), (match) => match[1]);
  return {
    species: name.replace(/\s*\([^)]+\)/g, "").trim(),
    form: forms.length ? forms.join(" · ") : "Normal",
  };
}

type SavedTeam = {
  id: string;
  name: string;
  league: League;
  memberIds: string[];
  score: number;
  updated: string;
};

const LEAGUES: Record<League, { name: string; cap: string; accent: string }> = {
  GL: { name: "Great League", cap: "1,500 CP", accent: "#49a7ff" },
  UL: { name: "Ultra League", cap: "2,500 CP", accent: "#9a7bff" },
  ML: { name: "Master League", cap: "No CP cap", accent: "#f3b73f" },
};

const TYPE_COLORS: Record<string, string> = {
  Water: "#4e90de",
  Ground: "#b98245",
  Poison: "#a963cb",
  Ghost: "#6b62b5",
  Fighting: "#d45252",
  Fairy: "#d978b8",
  Steel: "#8297a6",
  Dragon: "#6d6bd6",
  Psychic: "#e56a8b",
  Flying: "#78a4d7",
  Dark: "#6f6670",
  Normal: "#91979d",
  Fire: "#e87946",
  Electric: "#e1b939",
  Grass: "#5eaa68",
  Ice: "#5dbcb9",
};

const SAMPLE_ROSTER: Pokemon[] = [
  {
    id: "feraligatr",
    species: "Feraligatr",
    form: "Shadow",
    cp: 1497,
    level: 20.5,
    attackIv: 1,
    defenseIv: 13,
    hpIv: 14,
    fastMove: "Shadow Claw",
    chargedMoves: ["Hydro Cannon", "Ice Beam"],
    recommendedMoves: ["Shadow Claw", "Hydro Cannon", "Ice Beam"],
    types: ["Water"],
    rating: 96,
    rank: 18,
    role: "Safe switch",
    leagues: ["GL", "UL"],
    ready: true,
    favorite: true,
    shadow: true,
    elite: true,
    owned: true,
  },
  {
    id: "clodsire",
    species: "Clodsire",
    form: "Normal",
    cp: 1496,
    level: 29,
    attackIv: 0,
    defenseIv: 14,
    hpIv: 15,
    fastMove: "Poison Sting",
    chargedMoves: ["Earthquake", "Stone Edge"],
    recommendedMoves: ["Poison Sting", "Earthquake", "Stone Edge"],
    types: ["Poison", "Ground"],
    rating: 95,
    rank: 7,
    role: "Closer",
    leagues: ["GL"],
    ready: true,
    favorite: false,
    owned: true,
  },
  {
    id: "primeape",
    species: "Primeape",
    form: "Normal",
    cp: 1499,
    level: 24,
    attackIv: 2,
    defenseIv: 15,
    hpIv: 13,
    fastMove: "Karate Chop",
    chargedMoves: ["Rage Fist", "Close Combat"],
    recommendedMoves: ["Karate Chop", "Rage Fist", "Close Combat"],
    types: ["Fighting"],
    rating: 94,
    rank: 31,
    role: "Lead",
    leagues: ["GL", "UL"],
    ready: true,
    favorite: true,
    elite: true,
    owned: true,
  },
  {
    id: "dunsparce",
    species: "Dunsparce",
    form: "Normal",
    cp: 1494,
    level: 40.5,
    attackIv: 5,
    defenseIv: 15,
    hpIv: 14,
    fastMove: "Rollout",
    chargedMoves: ["Drill Run", "Rock Slide"],
    recommendedMoves: ["Rollout", "Drill Run", "Rock Slide"],
    types: ["Normal"],
    rating: 92,
    rank: 84,
    role: "Safe switch",
    leagues: ["GL"],
    ready: true,
    favorite: false,
    owned: true,
  },
  {
    id: "azumarill",
    species: "Azumarill",
    form: "Normal",
    cp: 1492,
    level: 45.5,
    attackIv: 0,
    defenseIv: 15,
    hpIv: 15,
    fastMove: "Bubble",
    chargedMoves: ["Play Rough", "Ice Beam"],
    recommendedMoves: ["Bubble", "Play Rough", "Ice Beam"],
    types: ["Water", "Fairy"],
    rating: 91,
    rank: 12,
    role: "Closer",
    leagues: ["GL"],
    ready: true,
    favorite: false,
    owned: true,
  },
  {
    id: "malamar",
    species: "Malamar",
    form: "Normal",
    cp: 2496,
    level: 49,
    attackIv: 3,
    defenseIv: 15,
    hpIv: 15,
    fastMove: "Psywave",
    chargedMoves: ["Foul Play", "Superpower"],
    recommendedMoves: ["Psywave", "Foul Play", "Superpower"],
    types: ["Dark", "Psychic"],
    rating: 94,
    rank: 26,
    role: "Lead",
    leagues: ["UL"],
    ready: true,
    favorite: true,
    owned: true,
  },
  {
    id: "giratina",
    species: "Giratina",
    form: "Altered",
    cp: 2489,
    level: 27,
    attackIv: 1,
    defenseIv: 12,
    hpIv: 15,
    fastMove: "Shadow Claw",
    chargedMoves: ["Dragon Claw", "Ancient Power"],
    recommendedMoves: ["Shadow Claw", "Dragon Claw", "Ancient Power"],
    types: ["Ghost", "Dragon"],
    rating: 96,
    rank: 42,
    role: "Safe switch",
    leagues: ["UL"],
    ready: true,
    favorite: true,
    owned: true,
  },
  {
    id: "talonflame",
    species: "Talonflame",
    form: "Normal",
    cp: 2493,
    level: 48.5,
    attackIv: 2,
    defenseIv: 15,
    hpIv: 13,
    fastMove: "Incinerate",
    chargedMoves: ["Fly", "Brave Bird"],
    recommendedMoves: ["Incinerate", "Fly", "Brave Bird"],
    types: ["Fire", "Flying"],
    rating: 91,
    rank: 73,
    role: "Closer",
    leagues: ["UL"],
    ready: false,
    favorite: false,
    elite: true,
    owned: true,
  },
  {
    id: "dialga",
    species: "Dialga",
    form: "Origin",
    cp: 4624,
    level: 50,
    attackIv: 15,
    defenseIv: 14,
    hpIv: 15,
    fastMove: "Dragon Breath",
    chargedMoves: ["Roar of Time", "Iron Head"],
    recommendedMoves: ["Dragon Breath", "Roar of Time", "Iron Head"],
    types: ["Steel", "Dragon"],
    rating: 97,
    rank: 4,
    role: "Lead",
    leagues: ["ML"],
    ready: true,
    favorite: true,
    elite: true,
    owned: true,
  },
  {
    id: "zacian",
    species: "Zacian",
    form: "Crowned Sword",
    cp: 4276,
    level: 50,
    attackIv: 15,
    defenseIv: 15,
    hpIv: 14,
    fastMove: "Metal Claw",
    chargedMoves: ["Close Combat", "Wild Charge"],
    recommendedMoves: ["Metal Claw", "Close Combat", "Wild Charge"],
    types: ["Fairy", "Steel"],
    rating: 96,
    rank: 8,
    role: "Closer",
    leagues: ["ML"],
    ready: true,
    favorite: true,
    owned: true,
  },
  {
    id: "dawn-wings",
    species: "Necrozma",
    form: "Dawn Wings",
    cp: 4634,
    level: 50,
    attackIv: 15,
    defenseIv: 15,
    hpIv: 15,
    fastMove: "Shadow Claw",
    chargedMoves: ["Moongeist Beam", "Dark Pulse"],
    recommendedMoves: ["Shadow Claw", "Moongeist Beam", "Dark Pulse"],
    types: ["Psychic", "Ghost"],
    rating: 95,
    rank: 11,
    role: "Safe switch",
    leagues: ["ML"],
    ready: true,
    favorite: true,
    elite: true,
    owned: true,
  },
];

const FUTURE_BUILDS: Pokemon[] = [
  {
    ...SAMPLE_ROSTER[3],
    id: "future-corsola",
    species: "Corsola",
    form: "Galarian",
    cp: 1498,
    level: 49.5,
    fastMove: "Astonish",
    chargedMoves: ["Night Shade", "Power Gem"],
    recommendedMoves: ["Astonish", "Night Shade", "Power Gem"],
    types: ["Ghost"],
    rating: 97,
    rank: 3,
    role: "Safe switch",
    leagues: ["GL"],
    owned: false,
    ready: false,
    elite: false,
  },
  {
    ...SAMPLE_ROSTER[5],
    id: "future-cobalion",
    species: "Cobalion",
    form: "Normal",
    cp: 2499,
    fastMove: "Double Kick",
    chargedMoves: ["Sacred Sword", "Stone Edge"],
    recommendedMoves: ["Double Kick", "Sacred Sword", "Stone Edge"],
    types: ["Fighting", "Steel"],
    rating: 97,
    rank: 9,
    role: "Closer",
    leagues: ["UL"],
    owned: false,
    ready: false,
    elite: true,
  },
  {
    ...SAMPLE_ROSTER[8],
    id: "future-palkia",
    species: "Palkia",
    form: "Origin",
    cp: 4683,
    fastMove: "Dragon Breath",
    chargedMoves: ["Spacial Rend", "Aqua Tail"],
    recommendedMoves: ["Dragon Breath", "Spacial Rend", "Aqua Tail"],
    types: ["Water", "Dragon"],
    rating: 98,
    rank: 1,
    role: "Lead",
    leagues: ["ML"],
    owned: false,
    ready: false,
    elite: true,
  },
];

const NAV_ITEMS: { id: View; label: string; icon: string }[] = [
  { id: "dashboard", label: "Command Center", icon: "⌂" },
  { id: "collection", label: "My Collection", icon: "▦" },
  { id: "builder", label: "Team Builder", icon: "◇" },
  { id: "import", label: "Import Lab", icon: "⇧" },
  { id: "teams", label: "Saved Teams", icon: "▱" },
];

const COVERAGE: Record<League, { strengths: string[]; threats: string[]; targets: string[] }> = {
  GL: {
    strengths: ["Steel", "Ghost", "Ground", "Rock"],
    threats: ["Flying", "Psychic", "Grass"],
    targets: ["Dunsparce", "Azumarill", "Clodsire"],
  },
  UL: {
    strengths: ["Ghost", "Dragon", "Steel", "Fire"],
    threats: ["Fairy", "Dark", "Water"],
    targets: ["Giratina", "Cobalion", "Tentacruel"],
  },
  ML: {
    strengths: ["Dragon", "Fairy", "Psychic", "Flying"],
    threats: ["Ground", "Dark", "Fire"],
    targets: ["Palkia", "Mewtwo", "Xerneas"],
  },
};

async function fetchTrainerState(): Promise<{ collection: Pokemon[]; savedTeams: SavedTeam[] }> {
  const response = await fetch("/api/state", { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Saved data is unavailable.");
  return { collection: payload.collection ?? [], savedTeams: payload.savedTeams ?? [] };
}

function App() {
  const [view, setView] = useState<View>("dashboard");
  const [league, setLeague] = useState<League>("GL");
  const [currentUser, setCurrentUser] = useState<UserProfile | null | undefined>(undefined);
  const [collection, setCollection] = useState<Pokemon[]>([]);
  const [savedTeams, setSavedTeams] = useState<SavedTeam[]>([]);
  const [locked, setLocked] = useState<string[]>([]);
  const [teamSeed, setTeamSeed] = useState(0);
  const [ownedOnly, setOwnedOnly] = useState(true);
  const [includeShadow, setIncludeShadow] = useState(true);
  const [allowElite, setAllowElite] = useState(true);
  const [query, setQuery] = useState("");
  const [collectionLeague, setCollectionLeague] = useState<League | "ALL">("ALL");
  const [importQueue, setImportQueue] = useState<ImportItem[]>([]);
  const [keepScreenshots, setKeepScreenshots] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [stateLoaded, setStateLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("loading");
  const [accountError, setAccountError] = useState("");
  const [toast, setToast] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadAccount() {
      localStorage.removeItem("pogo-pvp-pro-roster");
      localStorage.removeItem("pogo-pvp-pro-teams");
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Account service unavailable.");
        if (payload.user) {
          const state = await fetchTrainerState();
          if (cancelled) return;
          setCollection(state.collection);
          setSavedTeams(state.savedTeams);
          setStateLoaded(true);
          setSaveStatus("saved");
        }
        if (cancelled) return;
        setCurrentUser(payload.user);
      } catch (error) {
        if (cancelled) return;
        setAccountError(error instanceof Error ? error.message : "Account service unavailable.");
        setCurrentUser(null);
      }
    }
    void loadAccount();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!currentUser || !stateLoaded) return;
    const controller = new AbortController();
    const saveTimer = window.setTimeout(async () => {
      setSaveStatus("saving");
      try {
        const response = await fetch("/api/state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ collection, savedTeams }),
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Save failed.");
        setSaveStatus("saved");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSaveStatus("error");
      }
    }, 650);
    return () => {
      controller.abort();
      window.clearTimeout(saveTimer);
    };
  }, [collection, currentUser, savedTeams, stateLoaded]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const candidates = useMemo(() => {
    const pool = ownedOnly ? collection : [...collection, ...FUTURE_BUILDS];
    return pool
      .filter((pokemon) => pokemon.leagues.includes(league))
      .filter((pokemon) => includeShadow || !pokemon.shadow)
      .filter((pokemon) => allowElite || !pokemon.elite)
      .sort((a, b) => b.rating - a.rating);
  }, [allowElite, collection, includeShadow, league, ownedOnly]);

  const team = useMemo(() => {
    const lockedMembers = candidates.filter((pokemon) => locked.includes(pokemon.id));
    const available = candidates.filter((pokemon) => !locked.includes(pokemon.id));
    const offset = available.length ? teamSeed % available.length : 0;
    const rotated = [...available.slice(offset), ...available.slice(0, offset)];
    return [...lockedMembers, ...rotated].slice(0, 3);
  }, [candidates, locked, teamSeed]);

  const filteredCollection = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return collection.filter((pokemon) => {
      const matchesQuery = !normalized || `${pokemon.species} ${pokemon.form} ${pokemon.types.join(" ")}`.toLowerCase().includes(normalized);
      const matchesLeague = collectionLeague === "ALL" || pokemon.leagues.includes(collectionLeague);
      return matchesQuery && matchesLeague;
    });
  }, [collection, collectionLeague, query]);

  const readyCount = collection.filter((pokemon) => pokemon.ready).length;
  const leagueReady = collection.filter((pokemon) => pokemon.leagues.includes(league) && pokemon.ready).length;
  const activeLeague = LEAGUES[league];

  function navigate(next: View) {
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectLeague(next: League) {
    setLeague(next);
    setLocked([]);
    setTeamSeed(0);
  }

  function toggleLock(id: string) {
    setLocked((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 2) {
        setToast("You can lock up to two Pokémon.");
        return current;
      }
      return [...current, id];
    });
  }

  function generateTeam() {
    setTeamSeed((seed) => seed + 1);
    setToast("Fresh lineup generated from your filters.");
  }

  function saveCurrentTeam() {
    if (team.length < 3) {
      setToast("Add three eligible Pokémon before saving.");
      return;
    }
    const newTeam: SavedTeam = {
      id: crypto.randomUUID(),
      name: `${activeLeague.name} — Custom Lineup`,
      league,
      memberIds: team.map((pokemon) => pokemon.id),
      score: Math.round(team.reduce((sum, pokemon) => sum + pokemon.rating, 0) / team.length - 2),
      updated: "Just now",
    };
    setSavedTeams((current) => [newTeam, ...current]);
    setToast("Team saved to your battle plans.");
  }

  function handleFiles(files: File[]) {
    const accepted = files.filter((file) => /image\/(png|jpeg|webp)/.test(file.type));
    if (!accepted.length) {
      setToast("Choose PNG, JPEG, or WebP screenshots.");
      return;
    }
    const items = accepted.map((file) => ({
      id: crypto.randomUUID(),
      fileName: file.name,
      preview: URL.createObjectURL(file),
      species: "",
      fastMove: "",
      chargedMove1: "",
      chargedMove2: "",
      cp: 0,
      attackIv: 0,
      defenseIv: 0,
      hpIv: 0,
      confidence: 38,
    }));
    setImportQueue((current) => [...current, ...items]);
    setToast(`${accepted.length} screenshot${accepted.length === 1 ? "" : "s"} ready for review.`);
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    handleFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    handleFiles(Array.from(event.dataTransfer.files));
  }

  function updateImport(id: string, patch: Partial<ImportItem>) {
    setImportQueue((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function approveImports() {
    const valid = importQueue
      .map((item) => ({ item, catalogPokemon: PVP_POKEMON_BY_LABEL.get(item.species) }))
      .filter((match): match is { item: ImportItem; catalogPokemon: PvpPokemon } => Boolean(match.catalogPokemon && match.item.cp > 0));
    if (!valid.length) {
      setToast("Choose a Pokémon from the catalog and confirm its CP before saving.");
      return;
    }
    const additions: Pokemon[] = valid.map(({ item, catalogPokemon }) => {
      const name = pokemonNameParts(catalogPokemon.name);
      const chargedMoves = [item.chargedMove1 || "Select move", item.chargedMove2 || "Not unlocked"];
      return {
      id: item.id,
      catalogId: catalogPokemon.id,
      species: name.species,
      form: name.form,
      cp: item.cp,
      level: 20,
      attackIv: item.attackIv,
      defenseIv: item.defenseIv,
      hpIv: item.hpIv,
      fastMove: item.fastMove || "Select move",
      chargedMoves,
      recommendedMoves: [],
      types: catalogPokemon.types,
      rating: 70,
      rank: 0,
      role: "Needs analysis",
      leagues: item.cp <= 1500 ? ["GL"] : item.cp <= 2500 ? ["UL"] : ["ML"],
      ready: false,
      favorite: false,
      shadow: catalogPokemon.tags.includes("shadow") || catalogPokemon.id.endsWith("_shadow"),
      elite: [item.fastMove, ...chargedMoves].some((move) => catalogPokemon.eliteMoves.includes(move)),
      owned: true,
    }});
    setCollection((current) => [...additions, ...current]);
    setImportQueue((current) => current.filter((item) => !valid.some((validItem) => validItem.item.id === item.id)));
    setToast(`${additions.length} confirmed Pokémon added to your collection.`);
    navigate("collection");
  }

  function toggleFavorite(id: string) {
    setCollection((current) => current.map((pokemon) => (pokemon.id === id ? { ...pokemon, favorite: !pokemon.favorite } : pokemon)));
  }

  function removePokemon(id: string) {
    const pokemon = collection.find((item) => item.id === id);
    if (!pokemon || !window.confirm(`Remove ${pokemon.species} from your collection?`)) return;
    setCollection((current) => current.filter((item) => item.id !== id));
    setToast(`${pokemon.species} removed.`);
  }

  async function copyTeamLink(savedTeam: SavedTeam) {
    const link = `${window.location.origin}/#team-${savedTeam.id}`;
    try {
      await navigator.clipboard.writeText(link);
      setToast("Team reference copied.");
    } catch {
      setToast("Your browser blocked clipboard access.");
    }
  }

  async function handleAuthenticated(user: UserProfile) {
    setCurrentUser(user);
    setAccountError("");
    try {
      setSaveStatus("loading");
      const state = await fetchTrainerState();
      setCollection(state.collection);
      setSavedTeams(state.savedTeams);
      setStateLoaded(true);
      setSaveStatus("saved");
    } catch (error) {
      setSaveStatus("error");
      setCurrentUser(null);
      setAccountError(error instanceof Error ? error.message : "Saved data is unavailable.");
      throw error;
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setCurrentUser(null);
      setCollection([]);
      setSavedTeams([]);
      setStateLoaded(false);
      setSaveStatus("loading");
      setView("dashboard");
    }
  }

  async function updateProfile(profile: Omit<UserProfile, "id">) {
    const response = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Profile update failed.");
    setCurrentUser(payload.user);
    setToast("Trainer profile updated.");
  }

  if (currentUser === undefined) return <AuthLoading />;
  if (currentUser === null) return <AuthScreen initialError={accountError} onAuthenticated={handleAuthenticated} />;
  if (!stateLoaded) return <AuthLoading label={`Loading ${currentUser.username}'s workspace…`} />;

  const userInitials = currentUser.username.slice(0, 2).toUpperCase();

  return (
    <div className={`app-shell ${compactMode ? "is-compact" : ""}`}>
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate("dashboard")} aria-label="Pogo PVP Pro home">
          <span className="brand-mark" aria-hidden="true"><i /></span>
          <span><strong>Pogo PVP</strong><em>PRO</em></span>
        </button>

        <div className="workspace-label">BATTLE WORKSPACE</div>
        <nav className="primary-nav" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => (
            <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => navigate(item.id)}>
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
              {item.id === "import" && importQueue.length > 0 && <b>{importQueue.length}</b>}
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <div className={`sync-card ${saveStatus === "error" ? "error" : ""}`}>
          <div className="sync-icon" aria-hidden="true">↻</div>
          <div><strong>{saveStatus === "saving" ? "Saving changes…" : saveStatus === "error" ? "Sync needs attention" : "Cloud workspace"}</strong><span>{saveStatus === "saved" ? "Everything is saved" : saveStatus === "error" ? "We’ll retry on your next edit" : "Connected to your account"}</span></div>
          <i className={`status-dot ${saveStatus === "error" ? "error" : ""}`} />
        </div>
        <button className={`settings-link ${view === "settings" ? "active" : ""}`} onClick={() => navigate("settings")}>
          <span className="nav-icon" aria-hidden="true">⚙</span>Settings
        </button>
        <div className="profile-card">
          <div className="avatar">{userInitials}</div>
          <div><strong>{currentUser.username}</strong><span>{currentUser.team} · Level {currentUser.trainerLevel}</span></div>
          <button className="more" onClick={handleLogout} aria-label="Sign out" title="Sign out">↪</button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark small" aria-hidden="true"><i /></span>
            <strong>Pogo PVP Pro</strong>
          </div>
          <div className="topbar-copy">
            <p>{getEyebrow(view)}</p>
            <h1>{getTitle(view)}</h1>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" onClick={() => setToast("You’re all caught up.")} aria-label="Notifications">●</button>
            <button className="button secondary" onClick={() => navigate("import")}><span>＋</span> Add Pokémon</button>
          </div>
        </header>

        <div className="mobile-nav" aria-label="Mobile navigation">
          {NAV_ITEMS.slice(0, 4).map((item) => (
            <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => navigate(item.id)}>
              <span>{item.icon}</span>{item.label.replace("My ", "")}
            </button>
          ))}
        </div>

        <div className="page-content">
          {view === "dashboard" && (
            <Dashboard
              collection={collection}
              league={league}
              team={team}
              readyCount={readyCount}
              leagueReady={leagueReady}
              savedCount={savedTeams.length}
              onLeague={selectLeague}
              onNavigate={navigate}
            />
          )}
          {view === "collection" && (
            <CollectionView
              collection={filteredCollection}
              query={query}
              leagueFilter={collectionLeague}
              onQuery={setQuery}
              onLeagueFilter={setCollectionLeague}
              onFavorite={toggleFavorite}
              onRemove={removePokemon}
              onImport={() => navigate("import")}
            />
          )}
          {view === "builder" && (
            <BuilderView
              league={league}
              candidates={candidates}
              team={team}
              locked={locked}
              ownedOnly={ownedOnly}
              includeShadow={includeShadow}
              allowElite={allowElite}
              onLeague={selectLeague}
              onOwnedOnly={setOwnedOnly}
              onIncludeShadow={setIncludeShadow}
              onAllowElite={setAllowElite}
              onToggleLock={toggleLock}
              onGenerate={generateTeam}
              onSave={saveCurrentTeam}
            />
          )}
          {view === "import" && (
            <ImportView
              items={importQueue}
              keepScreenshots={keepScreenshots}
              fileInput={fileInput}
              onFileChange={onFileChange}
              onDrop={onDrop}
              onKeepScreenshots={setKeepScreenshots}
              onUpdate={updateImport}
              onRemove={(id) => setImportQueue((current) => current.filter((item) => item.id !== id))}
              onApprove={approveImports}
            />
          )}
          {view === "teams" && (
            <TeamsView
              teams={savedTeams}
              collection={collection}
              onOpen={(savedTeam) => { selectLeague(savedTeam.league); navigate("builder"); }}
              onCopy={copyTeamLink}
              onDelete={(id) => { setSavedTeams((current) => current.filter((item) => item.id !== id)); setToast("Saved team deleted."); }}
              onCreate={() => navigate("builder")}
            />
          )}
          {view === "settings" && (
            <SettingsView
              key={`${currentUser.id}-${currentUser.username}-${currentUser.team}-${currentUser.trainerLevel}`}
              user={currentUser}
              compactMode={compactMode}
              keepScreenshots={keepScreenshots}
              onCompactMode={setCompactMode}
              onKeepScreenshots={setKeepScreenshots}
              onProfileSave={updateProfile}
              onReset={() => {
                if (!window.confirm("Delete every Pokémon and saved team from your account?")) return;
                setCollection([]);
                setSavedTeams([]);
                setToast("Roster and saved teams deleted.");
              }}
            />
          )}
        </div>
      </main>
      {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
    </div>
  );
}

function Dashboard({
  collection,
  league,
  team,
  readyCount,
  leagueReady,
  savedCount,
  onLeague,
  onNavigate,
}: {
  collection: Pokemon[];
  league: League;
  team: Pokemon[];
  readyCount: number;
  leagueReady: number;
  savedCount: number;
  onLeague: (league: League) => void;
  onNavigate: (view: View) => void;
}) {
  const coverage = COVERAGE[league];
  const readyPercent = collection.length ? Math.round((readyCount / collection.length) * 100) : 0;
  const optimizedPercent = collection.length ? Math.round((collection.filter((pokemon) => pokemon.recommendedMoves.length > 0 && pokemon.recommendedMoves.every((move) => [pokemon.fastMove, ...pokemon.chargedMoves].includes(move))).length / collection.length) * 100) : 0;
  const secondMovePercent = collection.length ? Math.round((collection.filter((pokemon) => pokemon.chargedMoves[1] && pokemon.chargedMoves[1] !== "Not unlocked").length / collection.length) * 100) : 0;
  const teamScore = team.length === 3 ? Math.round(team.reduce((sum, pokemon) => sum + pokemon.rating, 0) / 3 - 2) : 0;
  return (
    <>
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="kicker"><i /> ROSTER ONLINE</span>
          <h2>Your next winning line<br />starts with the right three.</h2>
          <p>Turn your collection into battle-ready teams with league-aware builds, coverage analysis, and clear upgrade paths.</p>
          <div className="hero-actions">
            <button className="button primary" onClick={() => onNavigate("builder")}>Open Team Builder <span>→</span></button>
            <button className="text-button" onClick={() => onNavigate("collection")}>Review collection</button>
          </div>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="battle-core"><span /><i /></div>
          <div className="orbit-chip chip-one">IV</div>
          <div className="orbit-chip chip-two">CP</div>
          <div className="orbit-chip chip-three">3×</div>
        </div>
      </section>

      <section className="stats-row" aria-label="Roster overview">
        <StatCard label="Total Pokémon" value={collection.length.toString()} detail="Across all leagues" icon="▦" tone="blue" />
        <StatCard label="Battle ready" value={readyCount.toString()} detail={`${readyPercent}% of collection`} icon="✓" tone="green" />
        <StatCard label="Ready for league" value={leagueReady.toString()} detail={LEAGUES[league].name} icon="◇" tone="purple" />
        <StatCard label="Saved teams" value={savedCount.toString()} detail={savedCount ? "Ready for quick access" : "Build your first lineup"} icon="▱" tone="orange" />
      </section>

      <div className="dashboard-grid">
        <section className="panel featured-team">
          <PanelHeader eyebrow="RECOMMENDED LINEUP" title="Battle-ready team" action={<button className="text-button" onClick={() => onNavigate("builder")}>Full analysis →</button>} />
          <LeagueTabs league={league} onChange={onLeague} />
          {team.length === 3 ? <><div className="team-strip">
            {team.map((pokemon, index) => (
              <MiniMember key={pokemon.id} pokemon={pokemon} role={["Lead", "Safe switch", "Closer"][index]} index={index} />
            ))}
          </div>
          <div className="team-footer">
            <div className="score-ring" style={{ "--score": String(teamScore) } as React.CSSProperties}><strong>{teamScore}</strong><span>TEAM<br />SCORE</span></div>
            <div className="coverage-summary">
              <div><span>Strong into</span><TypeList types={coverage.strengths.slice(0, 3)} /></div>
              <div><span>Watch for</span><TypeList types={coverage.threats.slice(0, 3)} /></div>
            </div>
            <button className="button subtle" onClick={() => onNavigate("builder")}>Tune lineup</button>
          </div></> : <EmptyState icon="＋" title="Your roster is ready for its first entry" text="Import a Pokémon to unlock team recommendations and coverage analysis." action={<button className="button primary" onClick={() => onNavigate("import")}>Add your first Pokémon</button>} />}
        </section>

        <aside className="panel readiness-card">
          <PanelHeader eyebrow="THIS WEEK" title="Build readiness" />
          <div className="readiness-ring"><div><strong>{readyPercent}%</strong><span>battle ready</span></div></div>
          <div className="readiness-list">
            <ProgressRow label="Moves optimized" value={optimizedPercent} tone="blue" />
            <ProgressRow label="Second move unlocked" value={secondMovePercent} tone="purple" />
            <ProgressRow label="Battle ready" value={readyPercent} tone="green" />
          </div>
          <button className="button secondary wide" onClick={() => onNavigate("collection")}>View upgrade queue <span>{Math.max(0, collection.length - readyCount)}</span></button>
        </aside>
      </div>

      <section className="panel roster-preview">
        <PanelHeader eyebrow="RECENTLY UPDATED" title="Collection pulse" action={<button className="text-button" onClick={() => onNavigate("collection")}>View all {collection.length} →</button>} />
        {collection.length ? <div className="roster-list">
          {collection.slice(0, 5).map((pokemon) => <RosterRow key={pokemon.id} pokemon={pokemon} />)}
        </div> : <EmptyState icon="▦" title="No Pokémon in your collection" text="Your account starts clean. Add appraisal screenshots when you’re ready." action={<button className="button secondary" onClick={() => onNavigate("import")}>Import appraisals</button>} />}
      </section>
    </>
  );
}

function CollectionView({
  collection,
  query,
  leagueFilter,
  onQuery,
  onLeagueFilter,
  onFavorite,
  onRemove,
  onImport,
}: {
  collection: Pokemon[];
  query: string;
  leagueFilter: League | "ALL";
  onQuery: (value: string) => void;
  onLeagueFilter: (value: League | "ALL") => void;
  onFavorite: (id: string) => void;
  onRemove: (id: string) => void;
  onImport: () => void;
}) {
  return (
    <section className="panel collection-panel">
      <div className="collection-head">
        <div><span className="section-eyebrow">ROSTER DATABASE</span><h2>{collection.length} Pokémon in view</h2><p>Search, compare, and track build readiness across every league.</p></div>
        <button className="button primary" onClick={onImport}>＋ Import appraisals</button>
      </div>
      <div className="collection-toolbar">
        <label className="search-box"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search Pokémon, form, or type…" aria-label="Search collection" /></label>
        <div className="filter-tabs" aria-label="League filter">
          {(["ALL", "GL", "UL", "ML"] as const).map((item) => <button key={item} className={leagueFilter === item ? "active" : ""} onClick={() => onLeagueFilter(item)}>{item === "ALL" ? "All" : item}</button>)}
        </div>
        <button className="button ghost" onClick={() => onQuery("")}>Clear filters</button>
      </div>
      {collection.length ? (
        <div className="collection-table-wrap">
          <table className="collection-table">
            <thead><tr><th>Pokémon</th><th>League</th><th>CP / Level</th><th>IV spread</th><th>Current moves</th><th>Status</th><th aria-label="Actions" /></tr></thead>
            <tbody>
              {collection.map((pokemon) => (
                <tr key={pokemon.id}>
                  <td><div className="pokemon-cell"><PokemonMark pokemon={pokemon} size="small" /><div><strong>{pokemon.species}</strong><span>{pokemon.form}</span></div></div></td>
                  <td><div className="league-pills">{pokemon.leagues.map((item) => <span key={item} className={`league-pill ${item.toLowerCase()}`}>{item}</span>)}</div></td>
                  <td><strong className="numeric">{pokemon.cp.toLocaleString()}</strong><span className="table-sub">Level {pokemon.level}</span></td>
                  <td><strong className="numeric">{pokemon.attackIv}/{pokemon.defenseIv}/{pokemon.hpIv}</strong><span className="table-sub">Rank #{pokemon.rank || "—"}</span></td>
                  <td><strong className="move-main">{pokemon.fastMove}</strong><span className="table-sub">{pokemon.chargedMoves.join(" · ")}</span></td>
                  <td><span className={`readiness-badge ${pokemon.ready ? "ready" : "needs-work"}`}><i />{pokemon.ready ? "Battle ready" : "Needs work"}</span></td>
                  <td><div className="row-actions"><button onClick={() => onFavorite(pokemon.id)} aria-label={`${pokemon.favorite ? "Unfavorite" : "Favorite"} ${pokemon.species}`} className={pokemon.favorite ? "favorite" : ""}>★</button><button onClick={() => onRemove(pokemon.id)} aria-label={`Remove ${pokemon.species}`}>•••</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={query || leagueFilter !== "ALL" ? "⌕" : "＋"}
          title={query || leagueFilter !== "ALL" ? "No roster matches" : "Your roster is empty"}
          text={query || leagueFilter !== "ALL" ? "Try a different search or league filter." : "New accounts start clean. Import your first appraisal when you’re ready."}
          action={query || leagueFilter !== "ALL" ? <button className="button secondary" onClick={() => { onQuery(""); onLeagueFilter("ALL"); }}>Reset filters</button> : <button className="button primary" onClick={onImport}>Add your first Pokémon</button>}
        />
      )}
    </section>
  );
}

function BuilderView({
  league,
  candidates,
  team,
  locked,
  ownedOnly,
  includeShadow,
  allowElite,
  onLeague,
  onOwnedOnly,
  onIncludeShadow,
  onAllowElite,
  onToggleLock,
  onGenerate,
  onSave,
}: {
  league: League;
  candidates: Pokemon[];
  team: Pokemon[];
  locked: string[];
  ownedOnly: boolean;
  includeShadow: boolean;
  allowElite: boolean;
  onLeague: (league: League) => void;
  onOwnedOnly: (value: boolean) => void;
  onIncludeShadow: (value: boolean) => void;
  onAllowElite: (value: boolean) => void;
  onToggleLock: (id: string) => void;
  onGenerate: () => void;
  onSave: () => void;
}) {
  const coverage = COVERAGE[league];
  const teamScore = team.length ? Math.round(team.reduce((sum, pokemon) => sum + pokemon.rating, 0) / team.length - 2) : 0;
  return (
    <>
      <section className="builder-toolbar panel">
        <div><span className="section-eyebrow">BATTLE LAB</span><h2>Build for the open meta</h2><p>Lock your core, tune the rules, and explore several strong lineups.</p></div>
        <LeagueTabs league={league} onChange={onLeague} large />
      </section>

      <div className="builder-layout">
        <aside className="panel builder-controls">
          <PanelHeader eyebrow="TEAM RULES" title="Search settings" />
          <div className="control-stack">
            <Switch label="Owned Pokémon only" detail="Use your current collection" checked={ownedOnly} onChange={onOwnedOnly} />
            <Switch label="Include Shadow forms" detail="Allow higher-pressure builds" checked={includeShadow} onChange={onIncludeShadow} />
            <Switch label="Allow Elite TM moves" detail="Include legacy movesets" checked={allowElite} onChange={onAllowElite} />
          </div>
          <div className="control-divider" />
          <div className="weight-list">
            <span className="section-eyebrow">SCORING MODEL</span>
            <MetricBar label="Meta coverage" value={30} max={30} />
            <MetricBar label="Threat control" value={20} max={30} />
            <MetricBar label="Team safety" value={15} max={30} />
            <MetricBar label="Consistency" value={15} max={30} />
          </div>
          <button className="button primary wide generate-button" onClick={onGenerate}>↻ Generate another team</button>
        </aside>

        <div className="builder-main">
          <section className="panel lineup-panel">
            <div className="lineup-heading">
              <div><span className="section-eyebrow">TOP RECOMMENDATION</span><h2>{LEAGUES[league].name} lineup</h2></div>
              <div className="lineup-score"><strong>{teamScore}</strong><span>TEAM<br />SCORE</span></div>
            </div>
            {team.length === 3 ? (
              <div className="member-grid">
                {team.map((pokemon, index) => <MemberCard key={pokemon.id} pokemon={pokemon} role={["Lead", "Safe switch", "Closer"][index]} locked={locked.includes(pokemon.id)} onLock={() => onToggleLock(pokemon.id)} />)}
              </div>
            ) : (
              <EmptyState icon="◇" title="Not enough eligible builds" text="Relax one of the team rules or import more Pokémon for this league." />
            )}
            {team.length === 3 && <div className="lineup-actions"><p><span>✓</span> All three builds are legal for {LEAGUES[league].name}</p><button className="button secondary" onClick={onSave}>Save this team</button></div>}
          </section>

          <section className="analysis-grid">
            <div className="panel analysis-card">
              <PanelHeader eyebrow="MATCHUP PROFILE" title="Coverage map" />
              <div className="coverage-columns">
                <div><span className="analysis-label positive">STRONG INTO</span>{coverage.strengths.map((type) => <CoverageRow key={type} type={type} value={82 - coverage.strengths.indexOf(type) * 7} />)}</div>
                <div><span className="analysis-label danger">WATCH FOR</span>{coverage.threats.map((type) => <CoverageRow key={type} type={type} value={56 - coverage.threats.indexOf(type) * 6} danger />)}</div>
              </div>
            </div>
            <div className="panel analysis-card targets-card">
              <PanelHeader eyebrow="META CHECK" title="Targets & counters" />
              <p className="card-intro">This lineup is positioned to handle:</p>
              <div className="target-list">{coverage.targets.map((target, index) => <div key={target}><span className={`target-rank rank-${index + 1}`}>{index + 1}</span><div><strong>{target}</strong><span>{index === 0 ? "Strong answer" : index === 1 ? "Positive matchup" : "Shield dependent"}</span></div><b>{88 - index * 9}%</b></div>)}</div>
              <div className="recommendation"><span>↗</span><div><strong>Best next upgrade</strong><p>{team.find((pokemon) => !pokemon.ready)?.species ?? team[1]?.species ?? "Your safe switch"} gains the most from a second charged move.</p></div></div>
            </div>
          </section>

          <section className="panel lock-panel">
            <PanelHeader eyebrow="BUILD AROUND YOUR FAVORITES" title={`Lock up to two · ${locked.length}/2 selected`} action={locked.length ? <button className="text-button" onClick={() => locked.forEach(onToggleLock)}>Clear locks</button> : undefined} />
            <div className="candidate-scroll">
              {candidates.map((pokemon) => <button key={pokemon.id} className={`candidate-card ${locked.includes(pokemon.id) ? "locked" : ""}`} onClick={() => onToggleLock(pokemon.id)}><PokemonMark pokemon={pokemon} size="small" /><div><strong>{pokemon.species}</strong><span>CP {pokemon.cp.toLocaleString()} · {pokemon.rating} rating</span></div><i>{locked.includes(pokemon.id) ? "LOCKED" : "LOCK"}</i></button>)}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function ImportView({
  items,
  keepScreenshots,
  fileInput,
  onFileChange,
  onDrop,
  onKeepScreenshots,
  onUpdate,
  onRemove,
  onApprove,
}: {
  items: ImportItem[];
  keepScreenshots: boolean;
  fileInput: React.RefObject<HTMLInputElement | null>;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onKeepScreenshots: (value: boolean) => void;
  onUpdate: (id: string, patch: Partial<ImportItem>) => void;
  onRemove: (id: string) => void;
  onApprove: () => void;
}) {
  const sourceDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(pvpokeCatalog.source.sourceUpdatedAt));

  function updateSpecies(itemId: string, value: string) {
    const catalogPokemon = PVP_POKEMON_BY_LABEL.get(value);
    onUpdate(itemId, {
      species: value,
      confidence: catalogPokemon ? 96 : 38,
      fastMove: catalogPokemon?.fastMoves[0] ?? "",
      chargedMove1: catalogPokemon?.chargedMoves[0] ?? "",
      chargedMove2: catalogPokemon?.chargedMoves[1] ?? "",
    });
  }

  return (
    <>
      <section className="import-hero panel">
        <div className="import-hero-copy"><span className="section-eyebrow">BATCH APPRAISAL IMPORT</span><h2>Turn screenshots into complete battle records.</h2><p>Match every appraisal to the full Pokémon GO battle catalog, confirm its form and legal moves, then save it directly to your private roster.</p><div className="catalog-summary"><span><strong>{pvpokeCatalog.source.pokemonCount.toLocaleString("en-US")}</strong> released forms</span><span><strong>{pvpokeCatalog.source.pokedexCount}</strong> Pokédex species</span><a href={pvpokeCatalog.source.repository} target="_blank" rel="noreferrer">PvPoke data · {sourceDate} ↗</a></div></div>
        <div className="privacy-chip"><span>◉</span><div><strong>Private by default</strong><p>Images stay on this device unless you choose otherwise.</p></div></div>
      </section>
      <div className="import-layout">
        <section className="panel upload-panel">
          <div className="drop-zone" onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
            <div className="upload-symbol">⇧</div>
            <h3>Drop appraisal screenshots here</h3>
            <p>PNG, JPEG, or WebP · One Pokémon per image</p>
            <button className="button primary" onClick={() => fileInput.current?.click()}>Choose screenshots</button>
            <input ref={fileInput} type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={onFileChange} hidden />
          </div>
          <Switch label="Keep compressed screenshots" detail="Off by default for privacy" checked={keepScreenshots} onChange={onKeepScreenshots} />
          <div className="process-steps"><ProcessStep n="1" title="Local scan" detail="Read visible appraisal fields" /><ProcessStep n="2" title="Catalog match" detail="Choose species, form, and moves" /><ProcessStep n="3" title="Cloud save" detail="Add the confirmed build to your roster" /></div>
          <div className="catalog-note"><span>DATA</span><p><strong>Full battle-form coverage</strong>Regional, alternate, Mega, and Shadow variants are included. Cosmetic costumes share their base PvP build.</p></div>
        </section>

        <section className="panel review-panel">
          <PanelHeader eyebrow="REVIEW QUEUE" title={items.length ? `${items.length} waiting for confirmation` : "Nothing waiting yet"} action={items.length ? <span className="low-confidence">● NEEDS REVIEW</span> : undefined} />
          {items.length ? (
            <>
              <div className="review-list">
                {items.map((item, index) => {
                  const catalogPokemon = PVP_POKEMON_BY_LABEL.get(item.species);
                  const displayName = catalogPokemon ? pokemonNameParts(catalogPokemon.name) : null;
                  return <article className={`review-item ${catalogPokemon ? "catalog-confirmed" : ""}`} key={item.id}>
                    {/* Blob previews are local-only and cannot use the Next image optimizer. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.preview} alt={`Appraisal preview for ${item.fileName}`} />
                    <div className="review-fields">
                      <div className="review-title"><span>#{String(index + 1).padStart(2, "0")}</span><strong>{item.fileName}</strong><button onClick={() => onRemove(item.id)} aria-label={`Remove ${item.fileName}`}>×</button></div>
                      <div className="field-row">
                        <label className="species-search-field">Pokémon & form<input list="pvpoke-species-options" value={item.species} onChange={(event) => updateSpecies(item.id, event.target.value)} placeholder={`Search ${pvpokeCatalog.source.pokemonCount.toLocaleString("en-US")} released forms…`} /></label>
                        <NumberInput label="CP" value={item.cp} max={10000} onChange={(value) => onUpdate(item.id, { cp: value })} />
                      </div>
                      {catalogPokemon && displayName && <div className="catalog-match"><span className="catalog-check">✓</span><div><strong>{displayName.species}</strong><span>#{String(catalogPokemon.dex).padStart(4, "0")} · {displayName.form}</span></div><TypeList types={catalogPokemon.types} /><div className="base-stat-line"><span>ATK <b>{catalogPokemon.baseStats.atk}</b></span><span>DEF <b>{catalogPokemon.baseStats.def}</b></span><span>HP <b>{catalogPokemon.baseStats.hp}</b></span></div></div>}
                      <div className="iv-field-row"><NumberInput label="Attack IV" value={item.attackIv} max={15} onChange={(value) => onUpdate(item.id, { attackIv: value })} /><NumberInput label="Defense IV" value={item.defenseIv} max={15} onChange={(value) => onUpdate(item.id, { defenseIv: value })} /><NumberInput label="HP IV" value={item.hpIv} max={15} onChange={(value) => onUpdate(item.id, { hpIv: value })} /></div>
                      {catalogPokemon && <div className="move-field-row"><label>Fast move<select value={item.fastMove} onChange={(event) => onUpdate(item.id, { fastMove: event.target.value })}>{catalogPokemon.fastMoves.map((move) => <option value={move} key={move}>{move}{catalogPokemon.eliteMoves.includes(move) ? " · Elite" : ""}</option>)}</select></label><label>Charged move 1<select value={item.chargedMove1} onChange={(event) => onUpdate(item.id, { chargedMove1: event.target.value })}>{catalogPokemon.chargedMoves.map((move) => <option value={move} key={move}>{move}{catalogPokemon.eliteMoves.includes(move) ? " · Elite" : ""}</option>)}</select></label><label>Charged move 2<select value={item.chargedMove2} onChange={(event) => onUpdate(item.id, { chargedMove2: event.target.value })}><option value="">Not unlocked</option>{catalogPokemon.chargedMoves.map((move) => <option value={move} key={move}>{move}{catalogPokemon.eliteMoves.includes(move) ? " · Elite" : ""}</option>)}</select></label></div>}
                      <div className="confidence-line"><span>Field confidence</span><i><b style={{ width: `${item.confidence}%` }} /></i><strong>{item.confidence}%</strong></div>
                    </div>
                  </article>;
                })}
              </div>
              <datalist id="pvpoke-species-options">{PVP_POKEMON_OPTIONS.map(({ pokemon, label }) => <option value={label} key={pokemon.id}>{pokemon.types.join(" / ")}</option>)}</datalist>
              <div className="review-footer"><p><span>!</span> Every entry needs a catalog match and CP.</p><button className="button primary" onClick={onApprove}>Approve confirmed entries</button></div>
            </>
          ) : (
            <EmptyState icon="▧" title="Your review queue is clear" text={`Add appraisal screenshots to match against ${pvpokeCatalog.source.pokemonCount.toLocaleString("en-US")} released forms. Nothing is saved until you approve it.`} />
          )}
        </section>
      </div>
    </>
  );
}

function TeamsView({ teams, collection, onOpen, onCopy, onDelete, onCreate }: { teams: SavedTeam[]; collection: Pokemon[]; onOpen: (team: SavedTeam) => void; onCopy: (team: SavedTeam) => void; onDelete: (id: string) => void; onCreate: () => void }) {
  return (
    <section className="panel saved-teams-panel">
      <div className="collection-head"><div><span className="section-eyebrow">BATTLE PLANS</span><h2>Your saved teams</h2><p>Keep proven lines close and copy a quick reference whenever you need it.</p></div><button className="button primary" onClick={onCreate}>＋ Build a team</button></div>
      {teams.length ? <div className="saved-team-grid">{teams.map((team) => {
        const members = team.memberIds.map((id) => collection.find((pokemon) => pokemon.id === id)).filter(Boolean) as Pokemon[];
        return <article className="saved-team-card" key={team.id}><div className="saved-card-top"><span className={`league-pill ${team.league.toLowerCase()}`}>{team.league}</span><span>Updated {team.updated}</span></div><h3>{team.name}</h3><div className="saved-members">{members.map((pokemon) => <div key={pokemon.id}><PokemonMark pokemon={pokemon} size="small" /><span>{pokemon.species}</span></div>)}</div><div className="saved-card-footer"><div><strong>{team.score}</strong><span>score</span></div><button className="button ghost" onClick={() => onCopy(team)}>Copy reference</button><button className="button secondary" onClick={() => onOpen(team)}>Open team</button><button className="icon-button" onClick={() => onDelete(team.id)} aria-label={`Delete ${team.name}`}>×</button></div></article>;
      })}</div> : <EmptyState icon="▱" title="No saved teams yet" text="Build a lineup you like, then save it here for quick access." action={<button className="button primary" onClick={onCreate}>Open Team Builder</button>} />}
    </section>
  );
}

function AuthLoading({ label = "Opening your battle workspace…" }: { label?: string }) {
  return (
    <main className="auth-loading">
      <span className="brand-mark" aria-hidden="true"><i /></span>
      <div className="auth-spinner" aria-hidden="true" />
      <p>{label}</p>
    </main>
  );
}

function AuthScreen({ initialError, onAuthenticated }: { initialError: string; onAuthenticated: (user: UserProfile) => Promise<void> }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [team, setTeam] = useState<TrainerTeam>("Unaffiliated");
  const [trainerLevel, setTrainerLevel] = useState(1);
  const [error, setError] = useState(initialError);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const body = mode === "signup" ? { username, password, team, trainerLevel } : { username, password };
      const response = await fetch(`/api/auth/${mode === "signup" ? "signup" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Account request failed.");
      await onAuthenticated(payload.user);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Account request failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode(next: "login" | "signup") {
    setMode(next);
    setError("");
  }

  return (
    <main className="auth-shell">
      <section className="auth-story">
        <button className="brand auth-brand" aria-label="Pogo PVP Pro">
          <span className="brand-mark" aria-hidden="true"><i /></span>
          <span><strong>Pogo PVP</strong><em>PRO</em></span>
        </button>
        <div className="auth-copy">
          <span className="kicker"><i /> YOUR ROSTER. YOUR ACCOUNT.</span>
          <h1>Build smarter teams.<br />Keep every plan.</h1>
          <p>A private battle workspace for your collection, saved lineups, and trainer profile—available whenever you sign in.</p>
          <div className="auth-feature-list">
            <div><span>01</span><p><strong>Start clean</strong>No starter Pokémon are added for you.</p></div>
            <div><span>02</span><p><strong>Save automatically</strong>Roster edits and teams sync to your account.</p></div>
            <div><span>03</span><p><strong>No email required</strong>Just choose a username and password.</p></div>
          </div>
        </div>
        <div className="auth-visual" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="battle-core"><span /><i /></div></div>
      </section>

      <section className="auth-card-wrap">
        <div className="auth-card">
          <div className="auth-tabs" aria-label="Account action">
            <button className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")}>Sign in</button>
            <button className={mode === "signup" ? "active" : ""} onClick={() => switchMode("signup")}>Create account</button>
          </div>
          <div className="auth-card-heading">
            <span className="section-eyebrow">{mode === "login" ? "WELCOME BACK" : "NEW TRAINER"}</span>
            <h2>{mode === "login" ? "Open your workspace" : "Create your profile"}</h2>
            <p>{mode === "login" ? "Your private roster is ready when you are." : "Your new collection starts completely empty."}</p>
          </div>
          <form className="auth-form" onSubmit={submit}>
            <label className="auth-field"><span>Username</span><input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" placeholder="trainer_name" required /><small>3–24 letters, numbers, or underscores</small></label>
            <label className="auth-field"><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} maxLength={128} placeholder="At least 8 characters" required /></label>
            {mode === "signup" && (
              <div className="auth-row">
                <label className="auth-field"><span>Pokémon GO team</span><select value={team} onChange={(event) => setTeam(event.target.value as TrainerTeam)}>{TRAINER_TEAMS.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label className="auth-field"><span>Trainer level</span><input type="number" value={trainerLevel} onChange={(event) => setTrainerLevel(Number(event.target.value))} min={1} max={50} required /></label>
              </div>
            )}
            {error && <div className="auth-error" role="alert"><span>!</span>{error}</div>}
            <button className="button primary auth-submit" disabled={submitting}>{submitting ? "Working…" : mode === "login" ? "Sign in" : "Create account"}<span>→</span></button>
          </form>
          <p className="auth-footnote">Private session · Passwords are never stored in plain text</p>
        </div>
      </section>
    </main>
  );
}

function SettingsView({ user, compactMode, keepScreenshots, onCompactMode, onKeepScreenshots, onProfileSave, onReset }: { user: UserProfile; compactMode: boolean; keepScreenshots: boolean; onCompactMode: (value: boolean) => void; onKeepScreenshots: (value: boolean) => void; onProfileSave: (profile: Omit<UserProfile, "id">) => Promise<void>; onReset: () => void }) {
  const [username, setUsername] = useState(user.username);
  const [team, setTeam] = useState<TrainerTeam>(user.team);
  const [trainerLevel, setTrainerLevel] = useState(user.trainerLevel);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onProfileSave({ username, team, trainerLevel });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Profile update failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-grid">
      <section className="panel settings-panel"><PanelHeader eyebrow="DISPLAY" title="Workspace preferences" /><Switch label="Compact roster density" detail="Fit more rows on desktop" checked={compactMode} onChange={onCompactMode} /><Switch label="Keep imported screenshots" detail="Store compressed copies on this device" checked={keepScreenshots} onChange={onKeepScreenshots} /></section>
      <section className="panel settings-panel profile-settings"><PanelHeader eyebrow="TRAINER PROFILE" title="Account details" /><form className="profile-form" onSubmit={saveProfile}><label className="auth-field"><span>Username</span><input value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" required /></label><div className="profile-form-grid"><label className="auth-field"><span>Team</span><select value={team} onChange={(event) => setTeam(event.target.value as TrainerTeam)}>{TRAINER_TEAMS.map((item) => <option key={item}>{item}</option>)}</select></label><label className="auth-field"><span>Trainer level</span><input type="number" value={trainerLevel} onChange={(event) => setTrainerLevel(Number(event.target.value))} min={1} max={50} required /></label></div>{error && <div className="auth-error" role="alert"><span>!</span>{error}</div>}<button className="button primary" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button></form></section>
      <section className="panel settings-panel"><PanelHeader eyebrow="ACCOUNT DATA" title="Private cloud workspace" /><div className="demo-notice connected"><span>✓</span><p><strong>Database sync is connected.</strong>Your roster and saved teams belong to this account and follow you between signed-in devices.</p></div><button className="button danger" onClick={onReset}>Delete roster & teams</button></section>
      <section className="panel settings-panel full"><PanelHeader eyebrow="DATA & ATTRIBUTION" title="Built for transparent team planning" /><div className="settings-copy"><p>Species, forms, base stats, types, and legal moves are pinned to the attributed PvPoke catalog. Team ratings and matchup recommendations remain sample planning data until the ranking pipeline is connected.</p><div><span>APP VERSION</span><strong>0.3 · Full catalog</strong></div><div><span>CLOUD DATABASE</span><strong>Connected</strong></div><div><span>PVPOKE CATALOG</span><strong>{pvpokeCatalog.source.pokemonCount.toLocaleString("en-US")} released forms</strong></div></div></section>
    </div>
  );
}

function PanelHeader({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return <div className="panel-heading"><div><span className="section-eyebrow">{eyebrow}</span><h3>{title}</h3></div>{action}</div>;
}

function LeagueTabs({ league, onChange, large = false }: { league: League; onChange: (league: League) => void; large?: boolean }) {
  return <div className={`league-tabs ${large ? "large" : ""}`}>{(Object.keys(LEAGUES) as League[]).map((item) => <button key={item} className={league === item ? "active" : ""} onClick={() => onChange(item)}><span>{item}</span><b>{LEAGUES[item].name.replace(" League", "")}</b></button>)}</div>;
}

function StatCard({ label, value, detail, icon, tone }: { label: string; value: string; detail: string; icon: string; tone: string }) {
  return <article className={`stat-card tone-${tone}`}><div className="stat-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div><i>↗</i></article>;
}

function MiniMember({ pokemon, role, index }: { pokemon: Pokemon; role: string; index: number }) {
  return <article className="mini-member"><div className="member-order">0{index + 1}</div><PokemonMark pokemon={pokemon} /><div className="mini-member-copy"><span>{role.toUpperCase()}</span><strong>{pokemon.species}</strong><small>{pokemon.form} · CP {pokemon.cp.toLocaleString()}</small><TypeList types={pokemon.types} /></div></article>;
}

function MemberCard({ pokemon, role, locked, onLock }: { pokemon: Pokemon; role: string; locked: boolean; onLock: () => void }) {
  return <article className="member-card"><div className="member-card-top"><span className="role-label">{role.toUpperCase()}</span><button className={locked ? "locked" : ""} onClick={onLock}>{locked ? "◆ LOCKED" : "◇ LOCK"}</button></div><PokemonMark pokemon={pokemon} size="large" /><h3>{pokemon.species}</h3><p>{pokemon.form} · CP {pokemon.cp.toLocaleString()} · Lv {pokemon.level}</p><TypeList types={pokemon.types} /><div className="move-list"><div><span>FAST</span><strong>{pokemon.fastMove}</strong></div>{pokemon.chargedMoves.map((move, index) => <div key={move}><span>CHG {index + 1}</span><strong>{move}</strong></div>)}</div><div className="member-meta"><span>IV <b>{pokemon.attackIv}/{pokemon.defenseIv}/{pokemon.hpIv}</b></span><span>Rank <b>#{pokemon.rank || "—"}</b></span>{!pokemon.owned && <em>NOT OWNED</em>}</div></article>;
}

function PokemonMark({ pokemon, size = "medium" }: { pokemon: Pokemon; size?: "small" | "medium" | "large" }) {
  const initials = pokemon.species.split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase();
  const primary = TYPE_COLORS[pokemon.types[0]] ?? "#49a7ff";
  const secondary = TYPE_COLORS[pokemon.types[1] ?? pokemon.types[0]] ?? primary;
  return <div className={`pokemon-mark ${size}`} style={{ "--primary": primary, "--secondary": secondary } as React.CSSProperties}><span>{initials}</span><i /></div>;
}

function TypeList({ types }: { types: string[] }) {
  return <div className="type-list">{types.map((type) => <span key={type} style={{ "--type": TYPE_COLORS[type] ?? "#8493a3" } as React.CSSProperties}><i />{type}</span>)}</div>;
}

function ProgressRow({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className={`progress-row ${tone}`}><div><span>{label}</span><strong>{value}%</strong></div><i><b style={{ width: `${value}%` }} /></i></div>;
}

function RosterRow({ pokemon }: { pokemon: Pokemon }) {
  return <div className="roster-row"><PokemonMark pokemon={pokemon} size="small" /><div className="roster-name"><strong>{pokemon.species}</strong><span>{pokemon.form}</span></div><TypeList types={pokemon.types} /><div className="roster-stat"><span>CP</span><strong>{pokemon.cp.toLocaleString()}</strong></div><div className="roster-stat"><span>IV</span><strong>{pokemon.attackIv}/{pokemon.defenseIv}/{pokemon.hpIv}</strong></div><div className="roster-moves"><span>{pokemon.fastMove}</span><strong>{pokemon.chargedMoves.join(" · ")}</strong></div><span className={`readiness-badge ${pokemon.ready ? "ready" : "needs-work"}`}><i />{pokemon.ready ? "Ready" : "Upgrade"}</span></div>;
}

function Switch({ label, detail, checked, onChange }: { label: string; detail: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="switch-row"><span><strong>{label}</strong><small>{detail}</small></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i aria-hidden="true"><b /></i></label>;
}

function MetricBar({ label, value, max }: { label: string; value: number; max: number }) {
  return <div className="metric-bar"><div><span>{label}</span><strong>{value}%</strong></div><i><b style={{ width: `${(value / max) * 100}%` }} /></i></div>;
}

function CoverageRow({ type, value, danger = false }: { type: string; value: number; danger?: boolean }) {
  return <div className={`coverage-row ${danger ? "danger" : ""}`}><span style={{ "--type": TYPE_COLORS[type] ?? "#8493a3" } as React.CSSProperties}><i />{type}</span><b><i style={{ width: `${value}%` }} /></b><strong>{value}</strong></div>;
}

function ProcessStep({ n, title, detail }: { n: string; title: string; detail: string }) {
  return <div className="process-step"><span>{n}</span><div><strong>{title}</strong><small>{detail}</small></div></div>;
}

function NumberInput({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (value: number) => void }) {
  return <label>{label}<input type="number" min={0} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function EmptyState({ icon, title, text, action }: { icon: string; title: string; text: string; action?: ReactNode }) {
  return <div className="empty-state"><span>{icon}</span><h3>{title}</h3><p>{text}</p>{action}</div>;
}

function getTitle(view: View) {
  return { dashboard: "Command Center", collection: "My Collection", builder: "Team Builder", import: "Import Lab", teams: "Saved Teams", settings: "Settings" }[view];
}

function getEyebrow(view: View) {
  return { dashboard: "THURSDAY · JUL 16", collection: "ROSTER MANAGEMENT", builder: "OPEN LEAGUE ANALYSIS", import: "APPRAISAL WORKFLOW", teams: "TACTICAL LIBRARY", settings: "WORKSPACE CONTROL" }[view];
}

export default App;
