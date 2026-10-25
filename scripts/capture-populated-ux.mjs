// Real application journeys in fresh loopback DEV notebooks. No production data.
import {chromium} from '@playwright/test';
import{readFile,readdir,mkdir,writeFile}from'node:fs/promises';
import{createHash}from'node:crypto';
import assert from'node:assert/strict';
import{seedPopulatedWorkspace,populatedArchive,populatedFixtureManifest}from'../tests/helpers/populated-workspace.ts';
const round=Number(process.argv[2]||1);assert(round>=1&&round<=5);
const dir=process.env.NOVELIAA_POPULATED_CAPTURE_DIR||`.local/populated-ux-cycle-${round}`;await mkdir(dir,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
async function files(p){return(await Promise.all((await readdir(p,{withFileTypes:true})).map(e=>e.isDirectory()?files(p+'/'+e.name):p+'/'+e.name))).flat()}
async function source(){return hash(JSON.stringify(await Promise.all((await files('src')).filter(p=>/\.(tsx?|js|css)$/.test(p)&&!p.endsWith('.test.ts')).sort().map(async p=>[p,hash(await readFile(p))]))))}
const report={round,dataset:'Three-world AI-generated evaluation material; synthetic and unverified; no production workspace',fixture:await populatedFixtureManifest(),sourceFingerprintScope:'All runtime TS/TSX/JS/CSS in src, including vendored motion; excludes test modules',sourceBefore:await source(),sourceAfter:'',completed:false,captures:[],errors:[]};
await writeFile(dir+'/sample-workspace.json',await populatedArchive());
const browser=await chromium.launch({headless:true});report.browser=browser.version();
try{for(const width of [1440,768,390,320]){
 const height=width>=768?1000:844;const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});const page=await context.newPage();page.on('pageerror',e=>report.errors.push({width,error:e.message}));
 const notebook=`populated-ux-${round}-${width}-${Date.now()}`;await page.goto('http://127.0.0.1:5817/?local=1&notebook='+notebook);await page.waitForFunction(()=>window.__NOVELIAA_TEST__?.getSnapshot().ready);await seedPopulatedWorkspace(page,notebook);await page.evaluate(()=>document.fonts.ready);
 const capture=async state=>{await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const path=`${dir}/${state}-${width}.png`;await page.screenshot({path,fullPage:true});const bounds=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,brokenImages:[...document.images].some(i=>!i.complete||i.naturalWidth===0),clippedSurfaces:[...document.querySelectorAll('.library-page-row,.collection-card,.library-toolbar,.atlas-map')].filter(el=>{const r=el.getBoundingClientRect();return r.width&&r.height&&(r.right>innerWidth+1||r.left < -1)}).map(el=>({className:el.className,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right}))}));report.captures.push({state,viewport:{width,height},path,sha256:hash(await readFile(path)),bounds});assert(bounds.scrollWidth<=width+1,state+' overflow');assert.equal(bounds.clippedSurfaces.length,0,state+' has internally clipped retrieval surfaces');};
 const nav=async name=>{
  const quick=page.locator('.mobile-bottom').getByRole('button',{name:name==='Living Atlas'?'Atlas':name,exact:true});
  if(width<651&&await quick.isVisible())await quick.click();
  else {
   // A focused writing canvas intentionally hides the phone's quick navigation.
   // Exercise the visible header menu instead of assuming that bar always exists.
   if(width<651)await page.getByRole('button',{name:'Open navigation',exact:true}).click();
   await page.locator('.main-nav').getByRole('button',{name,exact:true}).click();
  }
 };
 await capture('writing-start');await nav('Library');
 for(const layout of ['List','Tile','Detailed']){await page.getByRole('button',{name:layout+' view',exact:true}).click();await capture('pages-'+layout.toLowerCase());}
 await page.locator('.library-tabs').getByRole('button',{name:/^Collections/}).click();
 for(const layout of ['List','Tile','Detailed']){await page.getByRole('button',{name:layout+' view',exact:true}).click();await capture('collections-'+layout.toLowerCase());}
 await page.locator('.collection-card-open').filter({hasText:'Draft chapters'}).click();await capture('collection-detail');
 await page.getByRole('button',{name:'Read collection',exact:true}).click();await page.waitForFunction(()=>Number(document.querySelector('.reader-stage')?.getAttribute('data-pages'))>1);await capture('reader-prose');
 await page.getByRole('button',{name:'Reading appearance',exact:true}).click();
 await page.getByRole('combobox',{name:'Reading typeface',exact:true}).selectOption('sans');
 await page.getByRole('combobox',{name:'Reading margins',exact:true}).selectOption('wide');
 await page.getByRole('button',{name:'Night',exact:true}).click();
 await page.getByRole('checkbox',{name:'Facing pages on wide screens',exact:true}).uncheck();
 await page.getByRole('button',{name:'Close reading settings',exact:true}).click();await capture('reader-night-single');
 await page.getByRole('button',{name:'Reading contents',exact:true}).click();await capture('reader-contents');
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:/^Back to (writing|Library)$/,exact:true}).click();await nav('Living Atlas');await capture('atlas');
 await nav('Library');
 if(width<651)await page.getByRole('button',{name:'Open navigation',exact:true}).click();
 await page.getByRole('combobox',{name:'Story universe',exact:true}).selectOption('sample-signal');
 // Selecting a universe closes the drawer after the local safety flush. Wait
 // for that actual navigation result; a second click can race the disappearing
 // scrim and make a valid context switch look like a missing control.
 if(width<651)await page.getByRole('button',{name:'Close navigation',exact:true}).waitFor({state:'hidden'});
 await capture('second-universe-library');
 await context.close();
 }report.completed=true;}finally{report.sourceAfter=await source();await browser.close();await writeFile(dir+'/capture.json',JSON.stringify(report,null,2)+'\n');}
assert.equal(report.sourceBefore,report.sourceAfter,'UI source changed during captures');assert.equal(report.errors.length,0);console.log(JSON.stringify({round,captures:report.captures.length,source:report.sourceAfter,directory:dir}));
