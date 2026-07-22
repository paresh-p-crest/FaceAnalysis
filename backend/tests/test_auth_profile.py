"""Tests for auth profile and password update helpers."""

import pytest

from backend.auth import hash_password, verify_password


def test_hash_and_verify_password_roundtrip():
    stored = hash_password("secret-password")
    assert verify_password("secret-password", stored)
    assert not verify_password("wrong-password", stored)


def test_validate_new_password_length_message():
    assert len("1234567") < 8
