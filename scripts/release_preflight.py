#!/usr/bin/env python3
"""Gate manual draft builds on successful push CI for the exact main commit."""
import json
import os
from pathlib import Path
import re
import subprocess
from urllib.parse import urlencode

from project_version import current_version


def release_context():
    if os.environ.get("GITHUB_REF") != "refs/heads/main":
        raise ValueError("Run release drafts from main after its CI has passed")
    repository = os.environ.get("GITHUB_REPOSITORY", "")
    sha = os.environ.get("GITHUB_SHA", "")
    if not re.fullmatch(r"[A-Za-z0-9_-]+/[A-Za-z0-9_.-]+", repository):
        raise ValueError("Invalid GitHub repository")
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise ValueError("Invalid release commit SHA")
    return repository, sha


def require_ci(repository, sha):
    query = urlencode({"head_sha": sha, "branch": "main", "event": "push", "status": "success", "per_page": 100})
    response = json.loads(subprocess.check_output([
        "gh", "api", f"repos/{repository}/actions/workflows/ci.yml/runs?{query}",
    ], text=True))
    for run in response["workflow_runs"]:
        if (run.get("head_sha") == sha and run.get("head_branch") == "main"
                and run.get("event") == "push" and run.get("status") == "completed"
                and run.get("conclusion") == "success"
                and run.get("head_repository", {}).get("full_name", "").lower() == repository.lower()):
            return
    raise ValueError("Wait for successful push CI on this exact main commit before building a release draft")


def main():
    repository, sha = release_context()
    version = current_version()
    require_ci(repository, sha)
    if output := os.environ.get("GITHUB_OUTPUT"):
        with Path(output).open("a", encoding="utf-8") as file:
            file.write(f"version={version}\n")
    print(f"Release {version}: successful CI verified for {sha}")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError) as error:
        raise SystemExit(str(error))
