import assert from 'node:assert/strict';
import { expect } from '@playwright/test';

export const surfaceFixture = `
import {useState} from 'react';
import {DemoLayout, OrientationPanel, EventLog, InspectionProvider, Inspectable, useInspection, useEvents, type DemoLayoutProps, type OrientationPanelProps} from '@borwood/demoable-react';
import '@borwood/demoable-react/styles.css';
function LocalInput() { const [text,setText]=useState('local'); return <input aria-label="Local panel state" value={text} onChange={event=>setText(event.target.value)} />; }
function Surface() {
 const state=useInspection(), events=useEvents();
 const [name,setName]=useState('Visitor'), [double,setDouble]=useState(false), [count,setCount]=useState(0), [tall,setTall]=useState(false);
 const orientation: OrientationPanelProps['children']=<><strong>Try the host controls</strong>{tall && <div style={{height:700}}>Tall orientation<button style={{marginTop:640}}>Last orientation action</button></div>}</>;
 const controls: DemoLayoutProps['controls']=<><label>Name<input aria-label="Name" value={name} onChange={event=>setName(event.target.value)} /></label><label><input type="checkbox" checked={double} onChange={event=>setDouble(event.target.checked)} />Double</label><LocalInput /><button onClick={()=>setTall(!tall)}>Toggle tall orientation</button></>;
 const app=<main style={{padding:20}}><h1>Hello {name}</h1><button onClick={()=>state.setActive(!state.active)}>Toggle layer</button><button onClick={()=>state.setComponentInspection(!state.componentInspection)}>Toggle components</button><button onClick={()=>state.setEventInspection(!state.eventInspection)}>Toggle events</button><button onClick={()=>events.start({label:'Surface event',content:<div style={{height:500}}>Long log content<button style={{marginTop:430}}>Last event action</button></div>})}>Report</button><Inspectable label="Surface target" context={<div><p>Rich surface context with reserved panels.</p><button>Context action</button></div>} style={{marginTop:40,width:160,height:80}}><button onClick={()=>setCount(count+(double?2:1))}>Count {count}</button></Inspectable><div style={{height:1000}}/><button>Last app action</button></main>;
 if(new URLSearchParams(location.search).has('standalone')) return <div style={{height:'100dvh',display:'grid',gridTemplateRows:'auto minmax(0,1fr) auto'}}><OrientationPanel style={{gridRow:1,display:'block'}} controls={controls}>{orientation}</OrientationPanel><div data-testid="standalone-app" style={{overflow:'auto',minHeight:0,gridRow:2}}>{app}</div><div style={{gridRow:3,minHeight:0}}><EventLog /></div></div>;
 if(new URLSearchParams(location.search).has('empty')) return <DemoLayout orientation={<></>} controls={false}>{app}</DemoLayout>;
 return <DemoLayout orientation={orientation} controls={controls}>{app}</DemoLayout>;
}
export function SurfaceFixture(){return <><style>{'body{margin:0}'}</style><InspectionProvider device="desktop"><Surface /></InspectionProvider></>;}
`;
const region = page => page.getByRole('region',{name:'Demo orientation'});
export async function verifySurface(page,url) {
 for(const standalone of [false,true]) {
  await page.setViewportSize({width:1000,height:800});
  await page.goto(url+'?surface'+(standalone?'&standalone':''));
  await expect(page.getByRole('button',{name:'Toggle layer',exact:true})).toBeVisible();
  const app=page.locator(standalone?'[data-testid=standalone-app]':'[data-demoable-app]');
  const hiddenHeight=standalone?(await app.boundingBox()).height:null;
  await expect(region(page)).toHaveCount(0);
  await page.getByRole('button',{name:'Toggle layer',exact:true}).click();
  await expect(region(page)).toBeVisible();
  await expect(region(page).locator('.demoable-react-controls > button').first()).toHaveAttribute('aria-label','Inspection settings');
  await page.getByRole('textbox',{name:'Name',exact:true}).fill('Ada?');
  await page.getByRole('textbox',{name:'Name',exact:true}).press('?');
  await expect(region(page)).toBeVisible();
  await page.getByRole('textbox',{name:'Local panel state'}).fill('kept');
  await page.getByRole('checkbox',{name:'Double',exact:true}).check();
  await page.getByRole('button',{name:'Count 0',exact:true}).click();
  await expect(page.getByRole('button',{name:'Count 2',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Toggle components',exact:true}).click();
  await page.getByRole('button',{name:'Toggle events',exact:true}).click();
  await expect(region(page)).toBeVisible();
  await expect(page.getByRole('region',{name:'Live events'})).toHaveCount(0);
  await page.getByRole('button',{name:'Toggle layer',exact:true}).click();
  await expect(region(page)).toHaveCount(0);
  if(standalone) await expect.poll(async () => (await app.boundingBox()).height).toBeCloseTo(hiddenHeight,0);
  else await expect(app).toHaveCSS('display','contents');
  await page.getByRole('button',{name:'Toggle layer',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Local panel state'})).toHaveValue('kept');
  await expect(page.getByRole('heading',{name:'Hello Ada??'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Count 2',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Toggle components',exact:true}).click();
  await page.getByRole('button',{name:'Toggle events',exact:true}).click();
  await page.getByRole('button',{name:'Report',exact:true}).click();
  const log=page.getByRole('region',{name:'Live events'});
  await page.getByRole('button',{name:'Pin Surface target',exact:true}).click();
  const context=page.getByRole('complementary',{name:'Surface target context'});
  await expect(context).toBeVisible();
  const layoutCheck=async()=>{
   const top=await region(page).boundingBox(), middle=await app.boundingBox(), bottom=await log.boundingBox(), card=await context.boundingBox();
   return top.y+top.height<=middle.y+1 && middle.y+middle.height<=bottom.y+1 && card.y>=top.y+top.height-1 && card.y+card.height<=bottom.y+1;
  };
  await expect.poll(layoutCheck,{message:'three real regions and context avoid top/bottom controls'}).toBe(true);
  await page.getByRole('button',{name:'Dismiss component context'}).click({position:{x:3,y:13}});
  await expect(context).toHaveCount(0);
  await page.getByRole('button',{name:'Toggle tall orientation'}).click();
  if (!standalone) {
   // an embedded shell is bounded by its own height, not the window.
   for (const shellHeight of [180,100,80]) {
   await page.locator('.demoable-react-layout').evaluate((node,height) => node.style.height=height+'px',shellHeight);
   await expect.poll(async()=>{
    const top=await region(page).boundingBox(), middle=await app.boundingBox(), bottom=await log.boundingBox();
    return middle.height>0 && top.y+top.height<=middle.y+1 && middle.y+middle.height<=bottom.y+1 && bottom.y+bottom.height<=shellHeight+1;
   }, {message:`nested${shellHeight}px shell retains three non-overlapping reachable regions`}).toBe(true);
   await page.getByRole('button',{name:'Toggle layer',exact:true}).focus();
   await page.keyboard.press('Enter');
   await expect(region(page)).toHaveCount(0);
   await expect(app).toHaveCSS('display','contents');
   await page.getByRole('button',{name:'Toggle layer',exact:true}).focus();
   await page.keyboard.press('Enter');
   await expect(page.getByRole('textbox',{name:'Local panel state'})).toHaveValue('kept');
   for(const name of ['Last orientation action','Last app action','Last event action']) {
    await page.getByRole('button',{name,exact:true}).focus();
    await expect(page.getByRole('button',{name,exact:true})).toBeInViewport();
   }
   const settingsGear=page.getByRole('button',{name:'Inspection settings',exact:true});
   await settingsGear.focus(); await page.keyboard.press('Enter');
   const settingsMenu=page.getByRole('group',{name:'Inspection settings',exact:true});
   await expect(settingsMenu).toBeVisible();
   await expect.poll(()=>settingsMenu.evaluate(node=>{const b=node.getBoundingClientRect();return b.left>=0&&b.top>=0&&b.right<=innerWidth&&b.bottom<=innerHeight;})).toBe(true);
   const sharedAlpha=page.getByRole('slider',{name:'Info and settings background opacity'});
   await sharedAlpha.fill('0.5'); await sharedAlpha.press('Escape'); await expect(settingsGear).toBeFocused();
   await page.getByRole('button',{name:'Last event action',exact:true}).focus();
   const lastEvent=page.getByRole('button',{name:'Last event action',exact:true});
   await expect.poll(async()=>lastEvent.evaluate(button=>{
    const box=button.getBoundingClientRect(), scroll=button.closest('.demoable-react-event-scroll').getBoundingClientRect();
    const y=(Math.max(box.top,scroll.top)+Math.min(box.bottom,scroll.bottom))/2;
    return scroll.height>0 && document.elementFromPoint(box.left+box.width/2,y)?.closest('button')===button;
   }),{message:'nested event action has a visible clickable part after focus'}).toBe(true);
   }
   await page.locator('.demoable-react-layout').evaluate(node => node.style.height='100dvh');
  }
  for(const viewport of [{width:390,height:700},{width:320,height:320},{width:240,height:160}]) {
   await page.setViewportSize(viewport);
   await expect.poll(async()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await expect.poll(()=>page.evaluate(({standalone,viewport})=>{
    // Read all regions in one browser task so observer-driven reflows cannot
    // interleave three separate protocol snapshots.
    const top=document.querySelector('.demoable-react-orientation').getBoundingClientRect();
    const middle=document.querySelector(standalone?'[data-testid=standalone-app]':'[data-demoable-app]').getBoundingClientRect();
    const bottom=document.querySelector('.demoable-react-events').getBoundingClientRect();
    const clear=top.height<=viewport.height*.3+1 && middle.height>0 && bottom.height<=viewport.height*.5+1 && top.bottom<=middle.top+1 && middle.bottom<=bottom.top+1;
    return clear ? 'clear' : JSON.stringify({top:top.toJSON(),middle:middle.toJSON(),bottom:bottom.toJSON()});
   },{standalone,viewport}),{message:'Resized panels settle within exact size/non-overlap bounds'}).toBe('clear');
   await page.getByRole('button',{name:'Last orientation action'}).focus();
   await expect(page.getByRole('button',{name:'Last orientation action'})).toBeInViewport();
   await page.getByRole('button',{name:'Last app action'}).focus();
   await expect(page.getByRole('button',{name:'Last app action'})).toBeInViewport();
   await page.getByRole('button',{name:'Last event action'}).focus();
   await expect(page.getByRole('button',{name:'Last event action'})).toBeInViewport();
  }
 }
 await page.setViewportSize({width:800,height:600});
 await page.goto(url+'?surface&empty');
 await page.getByRole('button',{name:'Toggle layer',exact:true}).click();
 await expect(region(page)).toBeVisible();
 await expect(region(page).locator('.demoable-react-controls > :first-child')).toHaveAttribute('aria-label','Inspection settings');
 console.log('PASS wrapper and standalone panel, mode independence, host/local state, input shortcut exclusion, occupied regions, narrow/short viewport and region keyboard scroll');
}

export async function verifySurfaceDemo(page,url) {
 await page.setViewportSize({width:1000,height:800});
 await page.goto(url);
 await page.getByRole('button',{name:'Start inspecting',exact:true}).click();
 await page.getByRole('textbox',{name:'Presented name'}).fill('Ada');
 await expect(page.getByRole('heading',{level:1})).toContainText("Ada's interface");
 await page.getByRole('checkbox',{name:'Count by two'}).check();
 await page.getByRole('button',{name:'Count: 0',exact:true}).click();
 await expect(page.getByRole('button',{name:'Count: 2',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Inspection settings',exact:true}).click();
 await page.getByRole('checkbox',{name:'Component inspection',exact:true}).uncheck();
 await page.getByRole('checkbox',{name:'Event inspection',exact:true}).uncheck();
 await expect(region(page)).toBeVisible();
 await page.getByRole('button',{name:'Close settings'}).click();
 await page.keyboard.press('?');
 await expect(region(page)).toHaveCount(0);
 await page.keyboard.press('?');
 await expect(page.getByRole('textbox',{name:'Presented name'})).toHaveValue('Ada');
 console.log('PASS actual demo: host text and toggle change visible app, independent modes retain orientation');
}
