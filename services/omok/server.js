import http from 'node:http';
import {clientAddress} from './client-address.js';
import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {WebSocketServer,WebSocket} from 'ws';
import {randomBytes,createHash} from 'node:crypto';
import {emptyBoard,validateMove,normalizeRule,forbiddenMessage,hasLegalMove} from './public/game.js';
import {createSeo} from './seo.js';

const PORT=Number(process.env.PORT)||3000;
const DATA_FILE=resolve(process.env.DATA_DIR||'data','rooms.json');
const configuredRooms=Number(process.env.MAX_ROOMS??100);
if(!Number.isSafeInteger(configuredRooms)||configuredRooms<1)throw Error('MAX_ROOMS must be a positive integer');
const MAX_ROOMS=configuredRooms;
const GRACE=120000;
const WAIT_TTL=10*60000,RESULT_TTL=5*60000,IDLE_TTL=2*3600000;
const rooms=new Map();
const PUBLIC_PATH=(process.env.PUBLIC_PATH||'').replace(/\/$/,'');
if(PUBLIC_PATH&&!/^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(PUBLIC_PATH))throw Error('PUBLIC_PATH must be a safe absolute path');
const seo=createSeo(process.env.PUBLIC_ORIGIN,process.env.NODE_ENV,PUBLIC_PATH);
let saving=Promise.resolve(),saveTimer,persistenceError=false,closing=false;
const log=(event,extra={})=>console.log(JSON.stringify({time:new Date().toISOString(),event,...extra}));
const hash=token=>createHash('sha256').update(token).digest('hex');
const send=(ws,data)=>{if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data));};
const error=(ws,message,reason)=>send(ws,{type:'error',message,reason});
const serializable=room=>({...room,players:room.players.map(({ws,...seat})=>seat)});
function save(immediate=false){
 clearTimeout(saveTimer);
 const write=()=>{
  const json=JSON.stringify({version:1,rooms:[...rooms.values()].map(serializable)});
  saving=saving.then(async()=>{await mkdir(dirname(DATA_FILE),{recursive:true,mode:0o700});await writeFile(DATA_FILE+'.tmp',json,{mode:0o600});await rename(DATA_FILE+'.tmp',DATA_FILE);persistenceError=false;}).catch(e=>{persistenceError=true;log('persistence_error',{message:e.message});});
  return saving;
 };
 if(immediate)return write();
 saveTimer=setTimeout(write,100);
}
try{
 const saved=JSON.parse(await readFile(DATA_FILE,'utf8'));
 if(saved.version!==1||!Array.isArray(saved.rooms))throw Error('Unsupported room data');
 for(const room of saved.rooms){
  if(!/^[A-F0-9]{6}$/.test(room.code)||!Array.isArray(room.board)||room.board.length!==225||!room.board.every(v=>[0,1,2].includes(v))||!Array.isArray(room.players)||room.players.length<1||room.players.length>2)throw Error('Invalid room data');
  if(Date.now()-room.updated>86400000)continue;
  if(room.deadline)room.remaining=Math.max(1000,room.deadline-Date.now());
  room.rule=normalizeRule(room.rule,'freestyle');room.createdAt??=room.updated;
  room.deadline=null;room.players.forEach(p=>{p.ws=null;p.disconnectedAt=Date.now();});rooms.set(room.code,room);
 }
 log('rooms_restored',{count:rooms.size});
}catch(e){if(e.code!=='ENOENT'){log('startup_error',{message:e.message});process.exit(1);}}

const files={'/':'index.html','/style.css':'style.css','/app.js':'app.js','/game.js':'game.js','/ai-worker.js':'ai-worker.js','/favicon.svg':'favicon.svg','/og-image.png':'og-image.png'};
const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; worker-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405,{'Allow':'GET, HEAD'});return res.end();}
 let requestUrl;
 try{requestUrl=new URL(req.url,'http://localhost');}catch{res.writeHead(400);return res.end('Bad request');}
 if(PUBLIC_PATH&&requestUrl.pathname===PUBLIC_PATH){res.writeHead(308,{Location:PUBLIC_PATH+'/'+requestUrl.search});return res.end();}
 if(PUBLIC_PATH&&!requestUrl.pathname.startsWith(PUBLIC_PATH+'/')){res.writeHead(404);return res.end('Not found');}
 const pathname=requestUrl.pathname.slice(PUBLIC_PATH.length);
 if(pathname==='/robots.txt'||pathname==='/sitemap.xml'){
  res.writeHead(200,{'Content-Type':pathname==='/robots.txt'?'text/plain; charset=utf-8':'application/xml; charset=utf-8','Cache-Control':'public, max-age=3600'});
  return res.end(req.method==='HEAD'?undefined:pathname==='/robots.txt'?seo.robotsTxt:seo.sitemapXml);
 }
 if(pathname==='/health'||pathname==='/room-status')res.setHeader('X-Robots-Tag','noindex, nofollow');
 if(pathname==='/room-status'){
  expireRooms();
  res.writeHead(persistenceError||closing?503:200,{'Content-Type':'application/json','Cache-Control':'no-store'});
  return res.end(req.method==='HEAD'?undefined:JSON.stringify({rooms:rooms.size,maxRooms:MAX_ROOMS,available:!closing&&!persistenceError&&rooms.size<MAX_ROOMS,waitingSeconds:WAIT_TTL/1000,graceSeconds:GRACE/1000,finishedSeconds:RESULT_TTL/1000}));
 }
 if(pathname==='/health'){res.writeHead(persistenceError||closing?503:200,{'Content-Type':'application/json'});return res.end(req.method==='HEAD'?undefined:JSON.stringify({status:persistenceError?'degraded':closing?'stopping':'ok',rooms:rooms.size,connections:wss.clients.size,uptime:Math.floor(process.uptime())}));}
 const path=files[pathname];if(!path){res.writeHead(404);return res.end('Not found');}
 try{
  let data=await readFile(new URL(`./public/${path}`,import.meta.url));
  if(path==='index.html'){const meta=seo.page(requestUrl.searchParams);data=data.toString().replace(/(href|src)="\/(?!\/)/g,`$1="${PUBLIC_PATH}/`).replace('<!-- SEO_META -->',meta.html);res.setHeader('X-Robots-Tag',meta.robots);}
  res.writeHead(200,{'Content-Type':path.endsWith('.png')?'image/png':path.endsWith('.svg')?'image/svg+xml':path.endsWith('.css')?'text/css':path.endsWith('.js')?'text/javascript':'text/html; charset=utf-8','Cache-Control':path.endsWith('.png')?'public, max-age=86400':'no-cache'});res.end(req.method==='HEAD'?undefined:data);
 }catch(e){log('http_error',{message:e.message});res.writeHead(500);res.end('Server error');}
});
const wss=new WebSocketServer({noServer:true,maxPayload:2048});
const ips=new Map();
server.on('upgrade',(req,socket,head)=>{
 const reject=()=>{socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();};
 if(closing||req.url!==PUBLIC_PATH+'/'||wss.clients.size>=1500)return reject();
 if(req.headers.origin){try{const origin=new URL(req.headers.origin);const expected=process.env.PUBLIC_ORIGIN?new URL(process.env.PUBLIC_ORIGIN).origin:null;if(expected?origin.origin!==expected:origin.host!==req.headers.host)return reject();}catch{return reject();}}
 const ip=clientAddress(req);const entry=ips.get(ip)||{count:0,attempts:0,start:Date.now()};
 if(Date.now()-entry.start>60000){entry.attempts=0;entry.start=Date.now();}
 entry.attempts++;ips.set(ip,entry);if(entry.count>=20||entry.attempts>60)return reject();
 wss.handleUpgrade(req,socket,head,ws=>{entry.count++;ws.ip=ip;wss.emit('connection',ws,req);});
});
const online=room=>room.players.length===2&&room.players.every(p=>p.ws?.readyState===WebSocket.OPEN);
function clock(room,reset=false){
 if(reset)room.remaining=room.seconds*1000;
 if(room.winner||!online(room)){if(room.deadline)room.remaining=Math.max(0,room.deadline-Date.now());room.deadline=null;}
 else if(room.seconds&&!room.deadline)room.deadline=Date.now()+room.remaining;
}
function publish(room){
 room.updated=Date.now();clock(room);
 for(const p of room.players)send(p.ws,stateFor(room,p));
 save();
}
function stateFor(room,p){return {type:'state',code:room.code,rule:room.rule,board:room.board,turn:room.turn,winner:room.winner,line:room.line,last:room.last,color:p.color,ready:online(room),players:room.players.map(s=>({name:s.name,color:s.color,online:!!s.ws,disconnectedAt:s.disconnectedAt})),deadline:room.deadline,remaining:room.remaining,seconds:room.seconds,serverTime:Date.now(),history:room.history,reason:room.reason,rematch:room.rematch,id:room.id,graceSeconds:GRACE/1000,waitingUntil:room.players.length===1?room.createdAt+WAIT_TTL:null,closeAt:room.winner?room.updated+RESULT_TTL:null};}
function expireRooms(now=Date.now()){
 for(const room of rooms.values()){
  const closed=room.closedAt&&now>=room.closedAt+GRACE;
  const waiting=room.players.length===1&&!room.winner&&now>=room.createdAt+WAIT_TTL;
  const finished=room.winner&&now>=room.updated+RESULT_TTL;
  const idle=now>=room.updated+IDLE_TTL;
  if(!closed&&!waiting&&!finished&&!idle)continue;
  const message=waiting?'10분 동안 상대가 입장하지 않아 방이 종료되었습니다. 새 방을 만들어 주세요.':finished?'대국 종료 후 5분 동안 활동이 없어 방이 정리되었습니다. 복기는 최근 대국에서 볼 수 있어요.':'오랫동안 활동이 없어 방이 종료되었습니다.';
  for(const p of room.players){send(p.ws,{type:'closed',message});if(p.ws)p.ws.room=null;}
  rooms.delete(room.code);save();log('room_expired',{code:room.code,reason:waiting?'waiting':finished?'finished':'idle'});
 }
}
function finish(room,winner,reason){room.winner=winner;room.reason=reason;room.deadline=null;room.rematch=[];log('game_finished',{code:room.code,reason,moves:room.history.length});}
function detach(ws,explicit=false){
 const room=rooms.get(ws.room);ws.room=null;if(!room)return;
 const seat=room.players.find(p=>p.ws===ws);if(!seat)return;
 seat.ws=null;seat.disconnectedAt=Date.now();
 if(explicit){
  if(room.players.length===2&&!room.winner)finish(room,3-seat.color,'leave');
  room.deadline=null;room.rematch=[];
  if(room.winner)send(ws,{...stateFor(room,seat),ready:false});
  let pendingResult=false;
  for(const p of room.players){
   if(p===seat)p.resultReceived=true;
   else if(p.ws){if(room.winner)send(p.ws,{...stateFor(room,p),ready:false});send(p.ws,{type:'closed',message:'상대가 방을 나가 방이 종료되었습니다. 대국 기록은 최근 대국에서 볼 수 있어요.'});p.ws.room=null;p.ws=null;p.resultReceived=true;}
   else if(room.winner&&!p.resultReceived)pendingResult=true;
  }
  if(pendingResult){room.closedAt=Date.now();room.updated=room.closedAt;}else rooms.delete(room.code);
  save();
 }else publish(room);
}
function attach(ws,room,seat,token){ws.room=room.code;seat.ws=ws;seat.disconnectedAt=null;if(token)send(ws,{type:'session',code:room.code,token});publish(room);}
function seatFor(ws,name,color){const token=randomBytes(32).toString('hex');return {token,seat:{tokenHash:hash(token),name:typeof name==='string'?name.trim().slice(0,16)||'플레이어':'플레이어',color,ws,disconnectedAt:null}};}
function newGame(room){Object.assign(room,{board:emptyBoard(),turn:1,winner:0,line:null,last:null,history:[],reason:null,rematch:[],id:randomBytes(12).toString('hex'),deadline:null,remaining:room.seconds*1000,createdAt:Date.now()});}
wss.on('connection',ws=>{
 ws.alive=true;ws.rate={start:Date.now(),count:0,actions:[]};
 ws.on('pong',()=>ws.alive=true);ws.on('error',e=>log('socket_error',{message:e.message}));
 ws.on('message',raw=>{try{
  if(closing)return;
  const now=Date.now();if(now-ws.rate.start>10000){ws.rate.start=now;ws.rate.count=0;}if(++ws.rate.count>50)return ws.close(1008,'Too many requests');
  const m=JSON.parse(raw);if(!m||typeof m.type!=='string')return error(ws,'올바르지 않은 요청입니다.');
  expireRooms(now);
  const room=rooms.get(ws.room);
  if(m.type==='preview'){
   const code=String(m.code).toUpperCase(),r=rooms.get(code);
   send(ws,{type:'preview',code,available:!!r&&r.players.length===1&&!!r.players[0].ws&&!r.winner,rule:r?.rule,seconds:r?.seconds});return;
  }
  if(m.type==='leave'){detach(ws,true);send(ws,{type:'left'});return;}
  if(m.type==='resume'){
   const r=rooms.get(String(m.code));const p=r?.players.find(p=>typeof m.token==='string'&&m.token.length===64&&p.tokenHash===hash(m.token));
   if(!p)return error(ws,'저장된 방이 만료되었습니다. 새 방을 만들어 주세요.','expired');
   if(!r.winner&&r.players.length===2){const absent=r.players.filter(s=>!s.ws&&s.disconnectedAt&&now-s.disconnectedAt>=GRACE);if(absent.length)finish(r,absent.length===2?3:3-absent[0].color,'disconnect');}
   if(ws.room&&ws.room!==r.code)detach(ws,true);
   if(r.closedAt){
    send(ws,{...stateFor(r,p),ready:false});send(ws,{type:'closed',message:'상대가 방을 나가 대국이 종료되었습니다. 최종 결과를 확인해 주세요.'});
    p.resultReceived=true;if(r.players.every(s=>s.resultReceived))rooms.delete(r.code);save();return;
   }
   if(p.ws&&p.ws!==ws){p.ws.room=null;send(p.ws,{type:'replaced'});p.ws.close(4001,'Session resumed elsewhere');}
   attach(ws,r,p);return;
  }
  if(m.type==='create'||m.type==='join'){
   ws.rate.actions=ws.rate.actions.filter(t=>now-t<60000);if(ws.rate.actions.length>=8)return error(ws,'방 요청이 많습니다. 잠시 후 다시 시도해 주세요.');ws.rate.actions.push(now);
   if(m.type==='create'){
    if(m.rule!==undefined&&!['renju','freestyle'].includes(m.rule))return error(ws,'지원하지 않는 규칙입니다.');
    const retainsResult=room?.players.length===2&&room.players.some(p=>!p.ws&&!p.resultReceived);
    if(rooms.size-(room&&!retainsResult?1:0)>=MAX_ROOMS)return error(ws,'서버의 방 한도에 도달했습니다. 기존 방에는 입장할 수 있어요. 잠시 후 다시 확인해 주세요.','capacity');
    detach(ws,true);let code;do{code=randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(code));
    const {token,seat}=seatFor(ws,m.name,1);const r={code,rule:normalizeRule(m.rule),players:[seat],seconds:m.seconds===60?60:0,updated:now};newGame(r);rooms.set(code,r);attach(ws,r,seat,token);log('room_created',{code});
   }else{
    const r=rooms.get(String(m.code).toUpperCase());if(!r||r.players.length!==1||!r.players[0].ws||r.players.some(p=>p.ws===ws)||r.winner)return error(ws,'입장할 수 없는 방입니다. 방이 만료되었거나 방장이 연결되어 있지 않을 수 있어요.');
    if(m.rule!==r.rule)return error(ws,'방의 규칙을 다시 확인한 뒤 입장해 주세요.','rule-mismatch');
    detach(ws,true);const {token,seat}=seatFor(ws,m.name,2);r.players.push(seat);attach(ws,r,seat,token);
   }return;
  }
  if(!room)return error(ws,'먼저 방에 입장해 주세요.');
  const seat=room.players.find(p=>p.ws===ws);if(!seat)return;
  if(room.deadline&&now>=room.deadline&&!room.winner){finish(room,3-room.turn,'timeout');publish(room);return;}
  if(m.type==='move'){
   const i=m.index;if(!online(room)||room.winner||room.turn!==seat.color||!Number.isInteger(i)||i<0||i>=225||room.board[i])return error(ws,'지금은 그 자리에 착수할 수 없습니다.');
   const verdict=validateMove(room.board,i,room.turn,room.rule);
   if(!verdict.legal)return error(ws,forbiddenMessage(verdict.reason),verdict.reason);
   room.board[i]=room.turn;room.last=i;room.history.push(i);room.line=verdict.line;
   if(room.line)finish(room,room.turn,'five');else if(room.board.every(Boolean))finish(room,3,'draw');
   room.turn=3-room.turn;if(!room.winner&&!hasLegalMove(room.board,room.turn,room.rule))finish(room,3,'no-legal-moves');room.deadline=null;clock(room,true);publish(room);
  }else if(m.type==='resign'&&!room.winner&&room.players.length===2){finish(room,3-seat.color,'resign');publish(room);}
  else if(m.type==='rematch'&&room.winner&&online(room)){
   if(room.rematch.includes(seat.color))return;
   room.rematch.push(seat.color);
   if(room.rematch.length===2){room.players.forEach(p=>p.color=3-p.color);newGame(room);}publish(room);
  }
 }catch(e){error(ws,'요청을 처리할 수 없습니다.');log('message_error',{message:e.message});}});
 ws.on('close',()=>{const entry=ips.get(ws.ip);if(entry)entry.count=Math.max(0,entry.count-1);if(!closing)detach(ws);});
});
const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}},15000);
const maintenance=setInterval(()=>{
 const now=Date.now();for(const room of rooms.values()){
  const absent=room.players.filter(p=>!p.ws&&p.disconnectedAt&&now-p.disconnectedAt>=GRACE);
  if(absent.length&&!room.winner&&room.players.length===2){finish(room,absent.length===2?3:3-absent[0].color,'disconnect');publish(room);}
  if(room.deadline&&now>=room.deadline&&!room.winner){finish(room,3-room.turn,'timeout');publish(room);}
 }
 expireRooms(now);
 for(const [ip,entry] of ips)if(!entry.count&&now-entry.start>60000)ips.delete(ip);
},1000);
async function shutdown(){
 if(closing)return;closing=true;clearInterval(heartbeat);clearInterval(maintenance);server.close();
 for(const r of rooms.values()){clock(r);if(r.deadline){r.remaining=Math.max(0,r.deadline-Date.now());r.deadline=null;}}
 for(const ws of wss.clients)ws.close(1012,'Server restarting');
 await save(true);log('shutdown');setTimeout(()=>process.exit(persistenceError?1:0),300).unref();
}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
server.on('error',e=>{log('server_error',{message:e.message});process.exit(1);});
server.listen(PORT,'0.0.0.0',()=>log('listening',{url:`http://localhost:${PORT}`}));
