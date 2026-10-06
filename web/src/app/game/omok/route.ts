export const dynamic = 'force-dynamic';

/** Launch the independent HTTP/WebSocket game server rather than copying static assets. */
export function GET(request: Request): Response {
 const configured=process.env.OMOK_PUBLIC_URL?.trim();
 const address=configured||(process.env.NODE_ENV==='development'?'http://localhost:3100':null);
 let target:URL|null=null;
 try{
  if(address){
   const url=new URL(address);
   const localDevelopment=process.env.NODE_ENV==='development'&&url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname);
   if((url.protocol==='https:'||localDevelopment)&&!url.username&&!url.password)target=url;
  }
 }catch{ /* Render the unavailable state below. */ }
 if(!target)return new Response(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OMOK · 공개 준비 중</title><main style="max-width:36rem;margin:15vh auto;padding:24px;font-family:system-ui;line-height:1.8"><h1>오목은 공개 준비 중입니다.</h1><p>지금은 게임 서버로 연결할 수 없습니다. 다른 작업물을 둘러봐 주세요.</p><a href="/works#games">작업물로 돌아가기</a></main></html>`,{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
 target.search='';target.hash='';target.searchParams.set('from','works');
 const room=new URL(request.url).searchParams.get('room');
 if(room&&/^[A-Fa-f0-9]{6}$/.test(room))target.searchParams.set('room',room.toUpperCase());
 return new Response(null,{status:307,headers:{Location:target.href,'Cache-Control':'no-store'}});
}
