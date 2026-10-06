import {chromium,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
await mkdir('artifacts/renju',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const baseURL=process.env.BASE_URL||'http://localhost:3100',errors=[];
const newPage=async()=>{const p=await browser.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));await p.goto(baseURL);return p;};
try{
 const p=await newPage();await expect(p.locator('#bot-rule')).toHaveValue('renju');await expect(p.locator('#rule-badge')).toHaveText('렌주');
 await p.addInitScript(()=>{if(!sessionStorage.getItem('fixture-loaded')){localStorage.setItem('omok:bot',JSON.stringify({history:[111,0,113,2,97,4,127,6],winner:0,myColor:1,gameId:'renju-ui-fixture',rule:'renju',difficulty:'normal'}));sessionStorage.setItem('fixture-loaded','1');}});
 await p.reload();await expect(p.locator('.intersection').nth(112)).toHaveClass(/forbidden/);await p.locator('.intersection').nth(112).click();await expect(p.locator('#toast')).toContainText('삼삼');await expect(p.locator('.stone')).toHaveCount(8);await expect(p.locator('#bot-rule')).toBeDisabled();await p.screenshot({path:'artifacts/renju/forbidden-desktop.png',fullPage:true});
 await p.locator('#resign').click();await p.locator('#confirm-yes').click();await p.locator('#review-current').click();await expect(p.locator('#rule-badge')).toHaveText('렌주');await expect(p.locator('.forbidden')).toHaveCount(0);await p.locator('#review-exit').click();
 await p.locator('#new-game').click();await p.locator('#next-rule').selectOption('freestyle');await p.locator('#confirm-yes').click();await expect(p.locator('#rule-badge')).toHaveText('자유룰');await p.reload();await expect(p.locator('#bot-rule')).toHaveValue('freestyle');
 const legacy=await newPage();await legacy.addInitScript(()=>{if(sessionStorage.getItem('legacy-loaded'))return;sessionStorage.setItem('legacy-loaded','1');localStorage.removeItem('omok:preferences');localStorage.setItem('omok:bot',JSON.stringify({history:[111,0,113,2,97,4,127,6],winner:0,myColor:1,gameId:'legacy-fixture'}));});await legacy.reload();await expect(legacy.locator('#rule-badge')).toHaveText('자유룰');await expect(legacy.locator('.forbidden')).toHaveCount(0);await legacy.locator('#new-game').click();await expect(legacy.locator('#next-rule')).toHaveValue('renju');await legacy.locator('#confirm-yes').click();await expect(legacy.locator('#rule-badge')).toHaveText('렌주');
 const a=await newPage(),b=await newPage();await a.locator('#online-mode').click();await b.locator('#online-mode').click();
 for(const rule of ['freestyle','renju']){
  await a.locator('#room-rule').selectOption(rule);await a.locator('#create-room').click();await expect(a.locator('#room-code')).toBeVisible();const code=await a.locator('#room-code').innerText();
  await b.locator('#room-input').fill(code);await expect(b.locator('#room-preview')).toContainText(rule==='renju'?'렌주':'자유룰');await expect(b.locator('#room-code')).toBeHidden();await b.screenshot({path:`artifacts/renju/preview-${rule}.png`,fullPage:true});
  await b.locator('#join-room').click();await expect(b.locator('#room-code')).toBeVisible();await expect(b.locator('#rule-badge')).toHaveText(rule==='renju'?'렌주':'자유룰');
  for(const [n,index] of [111,0,113,2,97,4,127,6].entries()){await (n%2===0?a:b).locator('.intersection').nth(index).click();await expect(a.locator('.stone')).toHaveCount(n+1);await expect(b.locator('.stone')).toHaveCount(n+1);}
  await a.locator('.intersection').nth(112).click();await expect(a.locator('.stone')).toHaveCount(rule==='renju'?8:9);
  if(rule==='renju'){await expect(a.locator('#toast')).toContainText('삼삼');await a.setViewportSize({width:320,height:844});await expect.poll(()=>a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await a.screenshot({path:'artifacts/renju/forbidden-mobile.png',fullPage:true});}
  await b.reload();await expect(b.locator('#rule-badge')).toHaveText(rule==='renju'?'렌주':'자유룰');await expect(b.locator('.stone')).toHaveCount(rule==='renju'?8:9);
  await a.locator('#resign').click();await a.locator('#confirm-yes').click();await expect(a.locator('#result-card')).toBeVisible();await a.locator('#rematch').click();await b.locator('#rematch').click();await expect(a.locator('.stone')).toHaveCount(0);await expect(a.locator('#rule-badge')).toHaveText(rule==='renju'?'렌주':'자유룰');
  await a.locator('#leave-room').click();await a.locator('#confirm-yes').click();await expect(b.locator('#online-again')).toBeVisible();await a.locator('#online-again').click();await b.locator('#online-again').click();
 }
 if(errors.length)throw Error(errors.join('\n'));
 console.log('PASS: default renju, forbidden markers and blocked clicks, locked rules, replay, new-game rules, legacy freestyle migration, room preview, both online rules, reconnect, rematch, 320px layout.');
}finally{await browser.close();}
