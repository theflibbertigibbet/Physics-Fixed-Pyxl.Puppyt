import { useState, useEffect, useRef, useCallback } from 'react';
import type { PoseData, PhysicsBody } from '../core/types';
import { createPhysicsBodyFromPose, updatePhysicsBody, extractPoseFromPhysicsBody } from '../core/physics';

interface PhysicsOptions {
  targetPose: PoseData;
  isEnabled: boolean;
}

export function usePhysics({ targetPose, isEnabled }: PhysicsOptions): { pose: PoseData } {
    const [physicalPose, setPhysicalPose] = useState<PoseData>(targetPose);
    const physicsBodyRef = useRef<PhysicsBody | null>(null);
    // FIX: Explicitly pass undefined to useRef to satisfy stricter TypeScript checks or linters.
    const animationFrameId = useRef<number | undefined>(undefined);
    // FIX: Explicitly pass undefined to useRef to satisfy stricter TypeScript checks or linters.
    const lastTimeRef = useRef<number | undefined>(undefined);
    const latestPoseRef = useRef<PoseData>(targetPose);

    useEffect(() => {
        // This effect ensures that when physics is turned OFF, or when the timeline changes
        // while physics is off, the component displays the correct static pose.
        if (!isEnabled) {
            setPhysicalPose(targetPose);
        }
        // We also update the ref here so that if physics is toggled ON,
        // it starts from the correct, most recent pose.
        latestPoseRef.current = targetPose;
    }, [targetPose, isEnabled]);

    const animate = useCallback(() => {
        if (!physicsBodyRef.current) { return; } // Should not happen if animate is running
        
        const time = performance.now();
        const lastTime = lastTimeRef.current ?? time;
        const dt = (time - lastTime) / 1000;
        lastTimeRef.current = time;

        if (dt > 0) {
            updatePhysicsBody(physicsBodyRef.current, Math.min(dt, 1/30));
            // Pass the LATEST known pose (could be the one from the last frame) to avoid stale closures
            const newAnimatedPose = extractPoseFromPhysicsBody(physicsBodyRef.current, latestPoseRef.current);
            latestPoseRef.current = newAnimatedPose; // Update ref for next frame
            setPhysicalPose(newAnimatedPose);
        }
        
        animationFrameId.current = requestAnimationFrame(animate);
    }, []);

    useEffect(() => {
        if (isEnabled) {
            lastTimeRef.current = performance.now();
            // When physics is enabled, create the body from the *current* pose
            // which is held in latestPoseRef. This ensures a smooth transition.
            physicsBodyRef.current = createPhysicsBodyFromPose(latestPoseRef.current);
            animationFrameId.current = requestAnimationFrame(animate);
        } else {
            if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
            animationFrameId.current = undefined;
            lastTimeRef.current = undefined;
            physicsBodyRef.current = null;
        }
        return () => { if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current); };
    }, [isEnabled, animate]);

    // The state `physicalPose` holds the simulation result if enabled,
    // or the passed-in `targetPose` if disabled (set by the other useEffect).
    return { pose: physicalPose };
}