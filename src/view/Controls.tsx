import React from 'react';

interface ControlsProps {
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onReset: () => void;
  onTogglePhysics: () => void;
  isPhysicsEnabled: boolean;
}

const UndoIcon = () => ( <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 18L5 13M5 13L10 8M5 13H16C18.7614 13 21 15.2386 21 18V20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> );
const RedoIcon = () => ( <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 18L19 13M19 13L14 8M19 13H8C5.23858 13 3 15.2386 3 18V20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> );
const ResetIcon = () => ( <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 10C20 14.4183 16.4183 18 12 18C7.58172 18 4 14.4183 4 10M20 10V5M20 10H15M4 10C4 5.58172 7.58172 2 12 2C16.4183 2 20 5.58172 20 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> );
const FeatherIcon = () => ( <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 12C4 12 4 11.2317 4.5 10.5C5.5 9 7 7 11 7C15 7 18 10 20 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 16C4 16 4 15.2317 4.5 14.5C5.5 13 7 11 11 11C15 11 18 14 20 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 20C4 20 4 19.2317 4.5 18.5C5.5 17 7 15 11 15C15 15 18 18 20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M11 7V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> );


export function Controls({ onUndo, onRedo, canUndo, canRedo, onReset, onTogglePhysics, isPhysicsEnabled }: ControlsProps) {
  const buttonClass = "p-2 rounded-md transition-colors text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed";

  return (
     <div className="bg-black/20 rounded-xl p-2 flex items-center justify-around gap-2 w-full">
      <div className="flex items-center gap-2">
        <button onClick={onUndo} disabled={!canUndo || isPhysicsEnabled} className={buttonClass} title="Undo" aria-label="Undo"><UndoIcon /></button>
        <button onClick={onRedo} disabled={!canRedo || isPhysicsEnabled} className={buttonClass} title="Redo" aria-label="Redo"><RedoIcon /></button>
      </div>

      <div className="w-px h-6 bg-white/10"></div>

       <div className="flex items-center gap-2">
        <button onClick={onReset} className={buttonClass} title="Reset to T-Pose" aria-label="Reset to T-Pose"><ResetIcon /></button>
        <button onClick={onTogglePhysics} className={`${buttonClass} ${isPhysicsEnabled ? 'text-red-500' : ''}`} title="Toggle Ragdoll Physics" aria-label="Toggle Ragdoll Physics"><FeatherIcon/></button>
      </div>
     </div>
  );
}