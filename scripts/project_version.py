"""Read the application's single version source. No other file owns a version."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
VERSION_FILE = ROOT / "internal/version/VERSION"

def current_version():
    value = VERSION_FILE.read_text().strip()
    if not re.fullmatch(r"(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)", value):
        raise ValueError("internal/version/VERSION must contain MAJOR.MINOR.PATCH")
    return value

if __name__ == "__main__":
    print(current_version())
