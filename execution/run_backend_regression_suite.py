#!/usr/bin/env python3
import argparse
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SUPABASE_PROJECT_ROOT = REPO_ROOT / "infra"


def build_steps(skip_reset: bool) -> list[list[str]]:
    if skip_reset:
        return [
            ["supabase", "stop", "--project-id", "FieldsOps_ai"],
            ["supabase", "stop", "--project-id", "infra"],
            ["supabase", "start"],
            ["python3", "execution/seed_backend_test_data.py"],
            ["python3", "execution/test_sprint_1.py"],
            ["python3", "execution/test_schedule_flow.py"],
        ]
    return [
        ["supabase", "stop", "--project-id", "FieldsOps_ai", "--no-backup"],
        ["supabase", "stop", "--project-id", "infra", "--no-backup"],
        ["supabase", "start"],
        ["python3", "execution/seed_backend_test_data.py"],
        ["python3", "execution/test_sprint_1.py"],
        ["python3", "execution/test_schedule_flow.py"],
    ]


def max_attempts_for(command: list[str]) -> int:
    return 1


def working_directory_for(command: list[str]) -> Path:
    if command and command[0] == "supabase":
        return SUPABASE_PROJECT_ROOT
    return REPO_ROOT


def log_event(event: str, **payload: object) -> None:
    line = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event": event,
        **payload,
    }
    print(json.dumps(line), flush=True)


def run_step(command: list[str]) -> int:
    log_event("step_start", command=command)
    completed = subprocess.run(command, cwd=working_directory_for(command))
    log_event("step_end", command=command, returncode=completed.returncode)
    return completed.returncode


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the local backend regression suite.")
    parser.add_argument(
        "--skip-reset",
        action="store_true",
        help="Skip `supabase db reset` and run only the verifier.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    steps = build_steps(skip_reset=args.skip_reset)
    log_event("suite_start", steps=steps)

    for command in steps:
        attempts = max_attempts_for(command)
        for attempt in range(1, attempts + 1):
            returncode = run_step(command)
            if returncode == 0:
                break
            if attempt < attempts:
                log_event("step_retry", command=command, attempt=attempt + 1)
                time.sleep(2)
        if returncode != 0:
            log_event("suite_failed", failed_command=command, returncode=returncode)
            return returncode

    log_event("suite_passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
