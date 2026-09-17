export type Attribution = { referrer: string; campaign: string };
const empty = (): Attribution => ({ referrer: '', campaign: '' });

/** One document entry can supply attribution once, never on a later SPA session renewal. */
export function createDocumentAttribution(referrer: string, search: string, navigationType: string) {
  let consumed = false;
  const query = new URLSearchParams(search);
  const tags = ['utm_source', 'utm_medium', 'utm_campaign'].map(name => {
    const value = query.get(name) ?? '';
    return /^[a-zA-Z0-9_-]{1,40}$/.test(value) ? value : '';
  });
  let origin = '';
  try {
    const url = new URL(referrer);
    if (['http:', 'https:'].includes(url.protocol)) origin = url.origin;
  } catch { /* Unknown source stays unknown. */ }
  const entry = {
    referrer: origin,
    campaign: tags.some(Boolean) ? tags.map(tag => tag || 'unset').join('/') : '',
  };
  return (newSession: boolean): Attribution => {
    const available = !consumed;
    consumed = true; // Also consume when an existing session keeps its first attribution.
    return available && newSession && navigationType === 'navigate' ? { ...entry } : empty();
  };
}

const documents = new WeakMap<Document, ReturnType<typeof createDocumentAttribution>>();
export function documentAttribution(doc: Document) {
  let attribution = documents.get(doc);
  if (!attribution) {
    const nav = doc.defaultView?.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    attribution = createDocumentAttribution(doc.referrer, doc.location.search, nav?.type ?? 'unknown');
    documents.set(doc, attribution);
  }
  return attribution;
}
