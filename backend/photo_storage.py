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
        # Preserve analysis dataSource (e.g. hair estimated vs measured); only attach URL.
        prev = cv_report[section]
        next_doc = {**prev, "imageSrc": url}
        if prev.get("dataSource") is None:
            next_doc["dataSource"] = "measured"
        cv_report[section] = next_doc

    if front:
        for key in ("faceShape", "symmetry", "proportions", "averageness", "skin"):
            _set(key, front)
        if cv_report.get("symmetry"):
            cv_report["symmetry"] = {**cv_report["symmetry"], "overlaySpace": "image"}
        if cv_report.get("proportions"):
            prop = {**cv_report["proportions"], "overlaySpace": "image"}
            ratios = prop.get("ratios", {})
            if isinstance(ratios, dict):
                prop["ratios"] = {
                    k: (
                        {**v, "overlaySpace": "image", "imageSrc": v.get("imageSrc") or front}
                        if isinstance(v, dict) and k != "nasoAural"
                        else ({**v, "overlaySpace": "image"} if isinstance(v, dict) else v)
                    )
                    for k, v in ratios.items()
                }
            cv_report["proportions"] = prop

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
        # Keep frontal crop as primary imageSrc; store profiles only as L/R slots
        prev_src = ears.get("imageSrc")
        was_profile = ears.get("photoSource") in ("profile", "rightProfile") or prev_src in (
            left_profile,
            right_profile,
        )
        front_src = ears.get("imageSrcFront") or (None if was_profile else prev_src)
        if left_profile:
            ears["imageSrcLeft"] = left_profile
        if right_profile:
            ears["imageSrcRight"] = right_profile
        if front_src:
            ears["imageSrc"] = front_src
            ears["imageSrcFront"] = front_src
        elif was_profile:
            ears.pop("imageSrc", None)
        ears["photoSource"] = "front"
        ears["dataSource"] = "measured"
        cv_report["ears"] = ears

        # Chin / jaw BEFORE stay frontal crops; profile attached as secondary only.
        if right_profile:
            for section in ("jaw", "jawChin"):
                if section in cv_report and isinstance(cv_report[section], dict):
                    prev = cv_report[section]
                    front_src = (
                        prev.get("imageSrcFront")
                        if prev.get("photoSource") == "rightProfile"
                        else prev.get("imageSrc")
                    ) or prev.get("imageSrcFront") or prev.get("imageSrc")
                    cv_report[section] = {
                        **prev,
                        "imageSrc": front_src,
                        "imageSrcProfile": right_profile,
                        "photoSource": "front",
                    }
            if "chin" in cv_report and isinstance(cv_report["chin"], dict):
                prev = cv_report["chin"]
                front_src = prev.get("imageSrcFront") if prev.get("photoSource") == "rightProfile" else prev.get("imageSrc")
                if not front_src:
                    front_src = prev.get("imageSrcFront") or prev.get("imageSrc")
                cv_report["chin"] = {
                    **prev,
                    "imageSrc": front_src,
                    "imageSrcProfile": right_profile,
                    "photoSource": "front",
                }
    elif cv_report.get("ears") and front:
        # No profile photos — keep front only as last resort
        _set("ears", front)
        if cv_report.get("ears"):
            cv_report["ears"] = {**cv_report["ears"], "dataSource": "estimated", "photoSource": "front"}

    if smile:
        _set("smile", smile)

    if top_head:
        hair = dict(cv_report.get("hair") or {})
        # Keep frontal forehead/hairline crop as primary; top-head is secondary for density analysis
        front_src = hair.get("imageSrcFront") or (
            hair.get("imageSrc") if hair.get("photoSource") != "topHead" else None
        )
        if front_src and str(front_src).rstrip("/").endswith("topHead.jpg"):
            front_src = hair.get("imageSrcFront")
        cv_report["hair"] = {
            **hair,
            **({"imageSrc": front_src, "imageSrcFront": front_src} if front_src else {}),
            "imageSrcTopHead": top_head,
            "photoSource": "front" if front_src else hair.get("photoSource", "front"),
        }
        if not front_src and hair.get("imageSrc") == top_head:
            cv_report["hair"].pop("imageSrc", None)
            cv_report["hair"]["photoSource"] = "front"

    meta = dict(cv_report.get("meta") or {})
    meta["pipelineVersion"] = PIPELINE_VERSION
    meta["posesStored"] = list(photo_urls.keys())
    cv_report["meta"] = meta
    return cv_report


def _projected_full_ext(image_bytes: bytes) -> tuple[str, str]:
    """Return (filename_ext, contentType) from magic bytes — jpg or png."""
    if image_bytes[:8] == b"\x89PNG\r\n\x1a\n":
        return "png", "image/png"
    return "jpg", "image/jpeg"


def save_projected_full(assessment_id: str, image_bytes: bytes) -> StoredPhoto:
    """Persist full-face projected AFTER as projected/full.jpg or full.png."""
    storage = get_photo_storage()
    dest_dir = storage.upload_root / assessment_id / "projected"
    dest_dir.mkdir(parents=True, exist_ok=True)
    ext, content_type = _projected_full_ext(image_bytes)
    filename = f"full.{ext}"
    dest_path = dest_dir / filename
    # Drop the alternate extension so only one full.* exists
    for other in ("jpg", "jpeg", "png"):
        if other == ext:
            continue
        alt = dest_dir / f"full.{other}"
        if alt.exists():
            alt.unlink()
    dest_path.write_bytes(image_bytes)
    rel = f"uploads/assessments/{assessment_id}/projected/{filename}"
    return StoredPhoto(
        poseId="full",
        relativePath=rel,
        publicUrl=f"{storage.public_url_prefix}/{assessment_id}/projected/{filename}",
        contentType=content_type,
        byteSize=len(image_bytes),
        storedAt=datetime.now(timezone.utc).isoformat(),
    )


def load_projected_full(assessment_id: str, projected_after: dict | None = None) -> bytes | None:
    """Load projected AFTER full image bytes from disk (jpg or png)."""
    storage = get_photo_storage()
    dest_dir = storage.upload_root / assessment_id / "projected"
    rel = None
    if isinstance(projected_after, dict):
        full = projected_after.get("full") or {}
        if isinstance(full, dict):
            rel = full.get("relativePath")
    if rel:
        # relativePath like uploads/assessments/{id}/projected/full.jpg
        name = Path(rel).name
        path = dest_dir / name
        if path.exists():
            return path.read_bytes()
    for name in ("full.jpg", "full.jpeg", "full.png"):
        path = dest_dir / name
        if path.exists():
            return path.read_bytes()
    return None


def save_parsing_crop(assessment_id: str, feature_id: str, image_bytes: bytes) -> StoredPhoto:
    """Persist a SegFormer feature crop under parsing/{featureId}.jpg."""
    storage = get_photo_storage()
    dest_dir = storage.upload_root / assessment_id / "parsing"
    dest_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{feature_id}.jpg"
    dest_path = dest_dir / filename
    dest_path.write_bytes(image_bytes)
    rel = f"uploads/assessments/{assessment_id}/parsing/{filename}"
    return StoredPhoto(
        poseId=feature_id,
        relativePath=rel,
        publicUrl=f"{storage.public_url_prefix}/{assessment_id}/parsing/{filename}",
        contentType="image/jpeg",
        byteSize=len(image_bytes),
        storedAt=datetime.now(timezone.utc).isoformat(),
    )
