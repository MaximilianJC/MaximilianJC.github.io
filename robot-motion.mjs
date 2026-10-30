import { ease } from './chess-motion.mjs?v=so101-1';

// Artistic offsets from the supplied folded CAD pose, in degrees. These are
// presentation poses, not servo commands or a calibrated hardware simulation.
export const ROBOT_POSES = [
  { at: 0, angles: [-9, 12, -22, 10, -7, 62] },
  { at: 0.27, angles: [5, 25, -44, 19, 4, 50] },
  { at: 0.76, angles: [5, 25, -44, 19, 4, 50] },
  { at: 1, angles: [-3, 16, -28, 12, -4, 66] },
];

export function robotPose(progress) {
  const next = ROBOT_POSES.findIndex(key => key.at > progress);
  if (next < 0) return ROBOT_POSES.at(-1).angles.map(degrees => degrees * Math.PI / 180);
  if (next === 0) return ROBOT_POSES[0].angles.map(degrees => degrees * Math.PI / 180);
  const from = ROBOT_POSES[next - 1], to = ROBOT_POSES[next];
  const blend = ease(from.at, to.at, progress);
  return from.angles.map((degrees, i) => (degrees + (to.angles[i] - degrees) * blend) * Math.PI / 180);
}
