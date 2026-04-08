from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from typing import Any

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import settings

security = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AuthUser:
    id: str
    email: str | None
    role: str
    raw_claims: dict[str, Any]


class JWKSCache:
    def __init__(self) -> None:
        self._jwks: dict[str, Any] | None = None
        self._expires_at: float = 0
        self._lock = asyncio.Lock()

    async def get_jwks(self) -> dict[str, Any]:
        now = time.time()
        if self._jwks is not None and now < self._expires_at:
            return self._jwks

        async with self._lock:
            now = time.time()
            if self._jwks is not None and now < self._expires_at:
                return self._jwks

            if not settings.SUPABASE_URL:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="SUPABASE_URL is not configured",
                )

            url = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(url)
                response.raise_for_status()
                jwks = response.json()

            self._jwks = jwks
            self._expires_at = now + settings.SUPABASE_JWKS_CACHE_TTL_SECONDS
            return jwks


jwks_cache = JWKSCache()


def _unauthorized(detail: str = "Unauthorized") -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


async def _decode_supabase_token(token: str) -> dict[str, Any]:
    try:
        header = jwt.get_unverified_header(token)
        algorithm = str(header.get("alg", ""))
    except JWTError as exc:  # pragma: no cover - defensive
        raise _unauthorized("Invalid token header") from exc

    options = {"verify_aud": False}

    try:
        if algorithm == "HS256":
            if not settings.SUPABASE_JWT_SECRET:
                raise _unauthorized("SUPABASE_JWT_SECRET missing for HS256 validation")
            return jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options=options,
            )

        jwks = await jwks_cache.get_jwks()
        # Support RS256 (legacy) and ES256 (ECC P-256, default for new Supabase projects)
        return jwt.decode(token, jwks, algorithms=["RS256", "ES256"], options=options)
    except JWTError as exc:
        raise _unauthorized("Token verification failed") from exc


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> AuthUser:
    if credentials is None:
        raise _unauthorized("Missing Authorization header")
    if credentials.scheme.lower() != "bearer":
        raise _unauthorized("Authorization scheme must be Bearer")

    claims = await _decode_supabase_token(credentials.credentials)
    sub = str(claims.get("sub", ""))
    if not sub:
        raise _unauthorized("Token missing subject claim")

    return AuthUser(
        id=sub,
        email=claims.get("email"),
        role=str(claims.get("role", "authenticated")),
        raw_claims=claims,
    )


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> AuthUser | None:
    if credentials is None:
        return None
    return await get_current_user(credentials)


async def verify_token(token: str) -> AuthUser:
    """Verify a raw JWT string (used by WebSocket auth via query-param)."""
    claims = await _decode_supabase_token(token)
    sub = str(claims.get("sub", ""))
    if not sub:
        raise _unauthorized("Token missing subject claim")
    return AuthUser(
        id=sub,
        email=claims.get("email"),
        role=str(claims.get("role", "authenticated")),
        raw_claims=claims,
    )
