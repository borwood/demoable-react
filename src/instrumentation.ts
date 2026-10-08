import type { EventHandle, EventInput, EventStore, EventUpdate } from './events';

export interface HandlerReporting<Args extends unknown[], Result> {
  attempt: EventInput | ((...args: Args) => EventInput);
  succeeded?: (result: Awaited<Result>) => EventUpdate;
  failed?: (error: unknown) => EventUpdate;
}

function guarded<T>(operation: () => T): T | undefined {
  try { return operation(); } catch { return undefined; }
}

function settle<T>(event: EventHandle | undefined, outcome: 'complete' | 'fail', value: T, formatter?: (value: T) => EventUpdate) {
  const patch = formatter ? guarded(() => formatter(value)) : undefined;
  guarded(() => event?.[outcome](patch));
}

/** Read then once: hostile accessors/reporters must not change application behavior. */
function observe<Result>(result: Result, event: EventHandle | undefined, reporting: Pick<HandlerReporting<[], Result>, 'succeeded' | 'failed'>) {
  try {
    const then = result !== null && (typeof result === 'object' || typeof result === 'function') ? (result as { then?: unknown }).then : undefined;
    if (typeof then === 'function') {
      // A native observer promise contains throwing/custom thenables. Both
      // settlement callbacks are guarded and never create an unhandled rejection.
      const observed = new Promise<Awaited<Result>>((resolve, reject) => { then.call(result, resolve, reject); });
      void observed.then(
        value => settle(event, 'complete', value, reporting.succeeded),
        error => settle(event, 'fail', error, reporting.failed),
      ).catch(() => {});
    } else settle(event, 'complete', result as Awaited<Result>, reporting.succeeded);
  } catch { /* Reporting cannot safely observe this return value. */ }
}

/** Report an existing promise while returning that exact promise. */
export function trackPromise<T>(store: EventStore, promise: Promise<T>, input: EventInput, reporting: Pick<HandlerReporting<[], T>, 'succeeded' | 'failed'> = {}): Promise<T> {
  const event = guarded(() => store.start({ ...input, state: 'running' }));
  observe<Promise<T>>(promise, event, reporting);
  return promise;
}

/** Preserve the application's function contract, including synchronous returns. */
export function instrumentHandler<This, Args extends unknown[], Result>(store: EventStore, handler: (this: This, ...args: Args) => Result, reporting: HandlerReporting<Args, Result>): (this: This, ...args: Args) => Result {
  return function (this: This, ...args: Args): Result {
    const event = guarded(() => {
      const input = typeof reporting.attempt === 'function' ? reporting.attempt(...args) : reporting.attempt;
      return store.start({ ...input, state: 'running' });
    });
    let result: Result;
    try { result = handler.apply(this, args); }
    catch (error) { guarded(() => settle(event, 'fail', error, reporting.failed)); throw error; }
    guarded(() => observe(result, event, reporting));
    return result;
  };
}
