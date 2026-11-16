#!/usr/bin/env python3
"""Exercise the real NSIS installer on a clean Windows CI account, without GUI/flash."""
import argparse
import hashlib
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import uuid

from project_version import ROOT, current_version


def smoke(installer: Path, binary: Path):
    if sys.platform != "win32":
        raise RuntimeError("Run this smoke test on a clean Windows CI account")
    import winreg
    uninstall_key = r"Software\Microsoft\Windows\CurrentVersion\Uninstall\Henrique MirandaZ-MapFlow"
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, uninstall_key):
            raise RuntimeError("An installation already exists; use a clean Windows CI account")
    except FileNotFoundError:
        pass
    config = Path(os.environ["APPDATA"]) / "z-mapflow"
    config.mkdir(parents=True, exist_ok=True)
    marker = config / f"installer-smoke-{uuid.uuid4().hex}.json"
    marker.write_text("preserve configuration", encoding="utf-8")
    try:
        with tempfile.TemporaryDirectory(prefix="zmapflow Windows install ") as temp:
            destination = Path(temp) / "app with spaces"
            # NSIS requires /D last and unquoted, including when it contains spaces.
            # CreateProcess receives this directly; no shell executes these strings.
            command = f'"{installer.resolve()}" /S /D={destination}'
            subprocess.run(command, check=True, timeout=240)
            installed = destination / "z-mapflow.exe"
            if hashlib.sha256(installed.read_bytes()).digest() != hashlib.sha256(binary.read_bytes()).digest():
                raise RuntimeError("The installer payload differs from the built executable")
            version = subprocess.check_output([str(installed), "--version"], text=True, timeout=15).strip()
            if version != current_version():
                raise RuntimeError("Installed version does not match VERSION")
            if not (destination / "LICENSE").is_file() or not (destination / "licenses/Fira-OFL.txt").is_file():
                raise RuntimeError("Required notices were not installed")
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, uninstall_key) as key:
                if winreg.QueryValueEx(key, "DisplayVersion")[0] != version:
                    raise RuntimeError("Windows uninstall metadata has the wrong version")
            subprocess.run(f'"{destination / "uninstall.exe"}" /S _?={destination}', check=True, timeout=60)
            if installed.exists() or marker.read_text(encoding="utf-8") != "preserve configuration":
                raise RuntimeError("Uninstall failed or removed application preferences")
            print("Windows install/version/uninstall smoke test passed; configuration preserved.")
    finally:
        marker.unlink(missing_ok=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--installer", type=Path, default=ROOT / "build/bin/z-mapflow-amd64-installer.exe")
    parser.add_argument("--binary", type=Path, default=ROOT / "build/bin/z-mapflow.exe")
    args = parser.parse_args()
    smoke(args.installer, args.binary)
