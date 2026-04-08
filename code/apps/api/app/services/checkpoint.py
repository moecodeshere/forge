"""
AES-256-GCM checkpoint encryption/decryption.
Key is derived from SUPABASE_JWT_SECRET via SHA-256.
Each checkpoint state is < 1MB (enforced by caller).
TTL of 14 days enforced by Supabase scheduled function.
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings


def _derive_key() -> bytes:
    secret = settings.SUPABASE_JWT_SECRET or "dev-key-change-in-production"
    return hashlib.sha256(secret.encode()).digest()


def encrypt_state(state: dict[str, Any]) -> str:
    """Encrypt state dict with AES-256-GCM. Returns base64(nonce + ciphertext)."""
    key = _derive_key()
    nonce = os.urandom(12)
    plaintext = json.dumps(state, default=str).encode()
    ciphertext = AESGCM(key).encrypt(nonce, plaintext, None)
    return base64.b64encode(nonce + ciphertext).decode()


def decrypt_state(blob: str) -> dict[str, Any]:
    """Decrypt a blob produced by encrypt_state."""
    key = _derive_key()
    combined = base64.b64decode(blob)
    nonce, ciphertext = combined[:12], combined[12:]
    plaintext = AESGCM(key).decrypt(nonce, ciphertext, None)
    result: dict[str, Any] = json.loads(plaintext)
    return result
