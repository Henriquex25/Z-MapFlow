#!/usr/bin/env python3
"""Create or resume a draft for the verified commit; never publish a release."""
import hashlib
import json
import os
from pathlib import Path
import subprocess

from project_version import current_version
from release_preflight import release_context


def asset_names(version, platforms=("linux", "windows")):
    assets = {
        "linux": ["z-mapflow_linux_amd64", f"z-mapflow_{version}_linux_amd64.tar.gz"],
        "windows": ["z-mapflow_windows_amd64.exe", f"z-mapflow_{version}_windows_amd64_setup.exe"],
    }
    return [name for platform in platforms for name in assets[platform]]


def release_assets(directory, version, platforms=("linux", "windows")):
    names = asset_names(version, platforms)
    checksums = directory / "checksums.txt"
    hashes = {}
    for line in checksums.read_text().splitlines():
        fields = line.split()
        if len(fields) != 2 or fields[1] not in names or fields[1] in hashes:
            raise ValueError("Invalid or duplicate release checksum entry")
        hashes[fields[1]] = fields[0]
    if set(hashes) != set(names):
        raise ValueError("Missing release asset checksums")
    for name in names:
        asset = directory / name
        if not asset.is_file() or asset.is_symlink() or asset.stat().st_size == 0:
            raise ValueError(f"Missing or invalid release asset: {name}")
        if hashlib.sha256(asset.read_bytes()).hexdigest() != hashes[name]:
            raise ValueError(f"Release asset checksum mismatch: {name}")
    return [str(directory / name) for name in [*names, "checksums.txt"]]


def main(directory=Path("dist")):
    repository, sha = release_context()
    version = current_version()
    if os.environ.get("RELEASE_VERSION") != version or os.environ.get("RELEASE_COMMIT") != sha:
        raise ValueError("Draft version and commit must match the verified build")
    assets = release_assets(directory, version)
    tag = f"v{version}"
    existing = subprocess.run([
        "gh", "release", "view", tag, "--repo", repository, "--json", "isDraft,targetCommitish",
    ], capture_output=True, text=True)
    if existing.returncode == 0:
        release = json.loads(existing.stdout)
        if release.get("isDraft") is not True:
            raise ValueError("This version is already published; increase VERSION")
        if release.get("targetCommitish") != sha:
            raise ValueError("An existing draft targets a different commit; increase VERSION or remove that draft")
        subprocess.run(["gh", "release", "upload", tag, *assets, "--repo", repository, "--clobber"], check=True)
    else:
        subprocess.run([
            "gh", "release", "create", tag, *assets, "--repo", repository,
            "--draft", "--target", sha, "--generate-notes", "--title", tag,
        ], check=True)
    print(f"Draft {tag} is ready. Review its assets and notes, then publish it manually as Latest.")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError) as error:
        raise SystemExit(str(error))
