alter table public.tb_domain_scenario_run
    add column if not exists p95_ms int not null default 0,
    add column if not exists rejected_count int not null default 0,
    add column if not exists queue_lag int not null default 0,
    add column if not exists replicas int not null default 0,
    add column if not exists recovery_seconds int not null default 0;
