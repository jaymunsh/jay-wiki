import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

async function server(t,origin='',environment='production',prefix=''){
 const dir=await mkdtemp(join(tmpdir(),'omok-seo-')),port=18000+Math.floor(Math.random()*10000);
 const child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),DATA_DIR:dir,PUBLIC_ORIGIN:origin,NODE_ENV:environment,PUBLIC_PATH:prefix}});
 t.after(async()=>{if(child.exitCode===null&&child.signalCode===null){const done=once(child,'exit');child.kill();await done;}await rm(dir,{recursive:true,force:true});});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup timeout')),3000);child.stdout.on('data',data=>{if(data.toString().includes('"event":"listening"')){clearTimeout(timer);resolve();}});child.once('error',reject);});
 return `http://localhost:${port}`;
}
test('public SEO uses the configured canonical origin and serves a real sharing image',async t=>{
 const base=await server(t,'https://omok.example.org');
 const response=await fetch(base+'/?from=works',{headers:{Host:'untrusted.example.com'}}),html=await response.text();
 assert.equal(response.status,200);assert.match(html,/<title>[^<]*웹 오목/);
 assert.match(html,/<link rel="canonical" href="https:\/\/omok.example.org\/">/);
 assert.match(html,/<meta property="og:url" content="https:\/\/omok.example.org\/">/);
 assert.match(html,/<meta property="og:image" content="https:\/\/omok.example.org\/og-image.png">/);
 assert.match(html,/<meta name="robots" content="index, follow">/);
 assert.equal(html.includes('untrusted.example.com'),false);
 const image=await fetch(base+'/og-image.png');assert.equal(image.headers.get('content-type'),'image/png');
 const png=Buffer.from(await image.arrayBuffer());assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),630);
 const robots=await (await fetch(base+'/robots.txt')).text();assert.match(robots,/Sitemap: https:\/\/omok.example.org\/sitemap.xml/);
 const sitemap=await (await fetch(base+'/sitemap.xml')).text();assert.match(sitemap,/<loc>https:\/\/omok.example.org\/<\/loc>/);assert.equal((sitemap.match(/<loc>/g)||[]).length,1);
});

test('shared-host mount keeps assets, metadata and WebSockets below its prefix',async t=>{
 const {WebSocket}=await import('ws');
 const base=await server(t,'https://game.example.org','production','/omok');
 const redirect=await fetch(base+'/omok?from=works',{redirect:'manual'});
 assert.equal(redirect.status,308);assert.equal(redirect.headers.get('location'),'/omok/?from=works');
 const response=await fetch(base+'/omok/'),html=await response.text();
 assert.equal(response.status,200);assert.match(html,/href="\/omok\/style.css"/);assert.match(html,/src="\/omok\/app.js"/);
 assert.match(html,/href="https:\/\/game.example.org\/omok\/"/);assert.match(html,/content="https:\/\/game.example.org\/omok\/og-image.png"/);
 for(const path of ['app.js','game.js','ai-worker.js','style.css','favicon.svg','og-image.png','health','room-status','robots.txt','sitemap.xml'])assert.equal((await fetch(base+'/omok/'+path)).status,200,path);
 assert.match(await(await fetch(base+'/omok/sitemap.xml')).text(),/<loc>https:\/\/game.example.org\/omok\/<\/loc>/);
 assert.equal((await fetch(base+'/app.js')).status,404);
 const ws=new WebSocket(base.replace('http:','ws:')+'/omok/',{origin:'https://game.example.org'});
 t.after(()=>ws.terminate());await once(ws,'open');
 const session=once(ws,'message');ws.send(JSON.stringify({type:'create',name:'prefix',rule:'renju'}));
 assert.equal(JSON.parse((await session)[0]).type,'session');ws.close();
});
test('invitation URLs are noindex and never put room codes into canonical or sharing metadata',async t=>{
 const base=await server(t,'https://omok.example.org');const response=await fetch(base+'/?room=ABC123'),html=await response.text();
 assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');assert.match(html,/<meta name="robots" content="noindex, nofollow">/);
 assert.equal(html.split('</head>')[0].includes('ABC123'),false);
 for(const path of ['/health','/room-status'])assert.equal((await fetch(base+path)).headers.get('x-robots-tag'),'noindex, nofollow');
});
test('unconfigured development server does not advertise itself to search engines',async t=>{
 const base=await server(t);const response=await fetch(base);assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');
 const html=await response.text();assert.match(html,/<meta name="robots" content="noindex, nofollow">/);assert.equal(html.includes('rel="canonical"'),false);
 assert.match(await (await fetch(base+'/robots.txt')).text(),/Disallow: \/\n/);
 assert.equal((await (await fetch(base+'/sitemap.xml')).text()).includes('<loc>'),false);
});
test('configured localhost remains excluded from indexing',async t=>{
 const base=await server(t,'https://localhost:3100');assert.equal((await fetch(base)).headers.get('x-robots-tag'),'noindex, nofollow');
 assert.equal((await (await fetch(base+'/robots.txt')).text()).includes('Sitemap:'),false);
});
test('development stays noindex even when a public origin is inherited',async t=>{
 const base=await server(t,'https://omok.example.org','development');
 const response=await fetch(base),html=await response.text();
 assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');
 assert.match(html,/<meta name="robots" content="noindex, nofollow">/);
 assert.match(await (await fetch(base+'/robots.txt')).text(),/Disallow: \/\n/);
 assert.equal((await (await fetch(base+'/sitemap.xml')).text()).includes('<loc>'),false);
});
