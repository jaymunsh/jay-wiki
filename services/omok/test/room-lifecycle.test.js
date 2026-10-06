import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createConnection} from 'node:net';
import {WebSocket} from 'ws';

async function fixture(t, rooms=[]) {
 const dir=await mkdtemp(join(tmpdir(),'omok-lifecycle-'));
 await writeFile(join(dir,'rooms.json'),JSON.stringify({version:1,rooms}));
 const port=45000+Math.floor(Math.random()*15000),clients=[];
 const child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),DATA_DIR:dir,MAX_ROOMS:'1'}});
 t.after(async()=>{clients.forEach(ws=>ws.terminate());if(child.exitCode===null&&child.signalCode===null){const done=once(child,'exit');child.kill();await done;}await rm(dir,{recursive:true,force:true});});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server startup timed out')),3000);child.stdout.on('data',data=>{if(data.toString().includes('"event":"listening"')){clearTimeout(timer);resolve();}});child.once('error',reject);});
 return {base:`http://localhost:${port}`,async client(){
  const ws=new WebSocket(`ws://localhost:${port}`);clients.push(ws);const messages=[],waiters=[];
  ws.on('message',data=>{const msg=JSON.parse(data),i=waiters.findIndex(w=>w.type===msg.type);if(i<0)messages.push(msg);else{const [w]=waiters.splice(i,1);clearTimeout(w.timer);w.resolve(msg);}});
  await once(ws,'open');return {ws,send:msg=>ws.send(JSON.stringify(msg)),get:type=>{const i=messages.findIndex(m=>m.type===type);if(i>=0)return Promise.resolve(messages.splice(i,1)[0]);return new Promise((resolve,reject)=>{const waiter={type,resolve};waiter.timer=setTimeout(()=>reject(Error(`No ${type}`)),3000);waiters.push(waiter);});}};
 }};
}
function savedRoom(extra={}) {
 return {code:'ABCDEF',rule:'renju',board:Array(225).fill(0),turn:1,winner:0,line:null,last:null,history:[],reason:null,rematch:[],id:'fixture',seconds:0,remaining:0,deadline:null,createdAt:Date.now(),updated:Date.now(),players:[{tokenHash:createHash('sha256').update('a'.repeat(64)).digest('hex'),name:'host',color:1}],...extra};
}

test('full capacity blocks creation but permits joining and replacement of an owned room',async t=>{
 const f=await fixture(t),a=await f.client(),b=await f.client();
 a.send({type:'create'});const room=await a.get('state');await a.get('session');
 const response=await fetch(f.base+'/room-status');assert.equal(response.status,200);
 const status=await response.json();assert.equal(status.rooms,1);assert.equal(status.maxRooms,1);assert.equal(status.available,false);
 b.send({type:'create'});assert.equal((await b.get('error')).reason,'capacity');
 a.send({type:'create'});const replacement=await a.get('state');await a.get('session');assert.notEqual(replacement.code,room.code);
 b.send({type:'join',code:replacement.code,rule:'renju'});assert.equal((await b.get('state')).ready,true);await b.get('session');await a.get('state');
 a.send({type:'leave'});const own=await a.get('state'),other=await b.get('state');assert.equal(own.winner,2);assert.equal(other.winner,2);assert.equal(own.reason,'leave');await a.get('left');await b.get('closed');
 assert.equal((await (await fetch(f.base+'/room-status')).json()).rooms,0);
});
test('expired waiting rooms cannot be previewed or resumed',async t=>{
 const f=await fixture(t,[savedRoom({createdAt:Date.now()-601000})]),a=await f.client();
 a.send({type:'preview',code:'ABCDEF'});assert.equal((await a.get('preview')).available,false);
 a.send({type:'resume',code:'ABCDEF',token:'a'.repeat(64)});assert.equal((await a.get('error')).reason,'expired');
 assert.equal((await (await fetch(f.base+'/health')).json()).rooms,0);
});
test('finished rooms release capacity after five inactive minutes',async t=>{
 const f=await fixture(t,[savedRoom({winner:1,updated:Date.now()-301000})]);
 const response=await fetch(f.base+'/room-status');assert.equal(response.status,200);assert.equal((await response.json()).rooms,0);
});
test('connection loss pauses play and same-tab credentials restore the seat',async t=>{
 const f=await fixture(t),a=await f.client(),b=await f.client();a.send({type:'create',seconds:60});const room=await a.get('state'),session=await a.get('session');
 b.send({type:'join',code:room.code,rule:'renju'});await b.get('session');await b.get('state');await a.get('state');
 a.ws.close();const paused=await b.get('state');assert.equal(paused.winner,0);assert.equal(paused.ready,false);assert.equal(paused.deadline,null);assert.equal(paused.graceSeconds,120);
 const restored=await f.client();restored.send({...session,type:'resume'});const state=await restored.get('state');assert.equal(state.ready,true);assert.equal(state.color,1);assert.equal(state.id,room.id);assert.ok(state.deadline>Date.now());
});
test('full-room preview offers only seats authenticated by saved recovery tokens',async t=>{
 const f=await fixture(t),a=await f.client(),b=await f.client();a.send({type:'create'});const room=await a.get('state'),session=await a.get('session');
 b.send({type:'join',code:room.code,rule:'renju'});await b.get('session');await b.get('state');await a.get('state');
 a.ws.close();await b.get('state');const returning=await f.client();
 returning.send({type:'preview',code:room.code,tokens:['b'.repeat(64),session.token]});const preview=await returning.get('preview');
 assert.equal(preview.available,false);assert.deepEqual(preview.recovery,[{index:1,color:1,name:'플레이어',online:false}]);
 returning.send({type:'preview',code:room.code,tokens:['b'.repeat(64)]});assert.deepEqual((await returning.get('preview')).recovery,[]);
 returning.send({...session,type:'resume'});assert.equal((await returning.get('state')).color,1);
});
test('timeline orders start, moves, disconnect, resume and finish and resets on rematch',async t=>{
 const f=await fixture(t),a=await f.client(),b=await f.client();a.send({type:'create'});const room=await a.get('state'),session=await a.get('session');
 b.send({type:'join',code:room.code,rule:'renju'});await b.get('session');await b.get('state');await a.get('state');
 a.send({type:'move',index:112});await a.get('state');await b.get('state');a.ws.close();await b.get('state');
 const returning=await f.client();returning.send({...session,type:'resume'});await returning.get('state');await b.get('state');
 b.send({type:'resign'});const end=await returning.get('state');await b.get('state');
 assert.deepEqual(end.timeline.map(e=>e.type),['created','start','move','disconnect','resume','end']);
 assert.equal(end.timeline[2].index,112);assert.equal(end.timeline[2].move,1);assert.equal(end.timeline[2].color,1);
 assert.ok(end.timeline.every((e,i)=>Number.isFinite(e.at)&&(!i||e.at>=end.timeline[i-1].at)));
 returning.send({type:'rematch'});await returning.get('state');await b.get('state');b.send({type:'rematch'});const next=await returning.get('state');await b.get('state');
 assert.notEqual(next.id,room.id);assert.deepEqual(next.timeline.map(e=>e.type),['start']);
});
test('restoring a long timeline retains its start and records the server restart',async t=>{
 const at=Date.now()-10000,timeline=[{type:'created',at},{type:'disconnect',at},{type:'resume',at},{type:'start',at},...Array.from({length:600},()=>({type:'resume',at,color:1}))];
 const f=await fixture(t,[savedRoom({timeline})]),a=await f.client();a.send({type:'resume',code:'ABCDEF',token:'a'.repeat(64)});const state=await a.get('state');
 assert.equal(state.timeline.length,600);assert.ok(state.timeline.some(e=>e.type==='start'&&e.at===at));assert.ok(state.timeline.some(e=>e.type==='restart'));assert.equal(state.timeline.at(-1).type,'resume');
});
test('invalid HTTP request targets return 400 without terminating the server',async t=>{
 const f=await fixture(t);
 const response=await new Promise((resolve,reject)=>{const socket=createConnection(Number(new URL(f.base).port),'127.0.0.1');let text='';socket.setTimeout(2000,()=>{socket.destroy();reject(Error('socket timeout'));});socket.on('connect',()=>socket.write('GET http://[ HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n'));socket.on('data',data=>text+=data);socket.on('error',reject);socket.on('close',()=>resolve(text));});
 assert.match(response,/^HTTP\/1\.1 400/);assert.equal((await fetch(f.base+'/health')).status,200);
});
test('an offline opponent can recover the final result when the other seat leaves',async t=>{
 const f=await fixture(t),a=await f.client(),b=await f.client();a.send({type:'create'});const room=await a.get('state');await a.get('session');
 b.send({type:'join',code:room.code,rule:'renju'});const session=await b.get('session');await b.get('state');await a.get('state');
 b.ws.close();await a.get('state');a.send({type:'leave'});await a.get('state');await a.get('left');
 const restored=await f.client();restored.send({...session,type:'resume'});const result=await restored.get('state');assert.equal(result.winner,2);assert.equal(result.reason,'leave');assert.equal(result.ready,false);await restored.get('closed');
 assert.equal((await (await fetch(f.base+'/room-status')).json()).rooms,0);
});
test('replacement cannot exceed capacity when an offline opponent still needs a result',async t=>{
 const f=await fixture(t),a=await f.client(),b=await f.client();a.send({type:'create'});const room=await a.get('state');await a.get('session');
 b.send({type:'join',code:room.code,rule:'renju'});await b.get('session');await b.get('state');await a.get('state');b.ws.close();await a.get('state');
 a.send({type:'create'});assert.equal((await a.get('error')).reason,'capacity');assert.equal((await (await fetch(f.base+'/room-status')).json()).rooms,1);
 a.send({type:'leave'});const result=await a.get('state');assert.equal(result.code,room.code);assert.equal(result.winner,2);await a.get('left');
});
