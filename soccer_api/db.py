"""SQLite paths and read-only snapshots."""

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def data_dir():
    return Path(os.environ.get("SOCCER_DATA_DIR", ROOT / "data"))


@contextmanager
def connect(readonly=True):
    path = data_dir() / "soccer.db"
    if readonly:
        con = sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True)
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        con = sqlite3.connect(path)
    try:
        with con:
            yield con
    finally:
        con.close()


def quote(name):
    return '"' + name.replace('"', '""') + '"'
