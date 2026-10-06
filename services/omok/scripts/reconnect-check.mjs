import {chromium,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir=await mkdtemp(join(tmpdir(),'omok-reconnect-')),port=3108;
const child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),DATA_DIR:dir,MAX_ROOMS:'1'}});
let browser;
try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup timeout')),5000);child.stdout.on('data',data=>{if(data.toString().includes('"event":"listening"')){clearTimeout(timer);resolve();}});child.once('error',reject);});
 browser=await chromium.launch({channel:process.env.OMOK_CHROME_CHANNEL||'chrome',headless:true});
 const errors=[];const host=await browser.newContext(),guest=await browser.newContext({viewport:{width:390,height:844}}),outsider=await browser.newContext();
 const page=async context=>{const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(`http://localhost:${port}`);return p;};
 const a=await page(host),b=await page(guest);await a.locator('#online-mode').click();await a.locator('#create-room').click();await expect(a.locator('#room-code')).toBeVisible();const code=await a.locator('#room-code').innerText();
 await b.locator('#online-mode').click();await b.locator('#room-input').fill(code);await expect(b.locator('#room-preview')).toContainText('확인 후 입장');await b.locator('#join-room').click();await expect(b.locator('#room-code')).toHaveText(code);
 await a.locator('.intersection').nth(112).click();await expect(b.locator('.stone')).toHaveCount(1);await b.locator('.intersection').nth(113).click();await expect(a.locator('.stone')).toHaveCount(2);
 // Migrate sessions created before recovery storage was introduced.
 await a.evaluate(()=>localStorage.removeItem('omok:recovery'));await a.reload();await expect(a.locator('.stone')).toHaveCount(2);
 await a.close();const restored=await page(host);await restored.locator('#online-mode').click();await restored.locator('#room-input').fill(code);
 await expect(restored.locator('#room-preview')).toContainText('이전 자리');await restored.locator('#join-room').click();await expect(restored.locator('#room-code')).toHaveText(code);await expect(restored.locator('.stone')).toHaveCount(2);
 await restored.locator('.intersection').nth(114).click();await expect(b.locator('.stone')).toHaveCount(3);
 await expect(restored.locator('#timeline-list')).toContainText('연결 끊김');await expect(restored.locator('#timeline-list')).toContainText('재접속');await expect(restored.locator('#timeline-list')).toContainText('3수');
 const third=await page(outsider);await third.locator('#online-mode').click();await third.locator('#room-input').fill(code);await expect(third.locator('#room-error')).toContainText('가득');await expect(third.locator('#room-preview')).toBeHidden();
 await b.reload();await expect(b.locator('.stone')).toHaveCount(3);await expect(b.locator('#timeline-list')).toContainText('재접속');
 await mkdir('artifacts/reconnect',{recursive:true});await restored.screenshot({path:'artifacts/reconnect/desktop.png',fullPage:true});await b.screenshot({path:'artifacts/reconnect/mobile.png',fullPage:true});
 await expect.poll(()=>b.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await restored.locator('#resign').click();await restored.locator('#confirm-yes').click();await expect(restored.locator('#result-card')).toBeVisible();await expect(b.locator('#timeline-list')).toContainText('기권');
 await b.locator('#review-current').click();await b.locator('#confirm-yes').click();await expect(b.locator('#timeline-list')).toContainText('3수');await expect(b.locator('#timeline-list')).toContainText('기권');
 const shared=await browser.newContext(),first=await page(shared),second=await page(shared);
 await first.locator('#online-mode').click();await first.locator('#create-room').click();await expect(first.locator('#room-code')).toBeVisible();const sharedCode=await first.locator('#room-code').innerText();
 await second.locator('#online-mode').click();await second.locator('#room-input').fill(sharedCode);await expect(second.locator('#room-preview')).toContainText('확인 후 입장');await second.locator('#join-room').click();await expect(second.locator('#room-code')).toHaveText(sharedCode);
 await first.close();const firstAgain=await page(shared);await firstAgain.locator('#online-mode').click();await firstAgain.locator('#room-input').fill(sharedCode);await expect(firstAgain.locator('#recovery-seat option')).toHaveCount(2);await firstAgain.locator('#recovery-seat').selectOption({label:'흑돌 · 플레이어'});await firstAgain.locator('#join-room').click();
 await expect(firstAgain.locator('#room-code')).toHaveText(sharedCode);await firstAgain.locator('.intersection').nth(112).click();await expect(second.locator('.stone')).toHaveCount(1);await second.locator('.intersection').nth(113).click();await expect(firstAgain.locator('.stone')).toHaveCount(2);
 await second.locator('#leave-room').click();await second.locator('#confirm-yes').click();await expect(firstAgain.locator('#room-code')).toBeHidden();const lobby=await page(shared);await lobby.locator('#online-mode').click();await lobby.locator('#room-input').fill(sharedCode);await expect(lobby.locator('#room-error')).toContainText('방을 찾을 수');await expect(lobby.locator('#room-preview')).toBeHidden();
 if(errors.length)throw Error(errors.join('\n'));console.log('PASS: closed-tab seat recovery, board/turn preserved, unauthenticated full-room rejection, reload timeline, desktop/mobile, replay timeline, shared-browser seat selection, explicit leave clears recovery.');
}finally{await browser?.close();const done=once(child,'exit');child.kill();await done;await rm(dir,{recursive:true,force:true});}
