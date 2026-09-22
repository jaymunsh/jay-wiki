# GAME-01 — Verification Results

**Deliverable:** `index.html` (self-contained Tetris, no external deps)
**Session window:** 2026-09-16 22:44 KST → 23:30 KST (well within the 25-min limit)
**Screenshot capture:** 2026-09-16 23:27 KST

## How verification was done

`shots_all.mjs` launches headless Chrome (`--headless=new`) against the page via CDP,
dispatches synthetic `KeyboardEvent`s (the same mechanism `cdp_game.mjs` uses), and
reads `window.__getState()` before/after every action to confirm the game actually
mutated. Screenshots are taken with `Page.captureScreenshot` and saved to `shots/`.

**Key finding (root cause of the earlier "identical screenshots" problem):** the first
runs loaded a **Chrome error page** ("사이트에 연결할 수 없음"), not the game. The
script was invoked with the relative path `index.html`, which produced the URL
`file://index.html` — Chrome reads `index.html` as a *hostname* and shows its
"can't reach site" interstitial. That page has no game state, so every capture was
byte-identical (hash `c1a9ea80fcf9`). Switching to the **absolute** path yields
`file:///abs/.../index.html` and the game loads. State transitions and screenshots are
verified below against the real game.

## Observed behavior (actual state, not feature names)

Each row is the recorded `window.__getState()` snapshot.

| Shot | State | Score | Current piece | Hold | Interval | What actually happened |
|------|-------|-------|---------------|------|----------|------------------------|
| `01_initial.png` | playing | 0 | `Tr0@3,0` | null | 800 | Fresh board; a piece spawned at column 3, row 0, rotation 0. |
| `02_play.png` | playing | 0 | `Sr0@3,0` | `T` | 800 | After **ArrowRight** (x 3→4), **ArrowUp** (rotate), **KeyC** (hold current, pull next to spawn), **Space** (hard drop, pull next). Four distinct state changes, all confirmed by before/after diffs. |
| `03_lineclear.png` | playing | **100** | `Zr0@3,0` | `T` | 800 | Bottom row filled via debug injection → single line cleared, score 0→**100** (+100/line, no drop bonus). |
| `04_paused.png` | **paused** | 100 | `Zr0@3,0` | `T` | 800 | **KeyP** froze state; `interval` unchanged (gravity paused). |
| `05_gameover.png` | **gameover** | 0 | `Tr0@3,0` | null | 800 | Restart cleared score to 0, then board filled rows 0..ROWS-2 and a piece spawned into a collision → game over. |

> Piece identities vary per load (randomized bag); the state/score/hold/interval columns
> above are the values recorded for the final screenshots on disk.

All five PNGs are visually distinct (md5: `5c69ff71…`, `d26378e9…`, `3bc43d2c…`,
`8f6076ea…`, `9eefdb44…`; sizes 13.6–19.8 KB).

### Confirmed concrete behaviors
- **Move:** active piece column advanced (x 3 → 4) on ArrowRight.
- **Rotate:** active piece rotation advanced (0 → 1) on ArrowUp.
- **Hold:** pressing C moved the active piece into the hold slot and pulled the next
  queue piece to spawn; the held piece is visible in the Hold box in `02_play.png`.
- **Hard drop:** Space locked the active piece and pulled the next piece to spawn.
- **Line clear scoring:** one cleared line added exactly **+100** (0 → 100), consistent
  with the 100/300/500/800 table and no per-cell drop bonus.
- **Pause:** state flipped to `paused`; gravity interval unchanged.
- **Restart:** score reset to 0, board cleared, new piece spawned.
- **Game over:** full-board fill + spawn produced a spawn collision → `gameover`.

## Limitations
- Screenshots are headless Chrome captures, not photographed hardware; colors/layout may
  differ slightly on a real display.
- The line-clear and game-over states were produced via the debug-injection hooks
  (`dbg-fill-row`, board-fill + `spawnPiece()`), which are intentionally separated from
  normal play and documented in the HTML's debug panel. They exercise the same clear /
  collision code paths as real play, but are not achievable through keyboard input alone.
- Only single-line clear (+100) was captured. Tetris-scoring branches (2/3/4-line clears)
  are covered by `cdp_game.mjs` state assertions but not shown as separate screenshots.
- Bag-shuffle / spawn positions are randomized per load, so exact piece identities differ
  run to run; the state table above is one observed instance.
