import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {WebSocket} from 'ws';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

// Keep unmatched session/state messages: they can arrive in the same frame batch.
function inbox(ws){
 const queued=[],waiters=[];
 ws.on('message',raw=>{
  const message=JSON.parse(raw);const index=waiters.findIndex(w=>w.type===message.type);
  if(index>=0){const [waiter]=waiters.splice(index,1);clearTimeout(waiter.timer);waiter.resolve(message);}else queued.push(message);
 });
 return type=>{
  const index=queued.findIndex(m=>m.type===type);if(index>=0)return Promise.resolve(queued.splice(index,1)[0]);
  return new Promise((resolve,reject)=>{const waiter={type,resolve};waiter.timer=setTimeout(()=>{waiters.splice(waiters.indexOf(waiter),1);reject(Error(`Timed out waiting for ${type}`));},3000);waiters.push(waiter);});
 };
}
test('online room validates turns, synchronizes wins, and closes on explicit leave',{timeout:15000},async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'omok-test-'));
 const port=32000+Math.floor(Math.random()*10000);
 const server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),DATA_DIR:dataDir}});
 const clients=[];
 try{
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Server startup timed out')),3000);server.stdout.on('data',raw=>{if(raw.toString().includes('"event":"listening"')){clearTimeout(timeout);resolve();}});server.once('error',reject);});
  const connect=async()=>{const ws=new WebSocket(`ws://localhost:${port}`);clients.push(ws);const receive=inbox(ws);await once(ws,'open');return {ws,receive};};
  const a=await connect(),b=await connect();
  a.ws.send(JSON.stringify({type:'create'}));const room=await a.receive('state');assert.equal(room.ready,false);assert.equal(room.rule,'renju');assert.equal((await a.receive('session')).token.length,64);
  b.ws.send(JSON.stringify({type:'join',code:room.code,rule:room.rule}));assert.equal((await a.receive('state')).ready,true);assert.equal((await b.receive('state')).color,2);
  b.ws.send(JSON.stringify({type:'move',index:100}));assert.equal((await b.receive('error')).type,'error');
  for(let n=0;n<9;n++){
   const i=n%2===0?Math.floor(n/2):30+Math.floor(n/2);
   (n%2===0?a:b).ws.send(JSON.stringify({type:'move',index:i}));
   const sa=await a.receive('state'),sb=await b.receive('state');assert.deepEqual(sa.board,sb.board);assert.equal(sa.board[100],0);assert.equal(sa.board.filter(Boolean).length,n+1);if(n===8)assert.equal(sa.winner,1);
  }
  a.ws.send(JSON.stringify({type:'leave'}));await a.receive('state');await b.receive('state');assert.equal((await b.receive('closed')).type,'closed');await a.receive('left');
  for(const rule of ['renju','freestyle']){
   a.ws.send(JSON.stringify({type:'create',rule}));const state=await a.receive('state');assert.equal(state.rule,rule);
   b.ws.send(JSON.stringify({type:'preview',code:state.code}));const preview=await b.receive('preview');assert.equal(preview.rule,rule);assert.equal(preview.available,true);
   b.ws.send(JSON.stringify({type:'join',code:state.code,rule:rule==='renju'?'freestyle':'renju'}));assert.equal((await b.receive('error')).reason,'rule-mismatch');
   b.ws.send(JSON.stringify({type:'join',code:state.code,rule}));await a.receive('state');await b.receive('state');
   for(const [n,i] of [111,0,113,2,97,4,127,6].entries()){
    (n%2===0?a:b).ws.send(JSON.stringify({type:'move',index:i}));await a.receive('state');await b.receive('state');
   }
   a.ws.send(JSON.stringify({type:'move',index:112}));
   if(rule==='renju'){
    assert.equal((await a.receive('error')).reason,'double-three');
    a.ws.send(JSON.stringify({type:'move',index:120}));const moved=await a.receive('state');await b.receive('state');assert.equal(moved.board[112],0);assert.equal(moved.history.length,9);assert.equal(moved.board[120],1);
   }else{assert.equal((await a.receive('state')).board[112],1);await b.receive('state');}
   a.ws.send(JSON.stringify({type:'resign'}));await a.receive('state');await b.receive('state');
   a.ws.send(JSON.stringify({type:'rematch'}));await a.receive('state');await b.receive('state');
   b.ws.send(JSON.stringify({type:'rematch'}));const rematch=await a.receive('state');await b.receive('state');assert.equal(rematch.rule,rule);assert.equal(rematch.color,2);assert.equal(rematch.history.length,0);
   a.ws.send(JSON.stringify({type:'leave'}));await a.receive('state');await b.receive('state');await b.receive('closed');await a.receive('left');
  }
 }finally{
  clients.forEach(ws=>ws.close());const exited=once(server,'exit');server.kill();await exited;await rm(dataDir,{recursive:true,force:true});
 }
});
