"""Conversation persistence order: the user message must load before its assistant reply."""

import asyncio
import uuid

import pytest

from backend.database import close_db, connect_db, is_db_configured, session_scope
from backend.models import Assessment, User
from backend.repositories.conversation_repository import (
    append_messages,
    get_conversation,
    get_or_create_conversation,
)

pytestmark = pytest.mark.skipif(not is_db_configured(), reason="DATABASE_URL not configured")


def test_user_message_persists_before_assistant_reply():
    """Two sequential appends (user, then assistant) must round-trip in that order."""
    email = f"ordering-{uuid.uuid4().hex}@test.local"

    async def scenario():
        await connect_db()
        try:
            async with session_scope() as session:
                user = User(email=email, password_hash="x")
                session.add(user)
                await session.flush()
                user_id = user.id
                assessment = Assessment(user_id=user_id)
                session.add(assessment)
                await session.flush()
                assessment_id = assessment.id

            conversation = await get_or_create_conversation(
                assessment_id=str(assessment_id), user_id=str(user_id)
            )

            # Simulates the router: user message persisted first, assistant reply only
            # after generation, so created_at reflects real chronology.
            await append_messages(
                conversation_id=conversation["id"],
                messages=[{"role": "user", "content": "What is my jaw shape?"}],
            )
            await append_messages(
                conversation_id=conversation["id"],
                messages=[{"role": "assistant", "content": "Your jaw is square."}],
            )

            loaded = await get_conversation(
                assessment_id=str(assessment_id), user_id=str(user_id)
            )
            roles = [m["role"] for m in (loaded or {}).get("messages", [])]
            assert roles == ["user", "assistant"], f"expected [user, assistant], got {roles}"

            async with session_scope() as session:
                user_row = await session.get(User, user_id)
                await session.delete(user_row)
        finally:
            await close_db()

    asyncio.run(scenario())
