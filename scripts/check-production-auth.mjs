#!/usr/bin/env node
// Operator verification. Credentials and session cookies remain in process memory.
// --public verifies the admin production HTTPS/BFF path; default uses an SSH tunnel.
import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { BASE, withProdTunnel } from './lib/prod-tunnel.mjs';
import { cloudflareAccessHeaders } from './lib/cloudflare-access.mjs';
const secret=JSON.parse(execFileSync('ssh',['-T','-o','BatchMode=yes','miniPC','kubectl -n backend get secret jaywiki-secrets -o json'],{encoding:'utf8'}));
const value=k=>Buffer.from(secret.data[k],'base64').toString();
function otp(secret) {
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits=[...secret.toUpperCase().replace(/=|\s/g,'')].map(c=>{
    const i=alphabet.indexOf(c);if(i<0)throw Error('Invalid TOTP encoding');return i.toString(2).padStart(5,'0');
  }).join('');
  const bytes=Buffer.from(bits.match(/.{8}/g).map(x=>parseInt(x,2)));
  const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
  const hash=createHmac('sha1',bytes).update(counter).digest();const offset=hash[19]&15;
  return ((hash.readUInt32BE(offset)&0x7fffffff)%1000000).toString().padStart(6,'0');
}
const publicSurface=process.argv.includes('--public');
const target=publicSurface?'https://admin.leneu.cloud':BASE;
const accessHeaders=publicSurface?cloudflareAccessHeaders(target):{};
const verify=async()=>{
  let cookie='';
  const request=(path,method='GET',body,origin=target)=>fetch(target+(publicSurface?path.replace(/^\/api\//,'/api/bff/'):path),{method,redirect:'error',headers:{origin,'content-type':'application/json',...accessHeaders,...(cookie?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const check=(name,condition)=>{if(!condition)throw Error(name+' failed'); console.log(JSON.stringify({check:name,passed:true}));};
  const login=await request('/api/auth/admin-login','POST',{username:'admin',password:value('APP_ADMIN_PASSWORD'),otp:otp(value('APP_ADMIN_TOTP_SECRET'))});
  check('admin TOTP login (HTTP '+login.status+')',login.status===200);
  cookie=login.headers.getSetCookie().find(x=>x.includes('Max-Age=')&&!x.includes('Max-Age=0'))?.split(';')[0]??login.headers.get('set-cookie')?.split(';')[0];
  check('authentication cookie issued',Boolean(cookie));
  const me=await request('/api/auth/me');check('authenticated session',me.ok&&(await me.json()).authenticated===true);
  check('admin API allowed', (await request('/api/admin/blog/posts?page=0&size=1')).status===200);
  check('cross-origin logout denied',(await request('/api/auth/logout','POST',{},'https://untrusted.invalid')).status===403);
  check('logout succeeds',(await request('/api/auth/logout','POST',{})).status===200);
  const replay=await request('/api/auth/me');check('logged-out cookie rejected',replay.status===401||replay.status===403||(replay.ok&&(await replay.json()).authenticated===false));
  check('logged-out admin access denied',[401,403].includes((await request('/api/admin/blog/posts?page=0&size=1')).status));
  cookie='';
  const search=await request('/api/search?q=redis');check('public search responds',search.ok&&Array.isArray(await search.json()));
};
if(publicSurface) await verify(); else await withProdTunnel(verify);
