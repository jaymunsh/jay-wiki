import test from 'node:test';
import assert from 'node:assert/strict';
import {clientAddress} from '../client-address.js';

const request=(headers={})=>({headers,socket:{remoteAddress:'10.0.0.5'}});
test('direct mode ignores forged forwarded and Cloudflare headers',()=>{
 assert.equal(clientAddress(request({'cf-connecting-ip':'203.0.113.1','x-forwarded-for':'203.0.113.2'}),{}),'10.0.0.5');
});
test('Cloudflare mode keeps distinct visitors separate behind the same Traefik hop',()=>{
 const a=clientAddress(request({'cf-connecting-ip':'203.0.113.1','x-forwarded-for':'203.0.113.1, 10.0.0.9'}),{TRUST_CLOUDFLARE:'1'});
 const b=clientAddress(request({'cf-connecting-ip':'2001:db8::1','x-forwarded-for':'2001:db8::1, 10.0.0.9'}),{TRUST_CLOUDFLARE:'1'});
 assert.equal(a,'203.0.113.1');assert.equal(b,'2001:db8::1');assert.notEqual(a,b);
 for(const value of [undefined,'forged','203.0.113.1, 203.0.113.2'])assert.equal(clientAddress(request({'cf-connecting-ip':value}),{TRUST_CLOUDFLARE:'1'}),'10.0.0.5');
});
test('the standalone Caddy mode still trusts only the last forwarding hop',()=>{
 assert.equal(clientAddress(request({'x-forwarded-for':'forged, 203.0.113.1'}),{TRUST_PROXY:'1'}),'203.0.113.1');
});
