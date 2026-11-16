"""Independent durable refresh status and a process-wide, crash-releasing writer lock."""

import json
import os
from contextlib import contextmanager
from datetime import datetime, timezone

from soccer_api.db import data_dir


def read_status():
    try:
        return json.loads((data_dir() / "refresh-status.json").read_text(encoding="utf8"))
    except (OSError, ValueError):
        return {}


def write_status(**updates):
    folder = data_dir()
    folder.mkdir(parents=True, exist_ok=True)
    payload = {**read_status(), **updates}
    temporary = folder / f"refresh-status.{os.getpid()}.tmp"
    temporary.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf8")
    temporary.replace(folder / "refresh-status.json")


def stamp():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


@contextmanager
def writer_lock():
    folder = data_dir()
    folder.mkdir(parents=True, exist_ok=True)
    with (folder / "refresh.lock").open("a+b") as handle:
        handle.seek(0, 2)
        if handle.tell() == 0:
            handle.write(b"0")
            handle.flush()
        handle.seek(0)
        try:
            if os.name == "nt":
                import msvcrt
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as exc:
            raise ValueError("Ein Quellenabgleich läuft bereits; später erneut versuchen.") from exc
        try:
            yield
        finally:
            handle.seek(0)
            if os.name == "nt":
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
