#!/usr/bin/env python3
"""Create the initial Linux package and updater assets from a versioned build."""
import argparse
import hashlib
import os
from pathlib import Path
import re
import shutil
import subprocess
import tarfile
import tempfile
from project_version import current_version

ROOT = Path(__file__).resolve().parents[1]


def package(version: str, binary: Path, output: Path):
    if not re.fullmatch(r"(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)", version):
        raise ValueError("Use a stable SemVer version without the v prefix")
    if version != current_version():
        raise ValueError("Release version must match internal/version/VERSION")
    binary = binary.resolve()
    actual = subprocess.check_output([str(binary), "--version"], text=True).strip()
    if actual != version:
        raise ValueError(f"Binary version {actual!r} differs from release {version!r}")
    output.mkdir(parents=True, exist_ok=True)
    raw = output / "z-mapflow_linux_amd64"
    shutil.copyfile(binary, raw)
    raw.chmod(0o755)
    archive = output / f"z-mapflow_{version}_linux_amd64.tar.gz"
    with tempfile.TemporaryDirectory(prefix="z-mapflow-package-") as temp:
        stage = Path(temp) / f"z-mapflow-{version}"
        stage.mkdir()
        for source, name in [(binary, "z-mapflow"), (ROOT / "build/appicon.png", "appicon.png"),
                             (ROOT / "LICENSE", "LICENSE"), (ROOT / "scripts/install.sh", "install.sh")]:
            shutil.copyfile(source, stage / name)
        (stage / "z-mapflow").chmod(0o755)
        (stage / "install.sh").chmod(0o755)
        shutil.copytree(ROOT / "frontend/public/licenses", stage / "licenses")
        files = sorted(p for p in stage.rglob("*") if p.is_file())
        (stage / "checksums.txt").write_text("".join(
            f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.relative_to(stage)}\n" for p in files))
        with tarfile.open(archive, "w:gz") as tar:
            tar.add(stage, arcname=stage.name)
    (output / "checksums.txt").write_text("".join(
        f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n" for p in [raw, archive]))
    print(f"Packaged {version}: {archive}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("version", nargs="?", default=current_version())
    parser.add_argument("--binary", type=Path, default=ROOT / "build/bin/z-mapflow")
    parser.add_argument("--output", type=Path, default=ROOT / "dist")
    args = parser.parse_args()
    package(args.version, args.binary, args.output)
