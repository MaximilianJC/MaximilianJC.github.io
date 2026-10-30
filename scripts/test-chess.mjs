import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PIECES, piecePose, floatOffset, TAU } from '../chess-motion.mjs';
import { STLLoader } from '../assets/vendor/three/STLLoader.js';

assert.equal(new Set(PIECES.map(p => p.id)).size, 6);
const queen = PIECES.find(p => p.id === 'queen');
assert.equal((queen.x + 3.5 + queen.z + 3.5 + 1) % 2, 1, 'White queen starts on a light square');
const loader = new STLLoader();
let triangles = 0;
for (let i = 0; i < PIECES.length; i++) {
  const piece = PIECES[i];
  const file = await readFile(new URL(`../assets/chess/${piece.file}`, import.meta.url));
  const count = file.readUInt32LE(80);
  assert.equal(file.length, 84 + 50 * count, `${piece.name}: complete binary STL`);
  triangles += count;
  const geometry = loader.parse(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  assert.ok(Math.abs(min.z) < 0.001 && Math.abs(max.z - 56) < 0.001, `${piece.name}: original 56 mm Z-up model`);
  assert.ok(max.x - min.x <= 20.01 && max.y - min.y <= 20.01, `${piece.name}: fits its 32 mm square`);
  geometry.dispose();

  const first = piecePose(i, 0);
  const last = piecePose(i, 1);
  for (const pose of [first, last]) {
    assert.equal(pose.x, piece.x, `${piece.name}: exact home file`);
    assert.equal(pose.z, piece.z, `${piece.name}: exact home rank`);
    assert.equal(pose.y, 0, `${piece.name}: sits on the board`);
  }
  assert.equal(first.rotation, Math.PI);
  assert.equal(last.rotation - first.rotation, TAU, `${piece.name}: full rotation about its own axis`);
  assert.ok(piece.z < 0, 'White home squares are on the robot side');
  let angleTravel = 0;
  let previous = piecePose(i, 0.35);
  for (let step = 1; step <= 200; step++) {
    const pose = piecePose(i, 0.35 + 0.44 * step / 200);
    assert.ok(Math.abs(Math.hypot(pose.x, pose.z) - 3.15) < 1e-10, `${piece.name}: circular orbit`);
    let delta = Math.atan2(pose.z, pose.x) - Math.atan2(previous.z, previous.x);
    if (delta < -Math.PI) delta += TAU;
    if (delta > Math.PI) delta -= TAU;
    angleTravel += delta;
    previous = pose;
  }
  assert.ok(Math.abs(angleTravel - TAU) < 1e-10, `${piece.name}: exactly one orbital revolution`);
}

let closest = Infinity;
let previous = PIECES.map((_, i) => piecePose(i, 0));
for (let step = 0; step <= 2000; step++) {
  const poses = PIECES.map((_, i) => piecePose(i, step / 2000));
  poses.forEach((pose, i) => {
    assert.ok(Object.values(pose).every(Number.isFinite));
    assert.ok(pose.y >= 0, 'No piece penetrates the board');
    assert.ok(Math.hypot(pose.x - previous[i].x, pose.y - previous[i].y, pose.z - previous[i].z) < 0.08, 'No discontinuity in the scroll path');
    for (let j = i + 1; j < poses.length; j++) {
      const other = poses[j];
      if (Math.abs(pose.y - other.y) >= 1.75) continue;
      const distance = Math.hypot(pose.x - other.x, pose.z - other.z);
      closest = Math.min(closest, distance);
      assert.ok(distance > 20 / 32, 'The original piece volumes never intersect');
    }
  });
  previous = poses;
}
console.log(`PASS: six source STLs (${triangles.toLocaleString()} triangles), exact landing, full orbit and axial rotation, continuous collision-free motion. Minimum spacing: ${(closest * 32).toFixed(2)} mm.`);

for (let i = 0; i < PIECES.length; i++) {
  let previousFloat = floatOffset(i, 0, 0.55);
  for (let step = 0; step <= 1200; step++) {
    const seconds = step / 10;
    const offset = floatOffset(i, seconds, 0.55);
    assert.ok(Math.abs(offset) <= 0.0300001, 'Idle float stays below 1 mm in either direction');
    assert.ok(Math.abs(offset - previousFloat) < 0.0032, 'Idle float has no sudden movement');
    for (const p of [0, 0.2, 0.85, 0.95, 1]) {
      assert.equal(Math.abs(floatOffset(i, seconds, p)), 0, 'Idle motion never changes lift-off or landing');
    }
    assert.equal(Math.abs(floatOffset(i, seconds, 0.55, 0)), 0, 'Float can fade out fully while scrolling');
    previousFloat = offset;
  }
}
assert.ok(new Set(PIECES.map((_, i) => floatOffset(i, 1, 0.55).toFixed(5))).size > 4, 'Pieces float out of phase');
console.log('PASS: subtle asynchronous floating, smooth speed, no drift outside the orbit.');
