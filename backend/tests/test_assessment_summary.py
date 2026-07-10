from backend.report_status import serialize_assessment_summary


def test_serialize_assessment_summary_strips_heavy_fields():
    doc = {
        "id": "abc123",
        "userId": "user1",
        "status": "pending_review",
        "provider": "local",
        "scanId": "scan-1",
        "createdAt": "2026-01-01T00:00:00+00:00",
        "photos": {"front": {"publicUrl": "/uploads/front.jpg"}},
        "answers": {"age": "25"},
        "aiNarrative": {"intro": "long text"},
        "analysis": {
            "cvReport": {
                "overall": {"score": 81},
                "symmetry": {"score": 76, "imageSrc": "data:image/png;base64,AAAA"},
                "nose": {"imageSrc": "data:image/png;base64,BBBB"},
            },
            "metrics": {"harmonyScore": 81, "symmetryScore": 76},
        },
    }

    summary = serialize_assessment_summary(doc)

    assert summary["id"] == "abc123"
    assert summary["status"] == "Pending Review"
    assert "photos" not in summary
    assert "answers" not in summary
    assert "aiNarrative" not in summary
    assert summary["analysis"]["cvReport"]["overall"]["score"] == 81
    assert summary["analysis"]["cvReport"]["symmetry"]["score"] == 76
    assert "imageSrc" not in summary["analysis"]["cvReport"]["symmetry"]
    assert "nose" not in summary["analysis"]["cvReport"]
