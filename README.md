# Pogo PVP Pro

Pogo PVP Pro is a polished, desktop-first Pokémon GO PvP workspace for reviewing a roster, confirming appraisal imports, and building league-aware teams.

## Included in this version

- Command Center with roster health and league readiness
- Searchable Great, Ultra, and Master League collection view
- Interactive team builder with owned-only, Shadow, and Elite TM controls
- Lock up to two Pokémon and generate alternate lineups
- Matchup coverage, target, counter, and upgrade summaries
- Batch screenshot intake with manual review and confidence states
- Saved teams and device-local demo persistence
- Responsive navigation and accessible keyboard focus states

The interface deliberately labels the current data and storage as a demo. It does not claim production OCR, cloud sync, or live PvPoke results before those services are connected.

## Local development

```bash
pnpm install
pnpm dev
```

Then open `http://localhost:3000`.

## Quality checks

```bash
pnpm lint
pnpm typecheck
pnpm build
```

## Privacy

Imported images are processed as browser previews and are not uploaded by this version. Keeping compressed screenshots is off by default. Collection and saved-team changes are stored only in the current browser.

## Production roadmap

1. Connect Supabase Auth, Postgres, Storage, and row-level security.
2. Add local Tesseract.js OCR plus appraisal-bar geometry detection.
3. Import and pin attributed PvPoke and Game Master-derived data.
4. Add exact level, PvP IV rank, and upgrade-cost calculations.
5. Add production share tokens, automated tests, and CI deployment.
