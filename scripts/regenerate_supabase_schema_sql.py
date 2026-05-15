"""Write `alembic upgrade head --sql` stdout to supabase/000_schema_from_alembic.sql.

Using subprocess avoids PowerShell `2>&1` merging Alembic INFO logs into the SQL file."""

from __future__ import annotations

import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
OUT = ROOT / "supabase" / "000_schema_from_alembic.sql"


def main() -> int:
    r = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head", "--sql"],
        cwd=str(BACKEND),
        capture_output=True,
        text=True,
    )
    if r.returncode != 0:
        sys.stderr.write(r.stderr or "")
        return r.returncode
    OUT.write_text(r.stdout, encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)} ({len(r.stdout)} chars)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
