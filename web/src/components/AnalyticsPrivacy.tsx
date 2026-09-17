'use client';
import { useSyncExternalStore } from 'react';
const subscribe = (fn: () => void) => { window.addEventListener('analytics-preference', fn); return () => window.removeEventListener('analytics-preference', fn); };
const snapshot = () => { try { return localStorage.getItem('jw_analytics_optout') === '1'; } catch { return true; } };
export function AnalyticsPrivacy() {
  const excluded = useSyncExternalStore(subscribe, snapshot, () => false);
  return <section><h2>브라우저 방문 통계</h2>
    <p>화면에 1초 이상 표시된 공개 페이지를 집계합니다. 하루 동안 유지되는 임의 번호(jw_av 쿠키)로 브라우저를 구분하고, 탭의 세션 저장소로 30분 비활동 전까지의 방문과 첫 유입을 연결합니다. 날짜는 한국 시간을 기준으로 나눕니다.</p>
    <p>서버에는 날짜와 비밀값을 섞은 대조값만 오늘·어제 범위로 보관하고 시간별로 정리합니다(최대 약 49시간, 서비스 중단 시 재기동 후 정리). 집계 숫자는 계속 보관하며 원본 IP와 사용자 에이전트는 통계 DB에 저장하지 않습니다.</p>
    <p>유입 주소는 호스트만 남깁니다. 공유 링크의 UTM source·medium·campaign은 제한된 라벨만 수집하고 검색어·URL 경로·utm_term·utm_content는 보관하지 않습니다. 페이지 표시 30초와 스크롤 75% 도달 여부도 집계합니다.</p>
    <p>관리자, 알려진 봇, 자동 브라우저와 DNT·GPC 요청은 제외합니다. 아래 설정으로 이 브라우저의 수집을 중지할 수 있습니다. 쿠키·저장소 삭제 시 설정도 초기화될 수 있습니다.</p>
    <button type="button" onClick={() => {
      try {
        localStorage.setItem('jw_analytics_optout', excluded ? '0' : '1');
        if (!excluded) {
          document.cookie='jw_av=; Path=/; Max-Age=0; SameSite=Lax';
          sessionStorage.removeItem('jw_analytics_blog'); sessionStorage.removeItem('jw_analytics_wiki');
        }
        location.reload();
      } catch { /* Blocked storage already disables collection. */ }
    }}>{excluded ? '방문 통계 허용하기' : '이 브라우저의 방문 통계 제외하기'}</button>
  </section>;
}
