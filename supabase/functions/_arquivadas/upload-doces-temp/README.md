# upload-doces-temp (arquivada)

Edge Function temporária, usada **uma única vez** para subir as fotos dos doces ao Storage.
Nunca esteve no repo.

- `index.ts` aqui é a **versão 4**, a última no ar: só responde `410 gone`. Copiada byte a byte de produção em 13/10/2026.
- As versões 1 a 3, que faziam o upload de verdade, **não são recuperáveis**: a API do Supabase só devolve o código da versão atual, e não havia cópia no repo, no histórico do git nem na pasta Kyrie.
- Antes de apagar, conferimos que nada a chamava: repo (todas as branches e o histórico), cron, funções SQL, triggers, `pg_net`, `configuracoes`, Vault e o código do catálogo.

A pasta começa com `_` (`_arquivadas`), e a CLI do Supabase ignora pastas com esse prefixo, como faz com `_shared`. Então nenhum `supabase functions deploy` a publica de novo.
