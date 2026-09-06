-- Remove the rows created while proving the session log works.
delete from public.cp_sessions
where driver_name in ('__connectivity_test__', 'Telemetry Test')
   or session_id like '\_\_%' escape '\';

-- What is left should be real sessions only.
select * from cp_sessions_log limit 20;
