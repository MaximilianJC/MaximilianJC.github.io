// A deterministic scroll timeline. All coordinates are in 32 mm board squares.
// Keeping pose calculation separate makes reversal and exact landing testable.
export const TAU = Math.PI * 2;
export const clamp = x => Math.max(0, Math.min(1, x));

// Exact critically damped spring: scroll-wheel steps change acceleration rather
// than jumping straight to a new animation speed. Stable at 30/60/120 Hz.
export function followScroll(position, velocity, target, milliseconds) {
  const seconds = Math.max(0, milliseconds) / 1000;
  const omega = 20;
  const offset = position - target;
  const impulse = velocity + omega * offset;
  const decay = Math.exp(-omega * seconds);
  const next = target + (offset + impulse * seconds) * decay;
  const speed = (velocity - omega * impulse * seconds) * decay;
  if (Math.abs(next - target) < 0.000002 && Math.abs(speed) < 0.00002) return { position: target, velocity: 0 };
  return { position: clamp(next), velocity: next < 0 || next > 1 ? 0 : speed };
}
export function ease(from, to, progress) {
  const t = clamp((progress - from) / (to - from));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

// Fade all idle/hover motion out before the pieces approach their home squares.
export const orbitPresence = progress => ease(0.30, 0.37, progress) * (1 - ease(0.77, 0.84, progress));

export function floatOffset(index, seconds, progress, idle = 1) {
  const phase = index * 1.19;
  const wave = Math.sin(seconds * TAU / (5.8 + index * 0.19) + phase) * 0.025
    + Math.sin(seconds * TAU / 9.3 + phase * 0.7) * 0.005;
  return wave * orbitPresence(progress) * clamp(idle);
}

export const PIECES = [
  { id: 'king', name: 'King', file: 'Koenig.stl', x: 0.5, z: 3.5 },
  { id: 'queen', name: 'Queen', file: 'Dame.stl', x: -0.5, z: 3.5 },
  { id: 'bishop', name: 'Bishop', file: 'Laeufer.stl', x: 1.5, z: 3.5 },
  { id: 'knight', name: 'Knight', file: 'Pferd.stl', x: 2.5, z: 3.5 },
  { id: 'rook', name: 'Rook', file: 'Turm.stl', x: 3.5, z: 3.5 },
  { id: 'pawn', name: 'Pawn', file: 'Bauer.stl', x: 0.5, z: 2.5 },
];

export function piecePose(index, progress) {
  const piece = PIECES[index];
  const stagger = index * 0.008;
  const lift = ease(0.07 + stagger, 0.23 + stagger, progress);
  const land = ease(0.87 + stagger * 0.5, 0.97 + stagger * 0.5, progress);
  const spread = ease(0.22, 0.35, progress) * (1 - ease(0.79, 0.87, progress));
  const turn = ease(0.35, 0.79, progress);
  // Assign ring slots so the six paths never cross during deployment/retraction.
  const slot = [2, 3, 1, 5, 0, 4][index];
  const angle = slot / PIECES.length * TAU + Math.PI / 12 + turn * TAU;
  const radius = 3.15;
  return {
    x: piece.x + (Math.cos(angle) * radius - piece.x) * spread,
    y: (lift * (2.55 + index * 0.12) + spread * 0.5) * (1 - land),
    z: piece.z + (Math.sin(angle) * radius - piece.z) * spread,
    rotation: turn * TAU,
    spread,
  };
}
