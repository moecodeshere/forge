#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${SUPABASE_URL:-}" || -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required." >&2
  exit 1
fi

RAND_SUFFIX="$(python3 - <<'PY'
import secrets
print(secrets.token_hex(4))
PY
)"

E2E_EMAIL="forge-e2e-${RAND_SUFFIX}@example.com"
E2E_PASSWORD="ForgeE2E!${RAND_SUFFIX}A9"

CREATE_PAYLOAD="$(python3 - "$E2E_EMAIL" "$E2E_PASSWORD" <<'PY'
import json
import sys
email = sys.argv[1]
password = sys.argv[2]
print(json.dumps({"email": email, "password": password, "email_confirm": True}))
PY
)"

curl_args=(
  -sS
  -o /tmp/forge_e2e_seed_user.json
  -w "%{http_code}"
  -X POST "${SUPABASE_URL}/auth/v1/admin/users"
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}"
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
  -H "Content-Type: application/json"
  -d "${CREATE_PAYLOAD}"
)

if HTTP_CODE="$(curl "${curl_args[@]}" 2>/tmp/forge_e2e_seed_user.err)"; then
  :
elif [[ "${FORGE_ALLOW_INSECURE_E2E_SEED:-}" == "1" ]]; then
  echo "Warning: retrying E2E seed with insecure TLS (-k)." >&2
  HTTP_CODE="$(curl -k "${curl_args[@]}")"
else
  cat /tmp/forge_e2e_seed_user.err >&2
  exit 1
fi

if [[ "${HTTP_CODE}" != "200" && "${HTTP_CODE}" != "201" ]]; then
  echo "Failed to seed E2E user (HTTP ${HTTP_CODE})." >&2
  exit 1
fi

echo "E2E_EMAIL=${E2E_EMAIL}"
echo "E2E_PASSWORD=${E2E_PASSWORD}"

