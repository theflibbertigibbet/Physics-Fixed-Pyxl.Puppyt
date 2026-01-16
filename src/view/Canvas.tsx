
import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle, useCallback, useLayoutEffect } from 'react';
import type { PoseData, Point, BoneSegment, Skeleton, TargetObject } from '../core/types';
import { computeSkeleton, getParentWorldAngle, W, H, jointConstraints, clampAngle, L_ARM, L_FOREARM, L_THIGH, L_SHIN, solveIK } from '../core/kinematics';
import { solveFabrik } from '../core/ik';
import { drawPart, drawJoints, drawJointMarkers } from './drawing';
import { constrainPoseToBounds } from '../utils';

export interface CanvasHandle {
  exportAsPng: () => void;
}

interface CanvasProps {
  pose: PoseData;
  onPoseCommit: (pose: PoseData) => void;
  assets?: { [key: string]: string | null };
  selectedPartKey: string | null;
  onSelectPart: (key: string) => void;
  onDeselect: () => void;
  isInteractionDisabled: boolean;
}

// --- Theme & constants ---
const PIN_COLOR = '#FF3B30';
const PAPER_COLOR = '#F4F1DE', GRID_COLOR = 'rgba(61, 43, 86, 0.1)';
const GRID_SNAP = 3.125;
const ANGLE_SNAP = (5 * Math.PI) / 180; // 5 degrees
const DAMPING_FACTOR = 0.4;

// --- Interaction ---
const boneToControlledAction: { [key: string]: { type: 'rotate'; joint: string; pivot: string; } } = { 
    'torso': { type: 'rotate', joint: 'torso', pivot: 'root' }, 
    'waist': { type: 'rotate', joint: 'waist', pivot: 'root' }, 
    'head': { type: 'rotate', joint: 'head', pivot: 'head' }, 
    'left.shoulder': { type: 'rotate', joint: 'left.shoulder', pivot: 'left.shoulder' }, 
    'left.elbow': { type: 'rotate', joint: 'left.elbow', pivot: 'left.elbow' }, 
    'left.hand': { type: 'rotate', joint: 'left.hand', pivot: 'left.hand' }, 
    'right.shoulder': { type: 'rotate', joint: 'right.shoulder', pivot: 'right.shoulder' }, 
    'right.elbow': { type: 'rotate', joint: 'right.elbow', pivot: 'right.elbow' }, 
    'right.hand': { type: 'rotate', joint: 'right.hand', pivot: 'right.hand' }, 
    'left.hip': { type: 'rotate', joint: 'left.hip', pivot: 'left.hip' }, 
    'left.knee': { type: 'rotate', joint: 'left.knee', pivot: 'left.knee' }, 
    'left.foot': { type: 'rotate', joint: 'left.foot', pivot: 'left.foot' }, 
    'right.hip': { type: 'rotate', joint: 'right.hip', pivot: 'right.hip' }, 
    'right.knee': { type: 'rotate', joint: 'right.knee', pivot: 'right.knee' }, 
    'right.foot': { type: 'rotate', joint: 'right.foot', pivot: 'right.foot' } 
};
const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t;
const recursiveLerp = (a: any, b: any, t: number): any => { if (typeof a === 'number' && typeof b === 'number') return lerp(a, b, t); if (typeof a === 'object' && a !== null && b !== null) { const result: { [key: string]: any } = {}; for (const key in a) if (key in b) result[key] = recursiveLerp(a[key], b[key], t); return result; } return b; };
const isClose = (a: any, b: any, threshold = 0.001): boolean => { if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < threshold; if (typeof a === 'object' && a !== null && b !== null) return Object.keys(a).every(key => isClose(a[key], b[key], threshold)); return a === b; }
function distToSegment(p: Point, v: Point, w: Point): number { const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2; if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y); let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2; t = Math.max(0, Math.min(1, t)); const proj = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) }; return Math.hypot(p.x - proj.x, p.y - proj.y); }


export const Canvas = forwardRef<CanvasHandle, CanvasProps>(({ pose, onPoseCommit, assets, selectedPartKey, onSelectPart, onDeselect, isInteractionDisabled }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [localPose, setLocalPose] = useState<PoseData>(pose);
  const [draggedPartKey, setDraggedPartKey] = useState<string | null>(null);
  const [activePivot, setActivePivot] = useState<Point | null>(null);
  const [displayedPose, setDisplayedPose] = useState<PoseData>(pose);
  // FIX: Explicitly pass undefined to useRef to satisfy stricter TypeScript checks or linters. While useRef() is valid, some toolchains might incorrectly flag it.
  const animationFrameId = useRef<number | undefined>(undefined);
  const initialDragOffset = useRef<Point>({x:0, y:0});
  const dragModeRef = useRef<'pan' | 'rotate' | 'ik' | 'aim' | 'full_body_ik' | 'grounded_ik' | null>(null);
  const controlledJointRef = useRef<string | null>(null);
  const initialPoseRef = useRef<PoseData | null>(null);
  const initialMousePosRef = useRef<Point>({x: 0, y: 0});
  const [pinnedPoints, setPinnedPoints] = useState<{[key: string]: Point} | null>(null);
  const pinnedPointsRef = useRef<{[key: string]: Point} | null>(null);
  const [userPins, setUserPins] = useState<{ [key: string]: Point }>({});
  const ikDriverKeyRef = useRef<string | null>(null);
  const rotationAccumulatorRef = useRef<number>(0);
  const lastMouseAngleRef = useRef<number>(0);

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        const padding = 80;
        const scaleX = (width - padding) / W;
        const scaleY = (height - padding) / H;
        setScale(Math.max(0, Math.min(scaleX, scaleY)));
      }
    });

    observer.observe(wrapper);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => { setLocalPose(pose); }, [pose]);
  useEffect(() => {
    const animate = (_time: number) => {
      setDisplayedPose(current => {
        if (isClose(current, localPose)) { animationFrameId.current = undefined; return localPose; }
        const nextPose = recursiveLerp(current, localPose, DAMPING_FACTOR) as PoseData;
        animationFrameId.current = requestAnimationFrame(animate);
        return nextPose;
      });
    };
    if (!animationFrameId.current && JSON.stringify(displayedPose) !== JSON.stringify(localPose)) {
        animationFrameId.current = requestAnimationFrame(animate);
    }
    return () => { if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current); animationFrameId.current = undefined; };
  }, [localPose, displayedPose]);

  const drawScene = useCallback((ctx: CanvasRenderingContext2D, isExport: boolean) => {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = isExport ? 'transparent' : PAPER_COLOR;
    ctx.fillRect(0, 0, W, H);

    if (!isExport) {
        ctx.strokeStyle = GRID_COLOR; ctx.lineWidth = 1;
        for (let x = 0; x <= W; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        for (let y = 0; y <= H; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    }

    const mainSkeleton = computeSkeleton(isExport ? pose : displayedPose);

    // Draw the thin red vertical center line
    if (!isExport) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(W / 2, 0);
        ctx.lineTo(W / 2, H);
        ctx.strokeStyle = PIN_COLOR;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    }

    const drawSkeleton = (skel: Skeleton, currentAssets?: typeof assets, highlightKey?: string | null) => {
        const order = [
            'right.hip', 'right.knee', 'right.foot',
            'left.hip', 'left.knee', 'left.foot',
            'waist',
            'right.shoulder', 'right.elbow', 'right.hand',
            'left.shoulder', 'left.elbow', 'left.hand',
            'torso',
            'neck', 'head'
        ];
        order.forEach(key => {
            const bone = skel.bones.find(b => b.key === key);
            if (bone) drawPart(ctx, bone, bone.key === highlightKey, currentAssets?.[bone.key] ?? null);
        });
    };

    drawSkeleton(mainSkeleton, assets, isExport ? null : selectedPartKey);

    if (!isExport) {
        drawJointMarkers(ctx, mainSkeleton.joints);
        const allPins = { ...userPins, ...pinnedPoints };
        drawJoints(ctx, mainSkeleton.joints, allPins, dragModeRef.current);
        if (activePivot) {
            ctx.fillStyle = PIN_COLOR; ctx.beginPath(); ctx.arc(activePivot.x, activePivot.y, 6, 0, 2 * Math.PI); ctx.fill();
        }
    }
  }, [displayedPose, pose, assets, selectedPartKey, activePivot, pinnedPoints, userPins]);

  useEffect(() => {
    const canvas = canvasRef.current!, ctx = canvas.getContext('2d')!;
    drawScene(ctx, false);
  }, [drawScene]);

  useImperativeHandle(ref, () => ({
    exportAsPng: () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      
      drawScene(ctx, true);
      const dataURL = canvas.toDataURL('image/png');
      drawScene(ctx, false); // Redraw original scene after export

      const link = document.createElement('a');
      link.download = 'pyxl-puppet.png';
      link.href = dataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }));

  const getMousePos = (e: React.MouseEvent): Point => { 
    const canvas = canvasRef.current;
    if (!canvas || scale === 0) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect(); 
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    return { x, y }; 
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isInteractionDisabled) return;
    const skeleton = computeSkeleton(localPose);
    const pos = getMousePos(e);
    let finalClickedKey: string | null = null;
    let minDistance = Infinity;

    skeleton.bones.forEach(bone => {
        const dist = distToSegment(pos, bone.start, bone.end);
            
        if (dist < bone.width / 2 + 16 && dist < minDistance) {
            minDistance = dist;
            finalClickedKey = bone.key;
        }
    });

    if (e.shiftKey && finalClickedKey && !['torso', 'waist', 'head', 'neck'].includes(finalClickedKey)) {
        onSelectPart(finalClickedKey);
        setDraggedPartKey(finalClickedKey);
        dragModeRef.current = 'aim';
        controlledJointRef.current = finalClickedKey;
        const pivot = skeleton.joints[finalClickedKey];
        if (pivot) setActivePivot(pivot);
        return;
    }
    
    if (finalClickedKey) {
        onSelectPart(finalClickedKey);
        setDraggedPartKey(finalClickedKey);
        
        const isEndEffector = ['hand', 'foot'].some(part => finalClickedKey.includes(part));
        const isCoreBody = ['head', 'torso', 'waist'].includes(finalClickedKey);
        
        if (isEndEffector && (e.altKey || e.metaKey)) {
            dragModeRef.current = 'ik';
            controlledJointRef.current = null;
            setActivePivot(null);
        } else if (isCoreBody && e.altKey) { // Option key: Grounded / Anchor IK
            dragModeRef.current = 'grounded_ik';
            ikDriverKeyRef.current = finalClickedKey;
            
            let pinsToUse: { [key: string]: Point } = {};
            const userPinKeys = Object.keys(userPins);

            if (userPinKeys.length > 0) {
                // Use the user's explicit pins if they exist
                pinsToUse = { ...userPins };
            } else {
                // Default to grounding the feet if no pins are set
                ['left.foot', 'right.foot'].forEach(key => {
                    const jointPos = skeleton.joints[key];
                    if (jointPos) pinsToUse[key] = jointPos;
                });
            }
            
            pinnedPointsRef.current = pinsToUse;
            setPinnedPoints(pinsToUse);

            initialPoseRef.current = localPose;
            initialMousePosRef.current = pos;
            setActivePivot(null);
        } else if (isCoreBody && e.metaKey) { // Command key: Full Body IK
            dragModeRef.current = 'full_body_ik';
            ikDriverKeyRef.current = finalClickedKey;

            const userPinKeys = Object.keys(userPins);
            let pinsToUse: { [key: string]: Point };

            if (userPinKeys.length > 0) {
                pinsToUse = { ...userPins };
            } else {
                pinsToUse = {};
                const pinKeys = ['left.hand', 'right.hand', 'left.foot', 'right.foot'];
                if (finalClickedKey !== 'head') pinKeys.push('head');
                pinKeys.forEach(key => {
                    const jointPos = skeleton.joints[key];
                    if (jointPos) pinsToUse[key] = jointPos;
                });
            }

            pinnedPointsRef.current = pinsToUse;
            setPinnedPoints(pinsToUse);
            
            initialPoseRef.current = localPose;
            initialMousePosRef.current = pos;
            setActivePivot(null);
        } else {
            const action = boneToControlledAction[finalClickedKey as keyof typeof boneToControlledAction];
            if (action?.type === 'rotate') {
                dragModeRef.current = 'rotate';
                controlledJointRef.current = action.joint;
                const pivotKey = action.pivot || action.joint;
                const pivot = skeleton.joints[pivotKey];
                if (!pivot) return;
                setActivePivot(pivot);
                initialPoseRef.current = localPose;
                initialMousePosRef.current = pos;
                rotationAccumulatorRef.current = 0;
                lastMouseAngleRef.current = Math.atan2(pos.y - pivot.y, pos.x - pivot.x);
            }
        }
    } else {
        onDeselect();
    }
  };
  
  const handleIk = (skeleton: Skeleton, snappedPos: Point, bypassConstraints: boolean) => {
    if (!draggedPartKey) return;
    
    const isHand = draggedPartKey.includes('hand');
    const isFoot = draggedPartKey.includes('foot');
    if (!isHand && !isFoot) return;
    
    const side = draggedPartKey.startsWith('left') ? 'left' : 'right' as 'left' | 'right';
    const isArm = isHand;
    
    const rootKey = isArm ? `${side}.shoulder` : `${side}.hip`;
    const midKey = isArm ? `${side}.elbow` : `${side}.knee`;
    const endKey = isArm ? `${side}.hand` : `${side}.foot`;
    
    const chainPoints = [skeleton.joints[rootKey], skeleton.joints[midKey], skeleton.joints[endKey]];
    if (chainPoints.some(p => !p)) return;

    const solvedChain = solveFabrik(chainPoints, snappedPos);
    
    const [newRootPos, newMidPos, newEndPos] = solvedChain;
    
    // --- Limb chain angles ---
    // FIX: Pass the root key of the IK chain to get the correct parent angle for local angle calculation.
    const parentAngle = getParentWorldAngle(rootKey, localPose);
    if (parentAngle === null) return;

    const newRootWorldAngle = Math.atan2(newMidPos.y - newRootPos.y, newMidPos.x - newRootPos.x);
    let newRootLocalAngle = newRootWorldAngle - parentAngle;

    const newMidWorldAngle = Math.atan2(newEndPos.y - newMidPos.y, newEndPos.x - newMidPos.x);
    let newMidLocalAngle = newMidWorldAngle - newRootWorldAngle;
    
    // --- End-effector aiming ---
    const newEndParentWorldAngle = newMidWorldAngle; // Parent is forearm/shin
    const newEndWorldAngle = Math.atan2(snappedPos.y - newEndPos.y, snappedPos.x - newEndPos.x);
    let newEndLocalAngle = newEndWorldAngle - newEndParentWorldAngle;

    if (!bypassConstraints) {
        const rootConstraint = jointConstraints[rootKey as keyof typeof jointConstraints];
        if (rootConstraint) newRootLocalAngle = clampAngle(newRootLocalAngle, rootConstraint.min, rootConstraint.max);
        
        const midConstraint = jointConstraints[midKey as keyof typeof jointConstraints];
        if (midConstraint) newMidLocalAngle = clampAngle(newMidLocalAngle, midConstraint.min, midConstraint.max);

        const endConstraint = jointConstraints[endKey as keyof typeof jointConstraints];
        if (endConstraint) newEndLocalAngle = clampAngle(newEndLocalAngle, endConstraint.min, endConstraint.max);
    }
    
    setLocalPose(p => {
        const newPose = JSON.parse(JSON.stringify(p));
        newPose[side][isArm ? 'shoulder' : 'hip'] = newRootLocalAngle;
        newPose[side][isArm ? 'elbow' : 'knee'] = newMidLocalAngle;
        newPose[side][isArm ? 'hand' : 'foot'] = newEndLocalAngle;
        return newPose;
    });
  };

  const handleGroundedIk = (pos: Point) => {
    const pinnedPoints = pinnedPointsRef.current;
    const initialPose = initialPoseRef.current;
    const initialMouse = initialMousePosRef.current;
    if (!pinnedPoints || !initialPose || !initialMouse) return;

    const mouseDelta = { x: pos.x - initialMouse.x, y: pos.y - initialMouse.y };
    
    let proposedPose = JSON.parse(JSON.stringify(initialPose));
    proposedPose.offset.x += mouseDelta.x;
    proposedPose.offset.y += mouseDelta.y;

    const proposedSkeleton = computeSkeleton(proposedPose);
    let totalCorrection = { x: 0, y: 0 };
    let correctionCount = 0;

    const calculateCorrection = (rootPos: Point | undefined, pinPos: Point | undefined, maxReach: number) => {
        if (rootPos && pinPos) {
            const dx = pinPos.x - rootPos.x;
            const dy = pinPos.y - rootPos.y;
            const dist = Math.hypot(dx, dy);

            if (dist > maxReach) {
                const overshoot = dist - maxReach;
                totalCorrection.x += (dx / dist) * overshoot;
                totalCorrection.y += (dy / dist) * overshoot;
                correctionCount++;
            }
        }
    };
    
    // Check pinned arms and legs for overstretching
    (['left', 'right'] as const).forEach(side => {
        if (pinnedPoints[`${side}.hand`]) {
            calculateCorrection(
                proposedSkeleton.joints[`${side}.shoulder`],
                pinnedPoints[`${side}.hand`],
                L_ARM + L_FOREARM
            );
        }
        if (pinnedPoints[`${side}.foot`]) {
            calculateCorrection(
                proposedSkeleton.joints[`${side}.hip`],
                pinnedPoints[`${side}.foot`],
                L_THIGH + L_SHIN
            );
        }
    });

    if (correctionCount > 0) {
        proposedPose.offset.x += totalCorrection.x / correctionCount;
        proposedPose.offset.y += totalCorrection.y / correctionCount;
    }
    
    const newPose = proposedPose;
    const finalSkeleton = computeSkeleton(newPose);

    // Solve IK for pinned arms and legs
    (['left', 'right'] as const).forEach(side => {
        const shoulderPos = finalSkeleton.joints[`${side}.shoulder`];
        const handPinPos = pinnedPoints[`${side}.hand`];
        if (shoulderPos && handPinPos) {
            const armResult = solveIK(shoulderPos, handPinPos, L_ARM, L_FOREARM);
            if (armResult) {
                const torsoAngle = finalSkeleton.bones.find(b => b.key === 'torso')?.angle ?? 0;
                newPose[side].shoulder = armResult.angle1 - torsoAngle;
                newPose[side].elbow = armResult.angle2;
            }
        }

        const hipPos = finalSkeleton.joints[`${side}.hip`];
        const footPinPos = pinnedPoints[`${side}.foot`];
        if (hipPos && footPinPos) {
            const legResult = solveIK(hipPos, footPinPos, L_THIGH, L_SHIN);
            if (legResult) {
                const waistAngle = finalSkeleton.bones.find(b => b.key === 'waist')?.angle ?? 0;
                newPose[side].hip = legResult.angle1 - waistAngle;
                newPose[side].knee = legResult.angle2;
            }
        }
    });

    setLocalPose(newPose);
  };
  
  const handleFullBodyIk = (pos: Point) => {
    const driverKey = ikDriverKeyRef.current;
    const pinnedPoints = pinnedPointsRef.current;
    const initialPose = initialPoseRef.current;
    const initialMouse = initialMousePosRef.current;
    if (!driverKey || !pinnedPoints || !initialPose) return;

    const mouseDelta = { x: pos.x - initialMouse.x, y: pos.y - initialMouse.y };
    
    // Create a proposed pose based on direct mouse movement
    let proposedPose = JSON.parse(JSON.stringify(initialPose));
    proposedPose.offset.x += mouseDelta.x;
    proposedPose.offset.y += mouseDelta.y;

    // --- Tension Simulation ---
    // Calculate how much the proposed pose overstretches the pinned limbs
    const proposedSkeleton = computeSkeleton(proposedPose);
    let totalCorrection = { x: 0, y: 0 };
    let correctionCount = 0;

    const calculateCorrection = (rootPos: Point | undefined, pinPos: Point | undefined, maxReach: number) => {
        if (rootPos && pinPos) {
            const dx = pinPos.x - rootPos.x;
            const dy = pinPos.y - rootPos.y;
            const dist = Math.hypot(dx, dy);

            if (dist > maxReach) {
                const overshoot = dist - maxReach;
                totalCorrection.x += (dx / dist) * overshoot;
                totalCorrection.y += (dy / dist) * overshoot;
                correctionCount++;
            }
        }
    };

    // Check arms and legs for overstretching
    (['left', 'right'] as const).forEach(side => {
        calculateCorrection(
            proposedSkeleton.joints[`${side}.shoulder`],
            pinnedPoints[`${side}.hand`],
            L_ARM + L_FOREARM
        );
        calculateCorrection(
            proposedSkeleton.joints[`${side}.hip`],
            pinnedPoints[`${side}.foot`],
            L_THIGH + L_SHIN
        );
    });

    // Apply the average correction to the pose offset, pulling it back
    if (correctionCount > 0) {
        proposedPose.offset.x += totalCorrection.x / correctionCount;
        proposedPose.offset.y += totalCorrection.y / correctionCount;
    }
    
    const newPose = proposedPose; // This is now our tension-adjusted pose
    const finalSkeleton = computeSkeleton(newPose);

    // --- Final IK Solve ---
    // Now solve the IK for each limb based on the corrected body position
    (['left', 'right'] as const).forEach(side => {
        const shoulderPos = finalSkeleton.joints[`${side}.shoulder`];
        const handPinPos = pinnedPoints[`${side}.hand`];
        if (shoulderPos && handPinPos) {
            const armResult = solveIK(shoulderPos, handPinPos, L_ARM, L_FOREARM);
            if (armResult) {
                const torsoAngle = finalSkeleton.bones.find(b => b.key === 'torso')?.angle ?? 0;
                newPose[side].shoulder = armResult.angle1 - torsoAngle;
                newPose[side].elbow = armResult.angle2;
            }
        }

        const hipPos = finalSkeleton.joints[`${side}.hip`];
        const footPinPos = pinnedPoints[`${side}.foot`];
        if (hipPos && footPinPos) {
            const legResult = solveIK(hipPos, footPinPos, L_THIGH, L_SHIN);
            if (legResult) {
                const waistAngle = finalSkeleton.bones.find(b => b.key === 'waist')?.angle ?? 0;
                newPose[side].hip = legResult.angle1 - waistAngle;
                newPose[side].knee = legResult.angle2;
            }
        }
    });

    // Head pinning logic (unchanged)
    if (driverKey !== 'head' && pinnedPoints.head) {
        const rootPos = finalSkeleton.joints['root'];
        const headPinPos = pinnedPoints.head;
        if (rootPos && headPinPos) {
            const torsoWorldAngle = Math.atan2(headPinPos.y - rootPos.y, headPinPos.x - rootPos.x) + Math.PI / 2;
            newPose.torso = torsoWorldAngle;
        }
    }

    setLocalPose(newPose);
  };

  const handleRotate = (skeleton: Skeleton, snappedPos: Point, useSnap: boolean) => {
    if (!draggedPartKey || !initialPoseRef.current || !activePivot) return;

    const action = boneToControlledAction[draggedPartKey as keyof typeof boneToControlledAction];
    if (!action || action.type !== 'rotate') return;

    const jointToRotate = action.joint;
    const pivot = activePivot;

    const currentMouseAngle = Math.atan2(snappedPos.y - pivot.y, snappedPos.x - pivot.x);
    let angleDiff = currentMouseAngle - lastMouseAngleRef.current;

    // Handle angle wrapping around the -PI/PI boundary
    if (angleDiff > Math.PI) {
        angleDiff -= 2 * Math.PI;
    } else if (angleDiff < -Math.PI) {
        angleDiff += 2 * Math.PI;
    }

    rotationAccumulatorRef.current += angleDiff;
    lastMouseAngleRef.current = currentMouseAngle;

    let initialLocalAngle = 0;
    const parts = jointToRotate.split('.');
    if (parts.length === 2) {
        initialLocalAngle = (initialPoseRef.current as any)[parts[0]][parts[1]];
    } else {
        initialLocalAngle = (initialPoseRef.current as any)[jointToRotate];
    }

    let newLocalAngle = initialLocalAngle + rotationAccumulatorRef.current;
    
    if (useSnap) {
        newLocalAngle = Math.round(newLocalAngle / ANGLE_SNAP) * ANGLE_SNAP;
    }

    setLocalPose(p => {
        const newPose = JSON.parse(JSON.stringify(p));
        if (parts.length === 2) {
            (newPose as any)[parts[0]][parts[1]] = newLocalAngle;
        } else {
            (newPose as any)[jointToRotate] = newLocalAngle;
        }
        return newPose;
    });
  };

  const handleAim = (pos: Point) => {
    const controlledJoint = controlledJointRef.current;
    if (!controlledJoint || !activePivot) return;

    const targetGridAngle = Math.atan2(pos.y - activePivot.y, pos.x - activePivot.y);
    const parentGlobalRotation = getParentWorldAngle(controlledJoint, localPose);
    if (parentGlobalRotation === null) return;
    const finalLocalAngle = targetGridAngle - parentGlobalRotation;

    setLocalPose(p => {
        const newPose = JSON.parse(JSON.stringify(p));
        const parts = controlledJoint.split('.');
        if (parts.length === 2) {
            const [side, jointName] = parts as ['left' | 'right', string];
            (newPose[side] as any)[jointName] = finalLocalAngle;
        } else {
            (newPose as any)[controlledJoint] = finalLocalAngle;
        }
        return newPose;
    });
  };
  
  const handleMouseMove = (e: React.MouseEvent) => { 
    if (!draggedPartKey) return;
    const skeleton = computeSkeleton(localPose);
    const pos = getMousePos(e);
    const snappedPos = { x: Math.round(pos.x / GRID_SNAP) * GRID_SNAP, y: Math.round(pos.y / GRID_SNAP) * GRID_SNAP };
    
    switch(dragModeRef.current) {
        case 'ik':
            handleIk(skeleton, snappedPos, e.altKey || e.metaKey);
            break;
        case 'grounded_ik':
            handleGroundedIk(pos);
            break;
        case 'full_body_ik':
            handleFullBodyIk(pos);
            break;
        case 'rotate':
            handleRotate(skeleton, snappedPos, e.ctrlKey);
            break;
        case 'aim':
            handleAim(pos);
            break;
    }
  };

  const handleMouseUp = () => {
    if (dragModeRef.current) {
      let finalPose = localPose;

      // If the action was a rotation, normalize the angle to the shortest path before committing.
      if (dragModeRef.current === 'rotate' && controlledJointRef.current) {
        const jointToNormalize = controlledJointRef.current;
        const parts = jointToNormalize.split('.');
        
        const normalizedPose = JSON.parse(JSON.stringify(localPose));

        const normalizeAngle = (angle: number): number => {
          let newAngle = angle % (2 * Math.PI);
          if (newAngle > Math.PI) {
            newAngle -= 2 * Math.PI;
          } else if (newAngle < -Math.PI) {
            newAngle += 2 * Math.PI;
          }
          return newAngle;
        };

        if (parts.length === 2) {
          // FIX: The original type `keyof PoseData['left']` seemed to confuse the compiler,
          // leading to a strange "not callable" error on `normalizeAngle`. Using `string` for the
          // joint name is safer here, especially since property access below uses `as any` anyway.
          const [side, jointName] = parts as ['left' | 'right', string];
          const currentAngle = (normalizedPose[side] as any)[jointName];
          (normalizedPose[side] as any)[jointName] = normalizeAngle(currentAngle);
        } else {
          const jointName = jointToNormalize as keyof PoseData;
          if (typeof (normalizedPose as any)[jointName] === 'number') {
            const currentAngle = (normalizedPose as any)[jointName];
            (normalizedPose as any)[jointName] = normalizeAngle(currentAngle);
          }
        }
        
        finalPose = normalizedPose;
        setLocalPose(finalPose);
      }
      
      onPoseCommit(finalPose);
    }

    // Reset all drag-related state
    setDraggedPartKey(null);
    setActivePivot(null);
    dragModeRef.current = null;
    controlledJointRef.current = null;
    initialPoseRef.current = null;
    setPinnedPoints(null);
    pinnedPointsRef.current = null;
    ikDriverKeyRef.current = null;
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isInteractionDisabled) return;

    const skeleton = computeSkeleton(localPose);
    const pos = getMousePos(e);
    let finalClickedKey: string | null = null;
    let minDistance = Infinity;

    const pinnableJoints = ['head', 'left.hand', 'right.hand', 'left.foot', 'right.foot'];

    Object.entries(skeleton.joints).forEach(([key, jointPos]) => {
        if (!pinnableJoints.includes(key)) return;

        const dist = Math.hypot(pos.x - jointPos.x, pos.y - jointPos.y);
        if (dist < 15 && dist < minDistance) { // 15px click radius
            minDistance = dist;
            finalClickedKey = key;
        }
    });

    if (finalClickedKey) {
        const key = finalClickedKey;
        setUserPins(prevPins => {
            const newPins = { ...prevPins };
            if (newPins[key]) {
                delete newPins[key];
            } else {
                newPins[key] = skeleton.joints[key];
            }
            return newPins;
        });
    }
  };

  return (
    <div ref={wrapperRef} className={`flex-1 flex items-center justify-center relative w-full h-full ${isInteractionDisabled ? 'cursor-default' : 'cursor-crosshair'}`} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onDoubleClick={handleDoubleClick}>
      <canvas 
        ref={canvasRef} 
        className="block shadow-2xl rounded-sm" 
        style={{ 
          boxShadow: '0 0 50px rgba(0,0,0,0.2)',
          transform: `scale(${scale})`,
          transformOrigin: 'center'
        }} 
        width={W} 
        height={H} 
      />
    </div>
  );
});
