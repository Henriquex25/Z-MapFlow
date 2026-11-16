#!/usr/bin/env python3
"""Package the Windows x64 installer and the executable used by auto-update."""
import argparse
import hashlib
from pathlib import Path
import shutil
import struct
import subprocess

from project_version import ROOT, current_version


def check_pe(filename, machines):
    with filename.open("rb") as file:
        header = file.read(64)
        if len(header) != 64 or header[:2] != b"MZ":
            raise ValueError(f"Not a Windows executable: {filename}")
        offset = struct.unpack_from("<I", header, 60)[0]
        if offset > 1 << 20:
            raise ValueError("Invalid PE header offset")
        file.seek(offset)
        signature = file.read(24)
        if len(signature) != 24 or signature[:4] != b"PE\0\0" or struct.unpack_from("<H", signature, 4)[0] not in machines:
            raise ValueError(f"Incorrect Windows executable architecture: {filename}")


def package(binary: Path, installer: Path, output: Path):
    version = current_version()
    check_pe(binary, {0x8664})
    check_pe(installer, {0x14C, 0x8664})  # NSIS uses an x86 launcher for x64 payloads.
    actual = subprocess.check_output([str(binary.resolve()), "--version"], text=True, timeout=15).strip()
    if actual != version:
        raise ValueError(f"Binary version {actual!r} differs from VERSION {version!r}")
    output.mkdir(parents=True, exist_ok=True)
    names = ["z-mapflow_windows_amd64.exe", f"z-mapflow_{version}_windows_amd64_setup.exe"]
    for source, name in zip([binary, installer], names):
        shutil.copyfile(source, output / name)
    (output / "checksums.txt").write_text("".join(
        f"{hashlib.sha256((output / name).read_bytes()).hexdigest()}  {name}\n" for name in names), encoding="utf-8")
    print(f"Packaged Windows {version}: {names[1]}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--binary", type=Path, default=ROOT / "build/bin/z-mapflow.exe")
    parser.add_argument("--installer", type=Path, default=ROOT / "build/bin/z-mapflow-amd64-installer.exe")
    parser.add_argument("--output", type=Path, default=ROOT / "dist")
    args = parser.parse_args()
    package(args.binary, args.installer, args.output)
