create table if not exists public.tb_domain_scenario_run (
    run_id           text primary key,
    scenario_type    text not null,
    mode             text not null,
    status           text not null,
    headline         text not null,
    before_amount    int not null,
    after_amount     int not null,
    idempotency_key  text not null,
    created_at       timestamptz not null default now()
);

create index if not exists idx_domain_scenario_run_recent
    on public.tb_domain_scenario_run (scenario_type, created_at desc);

create table if not exists public.tb_domain_scenario_step (
    id           bigserial primary key,
    run_id       text not null references public.tb_domain_scenario_run(run_id) on delete cascade,
    sequence_no  int not null,
    action       text not null,
    actor        text not null,
    status       text not null,
    detail       text not null,
    unique (run_id, sequence_no)
);
