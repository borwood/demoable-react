import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

const root=fileURLToPath(new URL('../',import.meta.url));
const directory=resolve(root,'demo-dist');
const server=createServer(async(req,res)=>{
 try {
  const path=resolve(directory,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));
  if(!path.startsWith(directory+sep)) {res.writeHead(403);res.end();return;}
  const data=await readFile(path);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[extname(path)] ?? 'application/octet-stream');res.end(data);
 } catch {res.writeHead(404);res.end();}
});
let browser;
try {
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const url=`http://127.0.0.1:${server.address().port}`;console.log('Owned screenshot HTTP handle:',url,'->',directory);
 browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1280,height:1000},deviceScaleFactor:1});
 await page.goto(url);await page.getByRole('button',{name:'Start inspecting'}).click();
 await page.getByRole('button',{name:'Run overlapping work'}).click();
 await page.getByRole('button',{name:'Try a failing promise'}).click();
 await page.getByRole('button',{name:'Report an outcome'}).click();
 await page.getByRole('button',{name:'Run wrapped handler'}).click();
 await page.getByRole('button',{name:'Count: 0',exact:true}).scrollIntoViewIfNeeded();
 await page.getByRole('button',{name:'Pin Counter',exact:true}).click();
 await expect(page.getByRole('complementary',{name:'Counter context',exact:true})).toBeVisible();
 await page.waitForTimeout(5100);
 await mkdir(resolve(root,'docs/images'),{recursive:true});
 await page.screenshot({path:resolve(root,'docs/images/events-pinned.png')});
 await page.getByRole('button',{name:'Dismiss component context'}).click();
 await page.getByRole('button',{name:'Run overlapping work'}).click();
 await page.getByRole('button',{name:'Show a cancelled event'}).click();
 await expect(page.getByRole('region',{name:'Live events'}).getByText('cancelled',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Expand event log'}).click();
 await page.getByRole('heading',{name:'Follow work as it happens.'}).scrollIntoViewIfNeeded();
 await page.waitForTimeout(200);
 await page.screenshot({path:resolve(root,'docs/images/events-expanded.png')});
 console.log('Captured authentic events-pinned.png and events-expanded.png from built demo.');
} finally {
 await browser?.close();await new Promise(done=>{server.close(done);server.closeAllConnections();});
 console.log('Closed owned screenshot browser and HTTP handles.');
}
