-- 문서 목차 노출 여부. 본문 표시자(<!-- toc -->)로 켜던 것을 컬럼으로 옮긴다 —
-- 관리자 화면에서 체크박스로 보이고, 어떤 글이 켜져 있는지 쿼리로 바로 나온다.
alter table public.tb_article
    add column toc_enabled boolean not null default false;
