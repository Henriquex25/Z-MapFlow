#!/usr/bin/env python3
"""Run Wails with native package metadata derived from the central VERSION file."""
import json
import subprocess
import sys
from project_version import ROOT, current_version


def run(args):
    version = current_version()
    if args == ["--version"]:
        print(version)
        return 0
    config = ROOT / "wails.json"
    original = config.read_text()
    data = json.loads(original)
    data.setdefault("info", {})["productVersion"] = version
    generated = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    config.write_text(generated)
    try:
        return subprocess.call(["wails", *args], cwd=ROOT)
    finally:
        # Preserve concurrent edits instead of overwriting a user's configuration.
        current = config.read_text()
        if current == generated:
            config.write_text(original)
        else:
            changed = json.loads(current)
            if changed.get("info", {}).get("productVersion") == version:
                changed["info"].pop("productVersion", None)
                config.write_text(json.dumps(changed, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    raise SystemExit(run(sys.argv[1:] or ["build"]))
