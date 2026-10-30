import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import { STLLoader } from '../assets/vendor/three/STLLoader.js';
import { PIECES } from '../chess-motion.mjs';
import { indexGeometry } from '../chess-render.mjs';

const loader = new STLLoader(), chunks = [], parts = [];
let offset = 0, originalVertices = 0, vertices = 0;
for (const piece of PIECES) {
  const bytes = await readFile(new URL(`../assets/chess/${piece.file}`, import.meta.url));
  const source = loader.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const indexed = indexGeometry(THREE, source);
  const pos = indexed.attributes.position.array;
  const indices = new Uint16Array(indexed.index.array);
  if (pos.length / 3 >= 65536) throw new Error('Index range exceeded');
  const data = Buffer.concat([Buffer.from(pos.buffer), Buffer.from(indices.buffer)]);
  const padding = Buffer.alloc((4 - data.length % 4) % 4);
  chunks.push(data, padding);
  parts.push({ file: piece.file, sourceSHA256: createHash('sha256').update(bytes).digest('hex'), offset, vertices: pos.length / 3, indices: indices.length });
  offset += data.length + padding.length;
  originalVertices += source.attributes.position.count;
  vertices += pos.length / 3;
}
await writeFile(new URL('../assets/chess/geometry.bin', import.meta.url), Buffer.concat(chunks));
await writeFile(new URL('../assets/chess/geometry.json', import.meta.url), JSON.stringify({ version: 1, bytes: offset, parts }, null, 2) + '\n');
console.log({ originalVertices, vertices, bytes: offset });
