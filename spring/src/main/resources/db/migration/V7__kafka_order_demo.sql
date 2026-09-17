alter table if exists public.tb_outbox_event
    add column if not exists published_at timestamptz,
    add column if not exists attempt_count integer not null default 0,
    add column if not exists last_error text;

create index if not exists idx_outbox_event_status_created
    on public.tb_outbox_event (aggregate_type, status, created_at);

create table if not exists public.tb_kafka_demo_order (
    id text primary key,
    product_code text not null,
    quantity integer not null,
    fail_mode text not null,
    status text not null,
    created_at timestamptz not null,
    updated_at timestamptz not null
);

create table if not exists public.tb_kafka_demo_event_log (
    id bigserial primary key,
    order_id text not null references public.tb_kafka_demo_order(id) on delete cascade,
    stage text not null,
    status text not null,
    message text not null,
    created_at timestamptz not null
);

create table if not exists public.tb_kafka_demo_consumer_result (
    id bigserial primary key,
    order_id text not null references public.tb_kafka_demo_order(id) on delete cascade,
    consumer_name text not null,
    status text not null,
    attempt_count integer not null,
    last_error text,
    updated_at timestamptz not null,
    unique (order_id, consumer_name)
);

create index if not exists idx_kafka_demo_event_log_order
    on public.tb_kafka_demo_event_log (order_id, id);

create index if not exists idx_kafka_demo_consumer_result_order
    on public.tb_kafka_demo_consumer_result (order_id, consumer_name);
