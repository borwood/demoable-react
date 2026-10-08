import { afterEach, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { InspectionProvider as Provider, useInspection } from '@borwood/demoable-react';
function State() {
  const state = useInspection();
  return <output data-testid="state">{JSON.stringify(state, ['active', 'componentInspection', 'eventInspection', 'opacity'])}</output>;
}
function state() { return JSON.parse(screen.getByTestId('state').textContent!); }
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

test('desktop starts hidden with independently enabled inspection settings', () => {
  render(<Provider device="desktop"><State /></Provider>);
  expect(state()).toEqual({ active: false, componentInspection: true, eventInspection: true, opacity: 0.75 });
  fireEvent.keyDown(document, { key: '?' });
  expect(state().active).toBe(true);
  fireEvent.keyDown(document, { key: '?' });
  expect(state().active).toBe(false);
});

test('configured settings survive hiding and shortcuts ignore editing, repeat and composition', () => {
  render(<Provider device="desktop" initialComponentInspection={false} initialEventInspection={true} initialOpacity={0.35}><State /><input aria-label="Application input" /><textarea aria-label="Application text" /><div contentEditable role="textbox" aria-label="Rich editor" /></Provider>);
  expect(state()).toEqual({ active: false, componentInspection: false, eventInspection: true, opacity: 0.35 });
  for (const element of [screen.getByLabelText('Application input'), screen.getByLabelText('Application text'), screen.getByLabelText('Rich editor')]) {
    fireEvent.keyDown(element, { key: '?' });
    expect(state().active).toBe(false);
  }
  fireEvent.keyDown(document, { key: '?', repeat: true });
  fireEvent.keyDown(document, { key: '?', isComposing: true });
  expect(state().active).toBe(false);
  fireEvent.keyDown(document, { key: '?' });
  expect(state().active).toBe(true);
  expect(state().componentInspection).toBe(false);
  expect(state().eventInspection).toBe(true);
});

test('explicit mobile stays active when shortcut is pressed', () => {
  render(<Provider device="mobile"><State /></Provider>);
  expect(state().active).toBe(true);
  fireEvent.keyDown(document, { key: '?' });
  expect(state().active).toBe(true);
  expect(screen.getByText("activate component and event inspection with '?' key")).toBeTruthy();
});

test('exact hint stays four seconds, fades one second, and rerender does not restart it', () => {
  vi.useFakeTimers();
  const view = render(<Provider device="desktop"><span>First render</span></Provider>);
  const hint = () => screen.queryByText("activate component and event inspection with '?' key");
  expect(hint()).toBeNull();
  fireEvent.keyDown(document, {key:'?'});
  act(() => { vi.advanceTimersByTime(3500); });
  expect(hint()?.getAttribute('data-phase')).toBe('shown');
  view.rerender(<Provider device="desktop"><span>Ordinary rerender</span></Provider>);
  act(() => { vi.advanceTimersByTime(500); });
  expect(hint()?.getAttribute('data-phase')).toBe('fading');
  act(() => { vi.advanceTimersByTime(999); });
  expect(hint()).not.toBeNull();
  act(() => { vi.advanceTimersByTime(1); });
  expect(hint()).toBeNull();
  fireEvent.keyDown(document, {key:'?'});
  fireEvent.keyDown(document, {key:'?'});
  expect(hint()).toBeNull();
});

test('reduced motion removes only the hint fade and auto reacts to primary-input changes', () => {
  vi.useFakeTimers();
  const media = new Map<string, { matches: boolean; listeners: Set<() => void> }>();
  vi.stubGlobal('matchMedia', (query: string) => {
    if (!media.has(query)) media.set(query, { matches: query.includes('reduced-motion'), listeners: new Set() });
    const value = media.get(query)!;
    return { get matches() { return value.matches; }, addEventListener: (_: string, listener: () => void) => value.listeners.add(listener), removeEventListener: (_: string, listener: () => void) => value.listeners.delete(listener) };
  });
  const view = render(<Provider device="auto"><State /></Provider>);
  expect(state().active).toBe(false);
  const primary = media.get('(hover: none) and (pointer: coarse)')!;
  act(() => { primary.matches = true; primary.listeners.forEach(listener => listener()); });
  expect(state().active).toBe(true);
  act(() => { vi.advanceTimersByTime(3999); });
  expect(screen.queryByText("activate component and event inspection with '?' key")).not.toBeNull();
  act(() => { vi.advanceTimersByTime(1); });
  expect(screen.queryByText("activate component and event inspection with '?' key")).toBeNull();
  view.unmount();
  expect([...media.values()].every(value => value.listeners.size === 0)).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

test('provider settings remain isolated and repeated mount removes shortcut listeners', () => {
  function ScopedState({ name }: { name: string }) {
    const current = useInspection();
    return <output data-testid={name}>{JSON.stringify(current, ['active', 'componentInspection', 'eventInspection'])}</output>;
  }
  const view = render(<><Provider device="desktop" initialComponentInspection={false}><ScopedState name="first" /></Provider><Provider device="mobile" initialEventInspection={false}><ScopedState name="second" /></Provider></>);
  fireEvent.keyDown(document, { key: '?' });
  expect(JSON.parse(screen.getByTestId('first').textContent!)).toEqual({ active: true, componentInspection: false, eventInspection: true });
  expect(JSON.parse(screen.getByTestId('second').textContent!)).toEqual({ active: true, componentInspection: true, eventInspection: false });
  view.unmount();
  fireEvent.keyDown(document, { key: '?' });
  render(<Provider device="desktop"><State /></Provider>);
  fireEvent.keyDown(document, { key: '?' });
  expect(state().active).toBe(true);
});
