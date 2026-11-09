// Product telemetry for failed financial writes. The apps register a sink once;
// the package reports only categorical facts: which command (route shape, never
// ids or query strings), the failure code, and whether the outcome is known.

let sink = null;

// Failures where the server may or may not have applied the write.
const OUTCOME_UNKNOWN = new Set(["network", "server", "invalid", "conflict"]);
const RETRYABLE = new Set(["network", "server", "invalid"]);

export function setFinanceTelemetry(next) {
  sink = typeof next === "function" ? next : null;
}

export function commandFromPath(path, method = "POST") {
  const route = String(path)
    .split(/[?#]/, 1)[0]
    .replace(/^\/api\/v\d+\//, "")
    .split("/")
    .filter(
      (part) =>
        part &&
        part !== "households" &&
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          decodeURIComponent(part),
        ),
    )
    .join("/");
  return `${String(method).toLowerCase()} ${route}`;
}

export function reportWriteFailure(path, method, code) {
  if (!sink) return;
  try {
    sink("financial_command_failed", {
      command: commandFromPath(path, method),
      error_code: String(code),
      is_retryable: RETRYABLE.has(code),
      outcome_known: !OUTCOME_UNKNOWN.has(code),
    });
  } catch {
    // Telemetry must never affect a financial operation.
  }
}

// Times one new-record form. Only field names and counts are kept, never values.
export function createRecordFormTracker({
  kind,
  emit,
  now = () => Date.now(),
}) {
  let startedAt = null;
  let edits = 0;
  let lastField = null;
  let finished = false;
  const elapsed = () => Math.max(0, Math.round(now() - startedAt));
  const send = (event, properties) => {
    try {
      emit(event, { kind, ...properties });
    } catch {
      // Telemetry must never affect the form.
    }
  };
  return {
    start() {
      if (startedAt !== null) return;
      startedAt = now();
      send("record_form_started", {});
    },
    edit(field) {
      if (startedAt === null || finished) return;
      edits += 1;
      lastField = String(field);
    },
    submit() {
      if (startedAt === null || finished) return;
      finished = true;
      send("record_form_submitted", {
        duration_ms: elapsed(),
        field_edit_count: edits,
      });
    },
    close() {
      if (startedAt === null || finished || edits === 0) return;
      finished = true;
      send("record_form_abandoned", {
        duration_ms: elapsed(),
        last_step: lastField,
      });
    },
  };
}
