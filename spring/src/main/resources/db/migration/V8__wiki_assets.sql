create table if not exists public.tb_article_asset (
    id              text primary key,
    object_key      text not null unique,
    original_name   text not null,
    content_type    text not null,
    size_bytes      bigint not null check (size_bytes > 0),
    checksum_sha256 varchar(64) not null,
    status          text not null check (status in ('TEMP', 'ATTACHED', 'UNUSED')),
    uploaded_by     text not null,
    created_at      timestamptz not null default now(),
    attached_at     timestamptz,
    deleted_at      timestamptz
);

create index if not exists idx_article_asset_status_created
    on public.tb_article_asset (status, created_at);
