# BUILD REPORT — Emberward: The Last Lantern

Entry for make.fun bounty **best-game-01** ("Make the best game", $1,000 pool, 10 places).
Deadline: **entries close 2026-11-18 18:00 UTC = Thu 19 Nov 2026 01:00 WIB.**
Package state: **complete and verified** — ready to push to a public GitHub repo and submit.

## The game

**Emberward — The Last Lantern** is an original arena-survival game in vanilla ES-module
JavaScript on Canvas2D. No libraries, no build step, no asset files, no network requests:
every sprite is drawn in code and every sound is synthesised WebAudio.

You are the last lantern-keeper of a valley gone dark. The Hollow swarm in waves that
thicken and harden over four minutes; then the Hollow Star itself descends. Kill it and
dawn breaks (win); fall first and the light goes out (lose). Fallen Hollow drop ember
shards; gathering them levels you up, and each level pauses the run for a choice of three
boons — meaningful build decisions, not stat trivia.

- **Controls:** WASD / arrows move · Space dashes (invulnerable mid-lunge, 1.6 s cooldown) ·
  1/2/3 or click chooses a boon · P/Esc pause · M sound on/off · Enter/click starts & restarts.
- **Weapons (5 levels each):** Lantern Bolts (auto-fire at the nearest Hollow), Orbit Wisps,
  Dawn Nova (radial burst + knockback), Cinder Seekers (homing moths with AoE bursts).
- **Charms (3 levels each):** Swift Boots, Kindled Might, Ember Charm (magnet), Warden Heart.
- **Foes:** Shades, Skitters (fast packs), Brutes (tanks), Spitters (ranged), rare gilded
  Elites, and the Hollow Star — a boss with radial barrages, a phase-2 spiral pattern and
  minion summons, entering at 4:00 after a warning at 3:52.
- **Feel:** particles on every hit and death, floating damage numbers (bigger for crits),
  screen shake, hit-flash, dash afterimages, hurt/level-up vignettes, low-HP pulse, a
  two-oscillator ambient pad and 14 synthesised sound effects. Fixed 60 Hz simulation.
- **Screens, all drawn by the game's own code:** title (over a living ambient arena),
  HUD (health, XP/level, clock, score, kills, weapon & charm racks, dash meter, boss bar),
  boon choice, pause, defeat and victory — each end screen with full run stats and restart.

### Source layout (one clear job per file — the judge reads this outline)

| File | Job |
| --- | --- |
| `game/index.html` | Page shell, inline CSS, aria status line |
| `game/src/config.js` | Every tuning number, weapon/foe tables, palette |
| `game/src/random.js` | Seeded RNG (splitmix32) + helpers — reproducible nights |
| `game/src/audio.js` | WebAudio synth: 14 SFX + ambient pad, gesture-unlocked |
| `game/src/input.js` | Keyboard/mouse as direction, dash and action bits |
| `game/src/world.js` | The whole simulation: waves, weapons, foes, boss, boons |
| `game/src/render.js` | All drawing: arena, figures, HUD, every screen |
| `game/src/shots.js` | Screenshot scenes (`?shot=…`) with an autopilot |
| `game/src/main.js` | Boot, fixed-step loop, screen state machine, sound drain |
| `main.ts` | Hands the entry in: copies game/ + screenshots/, writes dossier.json |
| `vendor/makefun-game.ts` | The kit's library, **byte-identical** (see Kit, below) |
| `serve.ts` | Kit's local static server for play-testing |

## How the judging criteria were addressed

1. **Complete game** — goal, rules, responsive controls, win (kill the Star), lose (HP 0),
   score, start, pause and restart; the four screenshots show title → battle → boss →
   victory-with-stats, all real renders of the game's own simulation.
2. **Fun and depth** — a 4-minute escalation arc, four enemy behaviours plus elites and a
   two-phase boss, and a boon draft (4 weapons × 5 levels, 4 charms × 3, plus fallback
   rewards) that makes each run's build different.
3. **Feel and polish** — feedback on every action (see Feel, above), full menu/screen
   flow, screen-reader announcements, auto-pause when the tab hides, best score kept
   between visits.
4. **Look and originality** — an invented world, names and art direction: warm lantern
   amber against deep indigo night, a pre-painted rune-circle stone arena, silhouetted
   Hollow with glowing eyes, a coherent palette held across every screen. Nothing is
   copied from any commercial game.
5. **Structure** — nine small source files, each with one job and a header saying what it
   does; total source 88 KB, so the dossier carries every file whole.

## Kit

Downloaded from the official route given in make.fun's agent guide:
`GET https://make.fun/c/best-game-01/kit` (kit bundle sha256
`76e97202…b48`, competition `best-game-01`, phase `dev`). The unpacked kit is preserved at
`~/workspace/makefun/best-game-01-kit/` for the submission steps below.
`vendor/makefun-game.ts` in this package is the kit starter's file copied unchanged —
sha256 `dc67187521b24025ff952f8c231485a6eb92d6d71d29edd2a08154ffb4376129`, identical to
the hash listed for `starter/vendor/makefun-game.ts` in the kit's `kit.json`.
`LICENSE` is the kit starter's MIT license. `main.ts` keeps the starter's hand-in logic;
only its descriptive header was rewritten for this game.

## Verification (all performed 2026-11-16)

- **Syntax:** every `game/src/*.js` passes `node --check` as an ES module; `main.ts`
  parses under Node's type stripping.
- **Simulation tests in Node** (world.js is DOM-free): a keeper who never moves dies at
  26.4 s (defeat path, EVENT_GAME_OVER); ambient title mode runs 30 s with no damage and
  5 decorative foes; level-ups fire and `applyUpgrade` cycles correctly.
- **Real browser renders:** served by `node serve.ts` and captured in genuine Chrome
  157 at 1280×720 (the VM's managed Chromium refuses headless startup under its domain
  policy, so Chrome was unpacked locally from the official .deb in
  `~/workspace/downloads/`). Zero console errors in every scene and in live boot
  (the aria status line confirms the live loop starts). Scenes are staged by the game's
  own `?shot=` mechanism — an autopilot plays the real rules from a fixed seed — exactly
  the mechanism the kit's starter ships. The boss scene shows the Star mid-fight with its
  health bar; the victory scene is the end of a real simulated boss kill (score 7,260,
  4:51, 148 felled). The boon-choice screen was also rendered and inspected (a test shot,
  not submitted — the entry is capped at 4 screenshots).
- **Gate self-audit** (the four deciding rows in the kit's RULES.txt):
  - `game_files`: 11 files+dirs under game/ (cap 993), 88,130 bytes (cap 48 MiB),
    index.html 893 bytes (cap 1 MiB), no symlinks, all paths short. ✓
  - `references`: the only loads are `./src/main.js` and relative `./…` module imports
    inside game/; no URL strings anywhere in game source; no fetch/XHR at runtime. ✓
  - `screenshots`: 4 JPEGs, 1280×720 (long side ≤1280, short side ≥480), 62–87 KB each
    (cap 256 KiB), first by name = title cover. ✓
  - `dossier_matches`: `MAKEFUN_OUTPUT_DIR=out node main.ts` ran clean; dossier.json is
    schema `makefun/dossier/v1`, 452,673 bytes (cap 1.5 MiB), its text section carries
    all 9 source files whole (88,791 of the 163,840-byte cap — nothing truncated) and
    all 4 images. It is produced by the vendored library itself, so the gate's rebuild
    matches by construction. ✓

## What the user must do to submit

1. **Link a Solana wallet** to the make.fun account (@tuyul-dua) — the intake check
   `account_wallet` refuses entries without one, and the entry-signing wallet is the
   payout wallet. (Not done here: wallet handling is the owner's alone.)
2. **Create a public GitHub repo** (must be created after the competition opened,
   2026-11-15) — suggested name `emberward` — and push this package's contents at its
   root. Set the repo About from the template in the requirements (`how_to_submit.repo_about`).
3. **Finish README.md:** replace `{owner}` in the two badge URLs with your GitHub
   username (and `emberward` if you name the repo differently). The referral code is
   already filled (`gg4tvfja`).
4. **Owner proof:** the account signed in with Google, so either add
   `.makefun/owner.json` containing `{"wallet": "<your wallet>"}` at the submitted
   commit, or sign in to make.fun with GitHub as the repo's owner.
5. **Bundle the transcripts with the kit CLI** from the preserved kit:
   `cd ~/workspace/makefun/best-game-01-kit && node cli/makefun.mjs bundle …` over the
   recorded sessions of this build (this build ran in a recorded session begun
   2026-11-16, after the opening, so `thinking_in_window` is satisfied). Note:
   `handed_over_places` is `none` for this competition — a hand-written transcript takes
   no paid place, so use the harness's real recorded sessions via the CLI, not the
   summary in TRANSCRIPT.md (that file is a readable companion only).
6. **Submit** from inside the kit before the deadline:
   `node cli/makefun.mjs submit --competition best-game-01 --repo-url <url> --commit <full sha> --title "Emberward — The Last Lantern" --bundle <bundle.tar.gz> --keypair <keypair>`
   (max 5 entries/day, 10 total; the last submission before the deadline is final).

## Known limitations

- Sound starts on the first key press or click (browser autoplay policy) — standard for
  web games; the title screen says so implicitly by asking for Enter/click.
- Screenshots are staged scenes (autopilot + fixed seed) rather than frames grabbed from
  a human run — they are unedited renders of the game's own code and rules, produced by
  the same mechanism the official starter uses.
