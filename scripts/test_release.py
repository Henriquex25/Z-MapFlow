"""Verify packaging and installation without touching a real user profile."""
import hashlib
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest
from package_release import package


class ReleaseTest(unittest.TestCase):
    def test_package_install_and_reject_tampering(self):
        with tempfile.TemporaryDirectory(prefix="z-mapflow-release-test-") as tmp:
            root = Path(tmp)
            binary = root / "binary"
            binary.write_text('#!/bin/sh\nprintf "0.1.0\\n"\n')
            binary.chmod(0o755)
            output = root / "dist"
            package("0.1.0", binary, output)
            for line in (output / "checksums.txt").read_text().splitlines():
                digest, filename = line.split()
                self.assertEqual(digest, hashlib.sha256((output / filename).read_bytes()).hexdigest())
            with tarfile.open(output / "z-mapflow_0.1.0_linux_amd64.tar.gz") as tar:
                tar.extractall(root / "extracted", filter="data")
            folder = root / "extracted/z-mapflow-0.1.0"
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
            for version in ["0.1.0", "0.1.0-beta.1", "v0.1.0", "01.2.3"]:
                with self.subTest(version=version), self.assertRaises(ValueError):
                    package(version, binary, Path(tmp) / "out")


if __name__ == "__main__":
    unittest.main()
