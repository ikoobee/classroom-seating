/**
 * 迷你 store：单一状态树 + 切片级订阅
 * reducer 返回 { state, changed: string[] }，仅通知受影响切片的订阅者
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

    /** 订阅切片变化，返回取消函数 */
    subscribe(sliceKey, fn) {
      if (!listeners.has(sliceKey)) listeners.set(sliceKey, new Set());
      listeners.get(sliceKey).add(fn);
      return () => listeners.get(sliceKey).delete(fn);
    },
  };
}
