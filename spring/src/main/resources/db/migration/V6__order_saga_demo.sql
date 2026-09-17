create table if not exists public.tb_saga_order (
    id text primary key,
    product_code text not null,
    quantity int not null,
    status text not null,
    idempotency_key text not null unique,
    created_at timestamptz not null,
    updated_at timestamptz not null
);

create table if not exists public.tb_saga_inventory (
    product_code text primary key,
    available int not null,
    reserved int not null,
    updated_at timestamptz not null
);

create table if not exists public.tb_saga_payment (
    id text primary key,
    order_id text not null,
    amount_cents int not null,
    status text not null,
    created_at timestamptz not null
);

create table if not exists public.tb_saga_shipping (
    id text primary key,
    order_id text not null,
    status text not null,
    created_at timestamptz not null
);

create table if not exists public.tb_saga_instance (
    id text primary key,
    order_id text not null,
    status text not null,
    current_step text not null,
    fail_at text not null,
    created_at timestamptz not null,
    completed_at timestamptz
);

create table if not exists public.tb_saga_step (
    id bigserial primary key,
    saga_id text not null,
    step_name text not null,
    status text not null,
    compensating boolean not null,
    message text not null,
    created_at timestamptz not null
);

create table if not exists public.tb_outbox_event (
    id bigserial primary key,
    aggregate_type text not null,
    aggregate_id text not null,
    event_type text not null,
    payload jsonb not null,
    status text not null,
    created_at timestamptz not null,
    processed_at timestamptz
);

insert into public.tb_saga_inventory (product_code, available, reserved, updated_at)
values ('JAY-HOODIE', 10, 0, now())
on conflict (product_code) do nothing;
