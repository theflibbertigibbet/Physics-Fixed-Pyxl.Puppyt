import { useState, useCallback } from 'react';
import { History, getInitialHistory, pushHistory, undoHistory, redoHistory } from '../core/history';

export type HistoryManager<T> = {
  state: T;
  setState: (newState: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

export function useHistory<T>(initialState: T): HistoryManager<T> {
  const [history, setHistory] = useState<History<T>>(() => getInitialHistory(initialState));

  const setState = useCallback((newState: T) => {
    setHistory(currentHistory => pushHistory(currentHistory, newState));
  }, []);

  const undo = useCallback(() => {
    setHistory(undoHistory);
  }, []);

  const redo = useCallback(() => {
    setHistory(redoHistory);
  }, []);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  return {
    state: history.present,
    setState,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
