# SO-101 web model

Derived from Maximilian's supplied `LeRobot Chess/CAD/Le Robot so 101/SO101 Assembly.stl`.
The original 37,635,784-byte file is unchanged on disk. Its SHA-256 is recorded in
`so101.json`. No replacement arm model is used.

The web model retains the actual base, brackets, arm links, servo housings, fixed
gripper and moving jaw. The source has 752,714 triangles in 311 connected solids.
The web version has 312,957 triangles, 159 retained solids and 21 draw calls.
It retains the source surfaces of every included component; only nine degenerate
faces are removed. No decimation is applied. The export checks the complete
triangle coordinates and winding before and after calculating crease normals.
Concealed motor internals, flexible wiring and small electronic details are
omitted. Smooth normals follow rounded CAD surfaces; sharp edges stay split.

The six pivot axes are measured from the circular servo horns in the supplied
assembly, including its small alignment offsets. Rigid parts are assigned to a
parent-child chain: shoulder pan, shoulder lift, elbow, wrist pitch, wrist roll,
and gripper. Horns belong to the output link, while housings belong to its parent.
Positions are millimetres relative to each pivot; the scene uses one unit per
32 mm and converts CAD Z-up to Three.js Y-up.

`so101.bin` stores each group as float32 positions, normalized int16 normals,
and uint16 triangle indices, padded to a four-byte boundary. `so101.json` records
offsets, counts, joint hierarchy, source fingerprint and component assignments.
The binary is 6,013,108 bytes. Browsers with `DecompressionStream` load the
losslessly compressed `so101.bin.gz` (3,474,136 bytes); other browsers load the
same uncompressed geometry. Everything loads from this repository, with no
remote model service.

The mounting shim is thin, close-fitting and matte. Every printed part, including
the complete static CAD base, shares the same orange shell material in both views.
Only actual servo housings and hardware remain dark/metallic. The white chess set
starts on the robot's side. Settled joint transforms are reused during idle
floating and colour transitions. Palette changes never alter the joint poses.

The restrained poses in `../../robot-motion.mjs` are presentation animation,
not calibrated servo commands or a physics/robot-control simulation. Joint
structure was also cross-checked against the [upstream SO-101 description](https://github.com/TheRobotStudio/SO-ARM100/tree/main/Simulation/SO101).
No upstream geometry was downloaded or substituted.

Rebuild with Python, numpy, scipy and trimesh:

```text
python scripts/prepare-robot.py "path/to/SO101 Assembly.stl"
node scripts/test-robot.mjs
node scripts/test-chess.mjs
```

The tests cover compact buffers, normals and indices, a stationary base, continuous
joint motion, exact reverse scrubbing, clearance from the animated piece envelopes,
and refresh-rate independent scroll damping. Browser QA covers desktop, portrait,
short screens, reduced motion, missing WebGL and the existing hover interaction.

The site before this addition is archived locally (and ignored by Git) at
`backups/portfolio-before-robot-2026-10-30.zip`.
