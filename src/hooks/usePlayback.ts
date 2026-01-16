import { useState, useEffect, useRef } from 'react';
import type { PoseData } from '../core/types';
import { interpolatePoses } from '../core/interpolation';

interface PlaybackOptions {
    keyframes: PoseData[];
    isPlaying: boolean;
    startFrame: number; // The frame to begin playback from
    fps?: number;
}

export function usePlayback({ keyframes, isPlaying, startFrame, fps = 2 }: PlaybackOptions): PoseData {
    const [interpolatedPose, setInterpolatedPose] = useState<PoseData>(keyframes[startFrame] || keyframes[0]);
    // FIX: Explicitly pass undefined to useRef to satisfy stricter TypeScript checks or linters.
    const animationFrameId = useRef<number | undefined>(undefined);
    const startTimeRef = useRef<number>(0);
    const startFrameRef = useRef<number>(0);

    // Effect to reset pose when not playing or when startFrame changes
    useEffect(() => {
        if (!isPlaying) {
            setInterpolatedPose(keyframes[startFrame] || keyframes[0]);
        }
    }, [isPlaying, startFrame, keyframes]);

    useEffect(() => {
        if (isPlaying && keyframes.length > 1) {
            startFrameRef.current = startFrame;
            startTimeRef.current = performance.now();
            
            const animate = (time: number) => {
                const elapsedTime = (time - startTimeRef.current) / 1000;
                const frameDuration = 1 / fps;
                
                const numKeyframes = keyframes.length;
                
                // Ping-pong logic: For N keyframes, there are N-1 segments forward and N-1 segments back.
                const numSegments = 2 * (numKeyframes - 1);
                if (numSegments <= 0) return;
                
                const totalDuration = numSegments * frameDuration;

                // Map the startFrame to a start time offset in the ping-pong timeline.
                const startTimeOffset = startFrameRef.current * frameDuration;
                const timelineTime = (elapsedTime + startTimeOffset) % totalDuration;
                
                const currentSegmentFloat = timelineTime / frameDuration;
                const segmentIndex = Math.floor(currentSegmentFloat);
                
                const t = currentSegmentFloat - segmentIndex;

                let fromIndex: number;
                let toIndex: number;

                if (segmentIndex < numKeyframes - 1) {
                    // Forward direction: 0 -> 1, 1 -> 2, ...
                    fromIndex = segmentIndex;
                    toIndex = segmentIndex + 1;
                } else {
                    // Backward direction: C -> B, B -> A
                    fromIndex = numSegments - segmentIndex;
                    toIndex = fromIndex - 1;
                }
                
                const fromPose = keyframes[fromIndex];
                const toPose = keyframes[toIndex];
                
                if (fromPose && toPose) {
                    setInterpolatedPose(interpolatePoses(fromPose, toPose, t));
                }

                animationFrameId.current = requestAnimationFrame(animate);
            };
            
            animationFrameId.current = requestAnimationFrame(animate);
        }

        return () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
        };
    }, [isPlaying, keyframes, startFrame, fps]);

    return interpolatedPose;
}