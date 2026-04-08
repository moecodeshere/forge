import pytest
from fastapi import HTTPException
from jose import jwt

from app.core.auth import _decode_supabase_token
from app.core.config import settings


@pytest.mark.asyncio
async def test_decode_hs256_token_success() -> None:
    original_secret = settings.SUPABASE_JWT_SECRET
    settings.SUPABASE_JWT_SECRET = "test-secret"
    token = jwt.encode(
        {
            "sub": "2f2be583-6b0a-4ea8-ab2b-7c478ef5c27d",
            "email": "test@example.com",
            "role": "authenticated",
        },
        settings.SUPABASE_JWT_SECRET,
        algorithm="HS256",
    )

    claims = await _decode_supabase_token(token)
    assert claims["sub"] == "2f2be583-6b0a-4ea8-ab2b-7c478ef5c27d"
    assert claims["email"] == "test@example.com"
    settings.SUPABASE_JWT_SECRET = original_secret


@pytest.mark.asyncio
async def test_decode_hs256_token_failure() -> None:
    original_secret = settings.SUPABASE_JWT_SECRET
    settings.SUPABASE_JWT_SECRET = "test-secret"
    token = jwt.encode({"sub": "abc"}, "other-secret", algorithm="HS256")

    with pytest.raises(HTTPException) as exc:
        await _decode_supabase_token(token)
    assert exc.value.status_code == 401
    settings.SUPABASE_JWT_SECRET = original_secret
