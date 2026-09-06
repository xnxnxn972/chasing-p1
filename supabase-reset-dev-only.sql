-- Wipe only the rows written from localhost, keeping real players' sessions.
delete from public.cp_sessions where env = 'dev';

select env, count(*) from public.cp_sessions group by env;
