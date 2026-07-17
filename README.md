# Pogo PVP Pro

Pogo PVP Pro is a polished Pokémon GO PvP workspace with private trainer accounts, a cloud-saved roster, appraisal review, and league-aware team building.

**Live app:** https://pogo-pvp-pro.vercel.app  
**Source repository:** https://github.com/Ferrsir/pogo-pvp-pro

## Included in this version

- Command Center with roster health and league readiness
- Searchable Great, Ultra, and Master League collection view
- Interactive team builder with owned-only, Shadow, and Elite TM controls
- Lock up to two Pokémon and generate alternate lineups
- Matchup coverage, target, counter, and upgrade summaries
- Batch screenshot intake with manual review and confidence states
- Searchable PvPoke catalog with all released battle forms and legal moves
- Regional, alternate, Mega, and Shadow variant support
- Username/password accounts with Pokémon GO team and trainer-level profiles
- Private, database-backed collections and saved teams
- Automatic cloud saving with clear sync status
- Empty starter accounts—no Pokémon or lineups are created automatically
- Responsive navigation and accessible keyboard focus states

Team rankings, matchups, and recommended moves remain sample planning data. The app does not claim production OCR or live PvPoke results before those data services are connected.

## Pokémon data

The import catalog is generated from PvPoke's `pokemon.json` and `moves.json` Game Master sources. It currently contains 1,597 entries marked released across 946 Pokédex numbers. Regional, alternate, Mega, and Shadow builds are separate choices; cosmetic costumes reuse their base form because they do not change PvP stats or moves.

The exact upstream commit and generation timestamp are embedded in `src/data/pvpoke-catalog.json`. Refresh it with:

```bash
pnpm data:sync
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

Passwords are salted and hashed with scrypt. Sessions use random, hashed database tokens in secure, HTTP-only cookies. Imported images remain browser previews and are not uploaded; keeping compressed screenshots is off by default. Roster and saved-team records are isolated by the signed-in account.

## Production roadmap

1. Add local Tesseract.js OCR plus appraisal-bar geometry detection.
2. Connect live PvPoke ranking simulations for league scores and matchup recommendations.
3. Add exact level, PvP IV rank, and upgrade-cost calculations.
4. Add password recovery or an explicit account deletion flow.
5. Add production share tokens, automated tests, and CI deployment.
