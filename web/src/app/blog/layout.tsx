import type { Metadata } from 'next';
import { BlogPlayer } from '@/components/blog/BlogPlayer';
import { BlogAudioProvider } from '@/components/blog/BlogAudioProvider';
import { BLOG_ORIGIN } from '@/lib/blogLinks';

/**
 * 아이콘은 루트 layout 의 metadata 를 그대로 물려받는다. Next 가 부모 metadata 를 병합하므로
 * 여기서 다시 적지 않아도 favicon·apple-touch-icon 이 그대로 나온다.
 * og:image 도 루트가 상대 경로('/og-image-1200x630.png')로 적어둔 덕에
 * 여기 metadataBase 기준으로 블로그 주소가 된다. 그 파일은 public/ 에 있고
 * blogHost 의 통과 목록에 들어 있어 블로그 host 에서도 그대로 서빙된다.
 *
 * 다만 og:site_name 은 루트가 'jay-wiki' 로 박아둔 값이라 여기서 덮는다.
 */
export const metadata: Metadata = {
  metadataBase: new URL(BLOG_ORIGIN),
  title: {
    // default 로 두면 루트의 template('%s · jay-wiki')이 씌워져 '… · jay-wiki' 가 된다.
    // absolute 가 부모 template 을 무시한다. 자식 화면의 제목에는 아래 template 이 걸린다.
    absolute: 'jay-blog — 만든 것과 그때의 판단',
    template: '%s · jay-blog',
  },
  description: '개인 프로젝트, 팀 프로젝트, 기술 실험, 도구와 워크플로에 대한 기록.',
  openGraph: {
    siteName: 'jay-blog',
    title: 'jay-blog — 만든 것과 그때의 판단',
    description: '개인 프로젝트, 팀 프로젝트, 기술 실험, 도구와 워크플로에 대한 기록.',
    // openGraph 는 객체째로 교체되므로 루트의 images 가 사라진다. 같은 파일을 다시 적는다.
    // 상대 경로라 위의 metadataBase 기준으로 블로그 주소가 된다.
    images: ['/og-image-1200x630.png'],
  },
};

/**
 * 블로그 골격. 좌측 레일 + 우측 본문. 위키 Header/Footer 를 쓰지 않는다.
 *
 * **배경음악의 audio 와 플레이어가 이 layout 안에 산다.** layout 은 블로그 안에서 화면을
 * 옮겨도 안 사라지므로 재생도 조작 상태도 이어진다. 레일은 화면마다 새로 그려지니 거기 두면 끊긴다.
 */
export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <BlogAudioProvider>
      <div className="blog-grid">{children}</div>
      <BlogPlayer />
    </BlogAudioProvider>
  );
}
