import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import { STLLoader } from '../assets/vendor/three/STLLoader.js';
import { PIECES, followScroll } from '../chess-motion.mjs';
import { loadChessGeometry, createChessSet, pixelRatioFor, frameDelta } from '../chess-render.mjs';
import { PALETTES, paletteFromSearch, paletteURL } from '../chess-palettes.mjs';
import { createRobot } from '../robot.js';

const local = async url => new Response(await readFile(url));
const geometries = await loadChessGeometry(THREE, local);
const meta = JSON.parse(await readFile(new URL('../assets/chess/geometry.json', import.meta.url)));
let sourceVertices = 0, indexedVertices = 0;
for (let i = 0; i < PIECES.length; i++) {
  const bytes = await readFile(new URL(`../assets/chess/${PIECES[i].file}`, import.meta.url));
  assert.equal(meta.parts[i].sourceSHA256, createHash('sha256').update(bytes).digest('hex'));
  const source = new STLLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const geometry = geometries[i], expanded = geometry.toNonIndexed();
  assert.deepEqual(expanded.attributes.position.array, source.attributes.position.array, 'All original triangles, winding and coordinates retained exactly');
  // Derivative face normals must match the original STL lighting normals.
  expanded.computeVertexNormals();
  const normals = expanded.attributes.normal.array, originalNormals = source.attributes.normal.array;
  for (let j = 0; j < normals.length; j++) assert.ok(Math.abs(normals[j] - originalNormals[j]) < .0001);
  sourceVertices += source.attributes.position.count;
  indexedVertices += geometry.attributes.position.count;
}
assert.ok(meta.bytes < 360_000);
assert.ok(indexedVertices < sourceVertices * .18);
const material = new THREE.MeshStandardMaterial({ flatShading: true });
const { root, heroes } = createChessSet(THREE, geometries, material, material.clone(), material.clone());
assert.equal(heroes.length, 6);
assert.equal(root.children.length, 16, 'Six individual heroes plus ten stationary batches');
assert.equal(new Set(heroes.map(mesh => mesh.material)).size, 6, 'Independent hover materials');
const positions = [], matrix = new THREE.Matrix4();
for (const child of root.children) {
  if (child.isInstancedMesh) {
    for (let i = 0; i < child.count; i++) {
      child.getMatrixAt(i, matrix);
      positions.push([matrix.elements[12], matrix.elements[13], matrix.elements[14]].join(','));
    }
  } else positions.push(child.position.toArray().join(','));
}
assert.equal(positions.length, 32);
assert.equal(new Set(positions).size, 32);
assert.equal(positions.filter(position => position.endsWith(',3.5')).length, 8);
assert.equal(positions.filter(position => position.endsWith(',-3.5')).length, 8);

assert.equal(paletteFromSearch(''), 'graphite');
assert.equal(paletteFromSearch('?palette=unknown'), 'graphite');
assert.equal(paletteFromSearch('?palette=original'), 'original');
const original = paletteURL('https://example.com/?test=1#chess-study', 'original');
assert.equal(original.searchParams.get('test'), '1');
assert.equal(original.hash, '#chess-study');
assert.equal(paletteURL(original.href, 'graphite').searchParams.has('palette'), false);
assert.equal(PALETTES.original.robot, 0xff6a13);
assert.equal(PALETTES.original.opponent, 0x9d432c);
const robot = await createRobot(THREE, local);
robot.update(.5, 0); robot.root.updateMatrixWorld(true);
const matrices = [];
robot.root.traverse(object => matrices.push(object.matrixWorld.elements.slice()));
for (const mix of [1, .4, 0]) {
  robot.update(.5, mix); robot.root.updateMatrixWorld(true);
  let index = 0;
  robot.root.traverse(object => assert.deepEqual(object.matrixWorld.elements, matrices[index++], 'Palette does not reset or move the rig'));
}
for (const [w,h,dpr] of [[390,520,3],[1440,900,2],[2560,1440,2]]) {
  const ratio = pixelRatioFor(w,h,dpr);
  assert.ok(ratio <= dpr);
  assert.ok(w*h*ratio*ratio <= (w < 800 ? 900_000 : 2_400_000) + 1);
  assert.ok(pixelRatioFor(w,h,dpr,.5) <= ratio);
}
assert.equal(frameDelta(2000), 1000/60);
const restart = followScroll(0, 0, .05, frameDelta(2000));
assert.ok(restart.position < .002, 'No initial jump after a long static pause');
console.log(`PASS: ${sourceVertices.toLocaleString()} → ${indexedVertices.toLocaleString()} vertices, exact source triangles/normals, 32 pieces in 16 calls, isolated hover, palette defaults/reversal, pixel budgets and smooth restart.`);
