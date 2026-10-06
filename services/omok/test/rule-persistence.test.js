import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {WebSocket} from 'ws';
import {emptyBoard} from '../public/game.js';

test('legacy room stays freestyle and new renju room survives server restart',{timeout:15000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'omok-rules-')),port=42000+Math.floor(Math.random()*10000);
 const legacyToken='a'.repeat(64);let child;const sockets=[];
 async function start(){
  child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),DATA_DIR:dir}});
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('startup timeout')),3000);child.stdout.on('data',raw=>{if(raw.toString().includes('"event":"listening"')){clearTimeout(timeout);resolve();}});child.once('error',reject);});
 }
 async function stop(){const exited=once(child,'exit');child.kill();await exited;child=null;}
 async function connection(){const ws=new WebSocket(`ws://localhost:${port}`);sockets.push(ws);const messages=[],pending=[];ws.on('message',raw=>{const msg=JSON.parse(raw),i=pending.findIndex(p=>p.type===msg.type);if(i>=0){const [p]=pending.splice(i,1);clearTimeout(p.timer);p.resolve(msg);}else messages.push(msg);});await once(ws,'open');return {send:data=>ws.send(JSON.stringify(data)),get:type=>{const i=messages.findIndex(m=>m.type===type);if(i>=0)return Promise.resolve(messages.splice(i,1)[0]);return new Promise((resolve,reject)=>{const p={type,resolve};p.timer=setTimeout(()=>reject(Error('message timeout')),3000);pending.push(p);});}};}
 try{
  const legacy={code:'ABCDEF',board:emptyBoard(),turn:1,winner:0,line:null,last:null,history:[],reason:null,rematch:[],id:'legacy',seconds:0,remaining:0,deadline:null,updated:Date.now(),players:[{tokenHash:createHash('sha256').update(legacyToken).digest('hex'),name:'기존 플레이어',color:1}]};
  await writeFile(join(dir,'rooms.json'),JSON.stringify({version:1,rooms:[legacy]}));
  await start();const a=await connection();a.send({type:'resume',code:'ABCDEF',token:legacyToken});assert.equal((await a.get('state')).rule,'freestyle');
  a.send({type:'create'});const state=await a.get('state'),session=await a.get('session');assert.equal(state.rule,'renju');
  await stop();await start();const restored=await connection();restored.send({type:'resume',code:session.code,token:session.token});const after=await restored.get('state');assert.equal(after.rule,'renju');assert.equal(after.id,state.id);assert.deepEqual(after.board,state.board);
 }finally{sockets.forEach(s=>s.close());if(child)await stop();await rm(dir,{recursive:true,force:true});}
});
