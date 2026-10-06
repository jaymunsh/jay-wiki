import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('artifacts/local',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const baseURL=process.env.BASE_URL||'http://localhost:3100',errors=[];
try{
 const p=await browser.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));
 let workers=0,sockets=0;p.on('worker',()=>workers++);p.on('websocket',()=>sockets++);
 await p.goto(baseURL);await p.locator('#local-mode').click();await expect(p.locator('#local-mode')).toHaveAttribute('aria-pressed','true');await expect(p.locator('#local-rule')).toHaveValue('renju');await expect(p.locator('#bot-options')).toBeHidden();
 await p.locator('.intersection').nth(112).click();await expect(p.locator('#turn-label')).toContainText('백돌 차례');await p.waitForTimeout(1100);await expect(p.locator('.stone')).toHaveCount(1);assert.equal(workers,0);assert.equal(sockets,0);
 await p.locator('.intersection').nth(113).click();await expect(p.locator('#turn-label')).toContainText('흑돌 차례');await p.locator('#undo').click();await expect(p.locator('.stone')).toHaveCount(1);await expect(p.locator('#turn-label')).toContainText('백돌 차례');await expect(p.locator('#local-rule')).toBeDisabled();
 await p.reload();await expect(p.locator('#local-mode')).toHaveAttribute('aria-pressed','true');await expect(p.locator('.stone')).toHaveCount(1);await expect(p.locator('#turn-label')).toContainText('백돌 차례');
 await p.locator('#bot-mode').click();await expect(p.locator('.stone')).toHaveCount(0);await p.locator('.intersection').nth(112).click();await p.locator('#local-mode').click();await p.waitForTimeout(1000);await expect(p.locator('.stone')).toHaveCount(1);await expect(p.locator('#turn-label')).toContainText('백돌 차례');
 await p.locator('#resign').click();await expect(p.locator('#confirm-title')).toContainText('백 플레이어');await p.locator('#confirm-no').click();await expect(p.locator('#result-card')).toBeHidden();await p.locator('#resign').click();await p.locator('#confirm-yes').click();await expect(p.locator('#result-title')).toHaveText('흑 플레이어의 승리!');await expect(p.locator('#stats-label')).toContainText('둘이 대전 1국');assert.equal((await p.locator('#stats-label').innerText()).includes('패'),false);
 await p.locator('#review-current').click();await expect(p.locator('#review-opponent')).toContainText('흑돌 승리');await p.locator('#review-next').click();await expect(p.locator('.stone')).toHaveCount(1);await p.locator('#review-exit').click();
 await p.locator('#new-game').click();await p.locator('#next-rule').selectOption('freestyle');await p.locator('#confirm-yes').click();await expect(p.locator('#local-rule')).toHaveValue('freestyle');
 for(const i of [105,0,106,2,107,4,108,6,109])await p.locator('.intersection').nth(i).click();await expect(p.locator('#result-title')).toHaveText('흑 플레이어의 승리!');await expect(p.locator('.stone.won')).toHaveCount(5);await expect(p.locator('.intersection').nth(110)).toBeDisabled();
 await p.locator('#new-game').click();await p.locator('#next-rule').selectOption('renju');await p.locator('#confirm-yes').click();
 for(const i of [111,0,113,2,97,4,127,6])await p.locator('.intersection').nth(i).click();await expect(p.locator('.intersection').nth(112)).toHaveClass(/forbidden/);await p.locator('.intersection').nth(112).click();await expect(p.locator('#toast')).toContainText('삼삼');await expect(p.locator('.stone')).toHaveCount(8);
 await p.screenshot({path:'artifacts/local/desktop.png',fullPage:true});
 for(const width of [320,390,768]){await p.setViewportSize({width,height:844});await expect.poll(()=>p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(p.locator('#local-mode')).toBeVisible();await p.screenshot({path:`artifacts/local/mobile-${width}.png`,fullPage:true});}
 await p.locator('#open-records').click();await expect(p.locator('#records-list')).toContainText('둘이 대전');await expect(p.locator('#records-list')).toContainText('흑돌 승리');await p.locator('[data-close="records-dialog"]').click();
 assert.equal(sockets,0);
 const favicon=await p.request.get(`${baseURL}/favicon.svg`);assert.equal(favicon.status(),200);assert.match(favicon.headers()['content-type'],/image\/svg\+xml/);await expect(p.locator('link[rel="icon"]')).toHaveAttribute('href',new URL('favicon.svg',baseURL.replace(/\/?$/,'/')).pathname);
 assert.deepEqual(errors,[]);console.log('PASS: local alternating turns, no bot/network, one-stone undo, restore, mode isolation and pending AI cancellation, resignation, win, renju bans, rule selection, replay, local-only stats, 320/390/768px layouts, SVG favicon.');
}finally{await browser.close();}
