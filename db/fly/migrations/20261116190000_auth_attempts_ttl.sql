-- One-shot TTL cleanup of identity.auth_attempts. Runtime also prunes stale
-- window rows from AuthAttemptBudget. WindowStart is unix_seconds / 900.
delete from identity.auth_attempts
where window_start < (extract(epoch from now())::bigint / 900) - 8;
