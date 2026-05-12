from __future__ import annotations

import uuid
from pathlib import Path

ALLOWED_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


def resolve_under_root(upload_root: Path, relative: str) -> Path:
    """Resolve a stored relative path strictly under ``upload_root``."""
    root = upload_root.resolve()
    candidate = Path(relative)
    if candidate.is_absolute() or ".." in candidate.parts:
        raise ValueError("invalid path")
    resolved = (root / candidate).resolve()
    resolved.relative_to(root)
    return resolved


def save_visit_evidence_file(upload_root: Path, visit_id: uuid.UUID, original_filename: str, data: bytes) -> str:
    ext = Path(original_filename).suffix.lower()
    if ext not in ALLOWED_IMAGE_EXT:
        ext = ".jpg"
    rel_dir = Path("visits") / str(visit_id)
    out_name = f"{uuid.uuid4().hex}{ext}"
    root = upload_root.resolve()
    dest_dir = (root / rel_dir).resolve()
    dest_dir.relative_to(root)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_file = dest_dir / out_name
    dest_file.write_bytes(data)
    rel_path = rel_dir / out_name
    return rel_path.as_posix()
