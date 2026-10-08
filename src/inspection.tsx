import { Children, Fragment, createContext, forwardRef, isValidElement, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode, type Ref, type RefCallback } from 'react';
import { createPortal } from 'react-dom';
import { createEventStore, type EventStore, type EventStoreOptions } from './events';

export type InspectionDevice = 'auto' | 'desktop' | 'mobile';
export interface InspectionProviderProps { children: ReactNode; device?: InspectionDevice; initialComponentInspection?: boolean; initialEventInspection?: boolean; initialOpacity?: number; eventOptions?: EventStoreOptions; }
export interface InspectableOptions { context?: ReactNode; label: string; ownerId?: string; }
export interface InspectionController {
  events: EventStore;
  active: boolean; componentInspection: boolean; eventInspection: boolean; componentVisible: boolean; eventVisible: boolean;
  opacity: number; pinnedId: string | null; activeId: string | null;
  setActive(value: boolean): void; setComponentInspection(value: boolean): void; setEventInspection(value: boolean): void;
  setOpacity(value: number): void; pin(id: string): void; dismiss(): void;
}
type Entry = InspectableOptions & { id: string; elements: Map<string, HTMLElement> };
type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
type Geometry = { width: number; height: number; targets: Record<string, Rect[]>; occupied: Rect[] };
type Internal = { registry: Map<string, Entry>; reserved: Map<string, HTMLElement>; refresh(): void; controller: InspectionController };
const Context = createContext<Internal | null>(null);
/** One ownership rule for selection lifetime, suppression and visible geometry. */
function memberElements(registry: Map<string, Entry>, id: string): HTMLElement[] {
  return [...new Set([...registry.values()].filter(entry => entry.id === id || entry.ownerId === id).flatMap(entry => [...entry.elements.values()]))];
}
const clamp = (value: number, maximum: number, minimum = 0) => Math.max(minimum, Math.min(maximum, value));
const normalizeOpacity = (value: number) => Number.isFinite(value) ? clamp(value, 1) : 0.75;
function internal() { const value = useContext(Context); if (!value) throw new Error('Inspection hooks require InspectionProvider'); return value; }
export function useInspection(): InspectionController { return internal().controller; }
/** Stable provider-scoped reporting API; independent of visibility. */
export function useEvents(): EventStore { return internal().controller.events; }
function useMedia(query: string) {
  const [matches, setMatches] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches);
  useEffect(() => { if (typeof matchMedia !== 'function') return; const media = matchMedia(query); const update = () => setMatches(media.matches); update(); media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, [query]);
  return matches;
}
function editable(event: KeyboardEvent) {
  for (const node of event.composedPath()) {
    if (!(node instanceof HTMLElement)) continue;
    if (node.matches('input,textarea,select')) return true;
    const attribute = node.getAttribute('contenteditable');
    if (attribute !== null) return attribute !== 'false';
  }
  return false;
}
function rect(left: number, top: number, right: number, bottom: number): Rect { return { left, top, right, bottom, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }; }
function visibleRect(element: HTMLElement, width: number, height: number): Rect | null {
  if (!element.isConnected || element.getClientRects().length === 0) return null;
  const bounds = element.getBoundingClientRect();
  let left = Math.max(0, bounds.left), top = Math.max(0, bounds.top), right = Math.min(width, bounds.right), bottom = Math.min(height, bounds.bottom);
  for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
    const style = getComputedStyle(ancestor); const box = ancestor.getBoundingClientRect();
    if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) { left = Math.max(left, box.left + ancestor.clientLeft); right = Math.min(right, box.left + ancestor.clientLeft + ancestor.clientWidth); }
    if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) { top = Math.max(top, box.top + ancestor.clientTop); bottom = Math.min(bottom, box.top + ancestor.clientTop + ancestor.clientHeight); }
  }
  if (right <= left || bottom <= top || getComputedStyle(element).visibility === 'hidden') return null;
  return rect(left, top, right, bottom);
}
function hasContent(content: ReactNode): boolean {
  return Children.toArray(content).some(child => typeof child === 'string' ? child.length > 0 : isValidElement(child) && child.type === Fragment ? hasContent((child.props as { children?: ReactNode }).children) : true);
}
export function InspectionProvider({ children, device = 'auto', initialComponentInspection = true, initialEventInspection = true, initialOpacity = .75, eventOptions }: InspectionProviderProps) {
  const [events] = useState(() => createEventStore(eventOptions));
  const eventMount = useRef(0);
  useEffect(() => {
    const generation = ++eventMount.current;
    return () => {
      // React StrictMode immediately replays effects. Dispose only after that replay
      // window, retaining the same handles and real deadlines across the replay.
      queueMicrotask(() => { if (eventMount.current === generation) events.dispose(); });
    };
  }, [events]);
  const autoMobile = useMedia('(hover: none) and (pointer: coarse)'); const mobile = device === 'mobile' || (device === 'auto' && autoMobile);
  const reducedMotion = useMedia('(prefers-reduced-motion: reduce)');
  const [desktopActive, setDesktopActive] = useState(false); const active = mobile || desktopActive;
  const [componentInspection, setComponentInspection] = useState(initialComponentInspection);
  const [eventInspection, setEventInspection] = useState(initialEventInspection);
  const [opacity, updateOpacity] = useState(() => normalizeOpacity(initialOpacity));
  const setOpacity = useCallback((value: number) => updateOpacity(normalizeOpacity(value)), []);
  const [hint, setHint] = useState<'shown' | 'fading' | 'gone'>('shown');
  const hintStart = useRef<number | null>(null);
  useEffect(() => {
    if (hintStart.current === null) hintStart.current = Date.now();
    const remaining = 4000 - (Date.now() - hintStart.current);
    const first = setTimeout(() => setHint(reducedMotion ? 'gone' : 'fading'), Math.max(0, remaining));
    const last = setTimeout(() => setHint('gone'), Math.max(0, remaining + 1000));
    return () => { clearTimeout(first); clearTimeout(last); };
  }, [reducedMotion]);
  useEffect(() => { const key = (event: KeyboardEvent) => { if (event.key === '?' && !event.repeat && !event.isComposing && !editable(event) && !mobile) setDesktopActive(value => !value); }; document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key); }, [mobile]);
  const registry = useRef(new Map<string, Entry>()).current; const reserved = useRef(new Map<string, HTMLElement>()).current;
  const [revision, revise] = useState(0); const refresh = useCallback(() => revise(value => value + 1), []);
  const [pinnedId, setPinned] = useState<string | null>(null); const [hoverId, setHover] = useState<string | null>(null);
  const suppression = useRef<string | null>(null); const pointer = useRef<{ x: number; y: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null); const insideBox = useRef(false);
  const pinOrigin = useRef<HTMLElement | null>(null);
  const recomputeHover = useRef<() => void>(() => {});
  const cancelLeave = useCallback(() => { if (timer.current !== null) clearTimeout(timer.current); timer.current = null; }, []);
  const dismiss = useCallback(() => { suppression.current = pinnedId ?? hoverId; setPinned(null); setHover(null); cancelLeave(); }, [pinnedId, hoverId, cancelLeave]);
  const pin = useCallback((id: string) => {
    if (!registry.has(id)) return;
    cancelLeave(); if (pinnedId === id) { suppression.current = id; setPinned(null); setHover(null); }
    else { suppression.current = null; setPinned(id); pinOrigin.current = [...document.querySelectorAll<HTMLElement>('[data-demoable-target]')].find(control => control.dataset.demoableTarget === id) ?? null; }
  }, [registry, pinnedId, cancelLeave]);
  const componentVisible = active && componentInspection;
  const activeId = componentVisible ? pinnedId ?? hoverId : null;
  const [contextBounds, setContextBounds] = useState<Rect | null>(null);
  const reportContextBounds = useCallback((bounds: Rect | null) => setContextBounds(previous => JSON.stringify(previous) === JSON.stringify(bounds) ? previous : bounds), []);
  const measuredGeometry = useRef('');
  const [geometry, setGeometry] = useState<Geometry>({ width: 0, height: 0, targets: {}, occupied: [] });
  useLayoutEffect(() => {
    const valid = (id: string) => registry.has(id) && memberElements(registry, id).some(element => element.isConnected);
    if (pinnedId && !valid(pinnedId)) setPinned(null);
    if (hoverId && !valid(hoverId)) setHover(null);
    if (suppression.current && !valid(suppression.current)) suppression.current = null;
  }, [revision, registry, pinnedId, hoverId]);
  useEffect(() => {
    if (!componentVisible) { setHover(null); cancelLeave(); insideBox.current = false; return; }
    const resolve = (path: EventTarget[]) => {
      for (const node of path) {
        if (!(node instanceof HTMLElement)) continue;
        for (const entry of registry.values()) if ([...entry.elements.values()].includes(node)) return entry.ownerId && registry.has(entry.ownerId) ? entry.ownerId : entry.id;
      }
      return null;
    };
    const pathAt = (element: Element | null) => { const path: EventTarget[] = []; for (let node = element; node; node = node.parentElement) path.push(node); return path; };
    const select = (path: EventTarget[], x: number, y: number) => {
      pointer.current = { x, y };
      const libraryElement = path.find(node => node instanceof HTMLElement && node.hasAttribute('data-demoable-ui')) as HTMLElement | undefined;
      if (libraryElement?.dataset.demoableUi === 'pin') {
        insideBox.current = false;
        const id = libraryElement.dataset.demoableTarget;
        if (id && registry.has(id)) {
          if (suppression.current && suppression.current !== id) suppression.current = null;
          cancelLeave();
          if (id !== suppression.current) setHover(id);
        }
        return;
      }
      const suppressed = suppression.current && registry.get(suppression.current);
      if (suppressed && !memberElements(registry, suppressed.id).some(element => path.includes(element))) suppression.current = null;
      if (libraryElement) { if (libraryElement.dataset.demoableUi === 'context') { insideBox.current = true; cancelLeave(); } else { insideBox.current = false; if (timer.current === null) timer.current = setTimeout(() => { timer.current = null; setHover(null); }, 300); } return; }
      insideBox.current = false;
      const suppressedEntry = suppression.current && registry.get(suppression.current);
      if (suppressedEntry && !memberElements(registry, suppressedEntry.id).some(element => path.includes(element))) suppression.current = null;
      const candidate = resolve(path);
      if (candidate && candidate !== suppression.current) { cancelLeave(); setHover(candidate); }
      else if (timer.current === null) timer.current = setTimeout(() => { timer.current = null; if (!insideBox.current) setHover(null); }, 300);
    };
    const move = (event: PointerEvent) => { if (event.pointerType !== 'touch') select(event.composedPath(), event.clientX, event.clientY); };
    const out = (event: PointerEvent) => { if (event.relatedTarget === null) select([], event.clientX, event.clientY); };
    document.addEventListener('pointermove', move, true); document.addEventListener('pointerover', move, true); document.addEventListener('pointerout', out, true);
    recomputeHover.current = () => { if (pointer.current && typeof document.elementFromPoint === 'function') select(pathAt(document.elementFromPoint(pointer.current.x, pointer.current.y)), pointer.current.x, pointer.current.y); };
    recomputeHover.current();
    return () => { recomputeHover.current = () => {}; cancelLeave(); document.removeEventListener('pointermove', move, true); document.removeEventListener('pointerover', move, true); document.removeEventListener('pointerout', out, true); };
  }, [componentVisible, registry, cancelLeave]);
  // Capture pointer coordinates even while hidden, then resolve the actual hit on restoration.
  useEffect(() => { const track = (event: PointerEvent) => { pointer.current = { x: event.clientX, y: event.clientY }; }; document.addEventListener('pointermove', track, true); return () => document.removeEventListener('pointermove', track, true); }, []);
  useEffect(() => {
    if (!componentVisible) return;
    let frame = 0, last = 0; let disposed = false;
    const measure = () => {
      const width = window.innerWidth, height = window.innerHeight; const targets: Record<string, Rect[]> = {};
      for (const entry of registry.values()) {
        const elements = memberElements(registry, entry.id);
        targets[entry.id] = elements.map(element => visibleRect(element, width, height)).filter((value): value is Rect => !!value);
        if (!elements.some(element => element.isConnected)) { setPinned(value => value === entry.id ? null : value); setHover(value => value === entry.id ? null : value); }
      }
      const occupied = [...reserved.values()].map(element => visibleRect(element, width, height)).filter((value): value is Rect => !!value);
      const next = { width, height, targets, occupied }; const serialized = JSON.stringify(next);
      if (serialized !== measuredGeometry.current) { measuredGeometry.current = serialized; setGeometry(next); recomputeHover.current(); }
    };
    const tick = (now: number) => { if (disposed) return; if (now - last >= 32) { measure(); last = now; } frame = requestAnimationFrame(tick); };
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    registry.forEach(entry => entry.elements.forEach(element => observer?.observe(element))); reserved.forEach(element => observer?.observe(element));
    window.addEventListener('resize', measure); window.addEventListener('scroll', measure, true); measure(); frame = requestAnimationFrame(tick);
    return () => { disposed = true; cancelAnimationFrame(frame); observer?.disconnect(); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [componentVisible, registry, reserved, revision, pinnedId]);
  const controller: InspectionController = { events, active, componentInspection, eventInspection, componentVisible, eventVisible: active && eventInspection, opacity, pinnedId, activeId, setActive: setDesktopActive, setComponentInspection, setEventInspection, setOpacity, pin, dismiss };
  const value = useMemo(() => ({ registry, reserved, refresh, controller }), [registry, reserved, refresh, active, componentInspection, eventInspection, opacity, pinnedId, activeId]);
  return <Context.Provider value={value}>{children}{typeof document !== 'undefined' && createPortal(<div className="demoable-react-layer">
    {active && hint !== 'gone' && <div className="demoable-react-hint" data-phase={hint}>{"activate component and event inspection with '?' key"}</div>}
    {componentVisible && <><TargetOverlays registry={registry} geometry={geometry} controller={controller} contextBounds={contextBounds} /><ContextBox onBounds={reportContextBounds} entry={activeId ? registry.get(activeId) : undefined} geometry={geometry} opacity={opacity} onDismiss={(keyboard) => { dismiss(); if (keyboard) pinOrigin.current?.focus(); }} onEnter={() => { insideBox.current = true; cancelLeave(); }} onLeave={() => { insideBox.current = false; cancelLeave(); timer.current = setTimeout(() => { timer.current = null; setHover(null); }, 300); }} /></>}
  </div>, document.body)}</Context.Provider>;
}

function assignRef<T>(reference: Ref<T> | undefined, value: T | null) { if (typeof reference === 'function') return reference(value); if (reference) reference.current = value; }
/** Register explicit members under one identity. Stable keys identify independently mounted roots. */
export function useInspectionGroup(options: InspectableOptions) {
  const { registry, refresh } = internal(); const id = useId();
  const entry = useRef<Entry>({ ...options, id, elements: new Map() }).current;
  const callbacks = useRef(new Map<string, { reference?: Ref<HTMLElement>; callback: RefCallback<HTMLElement> }>());
  useLayoutEffect(() => { registry.set(id, entry); refresh(); return () => { registry.delete(id); refresh(); }; }, [id, registry, entry, refresh]);
  useLayoutEffect(() => { if (entry.context !== options.context || entry.label !== options.label || entry.ownerId !== options.ownerId) { entry.context = options.context; entry.label = options.label; entry.ownerId = options.ownerId; refresh(); } }, [entry, options.context, options.label, options.ownerId, refresh]);
  const ref = useCallback(<T extends HTMLElement>(key: string, reference?: Ref<T>): RefCallback<T> => {
    const previous = callbacks.current.get(key); if (previous && previous.reference === reference) return previous.callback as RefCallback<T>;
    let cleanup: void | (() => void);
    const callback: RefCallback<T> = element => {
      if (cleanup) { cleanup(); cleanup = undefined; } else if (!element) assignRef(reference, null);
      if (element) { entry.elements.set(key, element); cleanup = assignRef(reference, element); }
      else entry.elements.delete(key);
      refresh();
    };
    callbacks.current.set(key, { reference: reference as Ref<HTMLElement>, callback: callback as RefCallback<HTMLElement> }); return callback;
  }, [entry, refresh]);
  return { id, ref };
}
export function useInspectable<T extends HTMLElement = HTMLElement>(options: InspectableOptions, applicationRef?: Ref<T>): { id: string; ref: RefCallback<T> } {
  const group = useInspectionGroup(options); return { id: group.id, ref: group.ref('target', applicationRef) };
}
export interface InspectableProps extends Omit<HTMLAttributes<HTMLDivElement>, 'context'>, InspectableOptions {}
export const Inspectable = forwardRef<HTMLDivElement, InspectableProps>(function Inspectable({ context, label, ownerId, children, ...attributes }, reference) {
  const target = useInspectable<HTMLDivElement>({ context, label, ownerId }, reference); return <div {...attributes} ref={target.ref}>{children}</div>;
});
/** Reserve an actual DOM region, for example an independently embedded event log. */
export function useOccupiedRegion<T extends HTMLElement = HTMLElement>(): RefCallback<T> {
  const { reserved, refresh } = internal(); const id = useId(); const element = useRef<T | null>(null);
  useLayoutEffect(() => { if (element.current) reserved.set(id, element.current); refresh(); return () => { reserved.delete(id); refresh(); }; }, [id, reserved, refresh]);
  return useCallback(node => { element.current = node; if (node) reserved.set(id, node); else reserved.delete(id); refresh(); }, [id, reserved, refresh]);
}

/** Surface-owned trigger. The provider never mounts a settings entry itself. */
export function InspectionSettings() {
  const controller = useInspection();
  const [open, setOpen] = useState(false);
  const gear = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const [position, setPosition] = useState({left: 0, top: 0});
  useEffect(() => { if (!controller.active) setOpen(false); }, [controller.active]);
  useLayoutEffect(() => {
    if (!open || !controller.active) return;
    let frame = 0;
    const measure = () => {
      const trigger = gear.current?.getBoundingClientRect(), box = menu.current?.getBoundingClientRect();
      if (!trigger || !box) return;
      const gutter = Math.min(8, window.innerWidth / 4, window.innerHeight / 4);
      const below = trigger.bottom + 8;
      const next = {
        left: clamp(trigger.left, window.innerWidth - box.width - gutter, gutter),
        top: clamp(below + box.height <= window.innerHeight - gutter ? below : trigger.top - box.height - 8, window.innerHeight - box.height - gutter, gutter),
      };
      setPosition(old => old.left === next.left && old.top === next.top ? old : next);
    };
    const tick = () => { measure(); frame = requestAnimationFrame(tick); };
    measure(); frame = requestAnimationFrame(tick);
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    if (gear.current) observer?.observe(gear.current);
    if (menu.current) observer?.observe(menu.current);
    window.addEventListener('resize', measure); window.addEventListener('scroll', measure, true);
    menu.current?.querySelector<HTMLInputElement>('input')?.focus();
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [open, controller.active]);
  const close = () => { setOpen(false); gear.current?.focus(); };
  if (!controller.active) return null;
  return <><button ref={gear} type="button" className="demoable-react-gear" data-demoable-ui="settings" aria-label="Inspection settings" aria-controls={open ? menuId : undefined} aria-expanded={open} onClick={() => setOpen(value => !value)}>⚙</button>
    {open && createPortal(<div className="demoable-react-layer demoable-react-settings-layer"><div ref={menu} id={menuId} className="demoable-react-settings" role="group" aria-label="Inspection settings" data-demoable-ui="settings" style={{...position, ...alphaStyle(controller.opacity)}} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
      <strong>Inspection settings</strong><label><input type="checkbox" checked={controller.componentInspection} onChange={event => controller.setComponentInspection(event.target.checked)} /> Component inspection</label><label><input type="checkbox" checked={controller.eventInspection} onChange={event => controller.setEventInspection(event.target.checked)} /> Event inspection</label><label>Info and settings background opacity <output>{Math.round(controller.opacity * 100)}%</output><input aria-label="Info and settings background opacity" type="range" min="0" max="1" step="0.05" value={controller.opacity} onChange={event => controller.setOpacity(Number(event.target.value))} /></label><button type="button" onClick={close}>Close settings</button>
    </div></div>, document.body)}</>;
}
function alphaStyle(opacity: number): CSSProperties {
  return {'--demoable-react-background-opacity': opacity, '--demoable-react-text-opacity': Math.min(opacity + .15, 1)} as CSSProperties;
}
function TargetOverlays({ registry, geometry, controller, contextBounds }: { registry: Map<string, Entry>; geometry: Geometry; controller: InspectionController; contextBounds: Rect | null }) {
  const occupied: Rect[] = [...geometry.occupied, ...(contextBounds ? [contextBounds] : [])];
  return <>{[...registry.values()].filter(entry => !entry.ownerId || !registry.has(entry.ownerId)).map(entry => {
    const rectangles = geometry.targets[entry.id] ?? []; if (!rectangles.length) return null;
    const first = rectangles[0]; const width = Math.min(26, geometry.width, geometry.height), height = width;
    let left = clamp(first.left + 2, geometry.width - width), top = clamp(first.top + 2, geometry.height - height);
    // Nearest free viewport grid position also keeps pins clear of interactive context.
    const overlaps = (x: number, y: number) => occupied.some(other => x < other.right && x + width > other.left && y < other.bottom && y + height > other.top);
    if (overlaps(left, top)) {
      const candidates: { x: number; y: number; distance: number }[] = [];
      for (let y = 0; y <= geometry.height - height; y += height + 4) for (let x = 0; x <= geometry.width - width; x += width + 4) {
        if (!overlaps(x, y)) candidates.push({ x, y, distance: (x - left) ** 2 + (y - top) ** 2 });
      }
      candidates.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
      if (candidates[0]) { left = candidates[0].x; top = candidates[0].y; }
    }
    occupied.push(rect(left, top, left + width, top + height)); const active = controller.activeId === entry.id, pinned = controller.pinnedId === entry.id;
    return <div key={entry.id}>{rectangles.map((bounds, index) => <div key={index} data-demoable-outline={entry.id} data-active={active} className="demoable-react-outline" style={{ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }} />)}<button type="button" data-demoable-ui="pin" data-demoable-target={entry.id} className="demoable-react-pin" aria-label={`Pin ${entry.label}`} aria-pressed={pinned} data-active={active} style={{ left, top, width, height }} onPointerDown={event => { if (event.pointerType === 'mouse') event.preventDefault(); }} onClick={() => controller.pin(entry.id)}>?</button></div>;
  })}</>;
}
type Edge = 'right' | 'bottom' | 'left' | 'top';
const sides: Edge[] = ['right', 'bottom', 'left', 'top'];
function intersects(a: Rect, b: Rect) { return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; }
function freeRegions(geometry: Geometry): Rect[] {
  const gutter = Math.min(8, geometry.width / 4, geometry.height / 4);
  let regions = [rect(gutter, gutter, geometry.width - gutter, geometry.height - gutter)];
  for (const occupied of geometry.occupied) regions = regions.flatMap(area => {
    if (!intersects(area, occupied)) return [area];
    // These maximal rectangles intentionally overlap: they are candidate containers,
    // not an area sum. Keeping both full-width and full-height cuts admits either fit.
    return [rect(area.left, area.top, Math.min(area.right, occupied.left - 8), area.bottom), rect(Math.max(area.left, occupied.right + 8), area.top, area.right, area.bottom), rect(area.left, area.top, area.right, Math.min(area.bottom, occupied.top - 8)), rect(area.left, Math.max(area.top, occupied.bottom + 8), area.right, area.bottom)].filter(candidate => candidate.width > 0 && candidate.height > 0);
  });
  return regions.length ? regions : [rect(0, 0, geometry.width, geometry.height)];
}
function adjacent(anchor: Rect, width: number, height: number, edge: Edge): Rect {
  const x = edge === 'right' ? anchor.right + 8 : edge === 'left' ? anchor.left - width - 8 : (anchor.left + anchor.right - width) / 2;
  const y = edge === 'bottom' ? anchor.bottom + 8 : edge === 'top' ? anchor.top - height - 8 : (anchor.top + anchor.bottom - height) / 2;
  return rect(x, y, x + width, y + height);
}
function visibleArea(candidate: Rect, geometry: Geometry) {
  let pieces = [rect(Math.max(0, candidate.left), Math.max(0, candidate.top), Math.min(geometry.width, candidate.right), Math.min(geometry.height, candidate.bottom))];
  for (const occupied of geometry.occupied) pieces = pieces.flatMap(area => {
    if (!intersects(area, occupied)) return [area];
    const left = Math.max(area.left, occupied.left), right = Math.min(area.right, occupied.right);
    const top = Math.max(area.top, occupied.top), bottom = Math.min(area.bottom, occupied.bottom);
    // Disjoint cuts ensure overlapping occupied regions are subtracted only once.
    return [rect(area.left, area.top, area.right, top), rect(area.left, bottom, area.right, area.bottom), rect(area.left, top, left, bottom), rect(right, top, area.right, bottom)].filter(piece => piece.width > 0 && piece.height > 0);
  });
  return pieces.reduce((sum, piece) => sum + piece.width * piece.height, 0);
}
function placeContext(anchor: Rect, width: number, height: number, geometry: Geometry, regions: Rect[], retainedSide?: Edge) {
  const candidates = sides.map(edge => ({ edge, bounds: adjacent(anchor, width, height, edge) }));
  if (!retainedSide) for (const candidate of candidates) for (const area of regions) {
    if (area.width < width || area.height < height) continue;
    const { edge, bounds } = candidate;
    const horizontal = edge === 'right' || edge === 'left';
    if (horizontal ? bounds.left >= area.left && bounds.right <= area.right : bounds.top >= area.top && bounds.bottom <= area.bottom) {
      return { edge, left: horizontal ? bounds.left : clamp(bounds.left, area.right - width, area.left), top: horizontal ? clamp(bounds.top, area.bottom - height, area.top) : bounds.top };
    }
  }
  const chosen = retainedSide ? candidates.find(candidate => candidate.edge === retainedSide)! : candidates.reduce((best, candidate) => visibleArea(candidate.bounds, geometry) > visibleArea(best.bounds, geometry) ? candidate : best);
  const fits = regions.filter(area => area.width >= width && area.height >= height);
  const containers = fits.length ? fits : regions;
  const placements = containers.map(area => ({ left: clamp(chosen.bounds.left, area.right - width, area.left), top: clamp(chosen.bounds.top, area.bottom - height, area.top) }));
  placements.sort((a, b) => Math.hypot(a.left - chosen.bounds.left, a.top - chosen.bounds.top) - Math.hypot(b.left - chosen.bounds.left, b.top - chosen.bounds.top));
  return { edge: chosen.edge, ...placements[0] };
}
function ContextBox({ entry, geometry, opacity, onDismiss, onEnter, onLeave, onBounds }: { onBounds(bounds: Rect | null): void; entry?: Entry; geometry: Geometry; opacity: number; onDismiss(keyboard: boolean): void; onEnter(): void; onLeave(): void }) {
  const box = useRef<HTMLElement>(null); const [size, setSize] = useState({ width: 0, height: 0 });
  const last = useRef<{ id: string; anchor: Rect; edge: Edge } | null>(null);
  const rectangles = entry ? geometry.targets[entry.id] ?? [] : [];
  const previous = last.current?.id === entry?.id ? last.current : null;
  const anchor = rectangles.length ? rect(Math.min(...rectangles.map(r => r.left)), Math.min(...rectangles.map(r => r.top)), Math.max(...rectangles.map(r => r.right)), Math.max(...rectangles.map(r => r.bottom))) : previous?.anchor ?? rect(0, 0, 0, 0);
  const present = !!entry && hasContent(entry.context);
  useLayoutEffect(() => { if (!present) return; const measure = () => { const bounds = box.current?.getBoundingClientRect(); if (bounds) setSize(old => old.width === bounds.width && old.height === bounds.height ? old : { width: bounds.width, height: bounds.height }); }; measure(); const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null; if (box.current) observer?.observe(box.current); return () => observer?.disconnect(); }, [present, entry?.context]);
  const regions = freeRegions(geometry);
  // Constrain only to the most usable unreserved viewport container, never to
  // the adjacent sliver. Measure this single mounted card before selecting a side.
  const area = [...regions].sort((a, b) => Math.min(b.width, 400) * b.height - Math.min(a.width, 400) * a.height)[0];
  const { edge, left, top } = placeContext(anchor, size.width, size.height, geometry, regions, !rectangles.length ? previous?.edge : undefined);
  useLayoutEffect(() => { if (entry && rectangles.length) last.current = { id: entry.id, anchor, edge }; }, [entry?.id, anchor.left, anchor.top, anchor.right, anchor.bottom, edge, rectangles.length]);
  const style = { left, top, maxWidth: Math.min(area.width, 400), maxHeight: area.height, ...alphaStyle(opacity) } as CSSProperties;
  useLayoutEffect(() => {
    const bounds = present ? box.current?.getBoundingClientRect() : null;
    onBounds(bounds ? rect(bounds.left, bounds.top, bounds.right, bounds.bottom) : null);
  }, [present, left, top, size.width, size.height, area.width, area.height, onBounds]);
  useEffect(() => () => onBounds(null), [onBounds]);
  if (!present) return null;
  return <aside ref={box} className="demoable-react-context" data-demoable-ui="context" data-edge={edge} aria-label={`${entry.label} context`} style={style} onPointerEnter={onEnter} onPointerLeave={onLeave} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onDismiss(true); } }}>
    <header className="demoable-react-context-header"><strong>{entry.label}</strong><button type="button" className="demoable-react-close" aria-label="Dismiss component context" onClick={event => onDismiss(event.detail === 0)}>x</button></header><div className="demoable-react-context-body">{entry.context}</div>
  </aside>;
}



