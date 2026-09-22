import { BookOpenText, Camera, Gauge, Music, Puzzle } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { getBlogCategories, getBlogStats, getBlogTags, getPopularBlogPosts } from '@/lib/blog';
import { blogPostHref, formatBlogDate } from '@/lib/blogLinks';
import { BlogSearchBox } from './BlogSearchBox';

/** 레일에 세울 태그 수. 글이 열몇 편인데 태그가 54개라 전부 내면 레일이 태그로만 채워진다. */
const RAIL_TAG_LIMIT = 25;

/** 한 편짜리 태그는 안 세운다. 그 글로 가는 링크가 하나 더 생기는 것일 뿐 묶음이 아니다. */
const RAIL_TAG_MIN_COUNT = 2;

/**
 * 좌측 레일 = 블로그의 헤더다. 본문 쪽에는 헤더가 없다.
 * 프로필 → 검색 → 전체 글 + 카테고리 → 작업물 → 인기 글 → 태그 → 처리방침 순으로 쌓인다.
 * 데스크톱 레일과 모바일 드로어가 같은 내용을 쓴다(BlogShell 이 양쪽에 꽂는다).
 */
export async function BlogRail({
  active,
}: {
  /** 지금 보고 있는 카테고리 slug. 목록 화면은 'all'. 태그·처리방침은 넘기지 않는다. */
  readonly active?: string;
} = {}) {
  const [categories, popular, tags, stats] = await Promise.all([
    getBlogCategories(),
    getPopularBlogPosts(3),
    getBlogTags(),
    getBlogStats(),
  ]);

  /* 태그는 이미 많이 쓴 순으로 온다(BlogPostTagRepository.countByTag). 여기서는 걸러 자르기만 한다. */
  const railTags = tags.filter((t) => t.count >= RAIL_TAG_MIN_COUNT).slice(0, RAIL_TAG_LIMIT);

  const total = categories.reduce(
    (sum, c) => sum + c.postCount + c.children.reduce((s, ch) => s + ch.postCount, 0),
    0,
  );

  return (
    <div className="blog-rail-body">
      <div className="blog-prof">
        <div className="blog-prof-id">
          {/* 38px 로 그리므로 152px(4배) 로 줄여 두었다. 원본 1254px 은 1.8MB 라 그대로 쓸 값이 없다. */}
          <Image
            className="blog-avatar"
            src="/assets/profile/dev-leneu.webp"
            alt=""
            width={38}
            height={38}
          />
          <div>
            <b>dev_leneu</b>
            <a href="https://github.com/jaymunsh" target="_blank" rel="noopener noreferrer">
              @jaymunsh
            </a>
          </div>
        </div>
        <p className="blog-prof-bio">만든 것과 그때의 판단을 남깁니다.</p>
        {stats && (
          <div className="blog-prof-stat">
            <div>
              <b>{stats.todayVisitors.toLocaleString('ko-KR')}</b>
              <span title="새 집계 기준 · 사람 수가 아닌 일별 고유 브라우저">오늘 브라우저</span>
            </div>
            <div>
              <b>{stats.totalVisitors.toLocaleString('ko-KR')}</b>
              <span title="새 집계 이후 일별 고유 브라우저 합계 · 날짜 간 중복 포함">일별 누적</span>
            </div>
          </div>
        )}
      </div>

      <BlogSearchBox />

      <nav className="blog-rail-sec" aria-label="카테고리">
        <h4>
          전체 글 <span className="n">({total})</span>
        </h4>
        <ul className="blog-cats">
          <li>
            <Link
              className="blog-cat-row"
              href="/"
              aria-current={active === 'all' ? 'page' : undefined}
            >
              <span>전체</span>
              <span className="n">({total})</span>
            </Link>
          </li>
          {categories.map((category) => (
            <li key={category.id}>
              <Link
                className="blog-cat-row"
                href={`/category/${encodeURIComponent(category.slug)}`}
                aria-current={active === category.slug ? 'page' : undefined}
              >
                <span>{category.name}</span>
                <span className="n">({category.postCount})</span>
              </Link>
              {category.children.length > 0 && (
                <ul className="blog-subcats">
                  {category.children.map((child) => (
                    <li key={child.id}>
                      <Link
                        className="blog-cat-row"
                        href={`/category/${encodeURIComponent(child.slug)}`}
                        aria-current={active === child.slug ? 'page' : undefined}
                      >
                        <span>{child.name}</span>
                        <span className="n">({child.postCount})</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* 글이 아니라 돌아가는 물건으로 보내는 줄. 별도 호스트라 Link 가 아니라 a 다. */}
      <div className="blog-rail-sec">
        <h4>작업물</h4>
        <ul className="blog-cats">
          <li>
            <a
              className="blog-cat-row"
              href="https://www.yes24.com/product/goods/193453753"
              target="_blank"
              rel="noopener noreferrer"
            >
              {/* 표지를 쓰면 좋겠지만 세로로 긴 그림이라 15px 에서는 안 읽힌다. */}
              <BookOpenText className="blog-work-mark blog-work-mark--line" aria-hidden />
              <span>비전공자를 위한 AI 지식</span>
              <span className="n">↗</span>
            </a>
          </li>
          <li>
            <a
              className="blog-cat-row"
              href="https://spellcrown.leneu.cloud"
              target="_blank"
              rel="noopener noreferrer"
            >
              {/* 게임의 현재 왕관 표식. 인라인 SVG로 그리던 Phosphor Crown은
                  게임이 그림을 갈아끼운 뒤로 사이트에만 남은 옛 표식이었다.
                  같은 파일을 쓰면 다음에 갈아끼울 때도 함께 따라간다. */}
              <img
                className="blog-work-mark"
                src="/assets/projects/spellcrown-web-boardgame/crown.webp"
                alt=""
                width={15}
                height={15}
                loading="lazy"
              />
              <span>SPELLCROWN</span>
              <span className="n">↗</span>
            </a>
          </li>
          <li>
            <a
              className="blog-cat-row"
              href="https://github.com/jaymunsh/jay-claude"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Puzzle className="blog-work-mark blog-work-mark--line" aria-hidden />
              <span>jay-claude</span>
              <span className="n">↗</span>
            </a>
          </li>
          <li>
            <a
              className="blog-cat-row"
              href="https://youtu.be/xuWCNbn3vk0"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Music className="blog-work-mark blog-work-mark--line" aria-hidden />
              <span>Lost in the Neon Wave</span>
              <span className="n">↗</span>
            </a>
          </li>
          <li>
            <a
              className="blog-cat-row"
              href="https://camera.leneu.cloud"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Camera className="blog-work-mark blog-work-mark--line" aria-hidden />
              <span>사진 촬영 입문 가이드</span>
              <span className="n">↗</span>
            </a>
          </li>
          <li>
            <a
              className="blog-cat-row"
              href="/benchmark/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Gauge className="blog-work-mark blog-work-mark--line" aria-hidden />
              <span>Leneu Benchmark</span>
              <span className="n">↗</span>
            </a>
          </li>
          <li>
            <a
              className="blog-cat-row"
              href="https://github.com/jaymunsh/hold-img"
              target="_blank"
              rel="noopener noreferrer"
            >
              {/* 앱의 메뉴 막대 아이콘과 같은 모양 — 라운드 프레임 안에 떠 있는 작은 조각 */}
              <svg
                className="blog-work-mark blog-work-mark--line"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden
              >
                <rect x="3.5" y="4.5" width="17" height="15" rx="3.5" />
                <rect x="7" y="11.5" width="5.5" height="5.5" rx="1.4" />
              </svg>
              <span>HoldImg</span>
              <span className="n">↗</span>
            </a>
          </li>
        </ul>
      </div>

      {popular.length > 0 && (
        <div className="blog-rail-sec">
          <h4>인기 글</h4>
          <ul className="blog-pop">
            {popular.map((post) => (
              <li key={post.id}>
                <Link href={blogPostHref(post.id, post.slug)}>
                  <span className="t">
                    {/* 클램프는 제목에만 건다. time 을 클램프 안에 두면 두 줄을 제목이 다 쓸 때
                        날짜가 잘려 사라지고, 세 줄짜리 제목은 잘리다 만 줄이 새어 나온다. */}
                    <span>{post.title}</span>
                    <time dateTime={post.publishedAt}>{formatBlogDate(post.publishedAt)}</time>
                  </span>
                  {/* 대표 이미지가 있는 글만 썸네일이 붙는다. 목록 한 줄과 같은 규칙이다. */}
                  {post.coverImageUrl && (
                    <span className="th">
                      <img src={post.coverImageUrl} alt="" loading="lazy" />
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {railTags.length > 0 && (
        <div className="blog-rail-sec">
          {/* 괄호 안은 화면에 선 수다. 전체 태그 수(54)를 쓰면 스무 개 남짓 보이는 화면과 안 맞는다. */}
          <h4>
            태그 <span className="n">({railTags.length})</span>
          </h4>
          <ul className="blog-taglist">
            {railTags.map((tag) => (
              <li key={tag.name}>
                <Link href={`/tag/${encodeURIComponent(tag.name)}`}>
                  <span>{tag.name}</span>
                  <em>{tag.count}</em>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="blog-rail-foot">
        <Link href="/privacy">개인정보 처리방침</Link>
      </div>
    </div>
  );
}
