import { describe, expect, it } from 'vitest';

import {
  blogAbsoluteUrl,
  blogPostHref,
  formatBlogDate,
  formatBlogDateTime,
  isEditedAfterPublish,
} from './blogLinks';

describe('blogPostHref', () => {
  it('id 를 정본으로 두고 slug 를 뒤에 붙인다', () => {
    expect(blogPostHref(6, 'donts3p-macos-sleep-assertion-app')).toBe(
      '/6/donts3p-macos-sleep-assertion-app',
    );
  });

  it('slug 를 URL 인코딩한다', () => {
    expect(blogPostHref(7, '한글 슬러그')).toBe(`/7/${encodeURIComponent('한글 슬러그')}`);
  });

  it('slug 가 비면 id 만 쓴다', () => {
    expect(blogPostHref(8, '')).toBe('/8');
  });
});

describe('blogAbsoluteUrl', () => {
  it('블로그 오리진을 앞에 붙인다', () => {
    expect(blogAbsoluteUrl('/6/slug')).toBe('https://blog.leneu.cloud/6/slug');
  });

  it('오리진 끝의 슬래시가 겹치지 않는다', () => {
    expect(blogAbsoluteUrl('/')).toBe('https://blog.leneu.cloud/');
  });
});

describe('formatBlogDate', () => {
  it('KST 기준 YYYY.MM.DD 로 적는다', () => {
    // 2026-08-01T15:00:00Z = KST 2026-08-02 00:00
    expect(formatBlogDate('2026-08-01T15:00:00Z')).toBe('2026.08.02');
  });

  it('값이 없거나 못 읽으면 -- 를 준다', () => {
    expect(formatBlogDate(null)).toBe('--');
    expect(formatBlogDate('nope')).toBe('--');
  });
});

describe('formatBlogDateTime', () => {
  it('KST 기준 YYYY.MM.DD HH:mm 로 적는다', () => {
    expect(formatBlogDateTime('2026-08-08T01:51:29Z')).toBe('2026.08.08 10:51');
  });

  it('자정을 24 가 아니라 00 으로 적는다', () => {
    // 2026-08-01T15:00:00Z = KST 2026-08-02 00:00. h12 나 h24 면 여기서 어긋난다.
    expect(formatBlogDateTime('2026-08-01T15:00:00Z')).toBe('2026.08.02 00:00');
  });

  it('오후를 24시제로 적는다', () => {
    expect(formatBlogDateTime('2026-08-08T10:05:00Z')).toBe('2026.08.08 19:05');
  });

  it('값이 없거나 못 읽으면 -- 를 준다', () => {
    expect(formatBlogDateTime(null)).toBe('--');
    expect(formatBlogDateTime('nope')).toBe('--');
  });
});

describe('isEditedAfterPublish', () => {
  it('발행 뒤 고친 글은 true', () => {
    expect(isEditedAfterPublish('2026-08-01T00:00:00Z', '2026-08-09T05:12:00Z')).toBe(true);
  });

  it('발행만 하고 안 고친 글은 false', () => {
    expect(isEditedAfterPublish('2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z')).toBe(false);
  });

  it('발행 절차가 만든 1분 미만 차이는 무시한다', () => {
    expect(isEditedAfterPublish('2026-08-01T00:00:00Z', '2026-08-01T00:00:30Z')).toBe(false);
  });

  it('값이 없거나 못 읽으면 false', () => {
    expect(isEditedAfterPublish(null, '2026-08-09T05:12:00Z')).toBe(false);
    expect(isEditedAfterPublish('2026-08-01T00:00:00Z', 'nope')).toBe(false);
  });
});
