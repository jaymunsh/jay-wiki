import {isIP} from 'node:net';

/** Only enable Cloudflare mode on an ingress restricted to the trusted proxy. */
export function clientAddress(request,environment=process.env){
 if(environment.TRUST_CLOUDFLARE==='1'){
  const address=request.headers['cf-connecting-ip'];
  return typeof address==='string'&&isIP(address)?address:request.socket.remoteAddress;
 }
 const forwarded=String(request.headers['x-forwarded-for']||'').split(',').at(-1).trim();
 return environment.TRUST_PROXY==='1'&&isIP(forwarded)?forwarded:request.socket.remoteAddress;
}
