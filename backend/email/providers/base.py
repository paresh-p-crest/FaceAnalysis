"""Provider adapter protocol for transactional email."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional, Protocol


@dataclass
class EmailAttachment:
    filename: str
    content: bytes
    content_type: str = "application/octet-stream"


@dataclass
class EmailSendOptions:
    attachments: list[EmailAttachment] | None = None
    reply_to: str | None = None
    tags: dict[str, str] | None = None


@dataclass
class ProviderSendResult:
    provider_message_id: str | None = None
    raw: dict = field(default_factory=dict)


class EmailProvider(Protocol):
    async def send(
        self,
        *,
        to: str,
        subject: str,
        html: str,
        text: str | None = None,
        options: EmailSendOptions | None = None,
    ) -> ProviderSendResult:
        """Send a rendered email via the provider."""
