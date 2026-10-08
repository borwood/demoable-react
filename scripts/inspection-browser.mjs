import assert from 'node:assert/strict';
import { expect } from '@playwright/test';

// This app is compiled in each isolated tarball consumer, never aliased to source.
export const inspectionFixture = `
import { StrictMode, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { InspectionProvider, OrientationPanel, Inspectable, useInspectable, useInspectionGroup, useOccupiedRegion, useInspection } from '@borwood/demoable-react';
import '@borwood/demoable-react/styles.css';
const params = new URLSearchParams(location.search);
function Rich() {
  const [count, setCount] = useState(0);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { document.body.dataset.richMounts = String(Number(document.body.dataset.richMounts || 0) + 1); return () => { document.body.dataset.richUnmounts = String(Number(document.body.dataset.richUnmounts || 0) + 1); }; }, []);
  return <div data-testid="rich"><h2>Child explanation</h2><p>Selectable contextual description.</p><a href="#context-link">Working context link</a><button onClick={() => setCount(count + 1)}>Context count: {count}</button><button onClick={() => setExpanded(!expanded)}>Expand rich context</button>{expanded && <div>{Array.from({length: 80}, (_, i) => <p key={i}>Long contextual explanation line {i}</p>)}<button>Last rich control</button></div>}</div>;
}
function Regions() {
  const [visible, setVisible] = useState(true);
  const [refVisible, setRefVisible] = useState(true);
  const [groupVisible, setGroupVisible] = useState(true);
  const [revision, setRevision] = useState(1);
  const [omitContext, setOmitContext] = useState(false);
  const [offset, setOffset] = useState(0);
  const [reserve, setReserve] = useState(false);
  const [hostCount, setHostCount] = useState(0);
  const hostRef = useRef<HTMLButtonElement>(null);
  const noWrapper = useInspectable<HTMLButtonElement>({ label: 'Ref target', ...(omitContext ? {} : { context: <p>Ref explanation {revision}</p> }) }, hostRef);
  const group = useInspectionGroup({ label: 'Group target', context: <p>Shared group explanation</p> });
  const callbackRef = useCallback((node: HTMLDivElement | null) => { if (!node) return; document.body.dataset.callbackActive = '1'; return () => { document.body.dataset.callbackActive = '0'; }; }, []);
  const owner = useInspectable<HTMLDivElement>({ label: 'Portal owner', context: <p>Owned portal explanation</p> });
  const portal = useInspectable<HTMLDivElement>({ label: 'Portal member', context: <p>Wrong member context</p>, ownerId: owner.id });
  const occupied = useOccupiedRegion();
  const duplicateOccupied = useOccupiedRegion();
  const state = useInspection();
  return <main style={{minHeight: 1800, fontFamily: 'sans-serif'}}>
    <output data-testid="inspection-state">{JSON.stringify({active: state.active, component: state.componentInspection, event: state.eventInspection, opacity: state.opacity, pinned: state.pinnedId})}</output>
    <nav style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
      <button onClick={() => setVisible(!visible)}>Toggle child</button><button onClick={() => setRefVisible(!refVisible)}>Toggle ref element</button><button onClick={() => setGroupVisible(!groupVisible)}>Toggle group member</button><button onClick={() => setRevision(revision + 1)}>Update context</button><button onClick={() => setOmitContext(!omitContext)}>Toggle optional context</button><button onClick={() => setOffset(offset + 80)}>Move target</button><button onClick={() => setReserve(!reserve)}>Toggle reserved region</button><button onClick={() => { if (hostRef.current) hostRef.current.focus(); }}>Focus application ref</button>
    </nav>
    <input aria-label="Application input" /><textarea aria-label="Application textarea" /><div contentEditable suppressContentEditableWarning role="textbox" aria-label="Application editor">Editable<button contentEditable={false}>Noneditable island</button></div>
    <Inspectable label="Parent target" context={<p>Parent explanation only</p>} data-testid="parent" style={{position: 'absolute', top: 200, left: 60, width: 360, height: 220, background: '#eee', padding: 20}}>
      <span data-testid="parent-only">Parent only area</span>
      {visible && <Inspectable label="Child target" context={<Rich />} data-testid="child" style={{marginTop: 35, width: 180, height: 90, background: '#ccd'}}><button onClick={() => setHostCount(hostCount + 1)}>Host count: {hostCount}</button></Inspectable>}
    </Inspectable>
    {refVisible && <button ref={noWrapper.ref} data-testid="ref-target" style={{position: 'absolute', top: 200 + offset, left: 520, width: 180, height: 90}}>No wrapper button</button>}
    {groupVisible && <div ref={group.ref('first', callbackRef)} data-testid="group-first" style={{position: 'absolute', left: 70, top: 510, width: 120, height: 60, background: '#ded'}}>First group member</div>}
    <div ref={group.ref('second')} data-testid="group-second" style={{position: 'absolute', left: 280, top: 510, width: 120, height: 60, background: '#ded'}}>Second group member</div>
    <div ref={owner.ref} data-testid="owner" style={{position: 'absolute', left: 530, top: 380, width: 170, height: 70}}>Portal owner target</div>
    {createPortal(<div ref={portal.ref} data-testid="portal" style={{position: 'absolute', left: 530, top: 510, width: 230, height: 130, background: '#eed'}}>Portal member <Inspectable label="Portal child" context={<p>Deep portal child explanation</p>} data-testid="portal-child" style={{margin: 20, padding: 10}}>Independent deep target</Inspectable></div>, document.body)}
    <Inspectable label="Empty target" context={null} data-testid="empty" style={{position: 'absolute', top: 700, left: 70}}>Empty context</Inspectable>
    <div data-testid="scroll-container" style={{position: 'absolute', top: 200, left: 810, width: 120, height: 100, overflow: 'auto'}}><Inspectable label="Clipped target" context={<p>Clipped explanation</p>} data-testid="clipped" style={{height: 220, width: 100, background: '#def'}}>A scrolling region</Inspectable></div>
    {reserve && <aside ref={occupied} data-testid="reserved" style={{position: 'fixed', right: 0, top: 0, bottom: 0, width: 340, background: '#cdf', zIndex: 10}}><div ref={duplicateOccupied} style={{height:"100%"}}><button>Reserved region control</button></div></aside>}
    <OrientationPanel style={{position:'fixed',top:100,right:0,width:160}}/>
  </main>;
}
export function InspectionFixture() {
  const [mounted, setMounted] = useState(true);
  return <><button data-testid="mount-toggle" onClick={() => setMounted(!mounted)}>Toggle provider</button>{mounted && <StrictMode><InspectionProvider device={(params.get('device') || 'desktop') as 'desktop' | 'mobile' | 'auto'} initialComponentInspection={params.get('component') !== 'off'} initialEventInspection={params.get('event') !== 'off'} initialOpacity={Number(params.get('opacity') || '.75')}><Regions /></InspectionProvider></StrictMode>}</>;
}
`;

const hint = "activate component and event inspection with '?' key";
const pin = (page, label) => page.getByRole('button', { name: `Pin ${label}`, exact: true });
const contextBox = page => page.locator('[data-demoable-ui=context]');
async function state(page) { return JSON.parse(await page.getByTestId('inspection-state').textContent()); }
async function hoverCenter(page, locator) {
  const box = await locator.boundingBox();
  assert(box);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
}
async function insideViewport(page, locator) {
  await expect.poll(async () => {
    const rect = await locator.boundingBox();
    const size = page.viewportSize();
    return !!rect && rect.x >= -1 && rect.y >= -1 && rect.x + rect.width <= size.width + 1 && rect.y + rect.height <= size.height + 1;
  }, { message: 'measured surface remains within the viewport' }).toBe(true);
}

export async function verifyInspection(page, url) {
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.goto(`${url}/?fixture=inspection`);
  const gear = page.getByRole('button', { name: 'Inspection settings', exact: true });
  await expect(page.getByText(hint, { exact: true })).toHaveCount(0);
  assert.equal((await state(page)).active, false, 'desktop inactive initially');
  await expect(gear).toHaveCount(0);
  const originalRect = await page.getByTestId('parent').boundingBox();
  for (const name of ['Application input', 'Application textarea', 'Application editor']) {
    await page.getByRole('textbox', { name, exact: true }).press('?');
    assert.equal((await state(page)).active, false, `shortcut ignored in ${name}`);
  }
  await page.getByRole('button', { name: 'Noneditable island', exact: true }).press('?');
  await expect(gear).toBeVisible();
  await page.getByRole('button', { name: 'Noneditable island', exact: true }).press('?');
  await expect(gear).toHaveCount(0);
  await page.locator('body').click({ position: { x: 950, y: 100 } });
  await page.keyboard.press('/');
  assert.equal((await state(page)).active, false, 'slash is not question mark');
  await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', repeat: true, bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', isComposing: true, bubbles: true }));
  });
  assert.equal((await state(page)).active, false);
  await page.keyboard.press('?');
  await expect(gear).toBeVisible();
  assert.deepEqual(await page.getByTestId('parent').boundingBox(), originalRect, 'overlays do not change host layout');
  await page.getByRole('button', { name: 'Host count: 0', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Host count: 1', exact: true })).toBeVisible();
  await hoverCenter(page, page.getByTestId('child'));
  await expect(contextBox(page)).toContainText('Child explanation');
  await expect(contextBox(page)).not.toContainText('Parent explanation only');
  await expect(contextBox(page)).toHaveAttribute('data-edge', 'right');
  await expect(contextBox(page)).toHaveCSS('opacity', '1');
  await expect(contextBox(page)).toHaveCSS('background-color', 'rgba(250, 248, 255, 0.75)');
  await expect(contextBox(page).locator('.demoable-react-context-body')).toHaveCSS('color', 'rgba(37, 32, 52, 0.9)');
  assert(Math.abs((await contextBox(page).boundingBox()).x - ((await page.getByTestId('child').boundingBox()).x + (await page.getByTestId('child').boundingBox()).width + 8)) < 2, 'card sits adjacent to target');
  await expect(pin(page, 'Child target')).toHaveText('?');
  await expect(page.getByRole('button', {name:'Dismiss component context'})).toHaveText('x');
  const circle = await pin(page, 'Child target').boundingBox();
  assert.equal(circle.width, circle.height, 'circular pin has equal dimensions');
  assert(circle.width >= 24);
  const firstPosition = await contextBox(page).boundingBox();
  const child = await page.getByTestId('child').boundingBox();
  await page.mouse.move(child.x + 15, child.y + child.height - 15);
  assert.deepEqual(await contextBox(page).boundingBox(), firstPosition, 'motion within target does not reposition');
  await contextBox(page).hover();
  await page.waitForTimeout(350);
  await page.getByRole('button', { name: 'Context count: 0', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Context count: 1', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Working context link' }).click();
  assert.equal(new URL(page.url()).hash, '#context-link');
  await expect(page.getByTestId('rich')).toHaveCount(1);
  assert.equal(await page.evaluate(() => Number(document.body.dataset.richMounts) - Number(document.body.dataset.richUnmounts || 0)), 1, 'rich content has one live mount');
  await page.getByRole('button', { name: 'Expand rich context', exact: true }).click();
  await insideViewport(page, contextBox(page));
  await insideViewport(page, page.getByRole('button', { name: 'Dismiss component context', exact: true }));
  await page.getByRole('button', { name: 'Last rich control', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'Last rich control', exact: true })).toBeInViewport();
  await page.getByRole('button', { name: 'Expand rich context', exact: true }).click();
  await hoverCenter(page, page.getByTestId('parent-only'));
  await expect(contextBox(page)).toContainText('Parent explanation only');
  // geometry changes must clear an unpinned hover even
  // when no pointer event occurs after its target leaves the viewport.
  assert.equal((await state(page)).pinned, null);
  await page.evaluate(() => window.scrollTo(0, 1000));
  await expect(contextBox(page)).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await hoverCenter(page, page.getByTestId('parent-only'));
  await expect(contextBox(page)).toContainText('Parent explanation only');
  // only the interactive context protects the leave grace;
  // hovering unrelated library controls must not keep this box alive.
  await gear.hover();
  await expect(contextBox(page)).toHaveCount(0);
  await pin(page, 'Child target').click();
  await expect(pin(page, 'Child target')).toHaveAttribute('aria-pressed', 'true');
  await expect(pin(page, 'Child target')).toHaveCSS('font-weight', '900');
  await hoverCenter(page, page.getByTestId('ref-target'));
  await expect(contextBox(page)).toContainText('Child explanation');
  const panel = await contextBox(page).boundingBox();
  await page.getByTestId('ref-target').evaluate((element, box) => { element.style.left = box.x + 40 + 'px'; element.style.top = box.y + 70 + 'px'; }, panel);
  await expect.poll(async () => {
    const button = await pin(page, 'Ref target').boundingBox();
    const box = await contextBox(page).boundingBox();
    return button.x + button.width <= box.x || box.x + box.width <= button.x || button.y + button.height <= box.y || box.y + box.height <= button.y;
  }, { message: 'direct-transfer pin remains clickable when its normal position is behind the current panel' }).toBe(true);
  await pin(page, 'Ref target').click();
  await expect(contextBox(page)).toContainText('Ref explanation 1');
  await page.getByTestId('ref-target').evaluate(element => { element.style.left = '520px'; element.style.top = '200px'; });
  await expect(pin(page, 'Child target')).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Update context', exact: true }).click();
  await expect(contextBox(page)).toContainText('Ref explanation 2');
  await page.getByRole('button', { name: 'Toggle optional context', exact: true }).click();
  await expect(contextBox(page), 'Omitting optional context must remove the stale panel').toHaveCount(0);
  await expect(pin(page, 'Ref target')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Toggle optional context', exact: true }).click();
  await expect(contextBox(page)).toContainText('Ref explanation 2');
  await page.keyboard.press('?');
  await expect(gear).toHaveCount(0);
  await expect(contextBox(page)).toHaveCount(0);
  await page.keyboard.press('?');
  await expect(contextBox(page)).toContainText('Ref explanation 2');
  await page.getByRole('button', { name: 'Focus application ref', exact: true }).click();
  await expect(page.getByTestId('ref-target')).toBeFocused();
  const beforeMove = await pin(page, 'Ref target').boundingBox();
  await page.getByRole('button', { name: 'Move target', exact: true }).click();
  await expect.poll(async () => (await pin(page, 'Ref target').boundingBox()).y).toBeCloseTo(beforeMove.y + 80, 0);
  await pin(page, 'Ref target').click();
  await hoverCenter(page, page.getByTestId('child'));
  await expect(contextBox(page)).toContainText('Child explanation');
  await page.keyboard.press('?');
  await hoverCenter(page, page.getByTestId('ref-target'));
  await page.keyboard.press('?');
  await expect(contextBox(page)).toContainText('Ref explanation 2');
  await pin(page, 'Ref target').click();
  await page.getByRole('button', { name: 'Toggle ref element', exact: true }).click();
  await expect(contextBox(page)).toHaveCount(0);
  await expect(pin(page, 'Ref target')).toHaveCount(0);
  await expect.poll(async () => (await state(page)).pinned).toBeNull();
  await page.getByRole('button', { name: 'Toggle ref element', exact: true }).click();
  await expect(pin(page, 'Ref target')).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-callback-active', '1');
  await page.getByRole('button', { name: 'Toggle group member', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute('data-callback-active', '0');
  await page.getByRole('button', { name: 'Toggle group member', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute('data-callback-active', '1');
  await hoverCenter(page, page.getByTestId('group-first'));
  await expect(contextBox(page)).toContainText('Shared group explanation');
  await hoverCenter(page, page.getByTestId('group-second'));
  await expect(contextBox(page)).toContainText('Shared group explanation');
  await page.mouse.move(235, 540);
  await expect(contextBox(page)).toHaveCount(0); // The gap between roots is not a target.
  await page.mouse.move(545, 520);
  await expect(contextBox(page)).toContainText('Owned portal explanation');
  // explicit owner suppression includes its separately registered portal members.
  await page.getByRole('button', { name: 'Dismiss component context', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(contextBox(page)).toHaveCount(0);
  await page.mouse.move(546, 520);
  await expect(contextBox(page), 'Dismissed owner must stay suppressed while pointer remains in its portal member').toHaveCount(0);
  await page.mouse.move(900, 100);
  await page.mouse.move(545, 520);
  await expect(contextBox(page)).toContainText('Owned portal explanation');
  await hoverCenter(page, page.getByTestId('portal-child'));
  await expect(contextBox(page)).toContainText('Deep portal child explanation');
  const clippedId = await pin(page, 'Clipped target').getAttribute('data-demoable-target');
  const clippedOutline = page.locator('[data-demoable-outline="' + clippedId + '"]');
  await expect.poll(async () => (await clippedOutline.boundingBox()).height).toBe(100);
  await page.getByTestId('scroll-container').evaluate(element => { element.scrollTop = 70; });
  await expect.poll(async () => (await clippedOutline.boundingBox()).height).toBe(100);
  await expect.poll(async () => (await clippedOutline.boundingBox()).y).toBe(200);
  await pin(page, 'Child target').focus();
  await page.keyboard.press('Enter');
  await expect(contextBox(page)).toContainText('Child explanation');
  await page.getByRole('button', { name: 'Dismiss component context', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(contextBox(page)).toHaveCount(0);
  await expect(pin(page, 'Child target')).toBeFocused();
  await page.mouse.move(900, 100);
  await hoverCenter(page, page.getByTestId('child'));
  await expect(contextBox(page)).toContainText('Child explanation');
  await page.getByRole('button', { name: 'Dismiss component context', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.mouse.move(child.x + 30, child.y + 50);
  await expect(contextBox(page)).toHaveCount(0);
  await page.mouse.move(900, 100);
  await hoverCenter(page, page.getByTestId('child'));
  await expect(contextBox(page)).toContainText('Child explanation');
  await pin(page, 'Child target').click();
  await page.getByRole('button', { name: 'Toggle child', exact: true }).click();
  await expect(contextBox(page)).toHaveCount(0);
  await expect(pin(page, 'Child target')).toHaveCount(0);
  await page.getByRole('button', { name: 'Toggle child', exact: true }).click();
  await pin(page, 'Child target').click();
  const pinnedPosition = await contextBox(page).boundingBox();
  await page.evaluate(() => window.scrollTo(0, 1000));
  await expect(contextBox(page)).toContainText('Child explanation');
  assert.deepEqual(await contextBox(page).boundingBox(), pinnedPosition, 'offscreen pin keeps last valid placement');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('button', { name: 'Dismiss component context', exact: true }).click();
  await hoverCenter(page, page.getByTestId('empty'));
  await expect(contextBox(page)).toHaveCount(0);

  // Settings belong to the orientation surface.
  await expect(gear.locator('..')).toHaveClass('demoable-react-controls');
  await page.setViewportSize({ width: 720, height: 520 });
  await gear.click();
  const componentToggle = page.getByRole('checkbox', { name: 'Component inspection', exact: true });
  const eventToggle = page.getByRole('checkbox', { name: 'Event inspection', exact: true });
  await componentToggle.uncheck();
  assert.equal((await state(page)).event, true);
  await expect(pin(page, 'Parent target')).toHaveCount(0);
  await eventToggle.uncheck();
  await componentToggle.check();
  assert.equal((await state(page)).event, false);
  await page.getByRole('slider', { name: 'Info and settings background opacity', exact: true }).fill('0.4');
  assert.equal((await state(page)).opacity, 0.4);
  await insideViewport(page, componentToggle);
  await insideViewport(page, page.getByRole('slider', { name: 'Info and settings background opacity', exact: true }));
  await gear.click();
  await page.setViewportSize({ width: 1000, height: 800 });
  await pin(page, 'Child target').click();
  await insideViewport(page, contextBox(page));
  await expect(contextBox(page)).toHaveCSS('background-color', 'rgba(250, 248, 255, 0.4)');
  await expect(contextBox(page).locator('.demoable-react-context-body')).toHaveCSS('color', 'rgba(37, 32, 52, 0.55)');
  await page.getByRole('button', { name: 'Toggle reserved region', exact: true }).click();
  await expect.poll(async () => {
    const box = await contextBox(page).boundingBox();
    const reserved = await page.getByTestId('reserved').boundingBox();
    return box.x + box.width <= reserved.x + 1 || box.x >= reserved.x + reserved.width || box.y + box.height <= reserved.y || box.y >= reserved.y + reserved.height;
  }).toBe(true);
  await page.setViewportSize({width:700,height:400});
  await page.getByTestId('ref-target').evaluate(element=>Object.assign(element.style,{position:'fixed',left:'170px',top:'80px',width:'160px',height:'240px'}));
  await pin(page,'Ref target').click();
  await expect(contextBox(page)).toHaveAttribute('data-edge','left');
  await insideViewport(page,contextBox(page));
  assert((await contextBox(page).boundingBox()).x + (await contextBox(page).boundingBox()).width <= 360, 'no-fit clamp excludes union of overlapping reservations');
  await page.setViewportSize({width:1000,height:800});
  await page.getByTestId('mount-toggle').click();
  await expect(gear).toHaveCount(0);
  await expect(contextBox(page)).toHaveCount(0);
  await page.keyboard.press('?');
  await page.getByTestId('mount-toggle').click();
  assert.equal((await state(page)).active, false, 'unmounted listeners do not carry state into remount');
  await page.keyboard.press('?');
  await expect(gear).toHaveCount(1);
  // all full-fit sides, right/bottom/left/top priority and cross-axis shifting.
  await page.setViewportSize({ width: 800, height: 800 });
  for (const [x, y, width, edge] of [[350, 350, 100, 'right'], [30, 3, 100, 'right'], [350, 30, 400, 'bottom'], [650, 650, 100, 'left'], [10, 650, 780, 'top']]) {
    await page.getByTestId('ref-target').evaluate((element, coordinates) => {
      Object.assign(element.style, { position: 'fixed', left: coordinates.x + 'px', top: coordinates.y + 'px', width: coordinates.width + 'px', height: '100px' });
    }, { x, y, width });
    if (!(await state(page)).pinned) await pin(page, 'Ref target').click();
    await expect(contextBox(page)).toHaveAttribute('data-edge', edge);
    await insideViewport(page, contextBox(page));
    await expect.poll(async () => {
      const target = await page.getByTestId('ref-target').boundingBox(), card = await contextBox(page).boundingBox();
      const gap = edge === 'right' ? card.x - target.x - target.width : edge === 'bottom' ? card.y - target.y - target.height : edge === 'left' ? target.x - card.x - card.width : target.y - card.y - card.height;
      return Math.abs(gap - 8);
    }, {message:'main-axis adjacency survives cross-axis shifting'}).toBeLessThan(2);
  }
  // No direction fits: independently calculate visible rectangle areas before shifting.
  await page.setViewportSize({width:300,height:180});
  await page.getByTestId('ref-target').evaluate(element => Object.assign(element.style,{left:'110px',top:'60px',width:'80px',height:'60px'}));
  await insideViewport(page, contextBox(page));
  await expect.poll(async () => {
    const card = await contextBox(page).boundingBox(), w=card.width, h=card.height;
    const candidates = [['right',198,90-h/2],['bottom',150-w/2,128],['left',102-w,90-h/2],['top',150-w/2,52-h]];
    const occupied=await page.getByRole('region',{name:'Demo orientation'}).boundingBox();
    const areas=candidates.map(([edge,x,y])=>{
      const left=Math.max(0,x),top=Math.max(0,y),right=Math.min(300,x+w),bottom=Math.min(180,y+h);
      const visible=Math.max(0,right-left)*Math.max(0,bottom-top);
      const reserved=Math.max(0,Math.min(right,occupied.x+occupied.width)-Math.max(left,occupied.x))*Math.max(0,Math.min(bottom,occupied.y+occupied.height)-Math.max(top,occupied.y));
      return [edge,visible-reserved];
    });
    areas.sort((a,b)=>b[1]-a[1]);
    return await contextBox(page).getAttribute('data-edge') === areas[0][0];
  }, {message:'no-fit ranks maximum visible area before clamp'}).toBe(true);
  const overlap = await contextBox(page).boundingBox();
  assert(overlap.x < 190 && overlap.x+overlap.width > 110 && overlap.y < 120 && overlap.y+overlap.height > 60, 'fallback permits target overlap');
  await pin(page,'Ref target').click({position:{x:3,y:13}});
  await expect(pin(page,'Ref target')).toHaveAttribute('aria-pressed','false');
  await pin(page,'Ref target').click({position:{x:3,y:13}});
  await expect(pin(page,'Ref target')).toHaveAttribute('aria-pressed','true');
  await page.getByTestId('ref-target').evaluate(element => element.style.left='-1000px');
  const side = await contextBox(page).getAttribute('data-edge');
  await page.setViewportSize({width:240,height:160});
  await insideViewport(page,contextBox(page));
  await expect(contextBox(page)).toHaveAttribute('data-edge',side);
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.getByRole('button', { name: 'Dismiss component context', exact: true }).click();
  // independently selectable controls remain separated at coincident tops.
  await page.getByTestId('child').evaluate(element => { Object.assign(element.style, { position: 'absolute', top: '0', left: '0', margin: '0' }); });
  await expect.poll(async () => {
    const parent = await pin(page, 'Parent target').boundingBox();
    const nested = await pin(page, 'Child target').boundingBox();
    return parent.x + parent.width <= nested.x || nested.x + nested.width <= parent.x || parent.y + parent.height <= nested.y || nested.y + nested.height <= parent.y;
  }).toBe(true);
  await pin(page, 'Parent target').click();
  await expect(contextBox(page)).toContainText('Parent explanation only');
  await pin(page, 'Child target').click();
  await expect(contextBox(page)).toContainText('Child explanation');
  console.log('PASS actual input, nested/ref/group/portal selection, interactive context, pin lifecycle, layout movement, anchored settings/resize, occupied region, StrictMode remount');
}

export async function verifyMobileAndHint(browser, url) {
  const context = await browser.newContext({ viewport: { width: 390, height: 700 }, hasTouch: true, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('requestfailed', request => errors.push(request.failure()?.errorText));
    await page.goto(`${url}/?fixture=inspection&device=mobile&component=off&event=on&opacity=.25`);
    assert.equal((await state(page)).active, true);
    assert.equal((await state(page)).component, false);
    assert.equal((await state(page)).event, true);
    assert.equal((await state(page)).opacity, .25);
    await page.keyboard.press('?');
    assert.equal((await state(page)).active, true);
    const gear = page.getByRole('button', { name: 'Inspection settings', exact: true });
    await gear.tap();
    await page.getByRole('checkbox', { name: 'Component inspection', exact: true }).check();
    await insideViewport(page, page.getByRole('slider', { name: 'Info and settings background opacity', exact: true }));
    await gear.tap();
    await pin(page, 'Child target').tap();
    await expect(contextBox(page)).toContainText('Child explanation');
    await insideViewport(page, contextBox(page));
    await page.getByRole('button', { name: 'Dismiss component context', exact: true }).tap();
    await expect(contextBox(page)).toHaveCount(0);
    await expect(page.getByText(hint, { exact: true })).toHaveCount(0, { timeout: 6500 });
    await page.goto(`${url}/?fixture=inspection&device=auto`);
    const autoMobile = await page.evaluate(() => matchMedia('(hover: none) and (pointer: coarse)').matches);
    assert.equal((await state(page)).active, autoMobile, 'auto follows primary-input query, not touch support alone');
    await page.keyboard.press('?');
    assert.equal((await state(page)).active, true);
    assert.deepEqual(errors, [], 'Mobile consumer has no browser errors');
    console.log('PASS mobile settings, touch pin/dismiss, reduced-motion hint, primary-input classification');
  } finally { await context.close(); }
}

