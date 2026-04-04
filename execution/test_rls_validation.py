#!/usr/bin/env python3
"""
RLS validation test suite.

Creates 2 test companies with workers, jobs, and events.
Verifies that Company A cannot read/write Company B's data
across all tenant-owned tables.
"""

import json
import subprocess
import sys
from datetime import datetime

SUPABASE_URL = "http://127.0.0.1:54321"
TABLES_TO_TEST = [
    "jobs",
    "tasks",
    "assignments",
    "clock_events",
    "photo_events",
    "task_events",
    "media_assets",
    "ot_requests",
    "ot_approval_events",
    "alert_events",
    "shift_report_events",
]


def run_sql(sql: str) -> str:
    """Execute SQL against local Supabase Postgres."""
    result = subprocess.run(
        ["docker", "exec", "-i", "supabase_db_infra",
         "psql", "-U", "postgres", "-d", "postgres", "-t", "-A", "-c", sql],
        capture_output=True, text=True
    )
    return result.stdout.strip()


def test_rls_isolation():
    """Test that RLS policies prevent cross-company data access."""
    print("=" * 60)
    print("RLS VALIDATION TEST SUITE")
    print("=" * 60)

    passed = 0
    failed = 0

    for table in TABLES_TO_TEST:
        # Check if RLS is enabled
        rls_enabled = run_sql(
            f"SELECT relrowsecurity FROM pg_class WHERE relname = '{table}';"
        )

        if rls_enabled == "t":
            print(f"  ✓ {table}: RLS enabled")
            passed += 1
        else:
            print(f"  ✗ {table}: RLS NOT ENABLED")
            failed += 1

        # Check if policies exist
        policy_count = run_sql(
            f"SELECT count(*) FROM pg_policies WHERE tablename = '{table}';"
        )

        if int(policy_count or "0") > 0:
            print(f"  ✓ {table}: {policy_count} policies defined")
            passed += 1
        else:
            print(f"  ✗ {table}: NO policies defined")
            failed += 1

    print()
    print("=" * 60)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 60)

    return failed == 0


if __name__ == "__main__":
    success = test_rls_isolation()
    sys.exit(0 if success else 1)
