import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { InspectionProvider, Inspectable, DemoLayout, useEvents, trackPromise, instrumentHandler, useInspectable, useInspection, useInspectionGroup, useOccupiedRegion, packageInfo, type PackageInfo } from '@borwood/demoable-react';
import '@borwood/demoable-react/styles.css';
const info: PackageInfo = packageInfo;
function EventExamples() {
  const events = useEvents();
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const [cancellations, setCancellations] = useState(0);
  const [results, setResults] = useState(0);
  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current.clear(); }, []);
  function later(callback: () => void, delay: number) { const timer = setTimeout(() => { timers.current.delete(timer); callback(); }, delay); timers.current.add(timer); }
  function overlap() {
    const first = events.start({label:'Prepare delivery',content:'Checking the application data',progress:0});
    const second = events.start({label:'Send delivery',content:'Waiting for a background response',lifetime:{type:'completion',succeeded:10000,failed:null}});
    first.run(); second.run();
    later(() => first.update({progress:.55,content:'Formatting the delivery preview'}),700);
    later(() => first.complete({progress:1,content:'Preview ready. This manual entry stays until dismissed.'}),1600);
    later(() => { second.complete({content:'Delivery accepted. This entry expires ten seconds after success.'}); setResults(value=>value+1); },2800);
  }
  function recordCancellation() {
    const event = events.start({ label: 'Cancelled action' });
    event.cancel({ content: 'The application reported a cancellation. Other work continues independently.' });
    setCancellations(value => value + 1);
  }
  const wrapped = instrumentHandler(events, (amount:number) => { setResults(value=>value+amount); return amount; }, {attempt:{label:'Local action',content:'A synchronous handler keeps its normal return value.'}});
  function failure() {
    const operation = new Promise<string>((_resolve,reject) => later(() => reject(new Error('Service unavailable')),1000));
    void trackPromise(events,operation,{label:'Check availability',content:'Waiting for a response'}, {failed: error => ({content:`Application handled: ${error instanceof Error ? error.message : String(error)}`})}).catch(() => {});
  }
  return <section className="card event-examples"><span className="example-index">D</span><h3>Follow work as it happens.</h3><p>Start overlapping tasks, inspect a component, and watch each event update independently. Reporting continues when inspection is hidden.</p><div className="event-actions"><button onClick={overlap}>Run overlapping work</button><button onClick={failure}>Try a failing promise</button><button onClick={recordCancellation}>Show a cancelled event</button><button onClick={() => events.start({label:'Background signal',state:'succeeded',content:<><strong>Already complete.</strong> An arbitrary subscription or worker can report an outcome directly.</>})}>Report an outcome</button><button onClick={() => wrapped(1)}>Run wrapped handler</button></div><p className="quiet">Application results: {results}.</p><p>Adds a cancelled event to the log. It does not stop running work.</p><p role="status" aria-atomic="true">{cancellations > 0 ? `Cancellation recorded (${cancellations}). Other application work continues.` : ''}</p></section>;
}
function InteractiveContext() {
  const [expanded, setExpanded] = useState(false);
  return <><p>A real application action stays usable while its explanation is pinned.</p><button type="button" onClick={() => setExpanded(value => !value)}>{expanded ? 'Show less' : 'Explain the interaction'}</button>{expanded && <p>The counter belongs to the host application. Inspection adds an independent overlay, preserves its input, and never schedules application work.</p>}<p><a href="#integration-examples">Explore the integration examples</a></p></>;
}
function Examples({ name, doubleCount }: { name: string; doubleCount: boolean }) {
  const inspection = useInspection(); const [count, setCount] = useState(0); const [showRef, setShowRef] = useState(true);
  const applicationRef = useRef<HTMLButtonElement>(null);
  const refTarget = useInspectable<HTMLButtonElement>({ label: 'Existing button', context: <p>This existing button is registered through a composed ref. No layout wrapper is added, and its application ref still works.</p> }, applicationRef);
  const group = useInspectionGroup({ label: 'Delivery group', context: <p>The two delivery cards and explicit portal share one identity. Each member gets an outline; their visible union determines context placement.</p> });
  const portal = useInspectable<HTMLDivElement>({ label: 'Delivery portal', ownerId: group.id, context: 'This explicit owner supplies context.' });
  const reserved = useOccupiedRegion<HTMLDivElement>(); const [reserveSpace, setReserveSpace] = useState(false);
  return <main className="demoable-react-theme">
    <header className="demo-header"><span className="eyebrow">DEMOABLE REACT</span><span className="badge">Component inspection</span></header>
    <div className="hero"><p className="eyebrow">A LITTLE CONTEXT GOES A LONG WAY</p><h1>{name ? `${name}'s interface` : 'Your interface'}<br /><em>explain itself.</em></h1><p className="intro">Explore the details behind a demo. Hover to discover a component, pin its explanation, and keep using the app.</p><div className="hero-actions"><button type="button" onClick={() => inspection.setActive(!inspection.active)}>{inspection.active ? 'Hide inspection' : 'Start inspecting'}</button><span>or press <kbd>?</kbd> on desktop</span></div><p className="quiet">Report overlapping work while every application interaction stays usable.</p></div>
    <div className="section-heading"><div><p className="eyebrow">01 / TRY IT</p><h2>An ordinary interaction. An optional explanation.</h2></div><span className="status-dot">{inspection.active ? 'Inspection on' : 'Inspection off'}</span></div>
    <Inspectable label="Counter card" context={<p>This parent card explains the overall region. Hover the counter inside it to see only the nested component's context.</p>} className="card counter-card">
      <div><span className="number-label">INTERACTIONS</span><strong className="counter-value">{count.toString().padStart(2, '0')}</strong><p>Nested targets resolve from the real DOM. The most specific explanation wins.</p></div>
      <Inspectable label="Counter" context={<InteractiveContext />} className="counter-action"><button type="button" onClick={() => setCount(value => value + (doubleCount ? 2 : 1))}>Count: {count}</button><span className="quiet">Click normally, or pin with ?.</span></Inspectable>
    </Inspectable>
    <div className="section-heading" id="integration-examples"><div><p className="eyebrow">02 / INTEGRATE</p><h2>A target for every kind of layout.</h2></div></div>
    <div className="example-grid">
      <section className="card"><span className="example-index">A</span><h3>An existing element</h3><p>Keep your own markup and refs. The hook connects an existing DOM element.</p>{showRef && <button type="button" ref={refTarget.ref} onClick={() => setCount(value => value + (doubleCount ? 2 : 1))}>Existing button</button>}<button className="text-button" type="button" onClick={() => setShowRef(value => !value)}>{showRef ? 'Unmount target' : 'Restore target'}</button><button className="text-button" type="button" onClick={() => applicationRef.current?.focus()}>Focus through app ref</button></section>
      <section className="card"><span className="example-index">B</span><h3>Multiple roots, one story</h3><p>Explicit members share context without a surrounding layout wrapper.</p><div className="delivery-row"><div ref={group.ref('origin')} className="delivery-chip"><span>01</span><strong>Prepare</strong></div><div ref={group.ref('destination')} className="delivery-chip"><span>02</span><strong>Deliver</strong></div></div></section>
    </div>
    <section className="card portal-example"><div><span className="example-index">C</span><h3>Ownership across a portal</h3><p>The detached “Delivery ready” badge explicitly belongs to the delivery group. React ancestry never guesses inspection ownership.</p></div><label><input type="checkbox" checked={reserveSpace} onChange={event => setReserveSpace(event.target.checked)} /> Show reserved layout region</label>{reserveSpace && <div ref={reserved} className="reserved-region"><strong>Reserved integration region</strong><button type="button" onClick={() => setCount(value => value + (doubleCount ? 2 : 1))}>Reserved control</button><p>This additional application region is reserved alongside the live log.</p></div>}</section>
    {createPortal(<div ref={portal.ref} className="delivery-portal"><span aria-hidden="true">↗</span> Delivery ready</div>, document.body)}
    <EventExamples />
    <footer><p data-testid="package-info">{info.name} · {info.version}</p><span className="swatch" data-testid="theme-probe">Public stylesheet loaded</span><p>React wrapper · existing-element refs · explicit groups & portals<br />Local inspection and live events. No production bundle exclusion yet.</p></footer>
  </main>;
}
function Presentation() {
  const [name, setName] = useState('Alex');
  const [doubleCount, setDoubleCount] = useState(false);
  return <DemoLayout className="demo-presentation" orientation={<><strong>Explore a working interface.</strong> Hover for context, pin an explanation, and follow application events below.</>} controls={<>
    <label>Presented name <input aria-label="Presented name" value={name} onChange={event => setName(event.target.value)} /></label>
    <label><input type="checkbox" checked={doubleCount} onChange={event => setDoubleCount(event.target.checked)} /> Count by two</label>
    <span className="demo-control-note">These controls change the app. Press ? to hide the demo layer.</span>
  </>}><Examples name={name} doubleCount={doubleCount} /></DemoLayout>;
}
export function App() { return <InspectionProvider><Presentation /></InspectionProvider>; }
