ALTER TABLE public.tb_domain_scenario_run
    ADD COLUMN http_status INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN elapsed_ms BIGINT NOT NULL DEFAULT 0;
