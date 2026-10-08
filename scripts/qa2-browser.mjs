import assert from 'node:assert/strict';
import {expect} from '@playwright/test';
export const qa2Fixture = `
import {useState} from 'react';
import {DemoLayout, OrientationPanel, InspectionProvider, Inspectable, useInspection} from '@borwood/demoable-react';
import '@borwood/demoable-react/styles.css';
const params=new URLSearchParams(location.search);
function Host(){const [count,setCount]=useState(0);return <main data-testid="host" style={{margin:'24px 32px',padding:16,background:'#edf3e8',border:'2px solid #345',font:'17px/1.4 serif'}}><h1>Ordinary host</h1><input aria-label="Host value" defaultValue="kept"/><button onClick={()=>setCount(count+1)}>Host count {count}</button><div data-testid="host-grid" style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:13}}><div>One</div><div>Two</div></div><div style={{height:1800}}/><button data-testid="host-bottom">Bottom action</button></main>;}
function ContextContent(){const [count,setCount]=useState(0);return <><p>Persistent rich information</p><button onClick={()=>setCount(count+1)}>Rich count {count}</button></>;}
function Targets(){return <><Inspectable label="First target" context={<ContextContent/>} data-testid="qa-first" style={{position:'absolute',left:80,top:230,width:160,height:110}}>First</Inspectable><Inspectable label="Second target" context={<p>Second information</p>} data-testid="qa-second" style={{position:'absolute',left:400,top:410,width:160,height:110}}>Second</Inspectable></>;}
function Application(){const state=useInspection();return <><button onClick={()=>state.setActive(!state.active)}>Toggle layer</button><Targets/></>;}
export function Qa2Fixture(){
 if(params.has('plain')) return <Host/>;
 if(params.has('parity')) return <InspectionProvider device="desktop"><DemoLayout className="qa-custom-shell" appClassName="qa-custom-app" style={{height:260,margin:35,background:'pink',border:'4px solid red',overflow:'hidden'}} appStyle={{padding:7,background:'yellow',borderRadius:50}} orientation={<p>Host explanation</p>}><Host/></DemoLayout><style>{'.qa-custom-shell {font-family:monospace;box-shadow:0 0 10px red}.qa-custom-app {isolation:isolate}'}</style></InspectionProvider>;
 return <InspectionProvider device="desktop" initialOpacity={Number(params.get('opacity')??'.75')}><style>{'body{margin:0}'}</style>{params.has('provider')?<Application/>:<><OrientationPanel controls={<input aria-label="Demo text" defaultValue="editable"/>}/><Application/></>}</InspectionProvider>;
}
`;
async function hostSnapshot(page){await expect(page.getByTestId('host')).toBeVisible();return page.evaluate(()=>{
 const host=document.querySelector('[data-testid=host]'),grid=document.querySelector('[data-testid=host-grid]'), bottom=document.querySelector('[data-testid=host-bottom]');
 const style=getComputedStyle(host);
 return {host:host.getBoundingClientRect().toJSON(),grid:grid.getBoundingClientRect().toJSON(),bottom:bottom.getBoundingClientRect().toJSON(),documentHeight:document.documentElement.scrollHeight,font:style.font,padding:style.padding,background:style.backgroundColor,windowScroll:scrollY};
});}
export async function verifyQa2(page,url){
 await page.setViewportSize({width:1000,height:800});
 await page.goto(url+'?qa2&parity&plain'); const reference=await hostSnapshot(page); const referencePixels=await page.screenshot({animations:'disabled'});
 await page.getByTestId('host-bottom').scrollIntoViewIfNeeded(); const referenceScroll=await hostSnapshot(page);
 await page.goto(url+'?qa2&parity');
 assert.deepEqual(await hostSnapshot(page),reference,'inactive integration equals unintegrated host geometry and styles');
 assert(referencePixels.equals(await page.screenshot({animations:'disabled'})), 'inactive and unintegrated host screenshots match');
 await expect(page.getByText("activate component and event inspection with '?' key",{exact:true})).toHaveCount(0);
 await page.getByTestId('host-bottom').scrollIntoViewIfNeeded();
 assert.deepEqual(await hostSnapshot(page),referenceScroll,'inactive host keeps normal page scrolling');
 await page.evaluate(()=>scrollTo(0,0));
 await page.getByRole('textbox',{name:'Host value'}).fill('preserved');
 await page.getByRole('button',{name:'Host count 0'}).click();
 await page.locator('body').press('?');
 await expect(page.getByRole('region',{name:'Demo orientation'})).toBeVisible();
 await page.locator('body').press('?');
 await expect(page.getByRole('textbox',{name:'Host value'})).toHaveValue('preserved');
 await expect(page.getByRole('button',{name:'Host count 1'})).toHaveCount(1);
 assert.deepEqual(await hostSnapshot(page),reference,'disabling restores unintegrated layout after active custom styles');

 await page.goto(url+'?qa2&provider'); await expect(page.getByRole('button',{name:'Toggle layer',exact:true})).toBeVisible(); await page.locator('body').press('?');
 await expect(page.getByRole('button',{name:'Inspection settings',exact:true})).toHaveCount(0);
 await page.goto(url+'?qa2'); await expect(page.getByRole('button',{name:'Toggle layer',exact:true})).toBeVisible(); await page.locator('body').press('?');
 const gear=page.getByRole('button',{name:'Inspection settings',exact:true}), panel=page.getByRole('region',{name:'Demo orientation'});
 await expect(panel.locator('.demoable-react-controls > :first-child')).toHaveAttribute('aria-label','Inspection settings');
 const gearPosition=await gear.boundingBox(); assert(gearPosition.y<150);
 const firstPin=page.getByRole('button',{name:'Pin First target',exact:true});
 await expect.poll(async()=>firstPin.evaluate(button=>{const target=document.querySelector('[data-testid=qa-first]').getBoundingClientRect(),b=button.getBoundingClientRect();return {x:b.x-target.x,y:b.y-target.y};})).toEqual({x:2,y:2});
 await firstPin.hover(); await page.waitForTimeout(420);
 const box=page.getByRole('complementary',{name:'First target context'});
 await expect(box).toBeVisible();
 await page.getByTestId('qa-first').hover({position:{x:100,y:85}}); await firstPin.hover(); await page.waitForTimeout(420); await expect(box).toBeVisible();
 await box.hover(); await page.getByRole('button',{name:'Rich count 0'}).click(); await firstPin.hover(); await page.waitForTimeout(420); await expect(page.getByRole('button',{name:'Rich count 1'})).toBeVisible();
 await firstPin.click(); await page.getByRole('button',{name:'Pin Second target',exact:true}).hover(); await page.waitForTimeout(420); await expect(box).toBeVisible();
 // Displace another pin behind a pinned card, then resolve its explicit owner.
 const b=await box.boundingBox(); await page.getByTestId('qa-second').evaluate((node,b)=>Object.assign(node.style,{left:b.x+20+'px',top:b.y+40+'px'}),b);
 const secondPin=page.getByRole('button',{name:'Pin Second target',exact:true}); await secondPin.click();
 await expect(page.getByRole('complementary',{name:'Second target context'})).toBeVisible();
 await secondPin.click(); await secondPin.hover(); await page.waitForTimeout(420); await expect(page.locator('[data-demoable-ui=context]')).toHaveCount(0);
 await gear.hover(); await secondPin.hover(); await page.waitForTimeout(420); await expect(page.getByRole('complementary',{name:'Second target context'})).toBeVisible();
 await page.mouse.move(950,700); await expect(page.locator('[data-demoable-ui=context]')).toHaveCount(0);

 await gear.click(); const settings=page.getByRole('group',{name:'Inspection settings',exact:true});
 const slider=page.getByRole('slider',{name:'Info and settings background opacity'});
 await expect(settings).toHaveCSS('background-color','rgba(250, 248, 255, 0.75)');
 await expect(settings).toHaveCSS('color','rgba(37, 32, 52, 0.9)');
 const outer=await panel.evaluate(node=>getComputedStyle(node).backgroundColor);
 for(const alpha of [0,.5,.75,1]){
  await slider.fill(String(alpha));
  const values=await settings.evaluate(node=>({background:getComputedStyle(node).backgroundColor,text:getComputedStyle(node).color,opacity:getComputedStyle(node).opacity,button:getComputedStyle(node.querySelector('button')).color}));
  const expectedBackground=alpha===1?'rgb(250, 248, 255)':`rgba(250, 248, 255, ${alpha})`;
  const foreground=Math.min(alpha+.15,1), expectedText=foreground===1?'rgb(37, 32, 52)':`rgba(37, 32, 52, ${foreground})`;
  assert.equal(values.background,expectedBackground); assert.equal(values.text,expectedText); assert.equal(values.button,expectedText); assert.equal(values.opacity,'1');
  assert.equal(await panel.evaluate(node=>getComputedStyle(node).backgroundColor),outer);
 }
 await page.getByRole('button',{name:'Close settings'}).click();
 await firstPin.click(); await gear.click();
 await slider.fill('0.5');
 await expect(box).toHaveCSS('background-color','rgba(250, 248, 255, 0.5)');
 await expect(box.locator('.demoable-react-context-body')).toHaveCSS('color','rgba(37, 32, 52, 0.65)');
 assert(await settings.evaluate(node=>{const button=node.querySelector('button'),b=button.getBoundingClientRect();return document.elementFromPoint(b.right-3,b.top+b.height/2)?.closest('button')===button;}),'settings controls stay above overlapping pinned context');
 await page.getByRole('checkbox',{name:'Component inspection',exact:true}).uncheck(); await page.getByRole('checkbox',{name:'Event inspection',exact:true}).uncheck(); await expect(gear).toBeVisible();
 await slider.press('Escape'); await expect(settings).toHaveCount(0); await expect(gear).toBeFocused();
 await gear.press('Enter'); await expect(settings).toBeVisible();
 await page.getByRole('button',{name:'Close settings'}).click(); await expect(gear).toBeFocused();
 await gear.click(); await page.setViewportSize({width:240,height:160});
 await slider.focus();
 await expect(slider).toBeInViewport();
 await expect.poll(()=>settings.evaluate(node=>{const b=node.getBoundingClientRect();return b.x>=0&&b.y>=0&&b.right<=innerWidth&&b.bottom<=innerHeight;})).toBe(true);
 await slider.press('Escape'); await expect(gear).toBeFocused();
 await page.setViewportSize({width:1000,height:800});
 for(const [configured,alpha] of [[-3,0],[4,1],[.2,.2],['NaN',.75]]){
  await page.goto(url+'?qa2&opacity='+configured);
  await page.getByRole('button',{name:'Toggle layer',exact:true}).click();
  await page.getByRole('button',{name:'Inspection settings',exact:true}).click();
  const current=page.getByRole('group',{name:'Inspection settings',exact:true});
  await expect(page.getByRole('slider',{name:'Info and settings background opacity'})).toHaveValue(String(alpha));
  await expect(current).toHaveCSS('background-color',alpha===1?'rgb(250, 248, 255)':`rgba(250, 248, 255, ${alpha})`);
 }
 console.log('PASS inactive host parity/state/page scroll; settings ownership/alpha; pin hover/suppression/inset; inactive hint');
}
