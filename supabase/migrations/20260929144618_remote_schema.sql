drop extension if exists "pg_net";

drop trigger if exists "audit_events_signal_household_change" on "public"."audit_events";

drop policy "budgets_select_api_member" on "public"."budgets";

drop policy "goals_select_api_member" on "public"."goals";

drop policy "household_change_signals_insert_api_member" on "public"."household_change_signals";

drop policy "household_change_signals_select_member" on "public"."household_change_signals";

revoke select on table "public"."budgets" from "inout_api_runtime";

revoke select on table "public"."goals" from "inout_api_runtime";

revoke select on table "public"."household_change_signals" from "authenticated";

revoke insert on table "public"."household_change_signals" from "inout_api_runtime";

revoke delete on table "public"."household_change_signals" from "service_role";

revoke insert on table "public"."household_change_signals" from "service_role";

revoke references on table "public"."household_change_signals" from "service_role";

revoke select on table "public"."household_change_signals" from "service_role";

revoke trigger on table "public"."household_change_signals" from "service_role";

revoke truncate on table "public"."household_change_signals" from "service_role";

revoke update on table "public"."household_change_signals" from "service_role";

alter table "public"."categories" drop constraint "categories_name_trimmed_chk";

alter table "public"."household_change_signals" drop constraint "household_change_signals_household_id_fkey";

drop function if exists "private"."signal_household_change"();

drop function if exists "public"."can_receive_household_signal"(requested_household_id uuid);

alter table "public"."household_change_signals" drop constraint "household_change_signals_pkey";

drop index if exists "public"."household_change_signals_household_revision_idx";

drop index if exists "public"."household_change_signals_pkey";

drop table "public"."household_change_signals";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.auth_uid()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
          select coalesce(
            nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), ''),
            (nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
          )::uuid;
        $function$
;

CREATE OR REPLACE FUNCTION private.is_household_member(target_household_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
          select exists (
            select 1
            from public.household_members as member
            where member.household_id = target_household_id
              and member.user_id = (select private.auth_uid())
          );
        $function$
;

CREATE OR REPLACE FUNCTION private.is_household_owner(target_household_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
          select exists (
            select 1
            from public.household_members as member
            where member.household_id = target_household_id
              and member.user_id = (select private.auth_uid())
              and member.role = 'owner'
          );
        $function$
;

grant delete on table "public"."accounts" to "authenticated";

grant insert on table "public"."accounts" to "authenticated";

grant select on table "public"."accounts" to "authenticated";

grant update on table "public"."accounts" to "authenticated";

grant select on table "public"."audit_events" to "authenticated";

grant delete on table "public"."budgets" to "authenticated";

grant insert on table "public"."budgets" to "authenticated";

grant select on table "public"."budgets" to "authenticated";

grant update on table "public"."budgets" to "authenticated";

grant delete on table "public"."categories" to "authenticated";

grant insert on table "public"."categories" to "authenticated";

grant select on table "public"."categories" to "authenticated";

grant update on table "public"."categories" to "authenticated";

grant delete on table "public"."entries" to "authenticated";

grant insert on table "public"."entries" to "authenticated";

grant select on table "public"."entries" to "authenticated";

grant update on table "public"."entries" to "authenticated";

grant delete on table "public"."goals" to "authenticated";

grant insert on table "public"."goals" to "authenticated";

grant select on table "public"."goals" to "authenticated";

grant update on table "public"."goals" to "authenticated";

grant delete on table "public"."household_members" to "authenticated";

grant select on table "public"."household_members" to "authenticated";

grant update on table "public"."household_members" to "authenticated";

grant select on table "public"."households" to "authenticated";

grant update on table "public"."households" to "authenticated";

grant delete on table "public"."transactions" to "authenticated";

grant insert on table "public"."transactions" to "authenticated";

grant select on table "public"."transactions" to "authenticated";

grant update on table "public"."transactions" to "authenticated";

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();

CREATE TRIGGER protect_bucket_control_insert BEFORE INSERT ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.protect_bucket_control_columns('service_role');

CREATE TRIGGER protect_bucket_control_update BEFORE UPDATE OF lifecycle_configuration, lifecycle_configuration_generation ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.protect_bucket_control_columns();

CREATE TRIGGER protect_bucket_control_update_role AFTER UPDATE OF lifecycle_configuration, lifecycle_configuration_generation ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_lifecycle_service_role('service_role');

CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();

CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


