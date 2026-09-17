-- 주문에 구매자를 붙인다. 가입·로그인은 없다 — 시드한 데모 데이터다.
--
-- 데이터 분리 뒤에는 payment·shipping 이 customer_id 참조만 들고 이름은 안 복제한다.
-- 그래서 "결제 화면에 누구의 결제인지" 를 띄우려면 조인이 아니라 모놀리스의 조립이 된다.
-- 소유권을 나눴을 때 실제로 겪는 대가를 만드는 것이 이 테이블의 목적이다.

create table if not exists public.tb_saga_customer (
    id text primary key,
    name text not null,
    email text not null,
    grade text not null,
    created_at timestamptz not null
);

alter table public.tb_saga_order
    add column if not exists customer_id text;

-- 기존 주문에는 구매자가 없다. 데모 데이터라 소급하지 않고 null 로 둔다.
-- 화면은 null 이면 "구매자 없음(이전 데모)" 으로 그린다.

insert into public.tb_saga_customer (id, name, email, grade, created_at) values
    ('cus_ariel',  '문아리',   'ariel@example.test',  'GOLD',   now()),
    ('cus_bora',   '한보라',   'bora@example.test',   'SILVER', now()),
    ('cus_chan',   '정찬희',   'chan@example.test',   'BASIC',  now()),
    ('cus_dain',   '오다인',   'dain@example.test',   'GOLD',   now()),
    ('cus_eunsu',  '서은수',   'eunsu@example.test',  'BASIC',  now())
on conflict (id) do nothing;
