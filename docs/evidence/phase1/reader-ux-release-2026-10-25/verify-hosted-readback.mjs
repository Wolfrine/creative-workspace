import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const root='.local/reader-ux-release',out='docs/evidence/phase1/reader-ux-release-2026-10-25';
const commit='4c4c1660625aa8efa84cea4635cf97623dc06be9';
await mkdir(out,{recursive:true});
const expected=JSON.parse(await readFile(root+'/hosted-verification.json','utf8'));
assert.equal(expected.url,'https://noveliaa.web.app');assert.equal(expected.projectId,'noveliaa');assert.equal(expected.appId,'1:278082781314:web:9a4b7acef07fa8e4dfb49b');
const files=await Promise.all(expected.files.map(async file=>{
 assert(!file.path.startsWith('/')&&!file.path.split('/').includes('..'));
 const response=await fetch(expected.url+'/'+file.path+'?ux-release='+commit,{cache:'no-store',signal:AbortSignal.timeout(30000)});
 assert.equal(response.status,200,file.path);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(hash(bytes),file.sha256,file.path);
 return{...file,bytes:bytes.length,status:response.status};
}));
const config=await(await fetch(expected.url+'/__/firebase/init.json',{cache:'no-store',signal:AbortSignal.timeout(30000)})).json();
assert.equal(config.projectId,expected.projectId);assert.equal(config.appId,expected.appId);
const rules=JSON.parse(await readFile(root+'/rules-release.json','utf8'));
assert.equal(rules.projectId,'noveliaa');assert.equal(rules.sha256,hash(await readFile('firestore.rules')));
const report={checkedAt:new Date().toISOString(),commit,url:expected.url,projectId:config.projectId,appId:config.appId,configuredFiles:files,rules,productionManuscript:'not accessed, seeded or reset',authenticatedOwnerAcceptance:'not inferred'};
await writeFile(out+'/independent-hosted.json',JSON.stringify(report,null,2)+'\n');
const module=files.find(file=>/^assets\/index-.+\.js$/.test(file.path));assert(module);
const browser=await chromium.launch({headless:true});const visual={checkedAt:new Date().toISOString(),commit,browser:browser.version(),module:module.path,cases:[],limits:'Fresh signed-out production contexts only; authenticated workflows tested with isolated actual Auth/Firestore emulators. Desktop/phone-sized Chromium is not physical-phone acceptance.'};
try{for(const width of [1440,390,320]){
 const context=await browser.newContext({viewport:{width,height:width===1440?1000:844}});const page=await context.newPage();const issues=[];
 page.on('pageerror',e=>issues.push({type:'pageerror',message:e.message}));page.on('console',m=>{if(['error','warning'].includes(m.type()))issues.push({type:m.type(),message:m.text()});});
 await page.goto(expected.url+'/?verified-ux='+commit,{waitUntil:'networkidle'});
 await page.getByRole('button',{name:/Sign in with Google/}).waitFor();await page.evaluate(()=>document.fonts.ready);
 const scripts=await page.locator('script[src]').evaluateAll(items=>items.map(item=>item.getAttribute('src')));assert(scripts.includes('/'+module.path));
 assert.equal(await page.evaluate(()=>typeof window.__NOVELIAA_TEST__),'undefined');
 const bounds=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));assert(bounds.scrollWidth<=width+1);assert.deepEqual(issues,[]);
 const file=`${out}/entry-${width}.png`;await page.screenshot({path:file,fullPage:true});visual.cases.push({width,height:width===1440?1000:844,file,sha256:hash(await readFile(file)),scripts,bounds,issues});await context.close();
}}finally{await browser.close();await writeFile(out+'/visual-check.json',JSON.stringify(visual,null,2)+'\n');}
console.log(JSON.stringify({files:files.length,module:module.path,appId:config.appId,rulesSha256:rules.sha256,viewports:visual.cases.map(c=>c.width)}));
