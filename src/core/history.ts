// A generic, immutable history state manager.

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

export function getInitialHistory<T>(initialState: T): History<T> {
  return {
    past: [],
    present: initialState,
    future: [],
  };
}

export function pushHistory<T>(history: History<T>, newState: T): History<T> {
  // Deep compare to prevent pushing identical states. This is important
  // for atomic commits where the final state might not have changed.
  if (JSON.stringify(newState) === JSON.stringify(history.present)) {
    return history;
  }
  return {
    past: [...history.past, history.present],
    present: newState,
    future: [], // Clear the future when a new action is taken
  };
}

export function undoHistory<T>(history: History<T>): History<T> {
  if (history.past.length === 0) {
    return history;
  }
  const previous = history.past[history.past.length - 1];
  const newPast = history.past.slice(0, history.past.length - 1);
  return {
    past: newPast,
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redoHistory<T>(history: History<T>): History<T> {
  if (history.future.length === 0) {
    return history;
  }
  const next = history.future[0];
  const newFuture = history.future.slice(1);
  return {
    past: [...history.past, history.present],
    present: next,
    future: newFuture,
  };
}
