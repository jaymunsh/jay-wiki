import {chromium,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const external=process.env.BASE_URL,dir=external?null:await mkdtemp(join(tmpdir(),'omok-undo-')),port=3109;
const child=external?null:spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),DATA_DIR:dir}});
const base=external||`http://localhost:${port}/`;let browser,ownedSession;
try{
 if(child)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup timeout')),5000);child.stdout.on('data',data=>{if(data.toString().includes('"event":"listening"')){clearTimeout(timer);resolve();}});child.once('error',reject);});
 browser=await chromium.launch({channel:'chrome',headless:true});const errors=[];
 const host=await browser.newContext(),guest=await browser.newContext({viewport:{width:390,height:844}}),phone=await browser.newContext({viewport:{width:320,height:844}});
 const page=async ctx=>{const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base);return p;};
 const a=await page(host),b=await page(guest);await a.locator('#online-mode').click();await a.locator('#time-control').selectOption('60');await a.locator('#create-room').click();await expect(a.locator('#room-code')).toBeVisible();const code=await a.locator('#room-code').innerText();ownedSession=await a.evaluate(()=>JSON.parse(sessionStorage.getItem('omok:session')));
 await expect(a.locator('#elapsed-display')).toContainText('시작 대기');await b.locator('#online-mode').click();await b.locator('#room-input').fill(code);await expect(b.locator('#room-preview')).toContainText('확인 후 입장');await b.locator('#join-room').click();await expect(b.locator('#room-code')).toHaveText(code);
 await expect(a.locator('#elapsed-display')).toContainText('총 경과');await expect.poll(()=>a.locator('#elapsed-display').innerText()).not.toContain('00:00');
 await a.locator('.intersection').nth(112).click();await expect(b.locator('.stone')).toHaveCount(1);await b.locator('.intersection').nth(113).click();await expect(a.locator('.stone')).toHaveCount(2);
 await a.locator('#undo').click();await expect(b.locator('#undo-request-panel')).toBeVisible();await expect(b.locator('#undo-request-text')).toContainText('마지막 한 수');await expect(b.locator('.intersection').nth(114)).toBeDisabled();await expect(a.locator('#clock-display')).toContainText('일시정지');
 await b.locator('#undo-accept').click();await expect(a.locator('.stone')).toHaveCount(1);await expect(b.locator('.stone')).toHaveCount(1);await expect(a.locator('#timeline-list')).toContainText('무르기 수락');await b.locator('.intersection').nth(114).click();await expect(a.locator('.stone')).toHaveCount(2);
 for(let n=0;n<2;n++){await a.locator('#undo').click();await expect(b.locator('#undo-decline')).toBeVisible();await b.locator('#undo-decline').click();await expect(a.locator('#undo-request-panel')).toBeHidden();}
 await expect(a.locator('#undo')).toBeDisabled();await expect(a.locator('#board-action-help')).toContainText('0 / 3');await a.reload();await expect(a.locator('#undo')).toBeDisabled();await expect(a.locator('.stone')).toHaveCount(2);
 // Show a private transfer link, open it in a separate browser context, and ensure it never reaches HTTP requests.
 await a.locator('#transfer-device').click();await expect(a.locator('#transfer-details')).toBeVisible();const privateLink=await a.locator('#transfer-link').inputValue();
 const token=new URL(privateLink).hash.split('.')[1];const c=await phone.newPage();c.on('pageerror',e=>errors.push(e.message));let leaked=false;c.on('request',request=>{if(request.url().includes(token))leaked=true;});await c.goto(privateLink);
 await expect(c.locator('#room-code')).toHaveText(code);await expect(c.locator('.stone')).toHaveCount(2);await expect(c.locator('#undo')).toBeDisabled();await expect(a.locator('#connection-status')).toContainText('다른 기기');await expect.poll(()=>c.evaluate(()=>location.hash)).toBe('');if(leaked)throw Error('Private credential leaked to an HTTP request');
 await c.locator('.intersection').nth(115).click();await expect(b.locator('.stone')).toHaveCount(3);await expect.poll(()=>c.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const elapsed=await c.locator('#elapsed-display').innerText();await c.reload();await expect(c.locator('.stone')).toHaveCount(3);await expect(c.locator('#elapsed-display')).toBeVisible();
 const output=process.env.ARTIFACT_DIR||'artifacts/undo-transfer';await mkdir(output,{recursive:true});await c.screenshot({path:join(output,'mobile.png'),fullPage:true});await b.screenshot({path:join(output,'opponent.png'),fullPage:true});
 await c.locator('#resign').click();await c.locator('#confirm-yes').click();await expect(c.locator('#result-card')).toBeVisible();const finished=await c.locator('#elapsed-display').innerText();await expect(c.locator('#timeline-list')).toContainText('무르기 거절');await c.waitForTimeout(1100);await expect(c.locator('#elapsed-display')).toHaveText(finished);
 await c.locator('#review-current').click();await c.locator('#confirm-yes').click();await expect(c.locator('#elapsed-display')).toHaveText(finished);await expect(c.locator('.stone')).toHaveCount(3);await expect(c.locator('#timeline-list')).toContainText('무르기 수락');
 if(errors.length)throw Error(errors.join('\n'));console.log('PASS: consent and last-one undo, declined attempts/3-limit/reload, elapsed start/tick/reload/finish/replay, authenticated cross-device transfer, old seat replacement, fragment stripped/no HTTP credential leak, 320px layout.');
}finally{
 if(external&&browser&&ownedSession){
  const cleanup=await browser.newPage();await cleanup.goto(base);
  await cleanup.evaluate(({base,seat})=>new Promise(resolve=>{const url=new URL(base),ws=new WebSocket(`${url.protocol==='https:'?'wss:':'ws:'}//${url.host}${url.pathname}`);const timer=setTimeout(()=>{ws.close();resolve();},5000);ws.onopen=()=>ws.send(JSON.stringify({...seat,type:'resume'}));ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.type==='state')ws.send(JSON.stringify({type:'leave'}));else if(['left','closed','error'].includes(m.type)){clearTimeout(timer);ws.close();resolve();}};ws.onerror=()=>{clearTimeout(timer);ws.close();resolve();};}),{base,seat:ownedSession});
 }
 await browser?.close();if(child){if(child.exitCode===null&&child.signalCode===null){const exited=once(child,'exit');child.kill();await exited;}await rm(dir,{recursive:true,force:true});}}
