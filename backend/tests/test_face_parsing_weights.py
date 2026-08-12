"""Face parsing weight ensure / retryable load tests (no real network)."""

from __future__ import annotations

import pytest

from backend import face_parsing


def test_load_model_uses_hf_cache_dir(monkeypatch, tmp_path):
    monkeypatch.setenv("CV_MODELS_ROOT", str(tmp_path / "models"))
    face_parsing.reset_face_parsing_cache()
    monkeypatch.setattr(face_parsing, "ensure_face_parsing_weights", lambda: True)

    class _Proc:
        pass

    class _Model:
        def to(self, device):
            return self

        def eval(self):
            return self

    kwargs_seen = []

    def _from_pretrained(name, *args, **kwargs):
        kwargs_seen.append(kwargs)
        # First of each try-pair returns processor-like; second returns model-like.
        # local_files_only path: 2 calls; we succeed on first pair.
        if kwargs.get("local_files_only"):
            if len([k for k in kwargs_seen if k.get("local_files_only")]) == 1:
                return _Proc()
            return _Model()
        return _Proc()

    import transformers

    monkeypatch.setattr(
        transformers.SegformerImageProcessor,
        "from_pretrained",
        staticmethod(lambda *a, **k: _from_pretrained("proc", *a, **k)),
    )
    monkeypatch.setattr(
        transformers.SegformerForSemanticSegmentation,
        "from_pretrained",
        staticmethod(lambda *a, **k: _from_pretrained("model", *a, **k)),
    )
    monkeypatch.setattr("torch.cuda.is_available", lambda: False)

    _proc, _model, device = face_parsing._load_model()
    assert device == "cpu"
    assert kwargs_seen
    assert kwargs_seen[0]["cache_dir"] == str(tmp_path / "models" / "huggingface")
    face_parsing.reset_face_parsing_cache()


def test_failed_load_not_sticky(monkeypatch, tmp_path):
    monkeypatch.setenv("CV_MODELS_ROOT", str(tmp_path / "models"))
    face_parsing.reset_face_parsing_cache()
    monkeypatch.setattr(face_parsing, "ensure_face_parsing_weights", lambda: True)

    class _Proc:
        pass

    class _Model:
        def to(self, device):
            return self

        def eval(self):
            return self

    state = {"fail": True}

    def _from_pretrained(*args, **kwargs):
        if state["fail"]:
            raise RuntimeError("hub down")
        # Succeed: processor then model depending on call site
        if "SegformerImageProcessor" in str(args) or kwargs.get("_kind") == "proc":
            return _Proc()
        return _Model()

    import transformers

    n = {"i": 0}

    def _proc_fp(*a, **k):
        n["i"] += 1
        if state["fail"]:
            raise RuntimeError("hub down")
        return _Proc()

    def _model_fp(*a, **k):
        n["i"] += 1
        if state["fail"]:
            raise RuntimeError("hub down")
        return _Model()

    monkeypatch.setattr(transformers.SegformerImageProcessor, "from_pretrained", staticmethod(_proc_fp))
    monkeypatch.setattr(
        transformers.SegformerForSemanticSegmentation, "from_pretrained", staticmethod(_model_fp)
    )
    monkeypatch.setattr("torch.cuda.is_available", lambda: False)

    with pytest.raises(RuntimeError):
        face_parsing._load_model()

    state["fail"] = False
    _proc, _model, device = face_parsing._load_model()
    assert device == "cpu"
    face_parsing.reset_face_parsing_cache()
