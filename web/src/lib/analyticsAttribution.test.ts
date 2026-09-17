import { describe, expect, it } from 'vitest';
import { createDocumentAttribution } from './analyticsAttribution';
const none = { referrer: '', campaign: '' };
describe('document entry attribution', () => {
  it('keeps only origin and allowed campaign fields on a fresh entry', () => {
    const take = createDocumentAttribution('https://example.org/private?q=secret', '?utm_source=news&utm_campaign=guide&utm_term=private', 'navigate');
    expect(take(true)).toEqual({ referrer: 'https://example.org', campaign: 'news/unset/guide' });
    expect(take(true)).toEqual(none); // idle timeout or midnight in the same document
  });
  it('consumes entry even when the current session already has attribution', () => {
    const take = createDocumentAttribution('https://example.org', '?utm_source=new', 'navigate');
    expect(take(false)).toEqual(none);
    expect(take(true)).toEqual(none);
  });
  it.each(['reload', 'back_forward', 'unknown'])('does not revive stale labels on %s', type => {
    expect(createDocumentAttribution('https://example.org', '?utm_source=old', type)(true)).toEqual(none);
  });
  it('allows a genuinely new document to attribute a new session', () => {
    expect(createDocumentAttribution('https://other.example', '?utm_source=share', 'navigate')(true)).toEqual({ referrer: 'https://other.example', campaign: 'share/unset/unset' });
  });
  it('rejects malformed sources and arbitrary campaign text', () => {
    expect(createDocumentAttribution('javascript:alert(1)', '?utm_source=private%40mail.com', 'navigate')(true)).toEqual(none);
  });
});
