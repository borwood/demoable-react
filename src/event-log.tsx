import { useCallback, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { useEvents, useInspection, useOccupiedRegion } from './inspection';

export interface EventLogProps { className?: string; }
/** Embed in the layout cell of your choice. Hidden inspection renders no region. */
export function EventLog({ className = '' }: EventLogProps) {
  const store = useEvents();
  const events = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const { eventVisible } = useInspection();
  const occupied = useOccupiedRegion<HTMLElement>();
  const root = useRef<HTMLElement | null>(null), header = useRef<HTMLElement>(null), surface = useRef<HTMLDivElement>(null), content = useRef<HTMLDivElement>(null);
  const anchor = useRef<{ id: string; offset: number } | null>(null);
  const [expanded, setExpanded] = useState(false), [height, setHeight] = useState<number>();
  const scrollId = useId();
  const ref = useCallback((node: HTMLElement | null) => { root.current = node; occupied(node); }, [occupied]);
  const remember = useCallback(() => {
    const node = surface.current;
    if (!node || node.scrollTop < 2) { anchor.current = null; return; }
    const top = node.getBoundingClientRect().top;
    const first = Array.from(node.querySelectorAll<HTMLElement>('[data-event-id]')).find(row => row.getBoundingClientRect().bottom > top + 1);
    anchor.current = first ? {id:first.dataset.eventId!,offset:first.getBoundingClientRect().top - top} : null;
  }, []);
  useLayoutEffect(() => {
    if (!eventVisible) { anchor.current = null; return; }
    const measure = () => {
      const node = surface.current, body = content.current;
      if (!node || !body || !header.current) return;
      const rows = Array.from(body.children) as HTMLElement[];
      const last = rows[Math.min(expanded ? rows.length : 3, rows.length) - 1];
      const measured = last ? last.offsetTop + last.offsetHeight : 0;
      const viewport = window.visualViewport?.height ?? window.innerHeight;
      const nextHeight = Math.min(viewport / 2, header.current.getBoundingClientRect().height + measured + 2);
      setHeight(old => old === nextHeight ? old : nextHeight);
      const saved = anchor.current;
      if (saved) {
        const row = rows.find(row => row.dataset.eventId === saved.id);
        if (row) node.scrollTop += row.getBoundingClientRect().top - node.getBoundingClientRect().top - saved.offset;
      } else node.scrollTop = 0;
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (content.current) { observer.observe(content.current); for (const row of content.current.children) observer.observe(row); }
    if (header.current) observer.observe(header.current);
    window.addEventListener('resize', measure); window.visualViewport?.addEventListener('resize', measure);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); window.visualViewport?.removeEventListener('resize', measure); };
  }, [events, expanded, eventVisible]);
  if (!eventVisible) return null;
  return <section ref={ref} className={`demoable-react-events ${className}`} aria-label="Live events" data-demoable-ui="events" style={{height}}>
    <header ref={header} className="demoable-react-events-header"><strong>Live events <span aria-hidden="true">· {events.length}</span></strong><button type="button" aria-expanded={expanded} aria-controls={scrollId} aria-label={expanded ? 'Collapse event log' : 'Expand event log'} onClick={() => setExpanded(value => !value)}>{expanded ? 'Collapse' : 'Expand'}</button></header>
    <div ref={surface} id={scrollId} className="demoable-react-event-scroll" onScroll={remember} tabIndex={0} aria-label="Event entries">
      <div ref={content} className="demoable-react-event-content">
        {events.length === 0 ? <p className="demoable-react-event-empty">No events yet</p> : events.map(event => <article key={event.id} data-event-id={event.id} data-removing={event.removing} className="demoable-react-event" style={{'--demoable-react-fade-out':`${event.fadeOutMs}ms`} as CSSProperties}>
          <div className="demoable-react-event-heading"><strong>{event.label}</strong><span className="demoable-react-event-state" data-state={event.state}>{event.state}</span><button type="button" aria-label={`Dismiss ${event.label}`} onClick={() => store.dismiss(event.id)}>×</button></div>
          {event.content != null && <div className="demoable-react-event-description">{event.content}</div>}
          {event.progress !== undefined && <progress aria-label={`${event.label} progress`} value={event.progress} max={1} />}
        </article>)}
      </div>
    </div>
  </section>;
}
