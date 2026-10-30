import { robotPose } from './robot-motion.mjs?v=cad-3';
import { ease } from './chess-motion.mjs?v=cad-3';
import { PALETTES } from './chess-palettes.mjs?v=cad-3';

export async function createRobot(THREE, load = fetch) {
  const baseURL = new URL('./assets/robot/', import.meta.url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  let data, buffer;
  try {
    const compressed = typeof DecompressionStream !== 'undefined';
    const [manifestResponse, binaryResponse] = await Promise.all([
      load(new URL('so101.json?v=cad-3', baseURL), { signal: controller.signal }),
      load(new URL(`so101.bin${compressed ? '.gz' : ''}?v=cad-3`, baseURL), { signal: controller.signal }),
    ]);
    if (!manifestResponse.ok || !binaryResponse.ok) throw new Error('Robot asset unavailable');
    const body = compressed ? new Response(binaryResponse.body.pipeThrough(new DecompressionStream('gzip'))) : binaryResponse;
    [data, buffer] = await Promise.all([manifestResponse.json(), body.arrayBuffer()]);
  } finally {
    clearTimeout(timeout);
  }
  if (data.version !== 3 || buffer.byteLength !== data.bytes) throw new Error('Incomplete robot asset');

  const root = new THREE.Group();
  root.name = 'SO-101 — original CAD';
  root.position.set(-0.35, -0.27, -8.45);
  const cad = new THREE.Group();
  cad.rotation.x = -Math.PI / 2;
  cad.scale.setScalar(1 / 32);
  root.add(cad);
  const shellColour = new THREE.Color(0xa6aba3);
  const shellQuiet = new THREE.Color(0x727b75);
  const colours = Object.values(PALETTES).map(palette => ({
    shell: new THREE.Color(palette.robot), quiet: new THREE.Color(palette.robotDim),
  }));
  const shell = new THREE.MeshStandardMaterial({ color: shellColour, roughness: 0.48, metalness: 0.16 });
  const servo = new THREE.MeshStandardMaterial({ color: 0x202626, roughness: 0.36, metalness: 0.28 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x858d8b, roughness: 0.3, metalness: 0.7 });
  const materials = { shell, servo, metal };
  const pivots = data.joints.map(joint => new THREE.Vector3(...joint.pivot));
  const axes = data.joints.map(joint => new THREE.Vector3(...joint.axis).normalize());
  const joints = data.joints.map(joint => {
    const group = new THREE.Group();
    group.name = joint.name;
    return group;
  });
  data.joints.forEach((joint, i) => {
    const parent = joint.parent < 0 ? cad : joints[joint.parent];
    // Root offset grounds the original base, while preserving measured pivot
    // differences for every child in the kinematic chain.
    if (joint.parent >= 0) joints[i].position.copy(pivots[i]).sub(pivots[joint.parent]);
    parent.add(joints[i]);
  });
  for (const part of data.groups) {
    const geometry = new THREE.BufferGeometry();
    const n = part.vertices;
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buffer, part.offset, n * 3), 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(new Int16Array(buffer, part.offset + n * 12, n * 3), 3, true));
    geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(buffer, part.offset + n * 18, part.indices), 1));
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, materials[part.material]);
    mesh.userData.cadMaterial = part.material;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    joints[part.joint].add(mesh);
  }
  // A close-fitting dark mounting shim, with no bright projecting tray edge.
  const footing = new THREE.Mesh(new THREE.BoxGeometry(3.58, 0.035, 2.85), new THREE.MeshStandardMaterial({ color: 0x121512, roughness: .9, metalness: 0 }));
  footing.position.set(0, -0.0175, -0.33);
  footing.castShadow = footing.receiveShadow = true;
  root.add(footing);
  root.traverse(object => { object.updateMatrix(); object.matrixAutoUpdate = false; });
  let lastProgress = -1, lastMix = -1;

  return {
    root,
    update(progress, mix = 0) {
      if (progress === lastProgress && mix === lastMix) return;
      if (progress !== lastProgress) {
        const angles = robotPose(progress);
        for (let i = 1; i < joints.length; i++) {
          joints[i].quaternion.setFromAxisAngle(axes[i], angles[i - 1]);
          joints[i].updateMatrix();
        }
      }
      if (mix !== lastMix) {
        shellColour.lerpColors(colours[0].shell, colours[1].shell, mix);
        shellQuiet.lerpColors(colours[0].quiet, colours[1].quiet, mix);
        shell.roughness = .48 + mix * .13;
        shell.metalness = .16 * (1 - mix);
      }
      const orbit = ease(.15, .35, progress) * (1 - ease(.8, .98, progress));
      shell.color.copy(shellColour).lerp(shellQuiet, orbit);
      lastProgress = progress; lastMix = mix;
    },
  };
}
