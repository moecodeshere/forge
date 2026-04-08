"""Unit tests for per-user BYOK vault crypto and legacy ciphertext compatibility."""

from __future__ import annotations

import base64
import os

import pytest
from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

import app.services.user_keys as user_keys


class _VaultSettings:
    BYOK_VAULT_PEPPER = "unit-test-pepper"
    SUPABASE_JWT_SECRET = "unit-test-jwt"


@pytest.fixture
def vault_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(user_keys, "settings", _VaultSettings())


def test_encrypt_decrypt_roundtrip_per_user(vault_settings: None) -> None:
    blob = user_keys._encrypt_value("secret-value", "user-a")
    assert user_keys._decrypt_value(blob, "user-a") == "secret-value"


def test_different_users_cannot_decrypt_each_others_ciphertext(vault_settings: None) -> None:
    blob = user_keys._encrypt_value("only-a", "user-a")
    with pytest.raises(InvalidTag):
        user_keys._decrypt_value(blob, "user-b")


def test_legacy_ciphertext_still_decrypts(vault_settings: None) -> None:
    key = user_keys._legacy_derive_key()
    nonce = os.urandom(12)
    ct = AESGCM(key).encrypt(nonce, b"legacy-secret", None)
    blob = base64.b64encode(nonce + ct).decode()
    assert user_keys._decrypt_value(blob, "any-user-id") == "legacy-secret"
