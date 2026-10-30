import { PIECES, piecePose, floatOffset, orbitPresence, ease, clamp, followScroll } from './chess-motion.mjs?v=so101-1';

const section = document.querySelector('.chess-study');
const stage = section.querySelector('.chess-stage');
const viewport = section.querySelector('.chess-viewport');
const mount = section.querySelector('.chess-canvas');
const labelLayer = section.querySelector('.chess-labels');
const progressBar = section.querySelector('.chess-progress i');
const captionNumber = section.querySelector('.chess-caption-number');
const captionTitle = section.querySelector('.chess-caption-title');
const captionDetail = section.querySelector('.chess-caption-detail');
const hint = section.querySelector('.chess-scroll-hint');
const status = section.querySelector('.chess-status');
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
// Reserve the scroll track before loading 3D assets to prevent scroll anchoring jumps.
section.classList.add('is-enhanced');
section.classList.toggle('is-still', motionPreference.matches);
let started = false;

const captions = [
  ['01 — 03', 'Every piece, purpose-built.', 'Six original designs. Made for a robot’s next move.'],
  ['02 — 03', 'A different kind of movement.', 'Six forms. One full revolution. Every angle considered.'],
  ['03 — 03', 'Back to the real world.', 'Same pieces. Same squares. Ready for the next move.'],
];

function fallback() {
  section.classList.remove('is-ready', 'is-enhanced');
  section.classList.add('is-still');
  hint.textContent = 'The original chess set';
  status.textContent = '';
  captionNumber.textContent = 'THE PHYSICAL PIECES';
  captionTitle.textContent = captions[0][1];
  captionDetail.textContent = captions[0][2];
  viewport.setAttribute('aria-label', 'The custom chess pieces on an eight-by-eight board, with the SO-101 robot arm behind it.');
}

async function init() {
  if (started) return;
  started = true;
  status.textContent = 'Loading the scene…';
  let renderer;
  try {
    const [THREE, { STLLoader }, { createRobot }] = await Promise.all([
      import('./assets/vendor/three/three.module.min.js'),
      import('./assets/vendor/three/STLLoader.js'),
      import('./robot.js?v=so101-1'),
    ]);
    const narrow = () => viewport.clientWidth < 800;
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setClearColor(0x111110, 0);
    renderer.setPixelRatio(Math.min(devicePixelRatio, narrow() ? 1.5 : 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    // Load in parallel with the chess pieces; a robot asset failure still leaves
    // the existing chess experience usable.
    const robotPromise = createRobot(THREE).catch(error => {
      console.warn('The robot could not be loaded; keeping the chess study.', error);
      return null;
    });
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    const viewTarget = new THREE.Vector3();
    const projected = new THREE.Vector3();
    const light = new THREE.DirectionalLight(0xfff3df, 4.2);
    light.position.set(-4, 12, 6);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    Object.assign(light.shadow.camera, { left: -11, right: 11, top: 13, bottom: -9, near: 1, far: 45 });
    light.shadow.normalBias = 0.025;
    light.shadow.bias = -0.0003;
    light.shadow.radius = 3;
    scene.add(light, new THREE.HemisphereLight(0xdce7ed, 0x48402e, 2.1));
    const rim = new THREE.DirectionalLight(0xe1ebff, 3.4);
    rim.position.set(4, 7, -7);
    const fill = new THREE.DirectionalLight(0xffa06a, 0.8);
    fill.position.set(7, 3, 4);
    scene.add(rim, fill);

    // Local studio reflections: no external HDR texture or network dependency.
    const studio = new THREE.Scene();
    studio.background = new THREE.Color(0x444440);
    const panels = [];
    for (const [x, y, z, w, h, intensity] of [
      [-7, 7, 2, 5, 10, 4], [5, 6, -6, 4, 9, 3], [1, 10, 0, 7, 5, 2],
    ]) {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(intensity, intensity, intensity) }));
      panel.position.set(x, y, z);
      panel.lookAt(0, 1, 0);
      studio.add(panel);
      panels.push(panel);
    }
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(studio, 0.04);
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.5;
    pmrem.dispose();
    panels.forEach(panel => { panel.geometry.dispose(); panel.material.dispose(); });

    const ivory = new THREE.MeshStandardMaterial({ color: 0xe3dfd2, roughness: 0.31, metalness: 0.16 });
    const charcoal = new THREE.MeshStandardMaterial({ color: 0x323835, roughness: 0.36, metalness: 0.23 });
    const quietIvory = ivory.clone();
    const quietCharcoal = charcoal.clone();
    const board = new THREE.Group();
    scene.add(board);
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(8.45, 0.22, 8.45),
      new THREE.MeshStandardMaterial({ color: 0x1b1c1a, roughness: 0.38, metalness: 0.35 }),
    );
    base.position.y = -0.16;
    base.receiveShadow = true;
    base.castShadow = true;
    board.add(base);
    const tileGeometry = new THREE.BoxGeometry(0.996, 0.055, 0.996);
    const matrix = new THREE.Matrix4();
    for (let colour = 0; colour < 2; colour++) {
      const tiles = new THREE.InstancedMesh(tileGeometry, new THREE.MeshStandardMaterial({
        color: colour ? 0x68685f : 0x222724, roughness: 0.65, metalness: 0.08,
      }), 32);
      let index = 0;
      for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) {
        if ((x + z) % 2 === colour) {
          matrix.makeTranslation(x - 3.5, -0.028, z - 3.5);
          tiles.setMatrixAt(index++, matrix);
        }
      }
      tiles.receiveShadow = true;
      board.add(tiles);
    }

    // Small engraved coordinates keep the board rooted in the site's drawing language.
    const coordinateCanvas = document.createElement('canvas');
    coordinateCanvas.width = coordinateCanvas.height = 1024;
    const ctx = coordinateCanvas.getContext('2d');
    ctx.font = '17px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#a6a194';
    for (let i = 0; i < 8; i++) {
      const c = 88 + i * 121;
      ctx.fillText('abcdefgh'[i], c, 1010);
      ctx.fillText(String(8 - i), 14, c);
    }
    const coordinateTexture = new THREE.CanvasTexture(coordinateCanvas);
    coordinateTexture.colorSpace = THREE.SRGBColorSpace;
    const coordinates = new THREE.Mesh(new THREE.PlaneGeometry(8.45, 8.45), new THREE.MeshBasicMaterial({ map: coordinateTexture, transparent: true, depthWrite: false, opacity: 0.65 }));
    coordinates.rotation.x = -Math.PI / 2;
    coordinates.position.y = 0.006;
    board.add(coordinates);

    // Keep source triangles and dimensions; only convert CAD's Z-up to Three's Y-up.
    const loader = new STLLoader();
    const geometries = await Promise.all(PIECES.map(async piece => {
      const geometry = await loader.loadAsync(new URL(`./assets/chess/${piece.file}`, import.meta.url).href);
      geometry.rotateX(-Math.PI / 2);
      geometry.scale(1 / 32, 1 / 32, 1 / 32);
      geometry.computeBoundingBox();
      const bounds = geometry.boundingBox;
      geometry.translate(-(bounds.min.x + bounds.max.x) / 2, -bounds.min.y, -(bounds.min.z + bounds.max.z) / 2);
      geometry.computeBoundingSphere();
      return geometry;
    }));
    const heroes = [];
    const labels = [];
    const rank = [4, 3, 2, 1, 0, 2, 3, 4];
    for (let side = 0; side < 2; side++) {
      for (let row = 0; row < 2; row++) {
        for (let file = 0; file < 8; file++) {
          const type = row ? 5 : rank[file];
          const x = file - 3.5;
          const z = side ? row - 3.5 : 3.5 - row;
          const hero = !side && PIECES[type].x === x && PIECES[type].z === z;
          // Each floating piece has its own material; highlighting one never tints the set.
          const mesh = new THREE.Mesh(geometries[type], hero ? ivory.clone() : side ? quietCharcoal : quietIvory);
          mesh.position.set(x, 0, z);
          mesh.rotation.y = side ? Math.PI : 0;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          scene.add(mesh);
          if (hero) {
            mesh.material.emissive.set(0xff5a1f);
            mesh.material.emissiveIntensity = 0;
            heroes[type] = mesh;
            const label = document.createElement('span');
            label.className = 'chess-piece-label';
            label.textContent = PIECES[type].name;
            labelLayer.appendChild(label);
            labels[type] = label;
          }
        }
      }
    }

    const robot = await robotPromise;
    if (robot) {
      scene.add(robot.root);
      section.classList.add('has-robot');
      captions[2] = ['03 — 03', 'Your move, SO-101.', 'The pieces return. The arm gets ready.'];
    }

    let raf = 0, active = false, current = 0, velocity = 0, target = 0, lastTime = 0, caption = -1;
    let lastShadowAt = -Infinity, frameCost = 16, frameSamples = 0;
    let start = 0, travel = 1, width = 1, height = 1;
    let stopped = false;
    let floatClock = 0, idleBlend = 0, lastScrollAt = performance.now();
    let pointerInside = false, hovered = -1;
    let pointerX = 0, pointerY = 0, viewportRect;
    let covered = document.body.classList.contains('splash-active');
    const hoverLevels = new Float32Array(PIECES.length);
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const signalColour = new THREE.Color(0xff5a1f);
    const ivoryColour = new THREE.Color(0xe3dfd2);
    const ivoryDim = new THREE.Color(0x69695f);
    const blackColour = new THREE.Color(0x323835);
    const blackDim = new THREE.Color(0x202622);

    function setHovered(index) {
      if (hovered === index) return;
      hovered = index;
      mount.classList.toggle('is-hovering', index !== -1);
      document.documentElement.classList.toggle('chess-piece-hover', index !== -1);
    }
    function clearPointer() {
      pointerInside = false;
      setHovered(-1);
      requestFrame();
    }
    viewport.addEventListener('pointermove', event => {
      if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
      pointerInside = true;
      pointerX = event.clientX;
      pointerY = event.clientY;
      viewportRect = viewport.getBoundingClientRect();
      requestFrame();
    }, { passive: true });
    viewport.addEventListener('pointerleave', clearPointer);
    addEventListener('blur', clearPointer);

    function readProgress() {
      target = motionPreference.matches ? 0 : clamp((scrollY - start) / travel);
    }
    function requestFrame() {
      if (!raf && active && !document.hidden && !stopped && !covered) raf = requestAnimationFrame(frame);
    }
    function resize() {
      width = viewport.clientWidth;
      height = viewport.clientHeight;
      viewportRect = viewport.getBoundingClientRect();
      renderer.setSize(width, height);
      camera.aspect = width / height;
      // Fit the entire board and lifted ring, including narrow portrait phones.
      camera.fov = narrow() ? 34 : 32;
      camera.updateProjectionMatrix();
      const strip = parseFloat(getComputedStyle(stage).top) || 0;
      start = section.getBoundingClientRect().top + scrollY - strip;
      travel = Math.max(1, section.offsetHeight - stage.offsetHeight);
      readProgress();
      current = target;
      velocity = 0;
      renderer.shadowMap.needsUpdate = true;
      requestFrame();
    }
    function draw(p, dt = 0, time = performance.now()) {
      const flight = ease(0.08, 0.32, p) * (1 - ease(0.83, 0.99, p));
      const fit = Math.max(1, (robot ? 0.98 : 1.12) / camera.aspect);
      const centerX = robot && camera.aspect < 1 ? -1.7 : 0;
      // Gentle dolly: the board stays anchored while the pieces take the foreground.
      camera.position.set((robot ? 11.2 : 10.5) * fit + centerX, ((robot ? 12.6 : 11.5) + flight * 0.5) * fit, (robot ? 19 : 16.5) * fit);
      viewTarget.set(centerX, (robot ? 2.05 : 1.05) + flight * (robot ? 0.55 : 1.25), robot ? -2.15 : 0);
      camera.lookAt(viewTarget);
      camera.updateMatrixWorld();
      quietIvory.color.copy(ivoryColour).lerp(ivoryDim, flight * 0.8);
      quietCharcoal.color.copy(blackColour).lerp(blackDim, flight * 0.6);
      const labelsOpacity = ease(0.28, 0.37, p) * (1 - ease(0.77, 0.84, p));
      const orbit = motionPreference.matches ? 0 : orbitPresence(p);
      const settled = Math.abs(target - current) < 0.001;
      const idleTarget = settled ? ease(160, 850, time - lastScrollAt) : 0;
      idleBlend += (idleTarget - idleBlend) * (1 - Math.exp(-dt / 180));
      if (!orbit) idleBlend = 0;
      if (orbit) floatClock += dt / 1000;
      heroes.forEach((mesh, i) => {
        const pose = piecePose(i, p);
        mesh.position.set(pose.x, pose.y + floatOffset(i, floatClock, p, idleBlend), pose.z);
        mesh.rotation.y = pose.rotation;
      });
      robot?.update(p);

      // Pick the real STL surface. Empty space between pieces does not activate a hover.
      let picked = -1;
      if (pointerInside && orbit > 0.9 && settled) {
        pointer.set((pointerX - viewportRect.left) / width * 2 - 1, -(pointerY - viewportRect.top) / height * 2 + 1);
        scene.updateMatrixWorld(true);
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(heroes, false)[0];
        if (hit) picked = heroes.indexOf(hit.object);
      }
      setHovered(picked);
      const hoverEase = 1 - Math.exp(-dt / 155);
      heroes.forEach((mesh, i) => {
        hoverLevels[i] += ((i === hovered ? orbit : 0) - hoverLevels[i]) * hoverEase;
        if (hoverLevels[i] < 0.0001) hoverLevels[i] = 0;
        // The orbit gate guarantees the original scale and colour before landing.
        const highlight = hoverLevels[i] * orbit;
        mesh.scale.setScalar(1 + highlight * 0.06);
        mesh.material.color.copy(ivoryColour).lerp(signalColour, highlight * 0.18);
        mesh.material.emissiveIntensity = highlight * 0.12;
        projected.set(mesh.position.x, mesh.position.y - 0.16, mesh.position.z).project(camera);
        labels[i].style.transform = `translate(${(projected.x * 0.5 + 0.5) * width}px, ${(-projected.y * 0.5 + 0.5) * height}px) translateX(-50%)`;
        labels[i].style.opacity = String(labelsOpacity);
        labels[i].classList.toggle('is-selected', i === hovered);
      });
      const nextCaption = p < 0.26 ? 0 : p < 0.84 ? 1 : 2;
      if (nextCaption !== caption) {
        caption = nextCaption;
        [captionNumber.textContent, captionTitle.textContent, captionDetail.textContent] = captions[caption];
      }
      progressBar.style.transform = `scaleX(${p})`;
      // Millimetre-scale idle float does not need a fresh shadow map every frame.
      // Scroll and hover transitions retain fully synchronized shadows.
      if (!settled || hoverLevels.some(level => level > 0) || time - lastShadowAt > 90) {
        renderer.shadowMap.needsUpdate = true;
        lastShadowAt = time;
      }
      renderer.render(scene, camera);
    }
    function frame(time) {
      raf = 0;
      const elapsed = time - (lastTime || time - 16);
      const dt = Math.min(64, elapsed);
      // Keep smooth display-rate motion on phones. If sustained GPU load is
      // high, lower pixel density instead of dropping the idle loop to 30 fps.
      if (lastTime && elapsed < 100 && current !== target) {
        frameCost += (elapsed - frameCost) * 0.04;
        if (++frameSamples === 90 && frameCost > 24 && renderer.getPixelRatio() > 1) {
          renderer.setPixelRatio(Math.max(1, renderer.getPixelRatio() - 0.25));
          renderer.setSize(width, height);
        }
        if (frameSamples >= 90) frameSamples = 0;
      }
      lastTime = time;
      const next = followScroll(current, velocity, target, dt);
      current = next.position;
      velocity = next.velocity;
      draw(current, dt, time);
      if (current !== target || (!motionPreference.matches && orbitPresence(current) > 0) || hoverLevels.some(level => level > 0)) requestFrame();
    }
    function onScroll() {
      lastScrollAt = performance.now();
      viewportRect = viewport.getBoundingClientRect();
      readProgress();
      requestFrame();
    }
    function setMotion() {
      section.classList.toggle('is-still', motionPreference.matches);
      hint.textContent = motionPreference.matches ? 'The original chess set' : 'Scroll to explore ↓';
      viewport.setAttribute('aria-label', motionPreference.matches
        ? `The original custom chess pieces on an eight-by-eight board${robot ? ', with the SO-101 robot arm behind it' : ''}.`
        : `The original custom chess pieces on an eight-by-eight board. Scroll to lift six pieces into a full orbit and return them to their squares${robot ? ', while the SO-101 arm turns, raises its joints and gently moves its gripper' : ''}.`);
      resize();
    }
    const visibility = new IntersectionObserver(entries => {
      active = entries[0].isIntersecting;
      if (active) { readProgress(); current = target; velocity = 0; lastTime = 0; requestFrame(); }
      else { cancelAnimationFrame(raf); raf = 0; clearPointer(); }
    });
    visibility.observe(section);
    const sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(viewport);
    sizeObserver.observe(section);
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { cancelAnimationFrame(raf); raf = 0; clearPointer(); }
      else { lastTime = 0; readProgress(); current = target; velocity = 0; requestFrame(); }
    });
    new MutationObserver(() => {
      covered = ['splash-active', 'index-open', 'modal-open'].some(name => document.body.classList.contains(name));
      if (covered) { cancelAnimationFrame(raf); raf = 0; clearPointer(); }
      else { lastTime = 0; requestFrame(); }
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    motionPreference.addEventListener('change', setMotion);
    renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      stopped = true;
      cancelAnimationFrame(raf);
      raf = 0;
      clearPointer();
      fallback();
    });
    renderer.domElement.addEventListener('webglcontextrestored', () => {
      stopped = false;
      section.classList.add('is-ready', 'is-enhanced');
      setMotion();
      requestFrame();
    });
    section.classList.add('is-ready');
    status.textContent = '';
    setMotion();
    draw(current);
  } catch (error) {
    renderer?.dispose();
    mount.replaceChildren();
    console.warn('The chess study is using its static preview.', error);
    fallback();
  }
}

section.querySelector('.chess-skip').addEventListener('click', event => {
  event.preventDefault();
  const work = document.getElementById('work');
  work.tabIndex = -1;
  work.focus({ preventScroll: true });
  work.scrollIntoView({ behavior: 'instant' });
});

// The rest of the portfolio loads first. Only the visible orbit keeps an idle loop.
const preload = new IntersectionObserver(entries => {
  if (!entries.some(entry => entry.isIntersecting)) return;
  preload.disconnect();
  init();
}, { rootMargin: '800px 0px' });
preload.observe(section);
