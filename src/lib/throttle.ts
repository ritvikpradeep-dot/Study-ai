// Trailing-edge throttle: calls at most once per `ms`, always eventually
// firing with the latest args even if calls keep arriving faster than `ms`.
export function throttle<Args extends unknown[]>(fn: (...args: Args) => void, ms: number) {
  let lastCall = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Args | null = null;

  return (...args: Args) => {
    lastArgs = args;
    const now = Date.now();
    const remaining = ms - (now - lastCall);
    if (remaining <= 0) {
      lastCall = now;
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        lastCall = Date.now();
        if (lastArgs) fn(...lastArgs);
      }, remaining);
    }
  };
}
