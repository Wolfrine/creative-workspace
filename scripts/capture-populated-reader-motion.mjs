// Observe real app turns with the same varied evaluation archive as navigation.
// Actual timestamped captures and browser video; never a simulated transition.
import {chromium} from '@playwright/test';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {seedPopulatedWorkspace,populatedFixtureManifest} from '../tests/helpers/populated-workspace.ts';
const round=Number(process.argv[2]||2);
const large=process.argv.includes('--large');
const directory=process.env.NOVELIAA_MOTION_CAPTURE_DIR||`.local/populated-motion-${round}`;
await mkdir(directory,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function files(p){return(await Promise.all((await readdir(p,{withFileTypes:true})).map(e=>e.isDirectory()?files(p+'/'+e.name):p+'/'+e.name))).flat()}
async function source(){return hash(JSON.stringify(await Promise.all((await files('src')).filter(p=>/\.(tsx?|js|css)$/.test(p)&&!p.endsWith('.test.ts')).sort().map(async p=>[p,hash(await readFile(p))]))))}
const browser=await chromium.launch({headless:true});
const report={round,dataset:'AI-generated synthetic unverified multi-world archive; no production account',additionalProceduralStressWords:large?50000:0,fixture:await populatedFixtureManifest(),browser:browser.version(),sourceBefore:await source(),sourceAfter:'',cases:[],errors:[]};
try{for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:width===1440?1000:844},reducedMotion:'no-preference',recordVideo:{dir:directory+'/video',size:{width,height:width===1440?1000:844}}});
 const page=await context.newPage();page.on('pageerror',error=>report.errors.push({width,error:error.message}));
 const notebook=`populated-motion-${round}-${width}-${Date.now()}`;
 await page.goto('http://127.0.0.1:5817/?local=1&notebook='+notebook);
 await page.waitForFunction(()=>window.__NOVELIAA_TEST__?.getSnapshot().ready);
 await seedPopulatedWorkspace(page,notebook);await page.evaluate(()=>document.fonts.ready);
 if(large)await page.evaluate(async()=>{
  const vocabulary='Mira carried the ledger along the harbour road before dawn while a patient dog watched the ferry workers gather beside the locked gate and wait for the tide to reveal the old steps'.split(' ');
  const content=Array.from({length:400},(_,index)=>({type:'paragraph',content:[{type:'text',text:Array.from({length:125},(_,word)=>word===0?`Volume${index+1}.`:vocabulary[(word+index)%vocabulary.length]).join(' ')}]}));
  await window.__NOVELIAA_TEST__.createDocument({title:'Synthetic long-book motion volume',origin:'ai',collectionId:'salt-drafts',body:{type:'doc',content}});
 });
 if(width<651)await page.locator('.mobile-bottom').getByRole('button',{name:'Library',exact:true}).click();
 else await page.locator('.main-nav').getByRole('button',{name:'Library',exact:true}).click();
 await page.locator('.library-tabs').getByRole('button',{name:/^Collections/}).click();
 await page.locator('.collection-card-open').filter({hasText:'Draft chapters'}).click();
 await page.getByRole('button',{name:'Read collection',exact:true}).click();
 await page.waitForFunction(()=>Number(document.querySelector('.reader-stage')?.getAttribute('data-pages'))>2);
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const sourceBefore=await page.locator('.reader-prose').textContent();
 const turns=[];
 for(const direction of ['forward','back']){
  const before=`${directory}/${direction}-before-${width}.png`;await page.screenshot({path:before});
  const started=performance.now();
  await page.getByRole('button',{name:direction==='forward'?'Next reader page':'Previous reader page',exact:true}).evaluate(button=>button.click());
  const frames=[];
  for(const target of [0,120,260,420,650,900]){
   const remaining=target-(performance.now()-started);if(remaining>0)await page.waitForTimeout(remaining);
   const observed=await page.evaluate(()=>({page:document.querySelector('.reader-stage')?.getAttribute('data-page'),mode:document.querySelector('.reader-stage')?.getAttribute('data-motion'),active:document.querySelector('.reader-stage')?.getAttribute('data-motion-active'),canonicalArticles:document.querySelectorAll('.reader-prose').length,animations:document.querySelector('.reader-prose')?.getAnimations().map(a=>({state:a.playState,currentTime:a.currentTime})),transform:document.querySelector('.reader-prose')?getComputedStyle(document.querySelector('.reader-prose')).transform:null,leaves:[...document.querySelectorAll('.reader-motion-leaf')].map(el=>({column:el.getAttribute('data-source-column'),transform:getComputedStyle(el).transform,clip:getComputedStyle(el).clipPath})),hiddenFromAccess:document.querySelector('.reader-turn')?.ariaHidden,inert:document.querySelector('.reader-turn')?.inert}));
   const path=`${directory}/${direction}-${width}-${target}.png`;const actualElapsedMs=Math.round(performance.now()-started);await page.screenshot({path});
   frames.push({targetMs:target,actualElapsedMs,path,sha256:hash(await readFile(path)),observed});
  }
  await page.waitForFunction(()=>!document.querySelector('.reader-turn'));
  assert.equal(await page.locator('.reader-prose').textContent(),sourceBefore,'Canonical exact prose changed during turn');
  assert(frames.some(frame=>large?frame.observed.animations?.length:frame.observed.leaves.length),'No actual content-bearing transition observed');
  turns.push({direction,before,frames});
 }
 await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'Next reader page',exact:true}).click();
 assert.equal(await page.locator('.reader-turn').count(),0,'Reduced motion must not mount a leaf');
 const video=page.video();await context.close();report.cases.push({width,turns,reducedMotionNoLeaf:true,video:await video.path()});
}}finally{report.sourceAfter=await source();await browser.close();await writeFile(directory+'/motion.json',JSON.stringify(report,null,2)+'\n');}
assert.equal(report.sourceBefore,report.sourceAfter,'Runtime source changed during motion capture');
assert.equal(report.errors.length,0);console.log(JSON.stringify({round,cases:report.cases.length,turns:report.cases.reduce((s,c)=>s+c.turns.length,0),directory}));
