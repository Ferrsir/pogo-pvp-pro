# Pogo PVP Pro

Pogo PVP Pro is a polished Pokémon GO PvP workspace with private trainer accounts, a cloud-saved roster, appraisal review, and league-aware team building.

**Live app:** https://pogo-pvp-pro.vercel.app  
**Source repository:** https://github.com/Ferrsir/pogo-pvp-pro

## Included in this version

- Command Center with roster health and league readiness
- Searchable Great, Ultra, and Master League collection view
- Click any roster entry to open a complete PvP battle file
- Edit a saved Pokémon's CP, level, fast move, and charged moves from its collection battle file
- Current PvPoke Open League rank, score, recommended moves, matchups, counters, and editor notes
- Exact PvP IV rank across all 4,096 spreads with target CP, target level, and remaining power-ups
- Type weaknesses, resistances, target battle stats, and the complete legal move pool
- Interactive team builder with owned-only, Shadow, and Elite TM controls
- Manual team mode for choosing an exact Lead, Safe switch, and Closer from your collection
- Lock up to two Pokémon and generate alternate lineups
- Matchup coverage, target, counter, and upgrade summaries
- On-device screenshot OCR with a focused CP recovery pass, appraisal-bar IV measurement, form detection, and exact level calculation
- Batch screenshot intake with manual confirmation and confidence states
- Searchable PvPoke catalog with all released battle forms and legal moves
- Regional, alternate, Mega, and Shadow variant support
- High-resolution transparent Pokémon artwork from a pinned PokeAPI sprite catalog, with form matching and graceful fallbacks
- Username/password accounts with Pokémon GO team and trainer-level profiles up to level 80
- Private, database-backed collections and saved teams
- Automatic cloud saving with clear sync status
- Empty starter accounts—no Pokémon or lineups are created automatically
- Responsive navigation and accessible keyboard focus states

Roster battle files use pinned PvPoke Open League simulation results. Team-builder lineup generation remains planning guidance and does not run new simulations on demand.

## Pokémon data

The import catalog is generated from PvPoke's `pokemon.json` and `moves.json` Game Master sources. It currently contains 1,597 entries marked released across 946 Pokédex numbers. Regional, alternate, Mega, and Shadow builds are separate choices; cosmetic costumes reuse their base form because they do not change PvP stats or moves.

Great, Ultra, and Master League battle files are generated from PvPoke's current Open League ranking exports. The pinned ranking dataset contains 2,389 simulated builds, including recommended moves, best matchups, hardest counters, scores, and editor notes.

The exact upstream commit and generation timestamp are embedded in `src/data/pvpoke-catalog.json`. Refresh it with:

```bash
pnpm data:sync
```

Pokémon artwork is mapped against PokeAPI's transparent Home sprite collection. Refresh the pinned sprite map with:

```bash
pnpm data:sprites
```

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for attribution and license terms.

## Local development

```bash
pnpm install
Copy-Item .env.example .env.local
pnpm db:migrate
pnpm dev
```

Set `DATABASE_URL` in `.env.local` to a PostgreSQL connection string before migrating, then open `http://localhost:3000`.

## Quality checks

```bash
pnpm lint
pnpm typecheck
pnpm build
```

## Deployment

The production site is hosted on Vercel and connected to this GitHub repository. Neon Postgres is attached through the Vercel Marketplace for production, preview, and development environments. Pushes to `main` trigger a new production deployment automatically.

## Privacy

Passwords are salted and hashed with scrypt. Sessions use random, hashed database tokens in secure, HTTP-only cookies. Imported images and OCR processing remain in the browser and are not uploaded; keeping compressed screenshots is off by default. Roster and saved-team records are isolated by the signed-in account.

## Production roadmap

1. Add password recovery or an explicit account deletion flow.
2. Add Stardust, Candy, Candy XL, and TM inventory tracking.
3. Add production share tokens, automated tests, and CI deployment.
