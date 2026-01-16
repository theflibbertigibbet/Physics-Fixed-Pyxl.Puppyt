import type { PoseData } from './types';

// Standard linear interpolation for positions
const lerp = (a: number, b: number, t: number): number => a * (1 - t) + b * t;

// Interpolates angles by taking the shortest path around the circle
const lerpAngle = (a: number, b: number, t: number): number => {
    let delta = b - a;
    if (delta > Math.PI) {
        delta -= 2 * Math.PI;
    } else if (delta < -Math.PI) {
        delta += 2 * Math.PI;
    }
    return a + delta * t;
};

// This can recursively interpolate any nested object of numbers,
// applying the correct interpolation method based on the property.
function interpolateRecursive(a: any, b: any, t: number, path: string): any {
    if (typeof a === 'number' && typeof b === 'number') {
        // Use standard lerp only for offset properties, which are positions.
        // All other numeric properties are angles and need special handling.
        if (path.startsWith('offset.')) {
            return lerp(a, b, t);
        }
        return lerpAngle(a, b, t);
    }
    if (typeof a === 'object' && a !== null && b !== null) {
        const result: { [key:string]: any } = {};
        for (const key in a) {
            if (key in b) {
                // Pass down the property path to know the context
                result[key] = interpolateRecursive(a[key], b[key], t, `${path}${key}.`);
            }
        }
        return result;
    }
    return b; // Fallback for non-interpolatable types
}

export function interpolatePoses(poseA: PoseData, poseB: PoseData, t: number): PoseData {
    return interpolateRecursive(poseA, poseB, t, "") as PoseData;
}