import {afterEach, describe, expect, it, vi} from 'vitest';
import {GET} from './route';

afterEach(()=>vi.unstubAllEnvs());
describe('OMOK launch route',()=>{
 it('opens the local game server and preserves a valid invitation',()=>{
  vi.stubEnv('NODE_ENV','development');vi.stubEnv('OMOK_PUBLIC_URL','');
  const response=GET(new Request('http://blog.localhost:3000/game/omok?room=ABC123'));
  expect(response.status).toBe(307);
  const target=new URL(response.headers.get('location')!);
  expect(target.origin).toBe('http://localhost:3100');expect(target.searchParams.get('room')).toBe('ABC123');expect(target.searchParams.get('from')).toBe('works');
  expect(response.headers.get('cache-control')).toContain('no-store');
 });
 it('uses the configured HTTPS server in production without retaining arbitrary query parameters',()=>{
  vi.stubEnv('NODE_ENV','production');vi.stubEnv('OMOK_PUBLIC_URL','https://play.example.com');
  const response=GET(new Request('https://blog.example.com/game/omok?room=INVALID&next=https://other.example.com'));
  const target=new URL(response.headers.get('location')!);
  expect(target.origin).toBe('https://play.example.com');expect(target.searchParams.get('room')).toBeNull();expect(target.searchParams.get('next')).toBeNull();
 });
 it.each(['','http://play.example.com','javascript:alert(1)','https://user:password@play.example.com'])('keeps visitors on an explanatory page when production server configuration is unavailable: %s',async value=>{
  vi.stubEnv('NODE_ENV','production');vi.stubEnv('OMOK_PUBLIC_URL',value);
  const response=GET(new Request('https://blog.example.com/game/omok'));
  expect(response.status).toBe(503);expect(response.headers.get('location')).toBeNull();expect(await response.text()).toContain('/works');
 });
});
