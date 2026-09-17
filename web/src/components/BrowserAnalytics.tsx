'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { documentAttribution } from '@/lib/analyticsAttribution';
import { isBlogHost, isWikiHost } from '@/lib/siteHost';

type Visit = { id: string; day: string; last: number; referrer: string; campaign: string };
const kstDay = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const uuid = (s?: string) => !!s && /^[a-f0-9-]{36}$/i.test(s);

/** No network work during SSR/prefetch. Identifiers are first-party and rotated daily. */
export function BrowserAnalytics() {
  const pathname = usePathname();
  useEffect(() => {
    if (navigator.webdriver || navigator.doNotTrack === '1' || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return;
    try { if (localStorage.getItem('jw_analytics_optout') === '1') return; } catch { return; }
    const entryAttribution = documentAttribution(document);
    const site = isBlogHost(location.host) ? 'blog' : isWikiHost(location.host) ? 'wiki' : null;
    if (!site) return;
    const path = pathname.replace(/^\/blog(?=\/|$)/, '') || '/';
    const page = site === 'blog'
      ? (/^\/\d+\/[a-zA-Z0-9_-]+$/.test(path) ? path : /^\/(search|tags|categories)(\/|$)/.test(path) ? `/${path.split('/')[1]}` : path === '/' ? '/' : null)
      : (/^\/wiki\/[a-zA-Z0-9_-]+$/.test(path) || ['/', '/wiki', '/scenarios', '/services', '/board'].includes(path) ? path : null);
    if (!page) return;
    const key = `jw_analytics_${site}`;
    const initialize = () => {
      const day = kstDay();
      const old = document.cookie.split('; ').find(x => x.startsWith('jw_av='))?.slice(6);
      const visitorId = old?.startsWith(day + '.') && uuid(old.slice(11)) ? old.slice(11) : crypto.randomUUID();
      const midnight = Date.parse(day + 'T00:00:00+09:00') + 86400000;
      document.cookie = `jw_av=${day}.${visitorId}; Path=/; SameSite=Lax; Max-Age=${Math.max(1, Math.floor((midnight - Date.now()) / 1000))}${location.protocol === 'https:' ? '; Secure' : ''}`;
      if (!document.cookie.includes(`jw_av=${day}.${visitorId}`)) throw new Error('Storage disabled');
      let session: Visit | null = JSON.parse(sessionStorage.getItem(key) ?? 'null');
      const newSession = !session || !uuid(session.id) || session.day !== day
        || !Number.isFinite(session.last) || Date.now() - session.last > 1800000;
      const attribution = entryAttribution(newSession);
      if (newSession || !session) {
        session = { id: crypto.randomUUID(), day, last: Date.now(), ...attribution };
      }
      session.last = Date.now();
      sessionStorage.setItem(key, JSON.stringify(session));
      return { site, page, eventId: crypto.randomUUID(), visitorId, sessionId: session.id, referrer: session.referrer, campaign: session.campaign };
    };
    let payload: ReturnType<typeof initialize>;
    try { payload = initialize(); } catch { return; }
    let active = 0, sent = false, engaged = false, sending = false, attempts = 0, engagementAttempts = 0;
    let lastVisible = Date.now(), day = kstDay(), disposed = false;
    const send = async (type: string) => {
      try {
        const r = await fetch('/api/bff/analytics/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...payload, type }), keepalive: true });
        return r.ok;
      } catch { return false; }
    };
    const timer = window.setInterval(async () => {
      if (document.visibilityState !== 'visible' || sending) return;
      if (kstDay() !== day || Date.now() - lastVisible > 1800000) {
        try { payload = initialize(); } catch { return; }
        active = 0; sent = false; engaged = false; attempts = 0; engagementAttempts = 0; day = kstDay();
      }
      lastVisible = Date.now();
      active++;
      try {
        const session: Visit | null = JSON.parse(sessionStorage.getItem(key) ?? 'null');
        if (session?.id === payload.sessionId) { session.last = Date.now(); sessionStorage.setItem(key, JSON.stringify(session)); }
      } catch { /* Collection remains best effort. */ }
      if (!sent && attempts < 3) {
        sending = true; attempts++;
        sent = await send('view');
        sending = false;
      }
      if (disposed) return;
      const root = document.documentElement;
      const progress = (window.scrollY + window.innerHeight) / Math.max(root.scrollHeight, window.innerHeight);
      if (sent && !engaged && engagementAttempts < 3 && active >= 31 && progress >= .75) {
        engaged = true; engagementAttempts++;
        if (!(await send('engaged'))) engaged = false;
      }
    }, 1000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [pathname]);
  return null;
}
