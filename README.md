# Game Stash Arcade

A static website with **576 browser games**: 3D racing, 3D survival, arcade, action, puzzle, skill and sports games. No build step, no server code, no accounts.

## Run it

Open `index.html` through any static web server, for example:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

It also works on GitHub Pages, Netlify, or any static host. three.js is bundled in `js/vendor/`, so the 3D games work offline too.

## What's inside

| Engine | Category | Notes |
|---|---|---|
| Turbo Rally 3D (`race3d`) | Racing | Procedurally generated tracks, 3–5 AI rivals, 3 laps |
| Last Stand 3D (`survival3d`) | Survival | Wave-based arena shooter, obstacles, health packs, night mode |
| Snake, Brick Smash, Glider, Meteor Dodge | Arcade | |
| Star Blaster, Dash Runner, Rock Drift | Action | |
| Merge Tiles, Mine Sweep, Memory Match, Block Drop, Maze Escape | Puzzle | |
| Tower Stack | Skill | |
| Paddle Duel | Sports | |

Each of the 16 engines comes in **12 visual themes × 3 difficulties** = 576 games. Every variant is seeded, so it also gets its own tweaks (track layout, obstacle count, speed, gap size, enemy types and so on).

## Features

- Search, category chips, difficulty/theme filters, sorting
- Favourites, recently played, and best score per game (saved in the browser)
- Pause (P / Esc), restart, fullscreen, deep links (`#play/<game-id>`)
- On-screen touch controls on phones and tablets

## Adding a game

Register an engine in `js/engines/*.js` with `G.register(id, { title, cat, icon, desc, controls, variant(rnd, difficulty), create(api) })`. `create` returns `{ update(dt), draw(), destroy?() }`. The catalog adds it in every theme and difficulty automatically.
