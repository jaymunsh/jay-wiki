import { ImageResponse } from 'next/og';
import { getBlogPosts } from '@/lib/blog';
import { blogAbsoluteUrl } from '@/lib/blogLinks';

/**
 * 공유 카드. 글의 대표 이미지를 1200x630 안에 통째로 넣는다.
 *
 * 대표 이미지를 og:image 로 그냥 내보내면 플랫폼마다 제 비율로 잘라 간다. 세로로 긴 캡처는
 * 위아래가 날아간다. 여기서 미리 1200x630 으로 그려 두면 어디서도 다시 잘리지 않는다.
 *
 * 글자를 넣지 않는 이유: satori 는 woff2 를 못 읽고 이 저장소 폰트는 둘 다 woff2 다.
 * 카드 제목 하나 때문에 ttf 를 새로 들이지 않는다.
 */
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'jay-blog';

export default async function OpengraphImage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;
  // 단건 조회 API 는 조회수를 올린다. 크롤러가 카드를 받을 때마다 오르면 통계가 망가지므로 목록에서 찾는다.
  const post = (await getBlogPosts()).find((p) => String(p.id) === id);
  const src = blogAbsoluteUrl(post?.coverImageUrl ?? '/og-image-1200x630.png');

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f172a',
        }}
      >
        {/* satori 는 maxWidth/maxHeight 를 무시한다. objectFit 은 먹는다. */}
        <img src={src} alt="" width={size.width} height={size.height} style={{ objectFit: 'contain' }} />
      </div>
    ),
    size,
  );
}
