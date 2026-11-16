#!/usr/bin/env python3
"""Verify both platform packages and produce one complete release manifest."""
import argparse
import hashlib
from pathlib import Path
import shutil

from create_release_draft import asset_names, release_assets
from project_version import current_version


def merge(source: Path, output: Path):
    version = current_version()
    # Validate every input before touching output or contacting GitHub.
    inputs = [Path(name) for platform in ["linux", "windows"]
              for name in release_assets(source / f"package-{platform}", version, (platform,))
              if Path(name).name != "checksums.txt"]
    output.mkdir(parents=True, exist_ok=True)
    for asset in inputs:
        shutil.copyfile(asset, output / asset.name)
    (output / "checksums.txt").write_text("".join(
        f"{hashlib.sha256((output / name).read_bytes()).hexdigest()}  {name}\n"
        for name in asset_names(version)), encoding="utf-8")
    release_assets(output, version)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=Path("packages"))
    parser.add_argument("--output", type=Path, default=Path("dist"))
    args = parser.parse_args()
    merge(args.input, args.output)
