-- Carry the last trustworthy legacy totals into the v2 reporting layer without turning them
-- into a fake high-traffic day. New events keep incrementing tb_analytics_day one at a time.
create table public.tb_analytics_baseline (
    site text primary key check (site in ('blog', 'wiki')),
    through_date date not null,
    views bigint not null check (views >= 0),
    visitors bigint not null check (visitors >= 0),
    created_at timestamptz not null default now()
);

with boundary as (
    select (started_at at time zone 'Asia/Seoul')::date - 1 as through_date
    from public.tb_analytics_meta
    where version = 2
), sites(site) as (
    values ('blog'), ('wiki')
)
insert into public.tb_analytics_baseline(site, through_date, views, visitors)
select sites.site, boundary.through_date,
       coalesce(sum(legacy.views), 0), coalesce(sum(legacy.visitors), 0)
from sites
cross join boundary
left join public.tb_site_daily_stat legacy
       on legacy.site = sites.site and legacy.stat_date <= boundary.through_date
group by sites.site, boundary.through_date;
