"""
Server-side encrypted storage for user API keys (Run settings / BYOK vault).
AES-256-GCM. New writes use a per-user derived key (pepper + user_id).
Decrypt tries per-user key first, then legacy global key for backward compatibility.
"""
from __future__ import annotations

import base64
import hashlib
import os
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings


def _legacy_derive_key() -> bytes:
    """Legacy single-tenant key (same as checkpoint helper)."""
    secret = settings.SUPABASE_JWT_SECRET or "dev-key-change-in-production"
    return hashlib.sha256(secret.encode()).digest()


def _user_vault_derive_key(user_id: str) -> bytes:
    """Per-user vault key — isolates ciphertexts per user at the crypto layer."""
    pepper = (settings.BYOK_VAULT_PEPPER or settings.SUPABASE_JWT_SECRET or "dev-key-change-in-production")
    material = f"forge-byok-v1:{pepper}:{user_id}".encode()
    return hashlib.sha256(material).digest()


def _encrypt_value(plaintext: str, user_id: str) -> str:
    key = _user_vault_derive_key(user_id)
    nonce = os.urandom(12)
    ciphertext = AESGCM(key).encrypt(nonce, plaintext.encode("utf-8"), None)
    return base64.b64encode(nonce + ciphertext).decode()


def _decrypt_value(blob: str, user_id: str) -> str:
    combined = base64.b64decode(blob)
    nonce, ciphertext = combined[:12], combined[12:]
    try:
        key = _user_vault_derive_key(user_id)
        plaintext = AESGCM(key).decrypt(nonce, ciphertext, None)
        return plaintext.decode("utf-8")
    except Exception:
        key = _legacy_derive_key()
        plaintext = AESGCM(key).decrypt(nonce, ciphertext, None)
        return plaintext.decode("utf-8")


ALLOWED_KEY_NAMES = frozenset({
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GOOGLE_API_KEY",
    "GMAIL_ACCESS_TOKEN",
    "PERPLEXITY_API_KEY",
    "FIRECRAWL_API_KEY",
    "TELEGRAM_BOT_TOKEN",
    "GOOGLE_SHEETS_ACCESS_TOKEN",
    "DATABASE_URL",
})


def get_keys_for_user(user_id: str) -> dict[str, str]:
    """Return decrypted API keys for the user. Empty dict if none or error."""
    from app.services.supabase import get_supabase_admin_client

    supabase = get_supabase_admin_client()
    resp = (
        supabase.table("user_api_keys")
        .select("key_name, encrypted_value")
        .eq("user_id", user_id)
        .execute()
    )
    result: dict[str, str] = {}
    for row in (resp.data or []):
        name = row.get("key_name")
        enc = row.get("encrypted_value")
        if name in ALLOWED_KEY_NAMES and enc:
            try:
                result[name] = _decrypt_value(enc, user_id)
            except Exception:
                pass
    return result


def save_keys(user_id: str, keys: dict[str, str]) -> None:
    """Encrypt and upsert keys for the user. Only ALLOWED_KEY_NAMES are stored."""
    from app.services.supabase import get_supabase_admin_client

    supabase = get_supabase_admin_client()
    for name, value in keys.items():
        if name not in ALLOWED_KEY_NAMES or not value or not value.strip():
            continue
        encrypted = _encrypt_value(value.strip(), user_id)
        supabase.table("user_api_keys").upsert(
            {
                "user_id": user_id,
                "key_name": name,
                "encrypted_value": encrypted,
            },
            on_conflict="user_id,key_name",
        ).execute()
