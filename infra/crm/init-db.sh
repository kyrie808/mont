#!/bin/bash
# Roda uma única vez, na criação do volume do Postgres.
# O compose já cria o banco `evolution` (POSTGRES_DB); aqui só falta o do n8n.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE n8n;
EOSQL
