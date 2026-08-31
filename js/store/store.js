/**
 * Mini store: single state tree + slice-level subscriptions
 * The reducer returns { state, changed: string[] }; only subscribers of affected slices are notified
 */

export function createStore(reducer, initialState) {
  let state = initialState;
  const listeners = new Map(); // sliceKey -> Set<fn>

  return {
    getState: () => state,

    dispatch(action) {
      const result = reducer(state, action);
      if (!result.changed.length) return;
      state = result.state;
      for (const key of result.changed) {
        const set = listeners.get(key);
        if (set) for (const fn of set) fn(state[key], state);
      }
      const any = listeners.get('*');
      if (any) for (const fn of any) fn(state, action);
    },

    /** Subscribe to slice changes; returns an unsubscribe function */
    subscribe(sliceKey, fn) {
      if (!listeners.has(sliceKey)) listeners.set(sliceKey, new Set());
      listeners.get(sliceKey).add(fn);
      return () => listeners.get(sliceKey).delete(fn);
    },
  };
}
