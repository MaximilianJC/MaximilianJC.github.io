import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import { createRobot } from '../robot.js';
import { robotPose } from '../robot-motion.mjs';
import { followScroll, piecePose } from '../chess-motion.mjs';

const data = JSON.parse(await readFile(new URL('../assets/robot/so101.json', import.meta.url)));
const binary = await readFile(new URL('../assets/robot/so101.bin', import.meta.url));
assert.equal(binary.byteLength, data.bytes);
assert.equal(data.joints.length, 7);
const compressed = await readFile(new URL('../assets/robot/so101.bin.gz', import.meta.url));
assert.deepEqual(gunzipSync(compressed), binary, 'Lossless network compression');
assert.equal(compressed.byteLength, data.compressedBytes);
assert.ok(compressed.byteLength < 3_500_000, 'Detailed CAD remains a bounded download');
assert.equal(data.triangles, 312957, 'All retained CAD faces except nine degenerate faces');
assert.equal(data.components.reduce((n,c)=>n+c.sourceTriangles,0)-data.triangles,9);
const robot = await createRobot(THREE, async url => {
  const bytes = await readFile(url);
  return new Response(bytes);
});
const meshList = [];
robot.root.traverse(object => { if (object.isMesh) meshList.push(object); });
const shells = meshList.filter(mesh => mesh.userData.cadMaterial === 'shell');
assert.equal(new Set(shells.map(mesh => mesh.material)).size, 1, 'All printed parts including the base share one finish');
assert.ok(shells.every(mesh => !mesh.material.flatShading), 'Use CAD crease normals instead of artificial facets');
for (const mesh of meshList) {
  const pos = mesh.geometry.attributes.position, normals = mesh.geometry.attributes.normal;
  assert.ok(pos.array.every(Number.isFinite));
  assert.ok(mesh.geometry.index.array.every(index => index < pos.count));
  for (let i = 0; i < normals.count; i++) {
    assert.ok(Math.abs(Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i)) - 1) < .002);
  }
}

let previous = robotPose(0), collisionCandidates = 0;
const point = new THREE.Vector3();
for (let step = 0; step <= 200; step++) {
  const p = step / 200;
  const angles = robotPose(p);
  assert.ok(angles.every(Number.isFinite));
  angles.forEach((angle, i) => assert.ok(Math.abs(angle - previous[i]) < .03, 'No abrupt joint steps'));
  previous = angles;
  robot.update(p); robot.root.updateMatrixWorld(true);
  const pieces = Array.from({ length: 6 }, (_, i) => piecePose(i, p));
  for (const mesh of meshList) {
    const bounds = new THREE.Box3().setFromObject(mesh);
    assert.ok(bounds.min.y > -.5, 'The arm and footing stay above the ground');
    const possible = pieces.filter(pose => pose.x > bounds.min.x - .32 && pose.x < bounds.max.x + .32
      && pose.z > bounds.min.z - .32 && pose.z < bounds.max.z + .32 && pose.y < bounds.max.y && pose.y + 1.75 > bounds.min.y);
    if (!possible.length) continue;
    const pos = mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      point.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      for (const pose of possible) {
        if (point.y > pose.y && point.y < pose.y + 1.75 && Math.hypot(point.x - pose.x, point.z - pose.z) < .315) collisionCandidates++;
      }
    }
  }
}
assert.equal(collisionCandidates, 0, 'Robot surfaces stay outside the orbiting piece envelopes');
robot.update(.43); robot.root.updateMatrixWorld(true);
const snapshot = meshList.map(mesh => mesh.matrixWorld.elements.slice());
robot.update(1); robot.update(0); robot.update(.43); robot.root.updateMatrixWorld(true);
meshList.forEach((mesh, i) => assert.deepEqual(mesh.matrixWorld.elements, snapshot[i], 'Exact reverse scrubbing without drift'));
const base = robot.root.getObjectByName('base');
const before = base.matrixWorld.elements.slice();
robot.update(.8); robot.root.updateMatrixWorld(true);
assert.deepEqual(base.matrixWorld.elements, before, 'Base stays fixed while joints move');

// The analytical filter must settle at the same point independent of refresh
// rate, retain velocity continuity, and tolerate rapid changes of direction.
const advance = hz => {
  let state = { position: 0, velocity: 0 };
  for (let i = 0; i < hz / 2; i++) state = followScroll(state.position, state.velocity, .7, 1000 / hz);
  return state;
};
for (const hz of [30,60,120]) {
  const state = advance(hz), reference = advance(60);
  assert.ok(Math.abs(state.position - reference.position) < 1e-10);
  assert.ok(Math.abs(state.velocity - reference.velocity) < 1e-10);
}
let state = { position: 0, velocity: 0 };
for (let i = 0; i < 600; i++) {
  state = followScroll(state.position, state.velocity, i < 120 ? 1 : i < 240 ? 0 : .5, 1000 / 60);
  assert.ok(state.position >= 0 && state.position <= 1 && Number.isFinite(state.velocity));
}
assert.deepEqual(state, { position: .5, velocity: 0 });
await assert.rejects(createRobot(THREE, async () => new Response('', { status: 404 })), /unavailable/);
const decompression = globalThis.DecompressionStream;
try {
  globalThis.DecompressionStream = undefined;
  const loaded = [];
  const compatible = await createRobot(THREE, async url => {
    loaded.push(url.pathname);
    return new Response(await readFile(url));
  });
  assert.ok(loaded.some(path => path.endsWith('/so101.bin')), 'Uncompressed path for older browsers');
  compatible.update(.5);
  assert.equal(compatible.root.getObjectByName('base').children.length, base.children.length);
} finally { globalThis.DecompressionStream = decompression; }
console.log(`PASS: ${data.triangles.toLocaleString()} robot triangles, valid compact buffers, six continuous joints, fixed base, reversible motion, clear piece envelopes, 30/60/120 Hz scroll damping and missing-asset handling.`);
