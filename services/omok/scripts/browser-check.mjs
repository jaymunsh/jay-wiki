import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const baseURL=process.env.BASE_URL || 'http://localhost:3100';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const p=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(baseURL);await p.locator('.intersection').nth(112).click();await p.waitForTimeout(1200);assert.equal(await p.locator('.stone').count(),2);await p.locator('#undo').click();assert.equal(await p.locator('.stone').count(),0);await p.screenshot({path:'artifacts/desktop.png',fullPage:true});
 await p.locator('#online-mode').click();await p.locator('#create-room').click();await p.locator('#room-code').waitFor({state:'visible'});const code=(await p.locator('#room-code').innerText()).slice(0,6);
 const q=await browser.newPage();await q.goto(baseURL);await q.locator('#online-mode').click();await q.locator('#room-input').fill(code);await q.waitForFunction(()=>document.querySelector('#room-preview').textContent.includes('확인 후 입장'));await q.locator('#join-room').click();await p.waitForTimeout(200);await p.locator('.intersection').nth(112).click();await q.waitForTimeout(200);assert.equal(await q.locator('.stone').count(),1);await q.locator('.intersection').nth(113).click();await p.waitForTimeout(200);assert.equal(await p.locator('.stone').count(),2);
 await p.setViewportSize({width:390,height:844});await p.locator('#bot-mode').click();await p.locator('#confirm-yes').click();await p.screenshot({path:'artifacts/mobile.png',fullPage:true});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await p.locator('#rules-nav').click();assert.equal(await p.locator('#rules').evaluate(el=>el.open),true);assert.deepEqual(errors,[]);console.log('PASS: bot, undo, two-browser online play, mobile overflow, guide, no JS errors');
}finally{await browser.close();}
