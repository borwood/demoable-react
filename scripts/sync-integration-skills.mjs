import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const check = process.argv.includes('--check');
const metadata = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const files = new Map();
files.set('SKILL.md', await readFile(resolve(root, 'skills/source/integrate-demoable-react/SKILL.md'), 'utf8'));
for (const name of ['inspection', 'events', 'layout']) files.set(`references/${name}.md`, await readFile(resolve(root, `docs/api/${name}.md`), 'utf8'));
for (const name of ['App.tsx', 'app.css']) files.set(`assets/demo/${name}`, await readFile(resolve(root, `demo/${name}`), 'utf8'));
files.set('assets/demo/main.tsx', "import { createRoot } from 'react-dom/client';\nimport { App } from './App';\nimport './app.css';\ncreateRoot(document.getElementById('root')!).render(<App />);\n");
files.set('assets/demo/index.html', '<!doctype html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>Demoable React examples</title></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>\n');
files.set('assets/demo/package.json', JSON.stringify({name:'demoable-react-examples',private:true,type:'module',scripts:{dev:'vite',typecheck:'tsc --noEmit',build:'vite build'},dependencies:{[metadata.name]:metadata.version,react:metadata.devDependencies.react,'react-dom':metadata.devDependencies['react-dom']},devDependencies:Object.fromEntries(['typescript','vite','@types/react','@types/react-dom'].map(name=>[name,metadata.devDependencies[name]]))},null,2)+'\n');
files.set('assets/demo/tsconfig.json', JSON.stringify({compilerOptions:{target:'ES2022',lib:['ES2022','DOM'],types:['vite/client'],module:'ESNext',moduleResolution:'Bundler',jsx:'react-jsx',strict:true,skipLibCheck:true,noEmit:true},include:['*.tsx']},null,2)+'\n');
async function inventory(directory, prefix='') {
  const result=[];
  for(const entry of await readdir(directory,{withFileTypes:true})) {
    const name=prefix+entry.name;
    if(entry.isDirectory()) result.push(...await inventory(resolve(directory,entry.name),name+'/'));
    else result.push(name);
  }
  return result.sort();
}
for(const platform of ['agent','claude']) {
  const folder=resolve(root,`skills/${platform}/integrate-demoable-react`);
  for(const [name, raw] of files) {
    const content=raw.replaceAll('\r\n','\n');
    const path=resolve(folder,name);
    if(check) assert.equal((await readFile(path,'utf8')).replaceAll('\r\n','\n'),content,`Stale ${platform}/${name}; run npm run skills:sync`);
    else { await mkdir(dirname(path),{recursive:true}); await writeFile(path,content); }
    if(name.endsWith('.md')) for(const match of content.matchAll(/\]\(([^)]+)\)/g)) {
      const link=match[1].split('#')[0];
      if(!link || /^[a-z]+:/i.test(link)) continue;
      const target=resolve(dirname(path),link);
      assert(target.startsWith(folder+sep),'Skill reference must stay portable');
      assert(files.has(relative(folder,target).replaceAll('\\','/')),`Missing bundled reference ${link}`);
    }
  }
  assert.deepEqual(await inventory(folder),[...files.keys()].sort(),'Unexpected files in portable skill');
  assert.match(files.get('SKILL.md'),/^---\r?\nname: integrate-demoable-react\r?\ndescription: [^\r\n]+\r?\n---/,'Valid skill frontmatter');
}
console.log(`PASS integration skills: ${check?'checked':'synchronized'} identical metadata, instructions, portable references and complete demo assets (${files.size} files each).`);
