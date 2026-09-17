import Link from 'next/link';

export function AdminStatusTabs({ pathname, query, selected, items }: {
  pathname: string;
  query: string;
  selected: string;
  items: { value: string; label: string; count: number }[];
}) {
  return <nav className="admin-status-tabs" aria-label="발행 상태별 목록">
    {items.map(({ value, label, count }) => {
      const params = new URLSearchParams({ ...(query ? { q: query } : {}), status: value });
      return <Link key={value} href={`${pathname}?${params}`} aria-current={selected === value ? 'page' : undefined}>
        {label}<span>{count}</span>
      </Link>;
    })}
  </nav>;
}
