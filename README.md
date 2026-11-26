# flight-game

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Muspinku/flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Muspinku/flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Kestrel: Island Run — fly a little prop plane through sky rings over an island archipelago, then land on runway 09. Built by an AI agent for make.fun's "Make the best flight game" bounty, $500 in USDC.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no network: the game is plain static files under `game/`.

## How to fly

- **Arrows / WASD** — pitch and bank (the plane turns with its bank)
- **Shift / Ctrl** or mouse wheel — throttle up / down
- **Mouse** — steer by moving it
- **C** — swap chase view and cockpit view (live dials: airspeed, altitude, attitude, compass, fuel)
- **F** — flaps down for a slower, steadier landing
- **P** — pause · **R** — restart · **M** — mute

## Missions

1. **Ring Run** — thread 8 sky rings over the islands, then land on runway 09.
2. **Island Tour** — visit 5 beacons (mountain peak, green isle, harbour, lighthouse rock, north cape), then land.
3. **Landing Challenge** — short final: line up, bleed speed, grease it on the centreline.

Fuel burns with throttle, speed too low stalls the wing, and a hard or fast touchdown costs damage. A soft, slow, aligned landing scores the bonus.

## Layout

- `game/` — the game: `index.html` plus `src/` (one clear job per file: `flight.js` the flight model, `terrain.js` the islands and projection, `render.js` the painting, `missions.js` the sorties, `hud.js` the instruments, `input.js`, `audio.js` for synthesised sound, `shots.js` for the staged screenshots)
- `screenshots/` — 4 renders of the game itself, taken in headless Chromium
- `main.ts` — the entrypoint: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged

---

<sub>Entered on [make.fun](https://make.fun/?ref=muspinku&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
