import { expect } from '@playwright/test';

export const feedbackFixture = `
import { useState } from 'react';
import { InspectionProvider, DemoLayout, Inspectable, useInspectable, useInspection, useEvents, useDemoSessionState } from '@borwood/demoable-react';
import '@borwood/demoable-react/styles.css';
function Content() {
 const state = useInspection(), events = useEvents();
 const [enabled, setEnabled] = useState(true);
 const [scenario, setScenario] = useDemoSessionState('host:scenario', 'normal', (v): v is string => typeof v === 'string');
 const target = useInspectable({label:'Hook content', context:<p>Hook description</p>, enabled});
 const summary = useInspectable<HTMLElement>({label:'Summary', context:<p>Summary description</p>});
 return <DemoLayout orientation="Feedback fixture" controls={<><button onClick={() => state.setActive(!state.active)}>Toggle layer</button><button onClick={() => setScenario('slow')}>Scenario {scenario}</button></>}>
  <main style={{color:'rgb(1, 2, 3)',padding:40}}><button onClick={() => setEnabled(!enabled)}>Toggle enabled</button><button onClick={() => events.start({label:'One event'})}>Report</button>
  <details data-testid="disclosure"><summary ref={summary.ref}>Disclosure</summary><div ref={target.ref} data-testid="hook" style={{padding:30}}>Hook content</div><Inspectable label="Wrapper content" context="Wrapper description" style={{padding:30}}>Wrapper content</Inspectable></details>
  <div data-testid="hideable"><Inspectable label="Visible target" context="Visible description" style={{padding:30}}>Visible target</Inspectable></div>
  <output data-testid="pinned">{state.pinnedId ?? 'none'}</output><div style={{height:1600}}>Long host content</div></main>
 </DemoLayout>;
}
export function FeedbackFixture() { return <InspectionProvider device="desktop" sessionKey="feedback" theme={{demoSurface:'#181e21',surfaceRgb:'24 30 33',inkRgb:'235 240 242',ink:'#ebf0f2',muted:'#a9b6bc',border:'#46555c',buttonSurface:'#29343a',accent:'#bfa7ff'}}><Content /></InspectionProvider>; }
`;

export async function verifyFeedback(page, url) {
 await page.setViewportSize({width:1000,height:800});
 await page.goto(url + '?feedback');
 await page.evaluate(() => sessionStorage.clear());
 await page.reload();
 await expect.poll(() => page.evaluate(() => sessionStorage.getItem('demoable-react:v1:feedback:active'))).toBe('false');
 await page.keyboard.press('?');
 const pin = name => page.getByRole('button',{name:'Pin '+name,exact:true});
 await expect(pin('Summary')).toBeVisible();
 await expect(pin('Hook content')).toHaveCount(0);
 await expect(pin('Wrapper content')).toHaveCount(0);
 await page.getByTestId('disclosure').evaluate(node => { node.open = true; });
 await expect(pin('Hook content')).toBeVisible();
 await expect(pin('Wrapper content')).toBeVisible();
 await pin('Hook content').click();
 await page.getByTestId('disclosure').evaluate(node => { node.open = false; });
 await expect(pin('Hook content')).toHaveCount(0);
 await expect(page.getByTestId('pinned')).toHaveText('none');
 await page.getByTestId('disclosure').evaluate(node => { node.open = true; });
 await page.getByText('Toggle enabled',{exact:true}).click();
 await expect(pin('Hook content')).toHaveCount(0);
 await page.getByText('Toggle enabled',{exact:true}).click();
 await expect(pin('Hook content')).toBeVisible();
 for (const property of ['display','visibility','contentVisibility']) {
  await page.getByTestId('hideable').evaluate((node,property) => { node.style[property] = property === 'display' ? 'none' : 'hidden'; },property);
  await expect(pin('Visible target')).toHaveCount(0);
  await page.getByTestId('hideable').evaluate(node => { node.removeAttribute('style'); });
  await expect(pin('Visible target')).toBeVisible();
 }
 await pin('Visible target').click();
 const log = page.getByRole('region',{name:'Live events'});
 await expect(log).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
 await expect(log).toHaveCSS('color','rgb(235, 240, 242)');
 await expect(page.locator('main')).toHaveCSS('color','rgb(1, 2, 3)');
 await expect(page.locator('.demoable-react-context-body')).toHaveCSS('color','rgba(235, 240, 242, 0.9)');
 await expect(pin('Visible target').locator('svg')).toHaveCount(1);
 await page.getByRole('button',{name:'Dismiss component context'}).click();
 await page.getByRole('button',{name:'Expand event log'}).focus();
 await page.keyboard.press('Enter');
 await expect.poll(() => page.locator('.demoable-react-event-scroll').evaluate(node => node.clientHeight)).toBeGreaterThanOrEqual(112);
 await page.getByText('Report',{exact:true}).click();
 await expect.poll(() => page.locator('.demoable-react-event-scroll').evaluate(node => node.clientHeight)).toBeGreaterThanOrEqual(112);
 await page.getByRole('button',{name:'Dismiss One event'}).click();
 await expect(page.getByRole('button',{name:'Collapse event log'})).toHaveAttribute('aria-expanded','true');
 await page.getByText('Scenario normal',{exact:true}).click();
 await page.reload();
 await expect(page.getByText('Scenario slow',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Collapse event log'})).toBeVisible();
 await expect(page.getByText('One event',{exact:true})).toHaveCount(0);
 await page.goto(url + '?feedback&auth-return=1');
 await expect(page.getByText('Scenario slow',{exact:true})).toBeVisible();
 await expect(page.locator('.demoable-react-app-frame')).toHaveCSS('overflow','hidden');
 await expect(page.locator('.demoable-react-app-frame')).toHaveCSS('border-radius','28px');
 await page.locator('.demoable-react-app').evaluate(node => { node.scrollTop = 300; });
 await expect.poll(() => page.locator('.demoable-react-app').evaluate(node => node.scrollTop)).toBeGreaterThan(0);
 await page.setViewportSize({width:360,height:300});
 await expect.poll(async () => (await log.boundingBox()).height).toBeLessThanOrEqual(151);
 const other = await page.context().newPage();
 await other.goto(url + '?feedback');
 await expect(other.getByRole('region',{name:'Live events'})).toHaveCount(0);
 await other.close();
}
