import type { PoseData, Point, BoneSegment, Skeleton } from './types';

// --- Constants ---
export const W = 800;
export const H = 800;

// --- 8-Head Proportions based on a single HEAD_SIZE unit ---
const HEAD_SIZE_UNIT = 105;
const TRUNK_HEIGHT = HEAD_SIZE_UNIT * 3;
const LIMB_LENGTH = HEAD_SIZE_UNIT * 2;

export const HEAD_SIZE = HEAD_SIZE_UNIT * 0.8; // Visual size of the head shape

// Adjusted proportions to match target image
export const TORSO_HEIGHT = 150; 
export const WAIST_HEIGHT = 75;
const NECK_LENGTH = 0; // Neck is visually integrated but exists in hierarchy

// Limb length constants, derived from the base proportions
export const L_ARM = LIMB_LENGTH / 2;     // 105px
export const L_FOREARM = LIMB_LENGTH / 2;   // 105px
export const L_HAND = HEAD_SIZE_UNIT * 0.4;   // 42px
export const L_THIGH = 125;   
export const L_SHIN = 125;
export const L_FOOT = HEAD_SIZE_UNIT * 0.4;   // 42px

// --- Hierarchy Definition ---
export const hierarchy: { [key: string]: { parent: string | null; children: string[] } } = {
  'root': { parent: null, children: ['torso', 'waist'] },
  'torso': { parent: 'root', children: ['head', 'left.shoulder', 'right.shoulder'] },
  'waist': { parent: 'root', children: ['left.hip', 'right.hip'] },
  'head': { parent: 'torso', children: [] },
  'left.shoulder': { parent: 'torso', children: ['left.elbow'] },
  'left.elbow': { parent: 'left.shoulder', children: ['left.hand'] },
  'left.hand': { parent: 'left.elbow', children: [] },
  'right.shoulder': { parent: 'torso', children: ['right.elbow'] },
  'right.elbow': { parent: 'right.shoulder', children: ['right.hand'] },
  'right.hand': { parent: 'right.elbow', children: [] },
  'left.hip': { parent: 'waist', children: ['left.knee'] },
  'left.knee': { parent: 'left.hip', children: ['left.foot'] },
  'left.foot': { parent: 'left.knee', children: [] },
  'right.hip': { parent: 'waist', children: ['right.knee'] },
  'right.knee': { parent: 'right.hip', children: ['right.foot'] },
  'right.foot': { parent: 'right.knee', children: [] }
};

/**
 * Defines the base rotation for each part to achieve the T-Pose when all
 * pose data angles are zero. This establishes a "True Zero" identity for the rig,
 * unifying the joint origins for kinematics, IK, and physics.
 */
export const BASE_ANGLES: { [key: string]: number } = {
  // Core Body
  'torso': -Math.PI / 2,         // Points straight up from root
  'waist': Math.PI / 2,          // Points straight down from root
  'head': 0,                     // Aligns with torso
  // Left Arm (from T-Pose)
  'left.shoulder': -Math.PI / 2, // Extends left from torso
  'left.elbow': 0,               // Aligns with shoulder
  'left.hand': 0,                // Aligns with elbow
  // Right Arm (from T-Pose)
  'right.shoulder': Math.PI / 2, // Extends right from torso
  'right.elbow': 0,              // Aligns with shoulder
  'right.hand': 0,               // Aligns with elbow
  // Left Leg (from T-Pose)
  'left.hip': 0,                 // Extends down from waist
  'left.knee': 0,                // Aligns with hip
  'left.foot': 0,                // Aligns with knee
  // Right Leg (from T-Pose)
  'right.hip': 0,                // Extends down from waist
  'right.knee': 0,               // Aligns with hip
  'right.foot': 0,               // Aligns with knee
};


// --- Joint Constraints (currently unused, allowing free rotation) ---
export const jointConstraints: { [key: string]: { min: number; max: number } } = {};
export function clampAngle(angle: number, min: number, max: number): number {
  let normAngle = angle;
  while (normAngle > Math.PI) normAngle -= 2 * Math.PI;
  while (normAngle < -Math.PI) normAngle += 2 * Math.PI;
  return Math.max(min, Math.min(max, normAngle));
}

/**
 * Returns the default pose, where all joint angles are 0.
 * This state corresponds to the "True Zero" T-Pose identity.
 */
export function getDefaultPose(): PoseData {
  return {
    offset: { x: 0, y: 0 },
    torso: 0,
    waist: 0,
    head: 0,
    left: { 
      shoulder: Math.PI / 2, 
      elbow: 0, 
      hand: 0, 
      hip: 0, 
      knee: 0, 
      foot: 0 
    },
    right: { 
      shoulder: -Math.PI / 2, 
      elbow: 0, 
      hand: 0, 
      hip: 0, 
      knee: 0, 
      foot: 0 
    }
  };
}

const getEndPoint = (start: Point, angle: number, length: number): Point => ({
  x: start.x + Math.cos(angle) * length,
  y: start.y + Math.sin(angle) * length
});

export function computeSkeleton(pose: PoseData): Skeleton {
    const jointCache: { [key: string]: Point } = {};
    const boneCache: BoneSegment[] = [];
    const worldAngles: { [key: string]: number } = { root: 0 }; 

    const rootPos = { x: W / 2 + pose.offset.x, y: H / 2 + pose.offset.y };

    const storeJoint = (key: string, p: Point) => jointCache[key] = p;
    const storeBone = (key: string, start: Point, end: Point, width: number, angle: number) => {
        boneCache.push({ key, start, end, width, angle, shape: 'custom' });
    };

    // --- Tier 1: Core Body attached to Root ---
    jointCache['root'] = rootPos;

    // Torso
    worldAngles['torso'] = (BASE_ANGLES['torso'] || 0) + pose.torso;
    const neckPos = getEndPoint(rootPos, worldAngles['torso'], TORSO_HEIGHT);
    storeJoint('torso', neckPos);
    storeBone('torso', rootPos, neckPos, 100, worldAngles['torso']);

    // Waist
    worldAngles['waist'] = (BASE_ANGLES['waist'] || 0) + pose.waist;
    const hipBasePos = getEndPoint(rootPos, worldAngles['waist'], WAIST_HEIGHT);
    storeJoint('waist', hipBasePos);
    storeBone('waist', rootPos, hipBasePos, 60, worldAngles['waist']);

    // --- Tier 2: Head and Shoulders attached to Torso ---
    const headParentAngle = worldAngles['torso'];
    worldAngles['head'] = headParentAngle + (BASE_ANGLES['head'] || 0) + pose.head;
    const headVisualEnd = getEndPoint(neckPos, worldAngles['head'], 1);
    const headPhysicsCenter = getEndPoint(neckPos, worldAngles['head'], HEAD_SIZE / 2.5);
    storeBone('head', neckPos, headVisualEnd, HEAD_SIZE, worldAngles['head']);
    storeJoint('head', headPhysicsCenter);

    (['left', 'right'] as const).forEach(side => {
        const shoulderWidth = 48;
        const perpTorsoAngle = worldAngles['torso'] + Math.PI / 2;
        const shoulderXOffset = side === 'right' ? shoulderWidth : -shoulderWidth;
        const shoulderPos = getEndPoint(neckPos, perpTorsoAngle, shoulderXOffset);
        const shoulderKey = `${side}.shoulder`;
        storeJoint(shoulderKey, shoulderPos);

        worldAngles[shoulderKey] = worldAngles['torso'] + (BASE_ANGLES[shoulderKey] || 0) + pose[side].shoulder;
        const elbowPos = getEndPoint(shoulderPos, worldAngles[shoulderKey], L_ARM);
        storeBone(shoulderKey, shoulderPos, elbowPos, 36, worldAngles[shoulderKey]);

        const elbowKey = `${side}.elbow`;
        storeJoint(elbowKey, elbowPos);
        worldAngles[elbowKey] = worldAngles[shoulderKey] + (BASE_ANGLES[elbowKey] || 0) + pose[side].elbow;
        const handPos = getEndPoint(elbowPos, worldAngles[elbowKey], L_FOREARM);
        storeBone(elbowKey, elbowPos, handPos, 28, worldAngles[elbowKey]);

        const handKey = `${side}.hand`;
        storeJoint(handKey, handPos);
        worldAngles[handKey] = worldAngles[elbowKey] + (BASE_ANGLES[handKey] || 0) + pose[side].hand;
        const handEnd = getEndPoint(handPos, worldAngles[handKey], L_HAND);
        storeBone(handKey, handPos, handEnd, 16, worldAngles[handKey]);
    });

    // --- Tier 3: Legs attached to Waist ---
    (['left', 'right'] as const).forEach(side => {
        const hipWidth = 29;
        const perpWaistAngle = worldAngles['waist'] - Math.PI / 2;
        const hipXOffset = side === 'right' ? hipWidth : -hipWidth;
        const hipPos = getEndPoint(hipBasePos, perpWaistAngle, hipXOffset);
        const hipKey = `${side}.hip`;
        storeJoint(hipKey, hipPos);

        worldAngles[hipKey] = worldAngles['waist'] + (BASE_ANGLES[hipKey] || 0) + pose[side].hip;
        const kneePos = getEndPoint(hipPos, worldAngles[hipKey], L_THIGH);
        storeBone(hipKey, hipPos, kneePos, 44, worldAngles[hipKey]);
        
        const kneeKey = `${side}.knee`;
        storeJoint(kneeKey, kneePos);
        worldAngles[kneeKey] = worldAngles[hipKey] + (BASE_ANGLES[kneeKey] || 0) + pose[side].knee;
        const footPos = getEndPoint(kneePos, worldAngles[kneeKey], L_SHIN);
        storeBone(kneeKey, kneePos, footPos, 32, worldAngles[kneeKey]);

        const footKey = `${side}.foot`;
        storeJoint(footKey, footPos);
        worldAngles[footKey] = worldAngles[kneeKey] + (BASE_ANGLES[footKey] || 0) + pose[side].foot;
        const footEnd = getEndPoint(footPos, worldAngles[footKey], L_FOOT);
        storeBone(footKey, footPos, footEnd, 18, worldAngles[footKey]);
    });

    return { joints: jointCache, bones: boneCache };
}

// --- Inverse Kinematics (IK) & Helpers ---
export const getParentWorldAngle = (key: string, pose: PoseData): number | null => {
    const parentKey = hierarchy[key]?.parent;
    if (!parentKey) return 0;
    
    const skeleton = computeSkeleton(pose);
    const parentBone = skeleton.bones.find(b => b.key === parentKey);
    return parentBone?.angle ?? 0;
}

export const solveIK = (rootPos: Point, targetPos: Point, l1: number, l2: number): { angle1: number, angle2: number } | null => {
    let dx = targetPos.x - rootPos.x;
    let dy = targetPos.y - rootPos.y;
    let dist = Math.hypot(dx, dy);

    // Target is effectively at the root, cannot solve for a direction.
    if (dist < 0.1) return null;

    const maxReach = l1 + l2;
    if (dist > maxReach) {
        // Target is out of reach, stretch the limb fully towards it.
        return { angle1: Math.atan2(dy, dx), angle2: 0 };
    }

    const minReach = Math.abs(l1 - l2);
    if (dist < minReach) {
        // Target is too close. Push the target out to the minimum reach distance.
        const scale = minReach / dist;
        targetPos = { x: rootPos.x + dx * scale, y: rootPos.y + dy * scale };
        dx = targetPos.x - rootPos.x;
        dy = targetPos.y - rootPos.y;
        dist = minReach;
    }
    
    const distSq = dist * dist;

    // Law of Cosines to find the angle at the elbow joint
    const cosAngle2 = (l1 * l1 + l2 * l2 - distSq) / (2 * l1 * l2);
    const angle2_raw = Math.acos(Math.max(-1, Math.min(1, cosAngle2)));
    
    // Angle of the limb's root relative to the line from root to target
    const cosAngle1_part = (distSq + l1 * l1 - l2 * l2) / (2 * dist * l1);
    const angle1_part = Math.acos(Math.max(-1, Math.min(1, cosAngle1_part)));

    // The angle of the line from root to target
    const targetAngle = Math.atan2(dy, dx);
    
    // The final angle for the first bone (e.g., shoulder/hip)
    const angle1 = targetAngle - angle1_part; // This chooses the "elbow down/back" solution
    // The final angle for the second bone (e.g., elbow/knee)
    const angle2 = Math.PI - angle2_raw;

    return { angle1, angle2 };
};