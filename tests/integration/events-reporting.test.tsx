import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { InspectionProvider, useEvents, useInspection } from '../../src/inspection';
import { instrumentHandler, trackPromise } from '../../src/instrumentation';
import type { EventStore } from '../../src/events';

afterEach(() => { cleanup(); vi.useRealTimers(); });

function mountReporter() {
  let store!: EventStore;
  function Consumer() {
    store = useEvents();
    return <button onClick={instrumentHandler(store, () => 42, { attempt: { label: 'Attempt' } })}>Report action</button>;
  }
  const view = render(<StrictMode><InspectionProvider device="desktop"><Consumer /></InspectionProvider></StrictMode>);
  return { store, ...view };
}

test('a consumer handler reports attempt and result without changing arguments, this, identity or sync timing', () => {
  const { store } = mountReporter();
  const value = { value: 7 };
  const receiver = { amount: 5, invoke: instrumentHandler(store, function (this: { amount: number }, first: number, second: typeof value) {
    expect(first).toBe(3); expect(second).toBe(value); expect(this.amount).toBe(5); return second;
  }, { attempt: (first) => ({ label: `Adding ${first}` }), succeeded: result => ({ content: `Result ${result.value}` }) }) };
  let result: typeof value | undefined;
  act(() => { result = receiver.invoke(3, value); });
  expect(result).toBe(value);
  expect(store.getSnapshot()).toMatchObject([{ label: 'Adding 3', content: 'Result 7', state: 'succeeded' }]);
  fireEvent.click(screen.getByRole('button', { name: 'Report action' }));
  expect(store.getSnapshot()).toHaveLength(2);
});

test('original sync errors escape after failed reporting, even when formatters and subscribers throw', () => {
  const { store } = mountReporter();
  const applicationError = new Error('application');
  const reportingError = new Error('reporting');
  const unsubscribe = store.subscribe(() => { throw reportingError; });
  const handler = instrumentHandler(store, () => { throw applicationError; }, { attempt: { label: 'Failure' }, failed: () => { throw reportingError; } });
  expect(handler).toThrow(applicationError);
  unsubscribe();
  const formatter = instrumentHandler(store, () => { throw applicationError; }, { attempt: () => { throw reportingError; } });
  expect(formatter).toThrow(applicationError);
  const normal = instrumentHandler(store, () => 23, { attempt: () => { throw reportingError; } });
  expect(normal()).toBe(23);
  expect(store.getSnapshot()[0]?.state).toBe('failed');
});

test('concurrent same-label async calls remain running until their own settlement and return original promises', async () => {
  const { store } = mountReporter();
  let resolve!: (value: number) => void, reject!: (error: unknown) => void;
  const first = new Promise<number>(done => { resolve = done; });
  const second = new Promise<number>((_, fail) => { reject = fail; });
  const handler = instrumentHandler(store, (promise: Promise<number>) => promise, { attempt: { label: 'Work' }, succeeded: value => ({ content: `Done ${value}` }), failed: () => ({ content: 'Could not finish' }) });
  expect(handler(first)).toBe(first); expect(handler(second)).toBe(second);
  const ids = store.getSnapshot().map(event => event.id);
  expect(new Set(ids).size).toBe(2);
  expect(store.getSnapshot().map(event => event.state)).toEqual(['running', 'running']);
  await act(async () => { resolve(19); expect(await first).toBe(19); });
  expect(store.getSnapshot().map(event => event.state)).toEqual(['running', 'succeeded']);
  const error = new Error('no');
  await act(async () => { reject(error); await expect(second).rejects.toBe(error); });
  expect(store.getSnapshot().map(event => event.id)).toEqual(ids);
  expect(store.getSnapshot().map(event => event.state)).toEqual(['failed', 'succeeded']);
});

test('promise helper preserves values and errors when success/failure formatting fails', async () => {
  const { store } = mountReporter();
  const value = { response: true }; const error = new Error('promise rejected');
  const succeeded = Promise.resolve(value); const failed = Promise.reject(error);
  expect(trackPromise(store, succeeded, { label: 'Success' }, { succeeded: () => { throw Error('formatter'); } })).toBe(succeeded);
  expect(trackPromise(store, failed, { label: 'Failure' }, { failed: () => { throw Error('formatter'); } })).toBe(failed);
  await act(async () => { await expect(succeeded).resolves.toBe(value); await expect(failed).rejects.toBe(error); });
  expect(store.getSnapshot().map(event => event.state)).toEqual(['failed', 'succeeded']);
});

test('arbitrary thrown sentinels and hostile return-value then getters preserve application behavior', () => {
  const { store } = mountReporter();
  const sentinel = { application: 'original failure' };
  const throwing = instrumentHandler(store, () => { throw sentinel; }, { attempt: { label: 'Sentinel' }, failed: () => { throw Error('reporting'); } });
  try { throwing(); expect.fail('Expected original throw'); } catch (error) { expect(error).toBe(sentinel); }
  const value = Object.defineProperty({ answer: 42 }, 'then', { get() { throw Error('hostile getter'); } });
  const returns = instrumentHandler(store, () => value, { attempt: { label: 'Hostile return' } });
  expect(returns()).toBe(value);
  const brokenStore = { ...store, start: () => { throw Error('report start'); } };
  expect(instrumentHandler(brokenStore, () => 9, { attempt: { label: 'Broken reporter' } })()).toBe(9);
  const errors = instrumentHandler(brokenStore, () => { throw sentinel; }, { attempt: { label: 'Broken reporter' } });
  try { errors(); expect.fail('Expected original throw'); } catch (error) { expect(error).toBe(sentinel); }
});

test('bubbling and preventDefault remain application-controlled', () => {
  let store!: EventStore; const parent = vi.fn(); const value = vi.fn();
  function Form() {
    store = useEvents();
    return <div onClick={parent}><button onClick={instrumentHandler(store, (event: React.MouseEvent) => { event.preventDefault(); value(event.defaultPrevented); }, { attempt: { label: 'Click' } })}>Preserve click</button></div>;
  }
  render(<InspectionProvider><Form /></InspectionProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Preserve click' }));
  expect(parent).toHaveBeenCalledOnce(); expect(value).toHaveBeenCalledWith(true);
  expect(store.getSnapshot()[0]?.state).toBe('succeeded');
});

test('provider retains hidden updates and deadlines, isolates siblings, and disposes after StrictMode replay', async () => {
  vi.useFakeTimers();
  const stores: EventStore[] = [];
  function Consumer({ index }: { index: number }) { stores[index] = useEvents(); const controls = useInspection(); return <button onClick={() => controls.setEventInspection(false)}>Hide {index}</button>; }
  const view = render(<StrictMode><InspectionProvider device="desktop"><Consumer index={0} /></InspectionProvider><InspectionProvider device="mobile"><Consumer index={1} /></InspectionProvider></StrictMode>);
  let handle!: ReturnType<EventStore['start']>;
  act(() => { handle = stores[0].start({ label: 'Hidden', lifetime: { type: 'timed', durationMs: 317, fadeOutMs: 23 } }); });
  fireEvent.click(screen.getByRole('button', { name: 'Hide 0' }));
  act(() => { handle.update({ progress: .5 }); });
  expect(stores[0].getSnapshot()[0]?.progress).toBe(.5); expect(stores[1].getSnapshot()).toHaveLength(0);
  act(() => { vi.advanceTimersByTime(340); });
  expect(stores[0].getSnapshot()).toHaveLength(0);
  act(() => { stores[0].start({ label: 'Pending cleanup', lifetime: { type: 'timed', durationMs: 10_000 } }); });
  view.unmount();
  await Promise.resolve();
  expect(stores[0].getSnapshot()).toHaveLength(0); expect(vi.getTimerCount()).toBe(0);
  handle.complete(); expect(stores[0].getSnapshot()).toHaveLength(0);
});
