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

All six designs are 56 mm tall, with a 20 mm maximum diameter. Total: 29,038 triangles, approximately 1.45 MB of source STLs. Visitors load `geometry.bin` (348,888 bytes) and its manifest instead. Exact position welding retains every triangle and its winding while reducing stored vertices from 87,114 to 14,555. Flat shading reconstructs the original face normals. No geometry is simplified. Six moving pieces remain individual meshes; the other 26 share ten instanced batches, reducing the chess set from 32 to 16 draw calls. Both `poster.webp` and `poster-original.webp` render the same models for the static fallback.

The local renderer is Three.js 0.180.0, bundled in `../vendor/three` with its MIT license. The only change to the upstream STL loader is its relative import of the bundled renderer. No CDN requests are made by visitors.

## Development

Serve the repository using `python -m http.server 8765 --bind 127.0.0.1`, then open `http://127.0.0.1:8765/`. ES modules and STL loading require HTTP, so opening the HTML directly as a local file will use the static fallback.

Run `node scripts/test-chess.mjs` to check source geometry, path continuity, clearance, the full orbit, axial rotation, and exact landing. `node scripts/test-chess-render.mjs` checks lossless packed geometry, original face normals, all 32 square assignments, batching, palette isolation and framebuffer budgets. Rebuild the packed geometry with `node scripts/prepare-chess.mjs`. The timeline is in `../../chess-motion.mjs`; rendering and lifecycle management are in `../../chess.js`; responsive presentation is in `../../chess.css`.

Studio is the default: a neutral board, ivory pieces, charcoal opponents and an orange robot. The accessible Studio / Real-world toggle changes board and piece materials in place, preserving scroll position and animation. The optional `?palette=original#chess-study` URL opens the physical colour study directly; normal visits always start in Studio. The internal palette keys remain `graphite` / `original` for link compatibility. No preference is stored. The orange robot retains the same material finish in both views.

Both views use Bambu PLA Basic Orange 10300 (`#FF6A13`) for the complete printed robot, from the [official Bambu PLA Basic colour reference](https://store.bblcdn.eu/s8/default/903b60b06ac142e9b1b49ad53cfa4c82/Bambu_PLA_Basic_Hex_Code.pdf). In Real-world, the opponent pieces use the warm brown (`#754322`) requested from the earlier robot base. Tiffany blue (`#57CEDB`) and pink (`#F29BBF`) are visually adjusted from the supplied TECBEARS photographs for stronger colour; they are not measured filament specifications. Material brightness compensates for the studio lighting, including the stronger illumination of the foreground brown pieces. White pieces retain their existing finish. The palette values live in `../../chess-palettes.mjs`.

When scrolling settles in the orbit, the six pieces float asynchronously by at most 3.2 mm in either direction. The main cycles take 5.2–6.05 seconds, with a smaller 8.8-second secondary movement. This creates visible, gentle floating on small screens and fades out while scrolling and before landing. Hovering an actual STL surface eases that piece to 106% scale with a subtle orange material tint. Other pieces retain their own materials. Touch scrolling is not intercepted. Clearance checks include the full float and hover envelopes.

The stage uses native scrolling and CSS sticky positioning. A critically damped analytical spring smooths scroll-wheel steps at any refresh rate. The visible orbit keeps an idle animation loop at display rate, including on small screens; sustained GPU load reduces pixel density instead of imposing a 30 fps motion cap. Idle shadows update less often than the tiny floating movement. Rendering stops outside the viewport, in a hidden tab, or behind the index/modal/splash. Reduced-motion mode keeps a static board and robot and removes the long scroll track and all floating/hover movement. Mobile uses a shorter track, its own framing and a lower pixel ratio.

The spring preserves its velocity during mobile browser-bar resize events and restarts gently after a static pause. Shaders compile before the canvas is revealed. Stationary geometry and settled joint transforms are cached; mobile skips hidden label projections. Framebuffer targets are 0.9 million pixels on small stages and 2.4 million on desktop, capped at DPR 1.5 / 1.75, with adaptive quality under sustained load. These limits improve headroom without promising a particular frame rate on untested hardware.

On portrait phones and tablets, CSS grid reserves separate rows for the actual heading/control height, 3D scene, caption and footer. The canvas never extends behind the palette buttons, even when text wraps. Caption space stays stable across all three phases to avoid resizing the camera during scrolling. Landscape uses a text/control column beside the scene, and very short screens condense the caption. Touch buttons remain at least 44 px high. Desktop retains the existing composition.

The robot behind the white pieces comes from the supplied SO-101 assembly. The complete piece arrangement, paths and board coordinates are rotated by 180 degrees so the arm is on its own side. Relative spacing, full revolutions and exact landings are preserved. The robot's source geometry, measured joints and tests are documented in `../robot/README.md`.

The pre-change site is preserved locally in `backups/portfolio-before-chess-2026-10-29.zip` (Git commit `ca00b67`). Backups and preview captures are ignored by Git. To restore, extract the ZIP into a separate folder before replacing any working files.

The first completed 3D version, before floating, hover and palette comparison, is also preserved in `backups/portfolio-before-hover-and-colours-2026-10-29.zip`.

The complete robot scene before this optimization and material toggle is preserved in `backups/portfolio-before-material-toggle-2026-10-30.zip` (commit `44adcdc`).

The scene before the CAD, colours and side correction is preserved in `backups/portfolio-before-cad-correction-2026-10-30.zip` (commit `881166e`).
