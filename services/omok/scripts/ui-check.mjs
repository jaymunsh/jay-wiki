import {chromium,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const baseURL=process.env.BASE_URL||'http://localhost:3100';
await mkdir('artifacts/ui',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[];
async function newPage(width=1440,height=1000){const page=await browser.newPage({viewport:{width,height}});page.on('pageerror',e=>errors.push(e.message));await page.goto(baseURL);return page;}
try{
 const page=await newPage();
 await expect(page.locator('#difficulty')).toHaveValue('normal');
 await page.locator('#difficulty').selectOption('hard');
 await expect(page.locator('#difficulty-help')).toContainText('여러 수');
 await page.locator('.intersection').nth(112).click();
 await expect(page.locator('.stone')).toHaveCount(2,{timeout:10000});
 for(const cell of await page.locator('.intersection.occupied').all())await expect(cell).toHaveCSS('opacity','1');
 await page.locator('#difficulty').selectOption('easy');await expect(page.locator('#confirm-dialog')).toBeVisible();await page.locator('#confirm-no').click();await expect(page.locator('#difficulty')).toHaveValue('hard');
 await page.screenshot({path:'artifacts/ui/desktop-playing.png',fullPage:true});
 await page.locator('#resign').click();await page.locator('#confirm-yes').click();await expect(page.locator('#result-card')).toBeVisible();
 await page.screenshot({path:'artifacts/ui/desktop-result.png',fullPage:true});
 await page.locator('#review-current').click();await expect(page.locator('#review-bar')).toBeVisible();await expect(page.locator('.players')).toBeHidden();await page.locator('#review-next').click();await expect(page.locator('.stone')).toHaveCount(1);await page.screenshot({path:'artifacts/ui/desktop-review.png',fullPage:true});await page.locator('#review-exit').click();
 await page.locator('#online-mode').click();await page.locator('#join-room').click();await expect(page.locator('#room-error')).toBeVisible();await expect(page.locator('#room-input')).toBeFocused();
 await page.locator('#nickname').fill('첫 번째 플레이어');await page.locator('#create-room').click();await expect(page.locator('#room-code')).toBeVisible();await expect(page.locator('#room-setup')).toBeHidden();const code=await page.locator('#room-code').innerText();
 await page.screenshot({path:'artifacts/ui/desktop-waiting.png',fullPage:true});
 const friend=await newPage(390,844);await friend.locator('#online-mode').click();await friend.locator('#room-input').fill(code);await friend.locator('#nickname').fill('아주 긴 이름의 친구입니다');await expect(friend.locator('#room-preview')).toContainText('확인 후 입장');await friend.locator('#join-room').click();await expect(friend.locator('#room-code')).toBeVisible();await expect(page.locator('#turn-label')).toContainText('당신의 차례');await page.locator('.intersection').nth(112).click();await expect(friend.locator('.stone')).toHaveCount(1);await friend.locator('.intersection').nth(113).click();await expect(page.locator('.stone')).toHaveCount(2);
 await friend.screenshot({path:'artifacts/ui/mobile-online-playing.png',fullPage:true});await friend.reload();await expect(friend.locator('.stone')).toHaveCount(2);await expect(friend.locator('#room-code')).toHaveText(code);
 await friend.locator('#leave-room').click();await friend.locator('#confirm-yes').click();await expect(page.locator('#result-card')).toBeVisible();
 for(const width of [320,390,768,1024,1440]){
  const responsive=await newPage(width,900);await expect.poll(()=>responsive.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await responsive.screenshot({path:`artifacts/ui/bot-${width}.png`,fullPage:true});
  await responsive.locator('#online-mode').click();await expect.poll(()=>responsive.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);if(width<=820)await expect(responsive.locator('.board-column')).toBeHidden();
  await responsive.screenshot({path:`artifacts/ui/lobby-${width}.png`,fullPage:true});
  await responsive.locator('#open-records').click();await expect(responsive.locator('.empty-records')).toBeVisible();await expect(responsive.locator('#export-records')).toBeHidden();await responsive.locator('[data-close="records-dialog"]').click();
  await responsive.locator('#rules-nav').click();await expect(responsive.locator('#rules')).toBeVisible();await responsive.locator('.close-rules').click();await responsive.close();
 }
 if(errors.length)throw Error(errors.join('\n'));
 console.log('PASS: UI at 320/390/768/1024/1440, hard bot interaction, cancel settings, result, review, room validation, two-player UI, refresh recovery, dialogs, no page errors.');
}finally{await browser.close();}
