import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export const eventsFixture = `
import { StrictMode, useRef, useState } from 'react';
import { InspectionProvider, OrientationPanel, Inspectable, EventLog, useEvents, useInspection, type EventHandle } from '@borwood/demoable-react';
import '@borwood/demoable-react/styles.css';
function Example() {
 const events = useEvents(), inspection = useInspection();
 const latest = useRef<EventHandle | null>(null), sequence = useRef(0);
 const [embedded, setEmbedded] = useState(true);
 return <div style={{height:'100dvh',display:'grid',gridTemplateRows:'minmax(0, 1fr) auto'}}>
 <main data-testid="application" style={{overflow:'auto',padding:16}}>
 <OrientationPanel/>
 <button onClick={() => { latest.current = events.start({label:'Event ' + ++sequence.current,content:<p>Short content</p>}); }}>Add event</button>
 <button onClick={() => { latest.current = events.start({label:'Tall ' + ++sequence.current,content:<div style={{height:140}}>Variable content<button>Entry action</button></div>}); }}>Add tall</button>
 <button onClick={() => { latest.current = events.start({label:'Oversized',content:<div style={{height:1000}}>Large content<button style={{display:'block',marginTop:900}}>Last entry action</button></div>}); }}>Add oversized</button>
 <button onClick={() => latest.current?.update({content:<div style={{height:200}}>Updated content</div>})}>Update latest</button>
 <button onClick={() => events.start({label:'Expires hidden',lifetime:{type:'timed',durationMs:100,fadeOutMs:0}})}>Timed event</button>
 <button onClick={() => events.start({label:'Quick fade',lifetime:{type:'timed',durationMs:80,fadeOutMs:200}})}>Early fade event</button>
 <button onClick={() => inspection.setActive(!inspection.active)}>Toggle active</button>
 <button onClick={() => inspection.setEventInspection(!inspection.eventInspection)}>Toggle events</button>
 <button onClick={() => inspection.setComponentInspection(!inspection.componentInspection)}>Toggle components</button>
 <button onClick={() => setEmbedded(!embedded)}>Toggle embedding</button>
 <input aria-label="Application text" />
 <Inspectable label="Event target" context={<p>Context stays above the log.</p>} style={{marginTop:70,width:160,height:80}}>Inspectable target</Inspectable>
 </main>{embedded && <EventLog />}</div>;
}
export function EventsFixture() { return <StrictMode><style>{'body { margin: 0; }'}</style><InspectionProvider device="desktop"><Example /></InspectionProvider></StrictMode>; }
`;

export async function verifyEvents(page, url) {
 await page.setViewportSize({width:1000,height:800});
 await page.goto(url + '?events');
 await page.getByRole('button',{name:'Toggle active'}).click();
 const log = page.getByRole('region', {name:'Live events'});
 await expect(log).toBeVisible();
 await expect(log.getByText('No events yet')).toBeVisible();
 assert(await log.getByRole('button',{name:'Expand event log'}).evaluate(button => {
  const box=button.getBoundingClientRect();
  return document.elementFromPoint(box.x+box.width/2,box.bottom-3)?.closest('button') === button;
 }), 'Surface settings gear must not obstruct the empty-log expansion control');
 // Observe the real 80ms expiry / 200ms fade in the browser microtask where
 // its attribute changes. Cross-process polling can skip this entire phase.
 await log.evaluate(node => {
  const observer = new MutationObserver(() => {
   const row = Array.from(node.querySelectorAll('[data-event-id][data-removing="true"]')).find(row=>row.textContent.includes('Quick fade'));
   if (row) {
    window.__demoableFadeEvidence = {opacity:Number(getComputedStyle(row).opacity)};
    observer.disconnect();
   }
  });
  window.__demoableFadeEvidence = null;
  window.__demoableFadeCleanup = () => observer.disconnect();
  observer.observe(node,{subtree:true,attributes:true,attributeFilter:['data-removing']});
 });
 try {
  await page.getByRole('button',{name:'Early fade event'}).click();
  await expect.poll(()=>page.evaluate(()=>window.__demoableFadeEvidence)).not.toBeNull();
  const {opacity:fadeOpacity}=await page.evaluate(()=>window.__demoableFadeEvidence);
  assert(fadeOpacity > 0 && fadeOpacity <= 1, 'Early expiry retains a visible removal fade instead of abruptly hiding during fade-in');
  await expect(log.locator('[data-event-id]').filter({hasText:'Quick fade'})).toHaveCount(0);
 } finally {
  await page.evaluate(()=>{window.__demoableFadeCleanup(); delete window.__demoableFadeCleanup; delete window.__demoableFadeEvidence;});
 }
 const empty = (await log.boundingBox()).height;
 await page.getByRole('button',{name:'Add event',exact:true}).click();
 const one = (await log.boundingBox()).height;
 await page.getByRole('button',{name:'Add tall',exact:true}).click();
 await expect(log.getByText('Tall 2',{exact:true})).toBeVisible();
 await expect.poll(async () => (await log.boundingBox()).height).toBeGreaterThan(one + 70);
 const two = (await log.boundingBox()).height;
 await page.getByRole('button',{name:'Add event',exact:true}).click();
 await expect.poll(async () => (await log.boundingBox()).height).toBeGreaterThan(two);
 assert(empty > 30 && one > 30);
 for(let i=0;i<5;i++) await page.getByRole('button',{name:'Add event',exact:true}).click();
 const labels = await log.locator('[data-event-id] strong').allTextContents();
 assert.equal(labels[0],'Event 8');
 const scroll = log.locator('.demoable-react-event-scroll');
 await scroll.evaluate(node => { node.scrollTop = node.scrollHeight; });
 const old = log.locator('[data-event-id]').last();
 const before = (await old.boundingBox()).y;
 await page.getByRole('button',{name:'Add tall',exact:true}).click();
 await expect.poll(async () => Math.abs((await old.boundingBox()).y - before)).toBeLessThan(3);
 await page.getByRole('button',{name:'Update latest',exact:true}).click();
 await expect.poll(async () => Math.abs((await old.boundingBox()).y - before)).toBeLessThan(3);
 await log.getByRole('button',{name:'Expand event log'}).focus();
 await page.keyboard.press('Enter');
 await expect(log.getByRole('button',{name:'Collapse event log'})).toHaveAttribute('aria-expanded','true');
 assert((await log.boundingBox()).height <= 401);
 const app = await page.getByTestId('application').boundingBox(), bounds=await log.boundingBox();
 assert(app.y + app.height <= bounds.y + 1);
 await page.getByRole('button',{name:'Pin Event target',exact:true}).click();
 const context = page.getByRole('complementary',{name:'Event target context'});
 await expect(context).toBeVisible();
 await expect.poll(async () => {const box=await context.boundingBox(), region=await log.boundingBox(); return box.y+box.height <= region.y + 1;}).toBe(true);
 await page.getByRole('button',{name:'Dismiss component context'}).click();
 await page.getByRole('button',{name:'Toggle components'}).click();
 await expect(log).toBeVisible();
 await page.getByRole('button',{name:'Toggle events'}).click();
 await expect(log).toHaveCount(0);
 assert((await page.getByTestId('application').boundingBox()).height >= 799);
 await page.getByRole('button',{name:'Timed event'}).click();
 await page.waitForTimeout(250);
 await page.getByRole('button',{name:'Toggle events'}).click();
 await expect(log.getByText('Expires hidden')).toHaveCount(0);
 await page.getByRole('button',{name:'Toggle active'}).click();
 await expect(log).toHaveCount(0);
 await page.getByRole('button',{name:'Toggle active'}).click();
 await page.getByRole('button',{name:'Toggle embedding'}).click();
 await expect(log).toHaveCount(0);
 await page.getByRole('button',{name:'Toggle embedding'}).click();
 await expect(log.locator('[data-event-id]')).toHaveCount(9);
 await page.getByRole('button',{name:'Add oversized'}).click();
 await scroll.evaluate(node => {node.scrollTop=0;});
 await log.getByRole('button',{name:'Last entry action'}).scrollIntoViewIfNeeded();
 await expect(log.getByRole('button',{name:'Last entry action'})).toBeVisible();
 await page.setViewportSize({width:360,height:480});
 await expect.poll(async () => (await log.boundingBox()).height).toBeLessThan(241);
 const resizedApp=await page.getByTestId('application').boundingBox(), resizedLog=await log.boundingBox();
 assert(resizedApp.y + resizedApp.height <= resizedLog.y + 1);
 assert(resizedLog.y + resizedLog.height <= 481);
 await page.emulateMedia({reducedMotion:'reduce'});
 await expect(log.locator('[data-event-id]').first()).toHaveCSS('animation-name','none');
 await page.getByRole('textbox',{name:'Application text'}).fill('normal input?');
 await expect(page.getByRole('textbox',{name:'Application text'})).toHaveValue('normal input?');
 await page.emulateMedia({reducedMotion:'no-preference'});
 await log.getByRole('button',{name:'Dismiss Oversized'}).focus();
 await page.keyboard.press('Enter');
 await expect(log.getByText('Oversized',{exact:true})).toHaveCount(0);
 console.log('PASS live events: measured rows, order, arrival/update anchoring, grid, hidden expiry, embedding, oversized/mobile/reduced motion');
}

export async function verifyEventsTouch(browser,url) {
 const context = await browser.newContext({viewport:{width:390,height:600},hasTouch:true});
 try {
  const page = await context.newPage(); await page.goto(url+'?events');
  await page.getByRole('button',{name:'Toggle active'}).tap();
  await page.getByRole('button',{name:'Add tall',exact:true}).tap();
  const log=page.getByRole('region',{name:'Live events'});
  await log.getByRole('button',{name:'Expand event log'}).tap();
  await expect(log.getByRole('button',{name:'Collapse event log'})).toHaveAttribute('aria-expanded','true');
  await log.getByRole('button',{name:'Entry action'}).tap();
  await expect(log.getByRole('button',{name:'Collapse event log'})).toHaveAttribute('aria-expanded','true');
  await log.getByRole('button',{name:'Dismiss Tall 1'}).tap();
  await expect(log.getByText('No events yet')).toBeVisible();
 } finally { await context.close(); }
}

// Focused real-browser red/green runner; every server/browser is an owned handle.
if (process.argv.includes('--local')) {
 const { createServer } = await import('vite');
 const { chromium } = await import('@playwright/test');
 const server = await createServer({configFile:false,define:{__PACKAGE_NAME__:JSON.stringify('@borwood/demoable-react'),__PACKAGE_VERSION__:JSON.stringify('0.1.0')},root:fileURLToPath(new URL('../',import.meta.url)),server:{host:'127.0.0.1',port:0},plugins:[{
  name:'events-acceptance-fixture',
  configureServer(server) { server.middlewares.use((req,res,next) => { if (!req.url.startsWith('/__events')) return next(); res.setHeader('Content-Type','text/html'); res.end('<html><script>var __PACKAGE_NAME__="@borwood/demoable-react", __PACKAGE_VERSION__="0.1.0";</script><body style="margin:0"><div id="root"></div><script type="module" src="/@id/events-fixture.tsx"></script></body></html>'); }); },
  resolveId(id) { if(id === 'events-fixture.tsx') return id; },
  load(id) { if(id === 'events-fixture.tsx') return eventsFixture.replaceAll("'@borwood/demoable-react'","'/src/index.ts'").replaceAll("'@borwood/demoable-react/styles.css'","'/src/styles.css'") + `\nimport {createRoot} from 'react-dom/client';createRoot(document.getElementById('root')!).render(<EventsFixture/>);`; }
 }]});
 let browser;
 try {
  await server.listen(); const address = server.httpServer.address();
  console.log('Owned events Vite handle:', address);
  browser = await chromium.launch(); const page = await browser.newPage(); page.setDefaultTimeout(8000);
  page.on('pageerror',error=>console.error(error));
  await verifyEvents(page,`http://127.0.0.1:${address.port}/__events`);
 } finally { await browser?.close(); await server.close(); console.log('Closed owned events browser and Vite handles.'); }
}
