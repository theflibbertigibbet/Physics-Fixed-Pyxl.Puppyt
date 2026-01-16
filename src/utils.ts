import type { PoseData } from './core/types';
import { computeSkeleton, W, H } from './core/kinematics';

/**
 * Constrains a given pose so that its entire skeleton fits within the canvas boundaries.
 * It calculates the skeleton's bounding box and adjusts the pose's root offset accordingly.
 * @param pose - The input PoseData.
 * @returns A new PoseData object with the corrected offset.
 */
export const constrainPoseToBounds = (pose: PoseData): PoseData => {
    const skeleton = computeSkeleton(pose);
    if (skeleton.bones.length === 0) {
        return pose;
    }

    let minX = W, minY = H, maxX = 0, maxY = 0;
    
    skeleton.bones.forEach(b => {
        minX = Math.min(minX, b.start.x, b.end.x);
        maxX = Math.max(maxX, b.start.x, b.end.x);
        minY = Math.min(minY, b.start.y, b.end.y);
        maxY = Math.max(maxY, b.start.y, b.end.y);
    });

    const newOffset = { ...pose.offset };
    
    const padding = 20; // Add a small padding from the edge

    if (minX < padding) newOffset.x -= (minX - padding);
    if (maxX > W - padding) newOffset.x -= (maxX - (W - padding));
    if (minY < padding) newOffset.y -= (minY - padding);
    if (maxY > H - padding) newOffset.y -= (maxY - (H - padding));
    
    return { ...pose, offset: newOffset };
};