
import React, { useState, useRef } from 'react';
import { Canvas, type CanvasHandle } from './view/Canvas';
import { ControlPanel } from './view/ControlPanel';
import type { PoseData } from './core/types';
import { 
  getDefaultPose
} from './core/kinematics';
import { useHistory } from './hooks/useHistory';
import { usePlayback } from './hooks/usePlayback';
import { usePhysics } from './hooks/usePhysics';

// The state managed by useHistory will now be the entire timeline structure.
interface TimelineState {
  keyframes: PoseData[];
  currentFrame: number;
}

export function App() {
  const { 
    state: timelineState, 
    setState: setTimelineState, 
    undo, 
    redo, 
    canUndo, 
    canRedo 
  } = useHistory<TimelineState>({ 
    keyframes: [
      getDefaultPose()
    ], 
    currentFrame: 0 
  });

  const [selectedPartKey, setSelectedPartKey] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false); // Playback state
  const [isPhysicsEnabled, setIsPhysicsEnabled] = useState(false); // Physics state
  const [uiPosition, setUiPosition] = useState<'left' | 'right'>('left');
  const canvasRef = useRef<CanvasHandle>(null);
  
  const currentPose = timelineState.keyframes[timelineState.currentFrame];

  const handlePoseCommit = (newPose: PoseData) => {
    // We are updating the pose for the current keyframe.
    const newKeyframes = [...timelineState.keyframes];
    newKeyframes[timelineState.currentFrame] = newPose;
    setTimelineState({ ...timelineState, keyframes: newKeyframes });
  };

  const handleSelectPart = (key: string) => {
    setSelectedPartKey(key);
  };
  
  const handleReset = () => {
    setIsPhysicsEnabled(false);
    handlePoseCommit(getDefaultPose());
  };

  const handleTogglePhysics = () => {
    if (!isPhysicsEnabled) {
      // Start physics from the current pose.
      setIsPhysicsEnabled(true);
      // And ensure playback is stopped.
      setIsPlaying(false);
    } else {
      // Just turn it off.
      setIsPhysicsEnabled(false);
    }
  };

  // --- Timeline Handlers ---
  const handleSelectFrame = (index: number) => {
    setIsPhysicsEnabled(false);
    setIsPlaying(false);
    setTimelineState({ ...timelineState, currentFrame: index });
  };

  const handleAddFrame = () => {
    setIsPhysicsEnabled(false);
    setIsPlaying(false);
    const newKeyframes = [...timelineState.keyframes];
    newKeyframes.splice(timelineState.currentFrame + 1, 0, timelineState.keyframes[timelineState.currentFrame]);
    setTimelineState({
      keyframes: newKeyframes,
      currentFrame: timelineState.currentFrame + 1
    });
  };
  
  const handleDeleteFrame = () => {
    if (timelineState.keyframes.length <= 1) return;
    setIsPhysicsEnabled(false);
    setIsPlaying(false);
    const newKeyframes = [...timelineState.keyframes];
    newKeyframes.splice(timelineState.currentFrame, 1);
    const newCurrentFrame = Math.min(timelineState.currentFrame, newKeyframes.length - 1);
    setTimelineState({
      keyframes: newKeyframes,
      currentFrame: newCurrentFrame
    });
  };

  const handleTogglePlay = () => {
    if (isPhysicsEnabled) setIsPhysicsEnabled(false);
    if (timelineState.keyframes.length > 1) {
      setIsPlaying(p => !p);
    }
  };
  
  const handleToggleUiPosition = () => {
    setUiPosition(pos => pos === 'left' ? 'right' : 'left');
  };
  
  // --- Pose Computation ---
  const animatedPose = usePlayback({
    keyframes: timelineState.keyframes,
    isPlaying,
    startFrame: timelineState.currentFrame
  });
  
  const poseForAnimateOrSelect = isPlaying ? animatedPose : currentPose;
  
  const { pose: physicalPose } = usePhysics({
    targetPose: poseForAnimateOrSelect,
    isEnabled: isPhysicsEnabled,
  });

  const poseForCanvas = isPhysicsEnabled ? physicalPose : poseForAnimateOrSelect;

  return (
    <div 
      className={`flex h-screen w-screen bg-[#F4F1DE] overflow-hidden font-sans select-none ${uiPosition === 'left' ? 'flex-row' : 'flex-row-reverse'}`}
      onMouseDown={() => { if (showSplash) setShowSplash(false); }}
    >
      <ControlPanel 
        onUndo={undo} 
        onRedo={redo} 
        canUndo={canUndo} 
        canRedo={canRedo}
        onReset={handleReset}
        onTogglePhysics={handleTogglePhysics}
        isPhysicsEnabled={isPhysicsEnabled}
        keyframesCount={timelineState.keyframes.length}
        currentFrame={timelineState.currentFrame}
        onSelectFrame={handleSelectFrame}
        onAddFrame={handleAddFrame}
        onDeleteFrame={handleDeleteFrame}
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        uiPosition={uiPosition}
        onToggleUiPosition={handleToggleUiPosition}
      />
      <div className="flex-1 flex items-center justify-center relative">
        {showSplash && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <h1 className="text-8xl font-semibold text-[rgba(61,43,86,0.15)] select-none">
              Pyxl.Puppt
            </h1>
          </div>
        )}

        <Canvas 
          ref={canvasRef}
          pose={poseForCanvas} 
          onPoseCommit={handlePoseCommit} 
          selectedPartKey={selectedPartKey}
          onSelectPart={handleSelectPart}
          onDeselect={() => setSelectedPartKey(null)}
          isInteractionDisabled={isPhysicsEnabled}
        />
      </div>
    </div>
  );
}
