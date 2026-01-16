import type { Point } from './types';

const distance = (p1: Point, p2: Point) => Math.hypot(p1.x - p2.x, p1.y - p2.y);

/**
 * Solves a multi-point kinematic chain using the FABRIK algorithm.
 * @param chain - An array of points representing the joints of the chain.
 * @param target - The target point for the end effector.
 * @param iterations - The number of solver iterations.
 * @param tolerance - The distance threshold to stop iterating.
 * @returns A new array of points for the solved chain.
 */
export function solveFabrik(
    chain: Point[], 
    target: Point, 
    iterations: number = 10,
    tolerance: number = 0.1
): Point[] {
    if (chain.length === 0) return [];

    const solvedChain = chain.map(p => ({ ...p }));
    const lengths: number[] = [];
    for (let i = 0; i < solvedChain.length - 1; i++) {
        lengths.push(distance(solvedChain[i], solvedChain[i+1]));
    }
    const totalLength = lengths.reduce((sum, l) => sum + l, 0);
    const root = { ...solvedChain[0] };

    const distToTarget = distance(root, target);

    // If target is out of reach, stretch the chain towards it
    if (distToTarget > totalLength) {
        for (let i = 0; i < solvedChain.length - 1; i++) {
            const r = distance(solvedChain[i], target);
            const lambda = lengths[i] / r;
            solvedChain[i+1] = {
                x: (1 - lambda) * solvedChain[i].x + lambda * target.x,
                y: (1 - lambda) * solvedChain[i].y + lambda * target.y,
            };
        }
    } else {
        // Target is reachable, run FABRIK iterations
        let endEffector = solvedChain[solvedChain.length - 1];
        let iter = 0;

        while(distance(endEffector, target) > tolerance && iter < iterations) {
            // Forward pass (from end-effector to root)
            solvedChain[solvedChain.length - 1] = { ...target };
            for (let i = solvedChain.length - 2; i >= 0; i--) {
                const r = distance(solvedChain[i], solvedChain[i+1]);
                const lambda = lengths[i] / r;
                solvedChain[i] = {
                    x: (1 - lambda) * solvedChain[i+1].x + lambda * solvedChain[i].x,
                    y: (1 - lambda) * solvedChain[i+1].y + lambda * solvedChain[i].y,
                };
            }

            // Backward pass (from root to end-effector)
            solvedChain[0] = { ...root };
            for (let i = 0; i < solvedChain.length - 1; i++) {
                const r = distance(solvedChain[i], solvedChain[i+1]);
                const lambda = lengths[i] / r;
                solvedChain[i+1] = {
                    x: (1 - lambda) * solvedChain[i].x + lambda * solvedChain[i+1].x,
                    y: (1 - lambda) * solvedChain[i].y + lambda * solvedChain[i+1].y,
                };
            }

            endEffector = solvedChain[solvedChain.length - 1];
            iter++;
        }
    }

    return solvedChain;
}
