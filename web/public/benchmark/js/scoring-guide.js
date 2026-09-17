(() => {
  const button = document.getElementById('guide-theme');
  const apply = (dark) => {
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    button.textContent = dark ? '☀' : '◐';
    button.setAttribute('aria-label', dark ? '라이트 모드로 전환' : '다크 모드로 전환');
  };
  let dark = false;
  try { dark = localStorage.getItem('theme') === 'dark'; } catch {}
  apply(dark);
  button.addEventListener('click', () => {
    const next = !document.documentElement.classList.contains('dark');
    apply(next);
    try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch {}
  });
  const setOpen = (open) => document.querySelectorAll('details.task').forEach(el => { el.open = open; });
  document.getElementById('expand-tasks').addEventListener('click', () => setOpen(true));
  document.getElementById('collapse-tasks').addEventListener('click', () => setOpen(false));
  const reveal = () => {
    const el = document.getElementById(location.hash.slice(1));
    if (el && el.matches('details.task')) { el.open = true; el.scrollIntoView(); }
  };
  window.addEventListener('hashchange', reveal);
  reveal();
})();
