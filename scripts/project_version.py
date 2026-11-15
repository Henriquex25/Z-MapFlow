"""Read the application's single version source. No other file owns a version."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
VERSION_FILE = ROOT / "VERSION"

def current_version():
    if VERSION_FILE.is_symlink() or not VERSION_FILE.is_file() or VERSION_FILE.stat().st_size > 64:
        raise ValueError("VERSION must be a regular file of at most 64 bytes")
    value = VERSION_FILE.read_text().strip()
    if not re.fullmatch(r"(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)", value):
        raise ValueError("VERSION must contain MAJOR.MINOR.PATCH")
    return value

if __name__ == "__main__":
    print(current_version())
