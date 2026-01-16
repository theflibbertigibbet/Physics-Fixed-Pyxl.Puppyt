// Data-only representation of a character's pose.
// All values are in radians.
export type PoseData = {
  offset: { x: number; y: number };
  torso: number;
  waist: number;
  head: number;
  left: {
    shoulder: number;
    elbow: number;
    hand: number;
    hip: number;
    knee: number;
    foot: number;
  };
  right: {
    shoulder: number;
    elbow: number;
    hand: number;
    hip: number;
    knee: number;
    foot: number;
  };
};

// --- Computed Types for Rendering ---

export type Point = {
    x: number;
    y: number;
};

export type BoneSegment = {
    key: string;
    start: Point; // The pivot point for custom shapes
    end: Point;   // The end point, used for length and hit-detection
    width: number; // Used for hit-detection and asset binding
    angle: number; // The world-space angle for rendering
    shape: 'line' | 'polygon' | 'curve' | 'circle' | 'custom';
    vertices?: Point[];
};

export type Skeleton = {
    joints: { [key: string]: Point };
    bones: BoneSegment[];
};

// --- Physics Engine Types ---

export type PhysicsParticle = {
  id: string;
  pos: Point;
  prevPos: Point;
  mass: number;
};

export type PhysicsConstraint = {
  particleAIndex: number;
  particleBIndex: number;
  restLength: number;
};

export type PhysicsBody = {
  particles: PhysicsParticle[];
  constraints: PhysicsConstraint[];
  particleMap: Map<string, number>;
};

// The new interactive object for physics mode
export type TargetObject = {
  pos: Point;
  prevPos: Point;
  radius: number;
};