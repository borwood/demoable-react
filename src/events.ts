import type { ReactNode } from 'react';

export type EventState = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export type EventLifetime =
  | { type: 'manual'; fadeOutMs?: number }
  | { type: 'timed'; durationMs: number; fadeOutMs?: number }
  | { type: 'completion'; succeeded?: number | null; failed?: number | null; cancelled?: number | null; fadeOutMs?: number };
export interface EventUpdate { label?: string; content?: ReactNode; progress?: number; data?: unknown }
export interface EventInput extends EventUpdate { label: string; state?: EventState; lifetime?: EventLifetime }
export interface LiveEvent extends Readonly<EventInput> { readonly id: string; readonly sequence: number; readonly createdAt: number; readonly state: EventState; readonly removing: boolean; readonly fadeOutMs: number }
export interface EventHandle {
  readonly id: string;
  update(patch: EventUpdate): void;
  run(patch?: EventUpdate): void;
  complete(patch?: EventUpdate): void;
  fail(patch?: EventUpdate): void;
  cancel(patch?: EventUpdate): void;
  dismiss(): void;
}
export interface EventStore {
  start(input: EventInput): EventHandle;
  dismiss(id: string): void;
  subscribe(listener: () => void): () => void;
  getSnapshot(): readonly LiveEvent[];
  dispose(): void;
}
export interface EventStoreOptions { fadeOutMs?: number }

const terminal = (state: EventState) => state === 'succeeded' || state === 'failed' || state === 'cancelled';
function duration(value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new RangeError('Event durations must be nonnegative finite milliseconds.');
  return value;
}

/** A visibility-independent store. dispose() is permanent; retained handles become inert. */
export function createEventStore(options: EventStoreOptions = {}): EventStore {
  const defaultFade = duration(options.fadeOutMs ?? 200);
  const entries = new Map<string, LiveEvent>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const listeners = new Set<() => void>();
  let snapshot: readonly LiveEvent[] = Object.freeze([]);
  let sequence = 0;
  let disposed = false;

  function publish() {
    snapshot = Object.freeze([...entries.values()].reverse());
    for (const listener of [...listeners]) {
      // Observers are reporting code and cannot break application lifecycle work.
      try { listener(); } catch { /* One observer must not suppress the others. */ }
    }
  }
  function clearTimer(id: string) {
    const timer = timers.get(id);
    if (timer !== undefined) clearTimeout(timer);
    timers.delete(id);
  }
  function schedule(id: string, milliseconds: number, action: () => void) {
    clearTimer(id);
    const startedAt = Date.now();
    function tick() {
      if (disposed || !entries.has(id)) return;
      const remaining = milliseconds - (Date.now() - startedAt);
      if (remaining <= 0) { action(); return; }
      // Native timers overflow above signed 32-bit milliseconds. Retain the real
      // deadline across chunks instead of shortening a long requested lifetime.
      timers.set(id, setTimeout(() => { timers.delete(id); tick(); }, Math.min(remaining, 2_147_483_647)));
    }
    tick();
  }
  function dismiss(id: string) {
    const entry = entries.get(id);
    if (!entry || entry.removing || disposed) return;
    entries.set(id, Object.freeze({ ...entry, removing: true }));
    schedule(id, entry.fadeOutMs, () => { entries.delete(id); publish(); });
    if (entries.has(id)) publish();
  }
  function completion(entry: LiveEvent) {
    if (entry.lifetime?.type !== 'completion' || !terminal(entry.state)) return;
    const outcome = entry.state as 'succeeded' | 'failed' | 'cancelled';
    const retention = entry.lifetime[outcome];
    if (retention != null) schedule(entry.id, retention, () => dismiss(entry.id));
  }
  function change(id: string, patch: EventUpdate = {}, state?: EventState) {
    const entry = entries.get(id);
    if (!entry || entry.removing || disposed || (state && terminal(entry.state))) return;
    // Copy only public display fields; untyped callers cannot replace identity,
    // retention policy, removal state or creation order through an update.
    const display: EventUpdate = {};
    for (const key of ['label', 'content', 'progress', 'data'] as const) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) Object.assign(display, { [key]: patch[key] });
    }
    const next = Object.freeze({ ...entry, ...display, state: state ?? entry.state });
    entries.set(id, next);
    if (state) completion(next);
    publish();
  }
  return {
    getSnapshot: () => snapshot,
    dismiss,
    subscribe(listener) {
      if (!disposed) listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const id of timers.keys()) clearTimer(id);
      entries.clear();
      publish();
      listeners.clear();
    },
    start(input) {
      const lifetime: EventLifetime = Object.freeze({ ...(input.lifetime ?? { type: 'manual' }) });
      const fadeOutMs = duration(lifetime.fadeOutMs ?? defaultFade);
      if (lifetime.type === 'timed') duration(lifetime.durationMs);
      if (lifetime.type === 'completion') {
        for (const outcome of ['succeeded', 'failed', 'cancelled'] as const) {
          if (lifetime[outcome] != null) duration(lifetime[outcome]);
        }
      }
      const creationSequence = ++sequence;
      const id = `event-${creationSequence}`;
      const handle: EventHandle = Object.freeze({
        id,
        update: (patch: EventUpdate) => change(id, patch),
        run: (patch?: EventUpdate) => change(id, patch, 'running'),
        complete: (patch?: EventUpdate) => change(id, patch, 'succeeded'),
        fail: (patch?: EventUpdate) => change(id, patch, 'failed'),
        cancel: (patch?: EventUpdate) => change(id, patch, 'cancelled'),
        dismiss: () => dismiss(id),
      });
      if (disposed) return handle;
      const entry: LiveEvent = Object.freeze({ ...input, id, sequence: creationSequence, createdAt: Date.now(), state: input.state ?? 'pending', lifetime, removing: false, fadeOutMs });
      entries.set(id, entry);
      if (lifetime.type === 'timed') schedule(id, lifetime.durationMs, () => dismiss(id));
      else completion(entry);
      publish();
      return handle;
    },
  };
}
