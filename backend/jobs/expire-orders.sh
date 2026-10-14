#!/bin/sh
set -eu
# A scheduler runs this once per minute per tenant. PG_MAIN stays out of argv/logs.
: "${PG_MAIN:?Set PG_MAIN to the tenant-scoped PostgreSQL connection string}"
: "${PGOPTIONS:?Set PGOPTIONS with the tenant search_path and worker RLS context}"
export PGDATABASE="$PG_MAIN"
exec psql -X --no-password --set=ON_ERROR_STOP=1 --single-transaction \
  --command='SELECT shop_expire_pending_orders(100);'
