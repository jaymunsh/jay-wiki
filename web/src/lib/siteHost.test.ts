import { describe, expect, it } from 'vitest';
import { adminExternalPath, adminOriginFor, adminRewritePath, isAdminHost, isManagementApi, isProductionAdminHost, safeAdminNext } from './siteHost';

describe('site host boundary', () => {
  it('uses an exact administrator host allowlist', () => {
    expect(isAdminHost('admin.localhost:3000')).toBe(true);
    expect(isAdminHost('admin.leneu.cloud')).toBe(true);
    for (const host of ['admin.attacker.test', 'admin.leneu.cloud.evil', 'blog.localhost:3000', null]) {
      expect(isAdminHost(host)).toBe(false);
    }
  });

  it('shows the initial OTP field only on the production administrator host', () => {
    expect(isProductionAdminHost('admin.leneu.cloud')).toBe(true);
    expect(isProductionAdminHost('admin.leneu.cloud:443')).toBe(true);
    expect(isProductionAdminHost('admin.localhost:3000')).toBe(false);
    expect(isProductionAdminHost('admin.leneu.cloud.evil')).toBe(false);
  });

  it('maps clean admin URLs to internal routes and back', () => {
    expect(adminRewritePath('/')).toBe('/admin');
    expect(adminRewritePath('/login')).toBe('/admin-login');
    expect(adminRewritePath('/wiki/articles/new')).toBe('/admin/articles/new');
    expect(adminRewritePath('/blog/posts/12')).toBe('/admin/blog/posts/12');
    expect(adminRewritePath('/tools/spreadsheet-export')).toBe('/admin/tools/spreadsheet-export');
    expect(adminExternalPath('/admin/articles/new')).toBe('/wiki/articles/new');
    expect(adminExternalPath('/admin/stats')).toBe('/stats');
    expect(adminExternalPath('/admin/tools/spreadsheet-export')).toBe('/tools/spreadsheet-export');
    expect(adminRewritePath('/unknown')).toBeNull();
  });

  it('builds local and production administrator origins without sibling cookies', () => {
    expect(adminOriginFor('localhost:3000', 'http:')).toBe('http://admin.localhost:3000');
    expect(adminOriginFor('blog.localhost:3100', 'http:')).toBe('http://admin.localhost:3100');
    expect(adminOriginFor('portfolio.leneu.cloud')).toBe('https://admin.leneu.cloud');
  });

  it('classifies every management write while leaving public writes alone', () => {
    for (const [method, path] of [
      ['GET', ['admin', 'stats', 'report']],
      ['GET', ['articles', 'slug', 'revisions']],
      ['POST', ['articles']],
      ['DELETE', ['articles', 'slug']],
      ['POST', ['articles', 'slug', 'revert', '2']],
      ['POST', ['tabs', 'reorder']],
      ['PUT', ['wiki', 'featured']],
      ['POST', ['wiki-assets']],
      ['POST', ['domain-scenarios', 'spreadsheet-operations', 'exports']],
    ] as const) expect(isManagementApi(method, path)).toBe(true);
    expect(isManagementApi('GET', ['articles', 'slug'])).toBe(false);
    expect(isManagementApi('POST', ['blog', 'posts', '1', 'comments'])).toBe(false);
    expect(isManagementApi('POST', ['board', 'posts'])).toBe(false);
  });

  it('keeps login return paths inside known clean admin routes', () => {
    expect(safeAdminNext('/wiki/articles/new?parentId=start')).toBe('/wiki/articles/new?parentId=start');
    expect(safeAdminNext('https://attacker.test/steal')).toBe('/');
    expect(safeAdminNext('/\\attacker.test/steal')).toBe('/');
    expect(safeAdminNext('/unknown')).toBe('/');
  });
});
