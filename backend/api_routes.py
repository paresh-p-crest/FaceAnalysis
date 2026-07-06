"""Port of api/analyze-face.js — AWS Rekognition serverless endpoint.

This module provides the /api/analyze-face and /api/test-aws endpoints
for the FastAPI backend, matching the exact API shape the frontend expects.
"""

from __future__ import annotations
import base64
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import boto3
from botocore.exceptions import ClientError


router = APIRouter(prefix="/api")


class AnalyzeFaceRequest(BaseModel):
    imageBase64: str
    accessKeyId: str
    secretAccessKey: str
    sessionToken: Optional[str] = None
    region: str = "us-east-1"


class TestAwsRequest(BaseModel):
    accessKeyId: str
    secretAccessKey: str
    sessionToken: Optional[str] = None
    region: str = "us-east-1"


def _make_client(req) -> boto3.client:
    kwargs = {
        "region_name": req.region,
        "aws_access_key_id": req.accessKeyId,
        "aws_secret_access_key": req.secretAccessKey,
    }
    if req.sessionToken:
        kwargs["aws_session_token"] = req.sessionToken
    return boto3.client("rekognition", **kwargs)


@router.post("/analyze-face")
async def analyze_face(req: AnalyzeFaceRequest):
    """Analyze a face using AWS Rekognition — matches the Vercel serverless API shape."""
    if not req.imageBase64 or not req.accessKeyId or not req.secretAccessKey:
        raise HTTPException(status_code=400, detail="Missing image or AWS credentials")

    try:
        image_bytes = base64.b64decode(req.imageBase64)
        client = _make_client(req)
        response = client.detect_faces(
            Image={"Bytes": image_bytes},
            Attributes=["ALL"],
        )

        face_details = response.get("FaceDetails", [])
        if not face_details:
            raise HTTPException(status_code=422, detail="No face detected in image")

        return {"faceDetails": face_details[0]}

    except HTTPException:
        raise
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e) or "Rekognition error")


@router.post("/test-aws")
async def test_aws(req: TestAwsRequest):
    """Test AWS Rekognition credentials."""
    try:
        client = _make_client(req)
        # Use a tiny 1x1 JPEG as test
        tiny_jpeg = base64.b64decode(
            "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkS"
            "Ew8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJ"
            "CQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy"
            "MjIyMjIyMjIyMjIyMjL/wAARCAAyACgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEA"
            "AAEAAwIEAAcFBwkKCgEAAQUBAQEBAQEAAf+AAAEACgAOBwQKCg4LDA0NFxYWFyEd"
            "Hh4nIispKTQ0NjY2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6"
            "goOEhYaHiImKi4yNjo+QkZKTlJWWl5iZmpucnZ6foKGio6Slpqeoqaqys7S1tre4"
            "ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEB"
            "AQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAEC"
            "AxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYI4Q/SFE"
            "JiJXQ0VTNzwgcHRDQjs0NTY3OEtDTkZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3"
            "eHl6goOEhYaHiImKi4yNjo+QkZKTlJWWl5iZmpucnZ6foKGio6Slpqeoqaqys7S1"
            "tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ufo6erx8vP09fb3+Pn6/9oADAMB"
            "AAIRAxEAPwD3+iiigD//2Q=="
        )
        client.detect_faces(
            Image={"Bytes": tiny_jpeg},
            Attributes=["DEFAULT"],
        )
        return {"ok": True, "message": "Connection successful"}
    except ClientError as e:
        raise HTTPException(status_code=500, detail={"ok": False, "error": str(e)})
    except Exception as e:
        raise HTTPException(status_code=500, detail={"ok": False, "error": str(e)})
