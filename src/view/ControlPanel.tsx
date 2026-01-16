import React from 'react';
import { Controls } from './Controls';
import { Timeline } from './Timeline';

// Props for Controls
interface ControlsProps {
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onReset: () => void;
  onTogglePhysics: () => void;
  isPhysicsEnabled: boolean;
}

// Props for Timeline
interface TimelineProps {
    keyframesCount: number;
    currentFrame: number;
    onSelectFrame: (index: number) => void;
    onAddFrame: () => void;
    onDeleteFrame: () => void;
    isPlaying: boolean;
    onTogglePlay: () => void;
    isPhysicsEnabled: boolean;
}

interface ControlPanelProps extends ControlsProps, TimelineProps {
    uiPosition: 'left' | 'right';
    onToggleUiPosition: () => void;
}

const LeftArrowIcon = () => ( <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 19L8 12L15 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> );
const RightArrowIcon = () => ( <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 5L16 12L9 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> );

export function ControlPanel(props: ControlPanelProps) {
    const {
        uiPosition,
        onToggleUiPosition,
        // Controls props
        onUndo,
        onRedo,
        canUndo,
        canRedo,
        onReset,
        onTogglePhysics,
        isPhysicsEnabled,
        // Timeline props
        keyframesCount,
        currentFrame,
        onSelectFrame,
        onAddFrame,
        onDeleteFrame,
        isPlaying,
        onTogglePlay
    } = props;

    return (
        <div className={`w-72 bg-[#1a1a1a] text-white/70 p-4 flex flex-col gap-6 border-white/10 ${uiPosition === 'left' ? 'border-r' : 'border-l'}`}>
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold text-white">PYXL.PUPPT</h1>
                <button 
                    onClick={onToggleUiPosition} 
                    className="p-2 rounded-md transition-colors text-white/70 hover:bg-white/10 hover:text-white"
                    title={uiPosition === 'left' ? "Move panel to right" : "Move panel to left"}
                >
                    {uiPosition === 'left' ? <RightArrowIcon /> : <LeftArrowIcon />}
                </button>
            </div>

            <Controls
                onUndo={onUndo}
                onRedo={onRedo}
                canUndo={canUndo}
                canRedo={canRedo}
                onReset={onReset}
                onTogglePhysics={onTogglePhysics}
                isPhysicsEnabled={isPhysicsEnabled}
            />

            <Timeline
                keyframesCount={keyframesCount}
                currentFrame={currentFrame}
                onSelectFrame={onSelectFrame}
                onAddFrame={onAddFrame}
                onDeleteFrame={onDeleteFrame}
                isPlaying={isPlaying}
                onTogglePlay={onTogglePlay}
                isPhysicsEnabled={isPhysicsEnabled}
            />
            
            <div className="mt-auto text-xs text-white/30 text-center">
                <p>&copy; 2024 Pyxl.Puppt</p>
                <p>Minimalist Animation Tool</p>
            </div>
        </div>
    );
}