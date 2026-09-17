-- 단계마다 어느 서비스의 어느 파드가 처리했는지 남긴다.
-- 화면이 "결제만 다른 서비스가 했다"를 말로 설명하는 대신 실물 이름으로 보이게 하려는 것이다.
-- 형식은 service@pod 다. 값을 모르는 옛 행은 null 로 남고 화면이 그 줄만 생략한다.
alter table public.tb_saga_step add column if not exists actor varchar(120);
