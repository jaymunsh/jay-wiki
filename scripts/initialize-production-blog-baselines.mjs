#!/usr/bin/env node
// Compare-only production requests. Only identical drafts receive a syncHash.
import { readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { BASE, withProdTunnel } from './lib/prod-tunnel.mjs';
const skipped=new Set(['fixnet-macos-routing-blackhole.md','jaywiki-security-audit-2026-09.md','jaywiki-security-followup-maintenance-2026-09.md']);
const report=[];
await withProdTunnel(async token=>{
 for(const name of readdirSync('posts/jay-blog/drafts').filter(n=>n.endsWith('.md')&&!skipped.has(n)).sort()){
  const file='posts/jay-blog/drafts/'+name;
  const result=spawnSync(process.execPath,['scripts/publish-blog-drafts.mjs','--write','--initialize-baselines',file],{encoding:'utf8',env:{...process.env,JAYWIKI_API_BASE:BASE,JAYWIKI_INTERNAL_SYNC_TOKEN:token}});
  const output=result.stdout+result.stderr;
  const status=result.status===0?'identical-baseline-recorded':output.includes('baseline was not initialized')?'different-or-unpublished-preserved':'error';
  report.push({file,status}); console.log(JSON.stringify(report.at(-1)));
  if(status==='error')throw Error('Baseline comparison failed; response details suppressed for '+name);
 }
});
writeFileSync('.local-backups/security-20260910-blog-final/production-baseline-report.json',JSON.stringify(report,null,2)+'\n');
