import {isIP} from 'node:net';

const TITLE='OMOK | 무료 웹 오목 · 봇 대전, 둘이 대전, 온라인 대전';
const DESCRIPTION='입체 원목 보드에서 즐기는 무료 웹 오목. 쉬움·보통·어려움 봇, 한 화면 둘이 대전, 초대 코드 온라인 대전과 렌주·자유룰을 지원합니다.';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function createSeo(publicOrigin,environment='production',publicPath=''){
 let origin=null;
 try{
  const url=new URL(publicOrigin),host=url.hostname;
  if(environment!=='development'&&environment!=='test'&&url.protocol==='https:'&&!url.username&&!url.password&&host!=='localhost'&&!host.endsWith('.localhost')&&!host.endsWith('.local')&&!isIP(host.replace(/^\[|\]$/g,'')))origin=url.origin;
 }catch{ /* Public origin is deliberately absent on local development servers. */ }
 const root=`${origin||''}${publicPath}/`;
 const canonical=origin?root:null,image=`${root}og-image.png`;
 return {
  robotsTxt:origin?`User-agent: *\nAllow: ${publicPath}/\nDisallow: ${publicPath}/health\nDisallow: ${publicPath}/room-status\nSitemap: ${root}sitemap.xml\n`:'User-agent: *\nDisallow: /\n',
  sitemapXml:`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${canonical?`<url><loc>${escape(canonical)}</loc></url>`:''}</urlset>\n`,
  page(searchParams){
   const robots=origin&&!searchParams.has('room')?'index, follow':'noindex, nofollow';
   const html=`<title>${escape(TITLE)}</title>
  <meta name="description" content="${escape(DESCRIPTION)}">
  <meta name="robots" content="${robots}">
  ${canonical?`<link rel="canonical" href="${escape(canonical)}">`:''}
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="OMOK">
  <meta property="og:locale" content="ko_KR">
  <meta property="og:title" content="${escape(TITLE)}">
  <meta property="og:description" content="${escape(DESCRIPTION)}">
  ${canonical?`<meta property="og:url" content="${escape(canonical)}">`:''}
  <meta property="og:image" content="${escape(image)}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="OMOK 로고와 입체 원목 오목판">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escape(TITLE)}">
  <meta name="twitter:description" content="${escape(DESCRIPTION)}">
  <meta name="twitter:image" content="${escape(image)}">`;
   return {html,robots};
  }
 };
}
