# The physical chess pieces

These six binary STL files are unmodified copies of Maximilian's original CAD exports from `LeRobot Chess/CAD/Figuren`. The scene reads the actual triangles, converts Z-up to Y-up, and scales millimetres to 32 mm board squares. No substitute models or reconstructed silhouettes are used.

| Scene | Original source |
| --- | --- |
| King | Koenig.stl |
| Queen | Dame.stl |
| Bishop | Laeufer.stl |
| Knight | Pferd.stl |
| Rook | Turm.stl |
| Pawn | Bauer.stl |

All six designs are 56 mm tall, with a 20 mm maximum diameter. Total: 29,038 triangles, approximately 1.45 MB. Geometry is shared between the 32 instances on the board. `poster.webp` is a render of these same models for the static fallback.

The local renderer is Three.js 0.180.0, bundled in `../vendor/three` with its MIT license. The only change to the upstream STL loader is its relative import of the bundled renderer. No CDN requests are made by visitors.

## Development

Serve the repository using `python -m http.server 8765 --bind 127.0.0.1`, then open `http://127.0.0.1:8765/`. ES modules and STL loading require HTTP, so opening the HTML directly as a local file will use the static fallback.

Run `node scripts/test-chess.mjs` to check source geometry, path continuity, clearance, the full orbit, axial rotation, and exact landing. The timeline is in `../../chess-motion.mjs`; rendering and lifecycle management are in `../../chess.js`; responsive presentation is in `../../chess.css`.

The published scene uses the graphite board, ivory pieces and charcoal opponents. The earlier colour comparison, including the pastel assets and switcher, is preserved locally in `backups/portfolio-colour-study-2026-10-29.zip` for future work; it is not part of the published site.

When scrolling settles in the orbit, the six pieces float asynchronously by less than 1 mm in either direction, over roughly six-second cycles. This fades out while scrolling and before landing. Hovering an actual STL surface eases that piece to 106% scale with a subtle orange material tint. Other pieces retain their own materials. Touch scrolling is not intercepted.

The stage uses native scrolling and CSS sticky positioning. A critically damped analytical spring smooths scroll-wheel steps at any refresh rate. The visible orbit keeps an idle animation loop at display rate, including on small screens; sustained GPU load reduces pixel density instead of imposing a 30 fps motion cap. Idle shadows update less often than the tiny floating movement. Rendering stops outside the viewport, in a hidden tab, or behind the index/modal/splash. Reduced-motion mode keeps a static board and robot and removes the long scroll track and all floating/hover movement. Mobile uses a shorter track, its own framing and a lower pixel ratio.

The robot behind the black pieces comes from the supplied SO-101 assembly. Its source, optimization, measured joints and tests are documented in `../robot/README.md`.

The pre-change site is preserved locally in `backups/portfolio-before-chess-2026-10-29.zip` (Git commit `ca00b67`). Backups and preview captures are ignored by Git. To restore, extract the ZIP into a separate folder before replacing any working files.

The first completed 3D version, before floating, hover and palette comparison, is also preserved in `backups/portfolio-before-hover-and-colours-2026-10-29.zip`.
