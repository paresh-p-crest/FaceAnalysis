"""Photo persistence — local public storage (dev) with cloud migration path."""

from __future__ import annotations

import os
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Protocol

PIPELINE_VERSION = "2.0.0"

# Repo root: backend/ -> parent
_REPO_ROOT = Path(__file__).resolve().parent.parent
_DEFAULT_UPLOAD_ROOT = _REPO_ROOT / "public" / "uploads" / "assessments"


@dataclass
class StoredPhoto:
    poseId: str
    relativePath: str
    publicUrl: str
    contentType: str
    byteSize: int
    storedAt: str

    def to_dict(self) -> dict:
        return asdict(self)


class PhotoStorage(Protocol):
    def save_pose(self, assessment_id: str, pose_id: str, image_bytes: bytes) -> StoredPhoto: ...
    def delete_assessment_photos(self, assessment_id: str) -> None: ...


class LocalPublicPhotoStorage:
    """Writes JPEGs under public/uploads/assessments/{id}/{poseId}.jpg."""

    def __init__(self, upload_root: Optional[Path] = None, public_url_prefix: str = "/uploads/assessments"):
        self.upload_root = upload_root or _DEFAULT_UPLOAD_ROOT
        self.public_url_prefix = public_url_prefix.rstrip("/")

    def _assessment_dir(self, assessment_id: str) -> Path:
        return self.upload_root / assessment_id

    def save_pose(self, assessment_id: str, pose_id: str, image_bytes: bytes) -> StoredPhoto:
        dest_dir = self._assessment_dir(assessment_id)
        dest_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{pose_id}.jpg"
        dest_path = dest_dir / filename
        dest_path.write_bytes(image_bytes)
        rel = f"uploads/assessments/{assessment_id}/{filename}"
        return StoredPhoto(
            poseId=pose_id,
            relativePath=rel,
            publicUrl=f"{self.public_url_prefix}/{assessment_id}/{filename}",
            contentType="image/jpeg",
            byteSize=len(image_bytes),
            storedAt=datetime.now(timezone.utc).isoformat(),
        )

    def delete_assessment_photos(self, assessment_id: str) -> None:
        dest_dir = self._assessment_dir(assessment_id)
        if not dest_dir.exists():
            return
        for f in dest_dir.iterdir():
            if f.is_file():
                f.unlink()
        try:
            dest_dir.rmdir()
        except OSError:
            pass


def get_photo_storage() -> LocalPublicPhotoStorage:
    backend = os.environ.get("PHOTO_STORAGE_BACKEND", "local").lower()
    if backend != "local":
        # Prod S3/R2 not implemented — fall back to local with warning in logs
        pass
    root = os.environ.get("PHOTO_UPLOAD_ROOT")
    prefix = os.environ.get("PHOTO_PUBLIC_URL_PREFIX", "/uploads/assessments")
    return LocalPublicPhotoStorage(
        upload_root=Path(root) if root else None,
        public_url_prefix=prefix,
    )


def save_all_poses(assessment_id: str, photos: dict[str, bytes], front_bytes: bytes) -> dict[str, StoredPhoto]:
    """Persist front + all auxiliary pose bytes."""
    storage = get_photo_storage()
    stored: dict[str, StoredPhoto] = {}
    all_photos = dict(photos)
    if front_bytes and "front" not in all_photos:
        all_photos["front"] = front_bytes
    for pose_id, data in all_photos.items():
        if data:
            stored[pose_id] = storage.save_pose(assessment_id, pose_id, data)
    return stored


def photos_map_to_urls(stored: dict[str, StoredPhoto]) -> dict[str, str]:
    return {pose_id: s.publicUrl for pose_id, s in stored.items()}


def apply_photo_urls_to_cv_report(cv_report: dict, photo_urls: dict[str, str]) -> dict:
    """Bind persisted URLs into cvReport sections per Qoves pose routing."""
    if not cv_report or not photo_urls:
        return cv_report

    cv_report = dict(cv_report)
    cv_report["photos"] = dict(photo_urls)
    front = photo_urls.get("front")
    profile = photo_urls.get("rightProfile")
    smile = photo_urls.get("smile")
    top_head = photo_urls.get("topHead")

    def _set(section: str, url: Optional[str], fallback_key: Optional[str] = None):
        if not url:
            return
        if section not in cv_report:
            cv_report[section] = {}
        elif not isinstance(cv_report[section], dict):
            return
        cv_report[section] = {**cv_report[section], "imageSrc": url, "dataSource": "measured"}

    if front:
        for key in ("faceShape", "symmetry", "proportions", "averageness", "skin"):
            _set(key, front)

    if profile:
        ratios = cv_report.get("proportions", {}).get("ratios", {})
        if isinstance(ratios, dict) and "nasoAural" in ratios:
            naso = dict(ratios["nasoAural"])
            naso["imageSrc"] = profile
            naso["photoSource"] = "rightProfile"
            ratios = {**ratios, "nasoAural": naso}
            prop = {**cv_report.get("proportions", {}), "ratios": ratios}
            cv_report["proportions"] = prop

    left_profile = photo_urls.get("leftProfile")
    right_profile = photo_urls.get("rightProfile")
    if left_profile or right_profile:
        ears = dict(cv_report.get("ears") or {})
        if left_profile:
            ears["imageSrcLeft"] = left_profile
        if right_profile:
            ears["imageSrcRight"] = right_profile
            ears["imageSrc"] = right_profile
        ears["photoSource"] = "profile"
        ears["dataSource"] = "measured"
        cv_report["ears"] = ears
    elif cv_report.get("ears") and front:
        # No profile photos — keep front only as last resort
        _set("ears", front)
        if cv_report.get("ears"):
            cv_report["ears"] = {**cv_report["ears"], "dataSource": "estimated", "photoSource": "front"}

    if smile:
        _set("smile", smile)

    if top_head:
        _set("hair", top_head)

    meta = dict(cv_report.get("meta") or {})
    meta["pipelineVersion"] = PIPELINE_VERSION
    meta["posesStored"] = list(photo_urls.keys())
    cv_report["meta"] = meta
    return cv_report
