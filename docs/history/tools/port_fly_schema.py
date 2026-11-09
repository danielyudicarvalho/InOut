#!/usr/bin/env python3
"""Port the historical SQL migrations to vanilla PostgreSQL.

The historical files stay the source record. This script writes the Fly
Managed Postgres copy: user foreign keys land on identity.users, session
identity is private.auth_uid(), and hosted-provider publications are removed.
"""

from __future__ import annotations

import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / "supabase" / "migrations"
TARGET = ROOT / "db" / "fly" / "migrations"

REALTIME = re.compile(
    r"do \$\$\s*begin\s*if exists \(\s*select 1 from pg_publication where pubname = 'supabase_realtime'.*?end\s*\$\$;",
    re.S,
)


def port(sql: str) -> str:
    sql = REALTIME.sub(
        "-- Change signals stay in PostgreSQL. No hosted realtime publication is attached.",
        sql,
    )
    sql = sql.replace("references auth.users (id)", "references identity.users (id)")
    sql = sql.replace("references auth.users(id)", "references identity.users (id)")
    sql = sql.replace("auth.uid()", "private.auth_uid()")
    sql = sql.replace("Supabase", "the previous hosted provider")
    sql = sql.replace("supabase", "previous_host")
    return sql


def main() -> None:
    TARGET.mkdir(parents=True, exist_ok=True)
    for path in sorted(SOURCE.glob("*.sql")):
        ported = port(path.read_text())
        if "auth.users" in ported or "auth.uid()" in ported or "supabase" in ported.lower():
            raise SystemExit(f"ported migration still has a hosted-provider reference: {path.name}")
        (TARGET / path.name).write_text(ported)
    print(f"ported {len(list(TARGET.glob('*.sql')))} migrations")


if __name__ == "__main__":
    main()
