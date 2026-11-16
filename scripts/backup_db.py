"""Create a consistent, verified SQLite snapshot without stopping the local API."""

import argparse
import os
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path


def backup(directory=None):
    root = Path(__file__).resolve().parents[1]
    data = Path(os.environ.get("SOCCER_DATA_DIR", root / "data"))
    source = (data / "soccer.db").resolve()
    if not source.is_file():
        raise FileNotFoundError(f"Keine lokale Datenbank: {source}")
    target_dir = Path(directory) if directory else data / "backups"
    target_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    target = (target_dir / f"soccer-{stamp}.db").resolve()
    # Reserve a new filename; never overwrite a previous backup.
    with target.open("xb"):
        pass
    try:
        with closing(sqlite3.connect(source.as_uri() + "?mode=ro", uri=True)) as reader:
            with closing(sqlite3.connect(target)) as writer:
                reader.backup(writer)
                if writer.execute("PRAGMA quick_check").fetchone() != ("ok",):
                    raise ValueError("Die Sicherung hat die SQLite-Prüfung nicht bestanden.")
    except Exception:
        target.unlink(missing_ok=True)
        raise
    return target


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", help="Zielordner; Standard: data/backups")
    args = parser.parse_args()
    try:
        print(backup(args.directory))
    except (OSError, sqlite3.Error, ValueError) as exc:
        parser.exit(1, f"Sicherung fehlgeschlagen: {exc}\n")
