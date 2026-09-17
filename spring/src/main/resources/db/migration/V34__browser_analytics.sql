-- Version 2 is deliberately separate: GET requests in legacy counters included automation.
create table public.tb_analytics_meta (version integer primary key, started_at timestamptz not null default now());
insert into public.tb_analytics_meta(version) values (2);
create table public.tb_analytics_day (
 site text not null, day date not null, views bigint not null default 0,
 visitors bigint not null default 0, sessions bigint not null default 0, engaged bigint not null default 0,
 primary key(site, day)
);
create table public.tb_analytics_dimension (
 site text not null, day date not null, kind text not null, label text not null,
 views bigint not null default 0, sessions bigint not null default 0, engaged bigint not null default 0,
 primary key(site, day, kind, label)
);
-- Short-lived daily salted hashes only; no IP, raw URL, user agent or persistent identity.
create table public.tb_analytics_visitor (
 site text not null, day date not null, token text not null, primary key(site, day, token)
);
create table public.tb_analytics_session (
 site text not null, day date not null, token text not null, visitor text not null,
 source text not null, campaign text not null, device text not null, landing text not null,
 views integer not null default 0, primary key(site, day, token)
);
create table public.tb_analytics_event (
 site text not null, day date not null, token text not null, session text not null,
 page text not null, engaged boolean not null default false, created_at timestamptz not null default now(),
 primary key(site, day, token)
);
create index on public.tb_analytics_dimension(site, day, kind);
