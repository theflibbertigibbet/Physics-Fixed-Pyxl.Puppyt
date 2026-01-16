
import type { BoneSegment, Point } from '../core/types';
import { W } from '../core/kinematics';

// --- Theme & constants ---
const SELECTION_COLOR = '#E025A8'; // Magenta for "Aim" mode highlight
const JOINT_FILL_COLOR = '#1A1A1A';
const PIN_COLOR = '#FF3B30'; // Also used for pinned joints
const JOINT_RADIUS = 5;

// --- Asset Cache ---
const imageCache: { [src: string]: HTMLImageElement } = {};

// --- New part-specific color palette based on physical mass ---
const PALETTE = {
  PRIMARY_MASS: '#1A1A1A',  // Torso / Thighs / Upper Arms
  PIVOT: '#4D4D4D',         // Waist / Head / Neck
  END_EFFECTOR: '#808080',  // Forearms / Shins / Hands / Feet
};

const getColor = (key: string): string => {
  if (key === 'head' || key === 'neck' || key === 'waist') return PALETTE.PIVOT;
  if (key === 'torso' || key.includes('hip') || key.includes('shoulder')) return PALETTE.PRIMARY_MASS;
  if (key.includes('knee') || key.includes('elbow') || key.includes('hand') || key.includes('foot')) return PALETTE.END_EFFECTOR;
  return '#000000';
};

// --- Path definitions for each part ---
const pathHead = (ctx: CanvasRenderingContext2D) => {
  // A horizontal ellipse that will be rotated into a vertical position.
  // Centered 32 units along the bone's local X-axis.
  // Radius X (length) = 32, Radius Y (width) = 19.
  ctx.beginPath();
  ctx.ellipse(32, 0, 32, 19, 0, 0, Math.PI * 2);
};

// No visible neck piece in the target design.
const pathNeck = (ctx: CanvasRenderingContext2D) => {};

const pathTorso = (ctx: CanvasRenderingContext2D) => {
  // A triangle with its tip at the origin (root joint) and its base at x=150 (neck).
  // This is drawn horizontally and will be rotated upwards by the renderer.
  ctx.beginPath();
  ctx.moveTo(0, 0); 
  ctx.lineTo(150, -50);
  ctx.lineTo(150, 50);
  ctx.closePath();
};

const pathWaist = (ctx: CanvasRenderingContext2D) => {
  // A triangle with its base at the origin (root joint) and its tip at x=75 (waist-end).
  // This is drawn horizontally and will be rotated downwards by the renderer.
  ctx.beginPath();
  ctx.moveTo(0, -29);
  ctx.lineTo(75, 0);
  ctx.lineTo(0, 29);
  ctx.closePath();
};

// Generic diamond shape for limb segments
const createLimbPath = (length: number, width: number) => (ctx: CanvasRenderingContext2D) => {
    const halfWidth = width / 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(length / 2, -halfWidth);
    ctx.lineTo(length, 0);
    ctx.lineTo(length / 2, halfWidth);
    ctx.closePath();
};

// Arm segments
const pathUpperArm = createLimbPath(105, 36);
const pathForearm = createLimbPath(105, 28);

// Leg segments
const pathThigh = createLimbPath(125, 44);
const pathShin = createLimbPath(125, 32);

// End effectors - sharp triangles
const pathHand = (ctx: CanvasRenderingContext2D) => {
  ctx.beginPath();
  ctx.moveTo(0, -5);
  ctx.lineTo(42, 0);
  ctx.lineTo(0, 5);
  ctx.closePath();
};

const pathFoot = (ctx: CanvasRenderingContext2D) => {
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(42, 0);
  ctx.lineTo(0, 8);
  ctx.closePath();
};


const PATH_MAP: { [key: string]: (ctx: CanvasRenderingContext2D) => void } = {
  'head': pathHead, 'neck': pathNeck, 'torso': pathTorso, 'waist': pathWaist,
  'left.shoulder': pathUpperArm, 'right.shoulder': pathUpperArm,
  'left.elbow': pathForearm, 'right.elbow': pathForearm,
  'left.hand': pathHand, 'right.hand': pathHand,
  'left.hip': pathThigh, 'right.hip': pathThigh,
  'left.knee': pathShin, 'right.knee': pathShin,
  'left.foot': pathFoot, 'right.foot': pathFoot,
};

const drawSelectionHighlight = (ctx: CanvasRenderingContext2D, bone: BoneSegment) => {
  const pathFn = PATH_MAP[bone.key];
  if (!pathFn) return;

  ctx.save();
  ctx.translate(bone.start.x, bone.start.y);
  ctx.rotate(bone.angle);
  
  pathFn(ctx);

  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineWidth = 12;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.5;
  ctx.stroke();
  ctx.restore();
};

const drawImageAsset = (ctx: CanvasRenderingContext2D, bone: BoneSegment, assetUrl: string) => {
    const drawImg = (img: HTMLImageElement) => {
        const boneLength = Math.hypot(bone.end.x - bone.start.x, bone.end.y - bone.start.y);
        if (boneLength < 1) return;

        const boneAngle = Math.atan2(bone.end.y - bone.start.y, bone.end.x - bone.start.x);
        const center = { x: (bone.start.x + bone.end.x) / 2, y: (bone.start.y + bone.end.y) / 2 };
        
        const h = bone.width;

        ctx.save();
        ctx.translate(center.x, center.y);
        ctx.rotate(boneAngle);
        ctx.drawImage(img, -boneLength / 2, -h / 2, boneLength, h);
        ctx.restore();
    };

    if (imageCache[assetUrl]) {
        if(imageCache[assetUrl].complete) {
            drawImg(imageCache[assetUrl]);
        }
    } else {
        const img = new Image();
        img.src = assetUrl;
        img.onload = () => {}; 
        imageCache[assetUrl] = img;
    }
};

const drawCustomPart = (ctx: CanvasRenderingContext2D, bone: BoneSegment) => {
  const pathFn = PATH_MAP[bone.key];
  if (!pathFn) return;

  ctx.save();
  ctx.translate(bone.start.x, bone.start.y);
  ctx.rotate(bone.angle);

  pathFn!(ctx);
  ctx.fillStyle = getColor(bone.key);
  ctx.fill();

  ctx.restore();
};

export const drawPart = (ctx: CanvasRenderingContext2D, bone: BoneSegment, isHighlighted: boolean, assetUrl: string | null) => {
    if (isHighlighted) {
        drawSelectionHighlight(ctx, bone);
    }
    
    if (assetUrl) {
        drawImageAsset(ctx, bone, assetUrl);
        return;
    }
    
    drawCustomPart(ctx, bone);
};

export const drawJoints = (ctx: CanvasRenderingContext2D, joints: { [key: string]: Point }, pinnedPoints?: { [key: string]: Point } | null, dragMode?: string | null) => {
    const GROUNDED_PIN_COLOR = '#3B82F6'; // Blue for grounded pins

    for (const key in joints) {
        const p = joints[key];
        
        const isPinned = pinnedPoints && pinnedPoints[key];
        const isHead = key === 'head';

        const isGroundedFoot = dragMode === 'grounded_ik' && isPinned && key.includes('foot');

        if (isGroundedFoot) {
            ctx.save();
            ctx.fillStyle = GROUNDED_PIN_COLOR;
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.arc(p.x, p.y, JOINT_RADIUS * 3.5, 0, 2 * Math.PI);
            ctx.fill();
            ctx.restore();
        }
        
        if (isHead && !isPinned) continue; // Don't draw regular head dot, only pinned one

        ctx.fillStyle = isPinned ? PIN_COLOR : JOINT_FILL_COLOR;
        const radius = isPinned ? JOINT_RADIUS * 1.5 : JOINT_RADIUS;
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, 2 * Math.PI);
        ctx.fill();
    }
};

export const drawJointMarkers = (ctx: CanvasRenderingContext2D, joints: { [key: string]: Point }) => {
    const markerSize = 10;
    ctx.save();
    ctx.strokeStyle = 'rgba(60, 60, 67, 0.2)'; // Faint gray
    ctx.lineWidth = 1;

    for (const key in joints) {
        const p = joints[key];
        
        // Horizontal line of crosshair
        ctx.beginPath();
        ctx.moveTo(p.x - markerSize, p.y);
        ctx.lineTo(p.x + markerSize, p.y);
        ctx.stroke();

        // Vertical line of crosshair
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - markerSize);
        ctx.lineTo(p.x, p.y + markerSize);
        ctx.stroke();
    }
    ctx.restore();
};