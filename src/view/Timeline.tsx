import React from 'react';

// Some simple icons
const PlayIcon = () => ( <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 5V19L19 12L8 5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> );
const PauseIcon = () => ( <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 19H10V5H6V19ZM14 5V19H18V5H14Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> );
const AddIcon = () => ( <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> );
const DeleteIcon = () => ( <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 7H20M10 11V17M14 11V17M5 7L6 19C6 20.1046 6.89543 21 8 21H16C17.1046 21 18 20.1046 18 19L19 7M9 7V4C9 3.44772 9.44772 3 10 3H14C14.5523 3 15 3.44772 15 4V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> );

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

export function Timeline({ 
    keyframesCount, 
    currentFrame, 
    onSelectFrame, 
    onAddFrame, 
    onDeleteFrame,
    isPlaying,
    onTogglePlay,
    isPhysicsEnabled
}: TimelineProps) {
    const buttonClass = "p-2 rounded-md transition-colors text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed";

    return (
        <div className="w-full bg-black/20 rounded-xl p-3 flex flex-col gap-3">
            <div className="flex items-center gap-3">
                <button onClick={onTogglePlay} disabled={isPhysicsEnabled} className={`${buttonClass} ${isPlaying ? 'text-red-500' : ''}`} title={isPlaying ? "Pause" : "Play"}>
                    {isPlaying ? <PauseIcon /> : <PlayIcon />}
                </button>
                <button onClick={onAddFrame} disabled={isPhysicsEnabled} className={buttonClass} title="Add Keyframe">
                    <AddIcon />
                </button>
                <button onClick={onDeleteFrame} disabled={keyframesCount <= 1 || isPhysicsEnabled} className={buttonClass} title="Delete Keyframe">
                    <DeleteIcon />
                </button>
                <div className="text-white/70 text-sm ml-auto tabular-nums">
                    {isPhysicsEnabled ? 'Sim' : `${currentFrame + 1} / ${keyframesCount}`}
                </div>
            </div>
            <div className={`flex-1 bg-black/20 rounded-md p-2 h-16 flex items-center gap-2 overflow-x-auto ${isPhysicsEnabled ? 'opacity-50' : ''}`}>
                {Array.from({ length: keyframesCount }).map((_, index) => (
                    <button
                        key={index}
                        onClick={() => onSelectFrame(index)}
                        disabled={isPhysicsEnabled}
                        className={`w-10 h-10 rounded-md flex-shrink-0 transition-colors ${currentFrame === index && !isPhysicsEnabled ? 'bg-red-500' : 'bg-white/10 hover:bg-white/20'} disabled:hover:bg-white/10`}
                        title={`Go to frame ${index + 1}`}
                    >
                        <span className="text-white text-xs font-semibold">{index + 1}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}