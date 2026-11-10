"""Verify packaging and installation without touching a real user profile."""
import hashlib
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest
from package_release import package
from project_version import current_version


class ReleaseTest(unittest.TestCase):
    def test_package_install_and_reject_tampering(self):
        with tempfile.TemporaryDirectory(prefix="z-mapflow-release-test-") as tmp:
            root = Path(tmp)
            binary = root / "binary"
            version = current_version()
            binary.write_text(f'#!/bin/sh\nprintf "{version}\\n"\n')
            binary.chmod(0o755)
            output = root / "dist"
            package(version, binary, output)
            for line in (output / "checksums.txt").read_text().splitlines():
                digest, filename = line.split()
                self.assertEqual(digest, hashlib.sha256((output / filename).read_bytes()).hexdigest())
            with tarfile.open(output / f"z-mapflow_{version}_linux_amd64.tar.gz") as tar:
                tar.extractall(root / "extracted", filter="data")
            folder = root / f"extracted/z-mapflow-{version}"
            env = dict(os.environ, HOME=str(root / "home"), XDG_DATA_HOME=str(root / "data with spaces"))
            result = subprocess.run([str(folder / "install.sh"), "--no-launch"], env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            installed = root / "data with spaces/z-mapflow/z-mapflow"
            self.assertEqual(installed.read_bytes(), binary.read_bytes())
            desktop = (root / "data with spaces/applications/z-mapflow.desktop").read_text()
            self.assertIn(f'Exec="{installed}"', desktop)
            self.assertTrue((root / "home/.local/bin/z-mapflow").is_symlink())
            # A damaged extracted binary must not replace the installed application.
            (folder / "z-mapflow").write_text("corrupted")
            result = subprocess.run([str(folder / "install.sh"), "--no-launch"], env=env, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(installed.read_bytes(), binary.read_bytes())

    def test_rejects_misstamped_version_and_unstable_tags(self):
        with tempfile.TemporaryDirectory() as tmp:
            binary = Path(tmp) / "binary"
            binary.write_text('#!/bin/sh\necho dev\n')
            binary.chmod(0o755)
            for version in [current_version(), "0.1.0-beta.1", "v0.1.0", "01.2.3", "999.0.0"]:
                with self.subTest(version=version), self.assertRaises(ValueError):
                    package(version, binary, Path(tmp) / "out")

class WailsVersionTest(unittest.TestCase):
    def test_native_metadata_uses_central_version_and_restores_after_failure(self):
        from unittest.mock import patch
        import json
        import wails
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            config = root / "wails.json"
            original = '{"name":"test","info":{"productName":"Test"}}\n'
            config.write_text(original)
            def build(args, cwd):
                self.assertEqual(json.loads(config.read_text())["info"]["productVersion"], current_version())
                return 17
            with patch.object(wails, "ROOT", root), patch.object(wails.subprocess, "call", side_effect=build):
                self.assertEqual(wails.run(["build"]), 17)
            self.assertEqual(config.read_text(), original)

    def test_native_metadata_preserves_concurrent_configuration_edits(self):
        from unittest.mock import patch
        import json
        import wails
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            config = root / "wails.json"
            config.write_text('{"name":"test","info":{}}')
            def build(args, cwd):
                data = json.loads(config.read_text())
                data["name"] = "user edit"
                config.write_text(json.dumps(data))
                return 0
            with patch.object(wails, "ROOT", root), patch.object(wails.subprocess, "call", side_effect=build):
                wails.run(["build"])
            data = json.loads(config.read_text())
            self.assertEqual(data["name"], "user edit")
            self.assertNotIn("productVersion", data["info"])


if __name__ == "__main__":
    unittest.main()
