#!/bin/bash
# Runs once on first DB container start to enable extensions
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  CREATE EXTENSION IF NOT EXISTS "vector";
  CREATE EXTENSION IF NOT EXISTS "pg_trgm";
EOSQL

echo "PostgreSQL extensions enabled: uuid-ossp, vector, pg_trgm"
