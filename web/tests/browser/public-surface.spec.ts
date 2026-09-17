import { expect, test } from '@playwright/test';

const slug = process.env.WIKI_SMOKE_SLUG ?? 'browser-smoke-article';

test('public pages include the browser security headers', async ({ request }) => {
  const response = await request.get(`/wiki/${encodeURIComponent(slug)}`);
  expect(response.ok()).toBe(true);
  const headers = response.headers();
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('SAMEORIGIN');
  expect(headers['content-security-policy']).toContain("frame-ancestors 'self'");
  expect(headers['strict-transport-security']).toBe('max-age=31536000');
  expect(headers['x-powered-by']).toBeUndefined();
});

test('wiki deep link renders content and loads static assets', async ({ page }) => {
  const assetFailures: string[] = [];
  page.on('response', (response) => {
    const url = response.url();
    if (/\.(?:css|js)(?:\?|$)/i.test(url) && !response.ok()) {
      assetFailures.push(`${response.status()} ${url}`);
    }
  });

  await page.goto(`/wiki/${encodeURIComponent(slug)}`, { waitUntil: 'networkidle' });
  // 제목 문자열을 워크플로에 박으면 글 제목을 다듬을 때마다 배포 뒤 스모크가 깨진다.
  // 문서 제목에서 기대값을 뽑고, 같은 이름의 h1 이 실제로 그려졌는지만 본다.
  // level 로만 찾으면 셸의 숨은 home-hub-title h1 까지 2개가 잡힌다.
  await expect(page).toHaveTitle(/ · jay-wiki$/);
  const expectedTitle = (await page.title()).replace(/ · jay-wiki$/, '');
  expect(expectedTitle.length, 'wiki title should not be empty').toBeGreaterThan(3);
  await expect(page.getByRole('heading', { name: expectedTitle, level: 1 })).toBeVisible();
  if (!process.env.BASE_URL) {
    await expect(page.getByText('이 문서는 공개 위키 경로와 CSS·JavaScript 자산이 함께 로드되는지 확인합니다.')).toBeVisible();
  }
  expect(assetFailures, 'CSS/JS asset requests should not fail').toEqual([]);

  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: expectedTitle, level: 1 })).toBeVisible();
});

test('public surface does not overflow on a narrow viewport', async ({ page }) => {
  await page.goto(`/wiki/${encodeURIComponent(slug)}`, { waitUntil: 'networkidle' });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('portfolio and operations history render without horizontal overflow', async ({ page }) => {
  await page.goto('/portfolio', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', {
    name: 'jay-wiki: 실패를 설계하고, 실행과 복구로 검증합니다',
    level: 1,
  })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

  await page.getByRole('link', { name: '운영 이력 보기' }).first().click();
  await expect(page).toHaveURL(/\/operations\/history$/);
  await expect(page.getByRole('heading', { name: '운영했다는 말을 사건과 시간으로 증명한다' })).toBeVisible();
  await expect(page.getByText('없는 이미지로 배포를 깨뜨렸다')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
});
