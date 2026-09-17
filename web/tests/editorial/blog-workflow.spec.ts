import { expect, test, type Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/login');
  await page.locator('input[name=username]').fill('admin');
  await page.locator('input[name=password]').fill('admin1234');
  await page.getByRole('button', { name: '관리자 콘솔 열기', exact: true }).click();
  await expect(page).toHaveURL('http://admin.localhost:3101/wiki/articles');
}

test('login, draft, publication, edit and series survive navigation; logout revokes the session', async ({ page }) => {
  await page.goto('/blog/posts/new');
  await expect(page).toHaveURL(/\/login/);
  await page.locator('input[name=username]').fill('admin');
  await page.locator('input[name=password]').fill('wrong-password');
  await page.getByRole('button', { name: '관리자 콘솔 열기', exact: true }).click();
  await expect(page.locator('.admin-login-error')).toHaveText('관리자 인증 정보가 올바르지 않습니다.');
  await login(page);
  const suffix = `${Date.now()}`;
  const ids: number[] = [];
  const origin = 'http://admin.localhost:3101';
  const publicOrigin = 'http://blog.localhost:3101';
  try {
    for (const [index, status] of ['published', 'draft'].entries()) {
      await page.goto('/blog/posts/new');
      await page.locator('input[name=title]').fill(`E2E ${suffix} ${index}`);
      await page.locator('input[name=slug]').fill(`e2e-${suffix}-${index}`);
      await page.locator('select[name=categoryId]').selectOption({ index: 1 });
      await page.locator('select[name=status]').selectOption(status);
      await page.locator('textarea[name=body]').fill('초기 본문\n\n## 확인\n\n브라우저로 저장한 내용이다.');
      await page.getByRole('button', { name: '저장', exact: true }).click();
      await expect(page).toHaveURL(/\/blog\/posts$/);
      const posts = await (await page.request.get('/api/bff/admin/blog/posts')).json();
      const saved = posts.find((post: { slug: string }) => post.slug === `e2e-${suffix}-${index}`);
      expect(saved.status).toBe(status);
      ids.push(saved.id);
    }
    const anonymous = await page.context().browser()!.newContext();
    try {
      expect((await anonymous.request.get(`${publicOrigin}/api/bff/blog/posts/${ids[1]}`)).status()).toBe(404);
    } finally { await anonymous.close(); }
    await page.goto(`/blog/posts/${ids[1]}`);
    await expect(page.locator('textarea[name=body]')).toHaveValue(/초기 본문/);
    await page.locator('textarea[name=body]').fill('수정한 본문\n\n## 이어지는 기록\n\n발행 후에도 이 내용이 남는다.');
    await page.locator('select[name=status]').selectOption('published');
    await page.locator('select[name=prevPostId]').selectOption(String(ids[0]));
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await expect(page).toHaveURL(/\/blog\/posts$/);
    await page.goto(`/blog/posts/${ids[1]}`);
    await expect(page.locator('textarea[name=body]')).toHaveValue(/수정한 본문/);
    await expect(page.locator('select[name=prevPostId]')).toHaveValue(String(ids[0]));
    const first = await (await page.request.get(`/api/bff/admin/blog/posts/${ids[0]}`)).json();
    expect(first.nextPostId).toBe(ids[1]);
    await page.goto(`http://blog.localhost:3101/${ids[1]}/e2e-${suffix}-1`);
    await expect(page.getByText('발행 후에도 이 내용이 남는다.')).toBeVisible();
    await expect(page.getByRole('navigation', { name: '이어지는 글' }).getByRole('link', { name: new RegExp(`E2E ${suffix} 0`) })).toBeVisible();
    await page.getByRole('navigation', { name: '이어지는 글' }).getByRole('link').click();
    await expect(page.getByRole('heading', { name: `E2E ${suffix} 0`, exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  } finally {
    for (const id of ids.reverse()) {
      expect((await page.request.delete(`/api/bff/admin/blog/posts/${id}`, { headers: { origin } })).ok()).toBe(true);
    }
  }
  const token = (await page.context().cookies()).find(cookie => cookie.name === 'jw_token')!;
  expect((await page.request.post('/api/bff/auth/logout', { headers: { origin } })).ok()).toBe(true);
  await page.goto('/blog/posts');
  await expect(page).toHaveURL(/\/login/);
  const replay = await page.request.get('/api/bff/admin/blog/posts', { headers: { cookie: `jw_token=${token.value}` } });
  expect([401, 403]).toContain(replay.status());
});
