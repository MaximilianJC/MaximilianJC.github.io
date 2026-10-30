import { PIECES } from './chess-motion.mjs?v=cad-3';

// Bound actual framebuffer area, not just DPR: large Retina displays otherwise
// render millions of invisible pixels. Quality can adapt without changing fps.
export function pixelRatioFor(width, height, deviceRatio, quality = 1) {
  const small = width < 800;
  const budget = (small ? 900_000 : 2_400_000) * quality;
  return Math.min(deviceRatio, small ? 1.5 : 1.75, Math.max(.65, Math.sqrt(budget / Math.max(1, width * height))));
}

// A frame following a long static pause is the first frame of a new gesture,
// not 64 ms of movement. This avoids a kick when scrolling from rest.
export const frameDelta = elapsed => elapsed > 100 ? 1000 / 60 : Math.min(50, Math.max(0, elapsed));

export function indexGeometry(THREE, geometry) {
  const position = geometry.attributes.position.array;
  const vertices = [], indices = [], lookup = new Map();
  for (let i = 0; i < position.length; i += 3) {
    const key = `${position[i]},${position[i+1]},${position[i+2]}`;
    let index = lookup.get(key);
    if (index === undefined) {
      index = vertices.length / 3;
      lookup.set(key, index);
      vertices.push(position[i], position[i+1], position[i+2]);
    }
    indices.push(index);
  }
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  result.setIndex(indices);
  return result;
}

export async function loadChessGeometry(THREE, load = fetch) {
  const base = new URL('./assets/chess/', import.meta.url);
  const [metaResponse, binaryResponse] = await Promise.all([
    load(new URL('geometry.json?v=cad-3', base)), load(new URL('geometry.bin?v=cad-3', base)),
  ]);
  if (!metaResponse.ok || !binaryResponse.ok) throw new Error('Chess geometry unavailable');
  const [meta, buffer] = await Promise.all([metaResponse.json(), binaryResponse.arrayBuffer()]);
  if (meta.version !== 1 || meta.bytes !== buffer.byteLength) throw new Error('Incomplete chess geometry');
  return meta.parts.map(part => {
    const geometry = new THREE.BufferGeometry(), n = part.vertices;
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buffer, part.offset, n * 3), 3));
    // Every source STL uses a single face normal per triangle, matching its
    // winding. Flat shading reconstructs that exact normal in the shader.
    geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(buffer, part.offset + n * 12, part.indices), 1));
    return geometry;
  });
}

export function createChessSet(THREE, geometries, ivory, quietIvory, quietCharcoal) {
  const root = new THREE.Group(), heroes = [], batches = new Map();
  const rank = [4, 3, 2, 1, 0, 2, 3, 4];
  for (let side = 0; side < 2; side++) for (let row = 0; row < 2; row++) for (let file = 0; file < 8; file++) {
    const type = row ? 5 : rank[file], x = 3.5 - file, z = side ? 3.5 - row : row - 3.5;
    const hero = !side && PIECES[type].x === x && PIECES[type].z === z;
    if (hero) {
      const mesh = new THREE.Mesh(geometries[type], ivory.clone());
      mesh.position.set(x, 0, z);
      mesh.rotation.y = Math.PI;
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.material.emissive.set(0xff5a1f);
      mesh.material.emissiveIntensity = 0;
      heroes[type] = mesh;
      root.add(mesh);
    } else {
      const key = `${side}:${type}`;
      if (!batches.has(key)) batches.set(key, { type, side, positions: [] });
      batches.get(key).positions.push([x, z]);
    }
  }
  const matrix = new THREE.Matrix4();
  for (const { type, side, positions } of batches.values()) {
    const batch = new THREE.InstancedMesh(geometries[type], side ? quietCharcoal : quietIvory, positions.length);
    positions.forEach(([x, z], i) => {
      matrix.makeRotationY(side ? 0 : Math.PI);
      matrix.setPosition(x, 0, z);
      batch.setMatrixAt(i, matrix);
    });
    batch.computeBoundingSphere();
    batch.castShadow = batch.receiveShadow = true;
    batch.matrixAutoUpdate = false;
    root.add(batch);
  }
  root.matrixAutoUpdate = false;
  return { root, heroes };
}
