---
name: review-compact
description: Quick code review that saves tokens. Use when user says "review", "revisar", "checar", or "está certo?".
allowed-tools: Read, Grep
---

# Compact Review

Review code changes efficiently. Output MUST be concise.

## Format

For each issue found, output exactly:

[SEVERITY] file:line — description
FIX: one-line solution

Severities: 🔴 BREAK (will crash) · 🟡 WARN (potential bug) · 🟢 STYLE (non-blocking)

## Focus On

1. Type mismatches between database.ts ↔ domain.ts ↔ mappers.ts
2. Missing React Query cache invalidation after mutations
3. Supabase queries without error handling
4. Fields that break the two-project architecture (apps/interno vs apps/catalogo)

Do NOT comment on: formatting, variable naming, import order.
Maximum output: 15 lines.

## Relação com `/code-review`

Esta skill é a checagem **barata do dia-a-dia**, focada no domínio Mont (cadeia de tipos, invalidação de cache, arquitetura dois-projetos). Para o **portão pesado antes de mergear** — revisão completa de correção, com olhos frescos — usar `/code-review`. Não são redundantes: papéis diferentes.
