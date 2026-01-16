
import type { Point, PoseData, PhysicsBody, PhysicsParticle, Skeleton, PhysicsConstraint } from './types';
import { computeSkeleton, hierarchy, W, H, BASE_ANGLES } from './kinematics';

// --- Simulation Constants ---
const FRICTION = 0.96; // Higher friction dissipates energy faster for a definitive "plop".
const SOLVER_ITERATIONS = 15; // Increased for more stability
const GRAVITY = { x: 0, y: 2500 }; // High-gravity constant for a "ballistic" plop effect.
const STIFFNESS = 0.75; // Higher stiffness with more iterations reduces elasticity and jiggle.

/**
 * Calculates the shortest difference between two angles.
 * This prevents "flipping" when an angle crosses the -PI/PI boundary.
 */
const shortestAngleDiff = (from: number, to: number): number => {
    let diff = to - from;
    if (diff > Math.PI) {
        diff -= 2 * Math.PI;
    } else if (diff < -Math.PI) {
        diff += 2 * Math.PI;
    }
    return diff;
};

/**
 * Creates a physics body (particles and constraints) from a static pose.
 */
export function createPhysicsBodyFromPose(pose: PoseData): PhysicsBody {
    const skeleton = computeSkeleton(pose);
    const particles: PhysicsParticle[] = [];
    const constraints: PhysicsConstraint[] = [];
    const particleMap = new Map<string, number>();

    // Create particles from joints
    Object.entries(skeleton.joints).forEach(([key, point]) => {
        const particle: PhysicsParticle = {
            id: key,
            pos: { ...point },
            prevPos: { ...point },
            mass: 1.0,
        };
        // Mass distribution based on material spec
        if (key === 'root' || key === 'torso' || key.includes('hip') || key.includes('shoulder')) {
            particle.mass = 3.0; // Primary Mass
        } else if (key === 'waist' || key === 'head' || key === 'neck') {
            particle.mass = 1.5; // Pivots
        } else {
            particle.mass = 0.5; // End Effectors
        }
        particleMap.set(key, particles.length);
        particles.push(particle);
    });

    // Create constraints by walking the defined hierarchy
    Object.keys(hierarchy).forEach(parentKey => {
        const parentIndex = particleMap.get(parentKey);
        if (parentIndex === undefined) return;
        const parentParticle = particles[parentIndex];

        hierarchy[parentKey].children.forEach(childKey => {
            const childIndex = particleMap.get(childKey);
            if(childIndex === undefined) return;
            const childParticle = particles[childIndex];
            
            const restLength = Math.hypot(childParticle.pos.x - parentParticle.pos.x, childParticle.pos.y - parentParticle.pos.y);
            if (restLength > 0.1) {
                constraints.push({ particleAIndex: parentIndex, particleBIndex: childIndex, restLength });
            }
        });
    });

    return { particles, constraints, particleMap };
}

/**
 * Runs one step of the physics simulation.
 */
export function updatePhysicsBody(body: PhysicsBody, dt: number): void {
    const dtSq = dt * dt;

    // 1. Apply forces (gravity, friction) and integrate
    body.particles.forEach((p) => {
        if (p.mass === 0) return;

        const velocity = { x: (p.pos.x - p.prevPos.x) * FRICTION, y: (p.pos.y - p.prevPos.y) * FRICTION };
        p.prevPos = { ...p.pos };

        const accel = { x: GRAVITY.x, y: GRAVITY.y };

        p.pos.x += velocity.x + accel.x * dtSq;
        p.pos.y += velocity.y + accel.y * dtSq;
    });

    // 2. Solve constraints
    for (let i = 0; i < SOLVER_ITERATIONS; i++) {
        body.constraints.forEach(c => {
            const pA = body.particles[c.particleAIndex];
            const pB = body.particles[c.particleBIndex];
            const delta = { x: pB.pos.x - pA.pos.x, y: pB.pos.y - pA.pos.y };
            const dist = Math.hypot(delta.x, delta.y);
            if (dist < 0.001) return;
            
            const diff = (dist - c.restLength) / dist;
            const totalMass = pA.mass + pB.mass;
            if (totalMass === 0) return;
            
            const pAShare = pA.mass > 0 ? pA.mass / totalMass : 1;
            const pBShare = pB.mass > 0 ? pB.mass / totalMass : 1;

            const correctionX = delta.x * diff * STIFFNESS;
            const correctionY = delta.y * diff * STIFFNESS;

            pA.pos.x += correctionX * pBShare;
            pA.pos.y += correctionY * pBShare;
            pB.pos.x -= correctionX * pAShare;
            pB.pos.y -= correctionY * pAShare;
        });
    }

    // 3. Handle collisions with canvas boundaries (Impact Logic)
    const PARTICLE_RADIUS = 5;
    const bounds = {
        top: PARTICLE_RADIUS,
        bottom: H - PARTICLE_RADIUS,
        left: PARTICLE_RADIUS,
        right: W - PARTICLE_RADIUS,
    };
    const impactFalloutFactor = 0.15; // How much vertical momentum transfers to horizontal

    body.particles.forEach(p => {
        const vy = p.pos.y - p.prevPos.y; // Vertical velocity before correction

        // Y-Axis Landing (Floor)
        if (p.pos.y > bounds.bottom) {
            p.pos.y = bounds.bottom; // Locked to bottom visible pixel
            
            // The "Thud": Nullify vertical velocity
            p.prevPos.y = p.pos.y;

            // Impact Fallout: Small horizontal slide based on Y-momentum
            // This transfers a portion of the vertical velocity into the horizontal
            // velocity by adjusting the previous x position.
            p.prevPos.x -= vy * impactFalloutFactor;
        }
        
        // Y-Axis Ceiling
        if (p.pos.y < bounds.top) {
            p.pos.y = bounds.top;
            p.prevPos.y = p.pos.y; // Nullify vertical velocity
        }

        // X-Axis Containment (Side Walls)
        if (p.pos.x > bounds.right) {
            p.pos.x = bounds.right;
            p.prevPos.x = p.pos.x; // Nullify horizontal velocity
        }
        if (p.pos.x < bounds.left) {
            p.pos.x = bounds.left;
            p.prevPos.x = p.pos.x; // Nullify horizontal velocity
        }
    });
}


/**
 * Converts the physics body's particle positions back into a continuous PoseData object.
 */
export function extractPoseFromPhysicsBody(body: PhysicsBody, previousPose: PoseData): PoseData {
    const newPose: PoseData = JSON.parse(JSON.stringify(previousPose));
    const worldAngles: { [key: string]: number } = {};

    const getParticlePos = (key: string): Point | undefined => {
        const index = body.particleMap.get(key);
        return index !== undefined ? body.particles[index].pos : undefined;
    };
    
    const getPrevPoseAngle = (key: string): number => {
        const parts = key.split('.');
        if (parts.length === 2) return (previousPose as any)[parts[0]][parts[1]] ?? 0;
        return (previousPose as any)[key] ?? 0;
    };
    
    const calculateAngles = (parentKey: string, parentWorldAngle: number) => {
        hierarchy[parentKey].children.forEach(childKey => {
            const parentPos = getParticlePos(parentKey);
            const childPos = getParticlePos(childKey);

            if (parentPos && childPos) {
                const dx = childPos.x - parentPos.x;
                const dy = childPos.y - parentPos.y;
                const childWorldAngle = Math.atan2(dy, dx);
                
                const rawLocalAngle = childWorldAngle - parentWorldAngle - (BASE_ANGLES[childKey] || 0);
                const previousLocalAngle = getPrevPoseAngle(childKey);
                const finalLocalAngle = previousLocalAngle + shortestAngleDiff(previousLocalAngle, rawLocalAngle);

                const finalChildWorldAngle = parentWorldAngle + (BASE_ANGLES[childKey] || 0) + finalLocalAngle;
                worldAngles[childKey] = finalChildWorldAngle;

                const parts = childKey.split('.');
                if (parts.length === 2) {
                    (newPose as any)[parts[0]][parts[1]] = finalLocalAngle;
                } else {
                    (newPose as any)[childKey] = finalLocalAngle;
                }
                
                calculateAngles(childKey, finalChildWorldAngle);
            }
        });
    };

    const rootPos = getParticlePos('root');
    const torsoPos = getParticlePos('torso');
    const waistPos = getParticlePos('waist');
    
    if (rootPos && torsoPos && waistPos) {
        const torsoWorldAngle = Math.atan2(torsoPos.y - rootPos.y, torsoPos.x - rootPos.x);
        const waistWorldAngle = Math.atan2(waistPos.y - rootPos.y, waistPos.x - rootPos.x);
        
        const rawTorsoAngle = torsoWorldAngle - (BASE_ANGLES['torso'] || 0);
        newPose.torso = previousPose.torso + shortestAngleDiff(previousPose.torso, rawTorsoAngle);

        const rawWaistAngle = waistWorldAngle - (BASE_ANGLES['waist'] || 0);
        newPose.waist = previousPose.waist + shortestAngleDiff(previousPose.waist, rawWaistAngle);

        newPose.offset.x = rootPos.x - W / 2;
        newPose.offset.y = rootPos.y - H / 2;
        
        const finalTorsoWorldAngle = (BASE_ANGLES['torso'] || 0) + newPose.torso;
        const finalWaistWorldAngle = (BASE_ANGLES['waist'] || 0) + newPose.waist;
        
        calculateAngles('torso', finalTorsoWorldAngle);
        calculateAngles('waist', finalWaistWorldAngle);
    }
    
    return newPose;
}
