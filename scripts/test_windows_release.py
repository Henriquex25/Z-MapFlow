import hashlib
from pathlib import Path
import struct
import tempfile
import unittest
from unittest.mock import patch

import create_release_draft
import merge_release_assets
import package_windows
from project_version import current_version


def pe_bytes(machine=0x8664):
    data = bytearray(152)
    data[:2] = b"MZ"
    struct.pack_into("<I", data, 60, 128)
    data[128:132] = b"PE\0\0"
    struct.pack_into("<H", data, 132, machine)
    return bytes(data)


class WindowsReleaseTest(unittest.TestCase):
    def test_packages_verified_x64_payload_and_installer(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            binary, installer = root / "app.exe", root / "installer.exe"
            binary.write_bytes(pe_bytes())
            installer.write_bytes(pe_bytes(0x14C))
            with patch.object(package_windows.subprocess, "check_output", return_value=current_version()+"\n") as probe:
                package_windows.package(binary, installer, root / "dist")
            self.assertEqual(probe.call_args.args[0], [str(binary.resolve()), "--version"])
            assets = create_release_draft.release_assets(root / "dist", current_version(), ("windows",))
            self.assertEqual(len(assets), 3)

    def test_rejects_wrong_architecture_version_and_non_executables(self):
        for content, version in [(pe_bytes(0x14C), current_version()), (b"not executable", current_version()), (pe_bytes(), "999.0.0")]:
            with self.subTest(version=version, content=content[:2]), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                (root / "app.exe").write_bytes(content)
                (root / "setup.exe").write_bytes(pe_bytes(0x14C))
                with patch.object(package_windows.subprocess, "check_output", return_value=version):
                    with self.assertRaises(ValueError):
                        package_windows.package(root / "app.exe", root / "setup.exe", root / "dist")
                self.assertFalse((root / "dist").exists())

    def test_combines_both_platforms_before_allowing_a_draft(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            version = current_version()
            for platform in ["linux", "windows"]:
                folder = root / "packages" / f"package-{platform}"
                folder.mkdir(parents=True)
                names = create_release_draft.asset_names(version, (platform,))
                for name in names:
                    (folder / name).write_bytes(name.encode())
                (folder / "checksums.txt").write_text("".join(
                    f"{hashlib.sha256((folder/name).read_bytes()).hexdigest()}  {name}\n" for name in names))
            merge_release_assets.merge(root / "packages", root / "dist")
            self.assertEqual(len(create_release_draft.release_assets(root / "dist", version)), 5)
            (root / "packages/package-windows/z-mapflow_windows_amd64.exe").write_bytes(b"corrupted")
            with self.assertRaises(ValueError):
                merge_release_assets.merge(root / "packages", root / "bad-dist")
            self.assertFalse((root / "bad-dist").exists())


if __name__ == "__main__":
    unittest.main()
