#!/bin/sh
set -eu
: "${POST_DB_PASSWORD:?POST_DB_PASSWORD is required}"
: "${MEDIA_DB_PASSWORD:?MEDIA_DB_PASSWORD is required}"
psql --set ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set post_password="$POST_DB_PASSWORD" --set media_password="$MEDIA_DB_PASSWORD" \
  -f /socialsync/init.sql
