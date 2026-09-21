# TafelKampioen 🧠

Een interactieve webapp om de tafels van vermenigvuldiging en deling te oefenen — gemaakt voor kinderen die op school met de tafels bezig zijn.

🔗 **Live:** [evensglenn.github.io/tafelkampioen](https://evensglenn.github.io/tafelkampioen/)

## Functies

- Oefen vermenigvuldigen en delen, per tafel te kiezen (0 t.e.m. 10), met een instelbaar aantal sommen per ronde
- Optionele tijdslimiet per vraag (15 sec) met snelheidsmeting — zet je uit voor rustig oefenen zonder tijdsdruk
- Snelheidsrecord en de laatste 5 sessies worden lokaal bijgehouden (in de browser, geen account nodig)
- Licht / donker / automatisch thema — automatisch volgt live de systeeminstelling van het toestel
- Meldt vanzelf wanneer er een nieuwere versie van de app op GitHub Pages staat
- Responsive layout: op bredere schermen (iPad landscape, laptop) passen de tafelkeuzes in één rij, wat minder scrollen betekent

## Lokaal draaien

**Vereisten:** Node.js

```bash
npm install
npm run dev
```

De app draait dan op http://localhost:3000/tafelkampioen/

## Build

```bash
npm run build
```

Bouwt de statische site naar `dist/`. Dit synchroniseert automatisch het versienummer uit `package.json` naar `public/version.json` (via `scripts/sync-version.mjs`) — dat bestand gebruikt de app om te detecteren of er een nieuwere versie live staat.

## Deployen

Elke push naar `main` bouwt en deployt automatisch naar GitHub Pages via de workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

## Tech stack

- React + TypeScript
- Vite
- Tailwind CSS v4
- [Motion](https://motion.dev/) voor animaties
- canvas-confetti voor het feestje bij een foutloze ronde
