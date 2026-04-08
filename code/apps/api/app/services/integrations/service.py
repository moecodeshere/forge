from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

from app.core.config import settings


@dataclass(frozen=True)
class ConnectorMetadata:
    key: str
    label: str
    description: str
    supports_trigger: bool
    supports_action: bool
    auth_required: bool
    sample_actions: list[str]


class IntegrationConnector(Protocol):
    metadata: ConnectorMetadata

    async def execute_action(
        self,
        action: str,
        payload: dict[str, Any],
        *,
        test_mode: bool = True,
        secrets: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        ...


class _BaseConnector:
    metadata: ConnectorMetadata
    token_env_key: str = ""

    def _token(self, secrets: dict[str, str] | None = None) -> str:
        if secrets and self.token_env_key:
            val = secrets.get(self.token_env_key) or secrets.get(self.token_env_key.lower())
            if val and str(val).strip():
                return str(val).strip()
        return str(getattr(settings, self.token_env_key, "")).strip()

    async def execute_action(
        self,
        action: str,
        payload: dict[str, Any],
        *,
        test_mode: bool = True,
        secrets: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        secrets = secrets or {}
        if action not in self.metadata.sample_actions:
            raise ValueError(
                f"Unsupported action '{action}' for {self.metadata.label}. "
                f"Supported: {', '.join(self.metadata.sample_actions)}"
            )
        token = self._token(secrets)
        if not token:
            if test_mode:
                return {
                    "provider": self.metadata.key,
                    "action": action,
                    "status": "mock_success",
                    "message": f"{self.metadata.label} not configured. Returned mocked response.",
                    "input": payload,
                }
            raise ValueError(f"{self.metadata.label} token is not configured")

        # V1 placeholder behavior: credential-aware acknowledgement.
        # Real API calls are added in a follow-up iteration.
        return {
            "provider": self.metadata.key,
            "action": action,
            "status": "connected_stub",
            "message": f"{self.metadata.label} token detected. Connector call stub executed.",
            "input": payload,
        }


class SlackConnector(_BaseConnector):
    token_env_key = "SLACK_BOT_TOKEN"
    metadata = ConnectorMetadata(
        key="slack",
        label="Slack",
        description="Post messages and react to channel events.",
        supports_trigger=True,
        supports_action=True,
        auth_required=True,
        sample_actions=["post_message", "lookup_channel", "reply_in_thread"],
    )


class GmailConnector(_BaseConnector):
    token_env_key = "GMAIL_ACCESS_TOKEN"
    metadata = ConnectorMetadata(
        key="gmail",
        label="Gmail",
        description="Send and read emails for workflow automation.",
        supports_trigger=True,
        supports_action=True,
        auth_required=True,
        sample_actions=["send_email", "read_thread", "list_unread"],
    )

    async def execute_action(
        self,
        action: str,
        payload: dict[str, Any],
        *,
        test_mode: bool = True,
        secrets: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        secrets = secrets or {}
        if action != "send_email":
            return await super().execute_action(
                action, payload, test_mode=test_mode, secrets=secrets
            )

        token = self._token(secrets)
        if not token:
            if test_mode:
                return {
                    "provider": self.metadata.key,
                    "action": action,
                    "status": "mock_success",
                    "message": "Gmail not configured. Add Gmail OAuth token in Run settings for real send.",
                    "input": payload,
                }
            raise ValueError(
                "Gmail token not configured. Add Gmail OAuth access token in Run settings."
            )

        if test_mode:
            body = payload.get("body") or payload.get("output") or "(no body)"
            return {
                "provider": self.metadata.key,
                "action": action,
                "status": "mock_success",
                "message": f"Test mode: would send to {payload.get('to', '?')}",
                "preview": {"to": payload.get("to"), "subject": payload.get("subject"), "body_preview": str(body)[:200]},
            }

        # Real send via Gmail API
        to_addr = str(payload.get("to", "")).strip()
        subject = str(payload.get("subject", "")).strip()
        body_text = str(payload.get("body") or payload.get("output") or "").strip()
        if not to_addr:
            raise ValueError("send_email requires 'to' address")
        if not body_text:
            raise ValueError("send_email requires 'body' or 'output' (LLM summary)")

        try:
            from email.message import EmailMessage
            import base64
            from google.oauth2.credentials import Credentials
            from googleapiclient.discovery import build

            msg = EmailMessage()
            msg["To"] = to_addr
            msg["Subject"] = subject or "Daily digest"
            msg.set_content(body_text)

            creds = Credentials(token=token)
            service = build("gmail", "v1", credentials=creds)
            raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
            sent = service.users().messages().send(userId="me", body={"raw": raw}).execute()
            return {
                "provider": self.metadata.key,
                "action": action,
                "status": "sent",
                "message_id": sent.get("id"),
                "to": to_addr,
            }
        except Exception as e:
            return {
                "provider": self.metadata.key,
                "action": action,
                "status": "error",
                "error": str(e),
                "hint": "Ensure GMAIL_ACCESS_TOKEN is a valid OAuth access token with gmail.send scope.",
            }


class SheetsConnector(_BaseConnector):
    token_env_key = "GOOGLE_SHEETS_ACCESS_TOKEN"
    metadata = ConnectorMetadata(
        key="sheets",
        label="Google Sheets",
        description="Read and write spreadsheet rows.",
        supports_trigger=True,
        supports_action=True,
        auth_required=True,
        sample_actions=["append_row", "update_row", "read_range"],
    )

    async def execute_action(
        self,
        action: str,
        payload: dict[str, Any],
        *,
        test_mode: bool = True,
        secrets: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        if action != "append_row":
            return await super().execute_action(
                action, payload, test_mode=test_mode, secrets=secrets
            )
        token = self._token(secrets)
        if not token:
            if test_mode:
                return {
                    "provider": self.metadata.key,
                    "action": action,
                    "status": "mock_success",
                    "message": "Sheets not configured. Add GOOGLE_SHEETS_ACCESS_TOKEN (OAuth with sheets scope).",
                    "input": payload,
                }
            raise ValueError("GOOGLE_SHEETS_ACCESS_TOKEN is not configured.")
        spreadsheet_id = str(payload.get("spreadsheet_id", "")).strip()
        sheet_name = str(payload.get("sheet_name", "Sheet1")).strip()
        values = payload.get("values", payload.get("row", []))
        if isinstance(values, (str, int, float)):
            values = [values]
        if not spreadsheet_id:
            raise ValueError("append_row requires 'spreadsheet_id'.")
        if not values:
            raise ValueError("append_row requires 'values' (list of cell values) or 'row'.")
        if test_mode:
            return {
                "provider": self.metadata.key,
                "action": action,
                "status": "mock_success",
                "message": f"Test mode: would append {len(values)} cells to {sheet_name}",
                "preview": {"values": values[:5]},
            }
        import httpx
        range_name = f"'{sheet_name}'!A:A"  # append to next row in column A
        url = (
            f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}"
            f"/values/{range_name}:append?valueInputOption=USER_ENTERED"
        )
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                url,
                headers={"Authorization": f"Bearer {token}"},
                json={"values": [values]},
                timeout=15.0,
            )
        if resp.status_code != 200:
            err = resp.json() if resp.text else {}
            raise ValueError(
                err.get("error", {}).get("message", resp.text or f"Sheets API error {resp.status_code}")
            )
        data = resp.json()
        return {
            "provider": self.metadata.key,
            "action": action,
            "status": "updated",
            "updatedRange": data.get("updates", {}).get("updatedRange"),
            "updatedRows": data.get("updates", {}).get("updatedRows", 1),
        }


class NotionConnector(_BaseConnector):
    token_env_key = "NOTION_TOKEN"
    metadata = ConnectorMetadata(
        key="notion",
        label="Notion",
        description="Create and update pages and databases.",
        supports_trigger=False,
        supports_action=True,
        auth_required=True,
        sample_actions=["create_page", "update_page", "query_database"],
    )


class TelegramConnector(_BaseConnector):
    token_env_key = "TELEGRAM_BOT_TOKEN"
    metadata = ConnectorMetadata(
        key="telegram",
        label="Telegram",
        description="Send messages and alerts to Telegram chats or channels.",
        supports_trigger=False,
        supports_action=True,
        auth_required=True,
        sample_actions=["send_message", "send_message_with_image"],
    )

    async def execute_action(
        self,
        action: str,
        payload: dict[str, Any],
        *,
        test_mode: bool = True,
        secrets: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        secrets = secrets or {}
        if action != "send_message" and action != "send_message_with_image":
            return await super().execute_action(
                action, payload, test_mode=test_mode, secrets=secrets
            )
        token = self._token(secrets)
        if not token:
            if test_mode:
                return {
                    "provider": self.metadata.key,
                    "action": action,
                    "status": "mock_success",
                    "message": "Telegram not configured. Add TELEGRAM_BOT_TOKEN in Run settings.",
                    "input": payload,
                }
            raise ValueError("TELEGRAM_BOT_TOKEN is not configured.")
        chat_id = str(payload.get("chat_id", payload.get("channel", ""))).strip()
        text = str(payload.get("text", payload.get("body", payload.get("output", "")))).strip()
        if not chat_id:
            raise ValueError("Telegram send_message requires 'chat_id' or 'channel'.")
        if not text:
            raise ValueError("Telegram send_message requires 'text', 'body', or 'output'.")
        if test_mode:
            return {
                "provider": self.metadata.key,
                "action": action,
                "status": "mock_success",
                "message": f"Test mode: would send to chat_id={chat_id}",
                "preview": {"text_preview": text[:100]},
            }
        import httpx
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                url,
                json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
                timeout=10.0,
            )
        if resp.status_code != 200:
            data = resp.json() if resp.text else {}
            raise ValueError(
                data.get("description", resp.text or f"Telegram API error {resp.status_code}")
            )
        out = resp.json()
        return {
            "provider": self.metadata.key,
            "action": action,
            "status": "sent",
            "message_id": out.get("result", {}).get("message_id"),
            "chat_id": chat_id,
        }


class IntegrationService:
    def __init__(self) -> None:
        self._connectors: dict[str, IntegrationConnector] = {
            "slack": SlackConnector(),
            "gmail": GmailConnector(),
            "telegram": TelegramConnector(),
            "sheets": SheetsConnector(),
            "notion": NotionConnector(),
        }

    def list_connectors(self) -> list[ConnectorMetadata]:
        return [connector.metadata for connector in self._connectors.values()]

    def get_connector(self, provider: str) -> IntegrationConnector | None:
        return self._connectors.get(provider.strip().lower())

    async def execute(
        self,
        provider: str,
        action: str,
        payload: dict[str, Any],
        *,
        test_mode: bool = True,
        secrets: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        provider_key = provider.strip().lower()
        action_key = action.strip()
        connector = self.get_connector(provider_key)
        if connector is None:
            raise ValueError(f"Unknown integration provider: {provider_key}")
        return await connector.execute_action(
            action_key, payload, test_mode=test_mode, secrets=secrets or {}
        )

