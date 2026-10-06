import {chromium,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 const page=await context.newPage();await page.goto('http://blog.localhost:3000/works');
 const games=page.locator('#games');await expect(games.getByRole('heading',{name:'OMOK',exact:true})).toBeVisible();
 const entry=games.locator('article').filter({has:page.getByRole('heading',{name:'OMOK',exact:true})});
 await expect(entry.locator('img')).toBeVisible();await expect.poll(()=>entry.locator('img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
 await mkdir('artifacts/online-ux',{recursive:true});await games.screenshot({path:'artifacts/online-ux/blog-games.png'});
 const opened=page.waitForEvent('popup');await entry.getByRole('link',{name:/OMOK 작업물 보기/}).click();const game=await opened;
 await expect(game).toHaveURL('http://localhost:3100/?from=works');await expect(game.locator('#board')).toBeVisible();
 await expect(game.locator('#back-to-works')).toHaveAttribute('href','http://blog.localhost:3000/works');
 await game.locator('.intersection').nth(112).click();await expect(game.locator('.stone')).toHaveCount(2,{timeout:10000});await game.locator('#undo').click();await expect(game.locator('.stone')).toHaveCount(0);
 await game.locator('#online-mode').click();await expect(game.locator('#room-capacity')).toContainText('/ 100');
 await game.locator('#create-room').click();await expect(game.locator('#room-code')).toBeVisible();await game.locator('#back-to-works').click();await expect(game.locator('#confirm-message')).toContainText('승패는 기록되지');await game.locator('#confirm-yes').click();await expect(game).toHaveURL('http://blog.localhost:3000/works');
 await page.setViewportSize({width:390,height:844});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await games.screenshot({path:'artifacts/online-ux/blog-games-mobile.png'});
 if(errors.length)throw Error(errors.join('\n'));console.log('PASS: real blog catalog, logo asset, popup launch, game+undo, online room creation/cancellation, return to works, mobile catalog.');
}finally{await browser.close();}
