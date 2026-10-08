import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createEventStore } from '../../src/events';

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(1000); });
afterEach(() => { vi.useRealTimers(); });

test('stable identities, independent updates and immutable newest-created snapshots', () => {
  const store = createEventStore();
  const first = store.start({ label: 'work', data: { input: 1 } });
  const previous = store.getSnapshot();
  const second = store.start({ label: 'work', progress: 0.5 });
  first.run({ label: 'working', progress: 0.25, content: 'rich', data: { result: 2 } });
  expect(first.id).not.toBe(second.id);
  expect(store.getSnapshot().map(event => event.id)).toEqual([second.id, first.id]);
  expect(store.getSnapshot()[1]).toMatchObject({ state: 'running', label: 'working', progress: 0.25, content: 'rich', data: { result: 2 }, sequence: 1, createdAt: 1000 });
  expect(previous[0]).toMatchObject({ label: 'work', state: 'pending' });
  expect(Object.isFrozen(store.getSnapshot())).toBe(true);
  expect(Object.isFrozen(store.getSnapshot()[0])).toBe(true);
  expect(createEventStore().getSnapshot()).toEqual([]);
  store.dispose();
});

test('manual entries retain terminal outcome, accept display updates and freeze during idempotent fade', () => {
  const store = createEventStore({ fadeOutMs: 40 });
  const handle = store.start({ label: 'job' });
  handle.complete({ label: 'done' });
  handle.fail({ label: 'wrong' });
  handle.run();
  vi.advanceTimersByTime(1_000_000);
  expect(store.getSnapshot()[0]).toMatchObject({ state: 'succeeded', label: 'done' });
  handle.update({ label: 'retained' });
  expect(store.getSnapshot()[0].label).toBe('retained');
  handle.dismiss();
  const fading = store.getSnapshot();
  handle.update({ label: 'resurrect' });
  handle.cancel();
  vi.advanceTimersByTime(20);
  handle.dismiss();
  expect(store.getSnapshot()).toBe(fading);
  expect(fading[0].removing).toBe(true);
  vi.advanceTimersByTime(20);
  expect(store.getSnapshot()).toEqual([]);
  handle.update({ label: 'removed' });
  handle.complete();
  expect(store.getSnapshot()).toEqual([]);
});

test('creation expiry is unaffected by updates or completion and default fade lasts 200ms', () => {
  const store = createEventStore();
  const handle = store.start({ label: 'timed', lifetime: { type: 'timed', durationMs: 100 } });
  vi.advanceTimersByTime(60);
  handle.complete();
  vi.advanceTimersByTime(39);
  expect(store.getSnapshot()[0].removing).toBe(false);
  vi.advanceTimersByTime(1);
  expect(store.getSnapshot()[0].removing).toBe(true);
  vi.advanceTimersByTime(199);
  expect(store.getSnapshot()).toHaveLength(1);
  vi.advanceTimersByTime(1);
  expect(store.getSnapshot()).toEqual([]);
});

test('completion policies start at first outcome, permit indefinite retention and outcome-only reporting', () => {
  const store = createEventStore({ fadeOutMs: 0 });
  const lifetime = { type: 'completion' as const, succeeded: 60, failed: null, cancelled: 0 };
  const success = store.start({ label: 'success', lifetime });
  const failed = store.start({ label: 'failure', lifetime, state: 'failed' });
  store.start({ label: 'cancelled', lifetime, state: 'cancelled' });
  expect(store.getSnapshot().map(event => event.id)).toEqual([failed.id, success.id]);
  vi.advanceTimersByTime(100);
  success.complete();
  vi.advanceTimersByTime(40);
  success.complete();
  success.update({ progress: 1 });
  vi.advanceTimersByTime(20);
  expect(store.getSnapshot().map(event => event.id)).toEqual([failed.id]);
  vi.advanceTimersByTime(100000);
  expect(store.getSnapshot()).toHaveLength(1);
  store.dispose();
});

test('policy copies, zero expiry, long durations and invalid milliseconds', () => {
  const store = createEventStore({ fadeOutMs: 0 });
  const lifetime = { type: 'timed' as const, durationMs: 2_147_483_647 + 50 };
  store.start({ label: 'long', lifetime });
  lifetime.durationMs = 0;
  store.start({ label: 'zero', lifetime });
  expect(store.getSnapshot()).toHaveLength(1);
  vi.advanceTimersByTime(2_147_483_647);
  expect(store.getSnapshot()).toHaveLength(1);
  vi.advanceTimersByTime(49);
  expect(store.getSnapshot()).toHaveLength(1);
  vi.advanceTimersByTime(1);
  expect(store.getSnapshot()).toEqual([]);
  for (const durationMs of [-1, NaN, Infinity]) {
    expect(() => store.start({ label: 'invalid', lifetime: { type: 'timed', durationMs } })).toThrow(RangeError);
    expect(() => createEventStore({ fadeOutMs: durationMs })).toThrow(RangeError);
  }
});

test('disposal and unsubscription release timers and prevent removed handles from resurrecting', () => {
  const store = createEventStore();
  const listener = vi.fn();
  const unsubscribe = store.subscribe(listener);
  const handle = store.start({ label: 'job', lifetime: { type: 'timed', durationMs: 100 } });
  expect(listener).toHaveBeenCalledTimes(1);
  unsubscribe();
  handle.run();
  expect(listener).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(1);
  store.dispose();
  store.dispose();
  handle.complete();
  store.start({ label: 'too late' });
  expect(store.getSnapshot()).toEqual([]);
  expect(vi.getTimerCount()).toBe(0);
});

test('stores remain isolated and throwing observers cannot prevent handles, outcomes or deadlines', () => {
  const left = createEventStore({ fadeOutMs: 0 });
  const right = createEventStore();
  left.subscribe(() => { throw new Error('reporting unavailable'); });
  const observer = vi.fn();
  left.subscribe(observer);
  const handle = left.start({ label: 'observed', lifetime: { type: 'completion', failed: 15 } });
  handle.fail({ data: 'original failure' });
  expect(left.getSnapshot()[0]).toMatchObject({ state: 'failed', data: 'original failure' });
  expect(observer).toHaveBeenCalledTimes(2);
  expect(right.getSnapshot()).toEqual([]);
  right.start({ label: 'other provider' });
  vi.advanceTimersByTime(15);
  expect(left.getSnapshot()).toEqual([]);
  expect(right.getSnapshot()).toHaveLength(1);
  left.dispose();
  right.dispose();
});

test('independent outcome retention and per-policy fade overrides include fractional milliseconds', () => {
  const store = createEventStore();
  const lifetime = { type: 'completion' as const, failed: 25, cancelled: 10, fadeOutMs: 0 };
  const failure = store.start({ label: 'failure', lifetime });
  const cancelled = store.start({ label: 'cancelled', lifetime });
  failure.fail();
  cancelled.cancel();
  vi.advanceTimersByTime(10);
  expect(store.getSnapshot().map(event => event.id)).toEqual([failure.id]);
  vi.advanceTimersByTime(15);
  expect(store.getSnapshot()).toEqual([]);
  store.start({ label: 'fraction', lifetime: { type: 'timed', durationMs: 0.5, fadeOutMs: 0 } });
  vi.advanceTimersByTime(2);
  expect(store.getSnapshot()).toEqual([]);
  expect(() => store.start({ label: 'bad completion', lifetime: { type: 'completion', failed: -1 } })).toThrow(RangeError);
  expect(() => store.start({ label: 'bad fade', lifetime: { type: 'manual', fadeOutMs: NaN } })).toThrow(RangeError);
});
