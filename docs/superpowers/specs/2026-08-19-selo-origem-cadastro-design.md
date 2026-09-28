# Selo de origem do cadastro + fila "Novos da IA"

**Data:** 19/08/2026
**Origem:** o Gilmar levou um 409 ao cadastrar a "Najla". O número já era do contato
"♡ Cadonhoto ♡", que a secretária de WhatsApp tinha criado sozinha dois dias antes com
o push name do aparelho. Ele não tinha como saber: nada na base distingue um contato que
ele digitou de um que a IA capturou.

## Problema

`contatos` não guarda **por qual porta o cadastro entrou**. O único sinal disponível hoje,
`created_by IS NULL`, pega 356 contatos — a base velha inteira desde dez/2025 — dos quais
só 7 vieram da secretária. Não serve de filtro.

A coluna `origem` não resolve: ela responde outra pergunta ("como o cliente te achou":
direto/indicação/anúncio/catálogo). São ortogonais — a Najla é `origem = 'indicacao'` e
entrou pela porta do WhatsApp. Sobrecarregar `origem` com procedência de cadastro
corromperia o ROAS, que lê essa coluna.

## Decisões

### 1. `contatos.origem_cadastro` — o selo permanente

`text NOT NULL DEFAULT 'manual'`, `CHECK IN ('manual','whatsapp','catalogo')`.

As 4 portas de escrita passam a declarar a sua:

| porta | arquivo | selo |
|---|---|---|
| interno | `apps/interno/src/services/contatoService.ts` | `manual` (herda o default) |
| interno (cadastro rápido) | `components/features/vendas/NovaVenda/ClientSelector.tsx` | `manual` (herda o default) |
| secretária | `supabase/functions/whatsapp-ingestor/index.ts` | `whatsapp` |
| catálogo público | RPC `criar_pedido` | `catalogo` |
| admin do catálogo | `apps/catalogo/src/app/api/admin/pedidos/[id]/route.ts` | `catalogo` |

**Backfill:**

| selo | regra | qtd |
|---|---|---|
| `whatsapp` | `created_by IS NULL AND origem <> 'catalogo' AND criado_em >= '2026-08-12'` | 7 |
| `catalogo` | `created_by IS NULL AND origem = 'catalogo'` | 17 |
| `manual` | o resto, incluindo os 356 da base velha | ~782 |

Os 356 da base velha ficam como `manual` por decisão do diretor: foram digitados por humano
na migração, então o selo não mente.

**Trade-off aceito:** com `DEFAULT 'manual'`, uma porta automática nova que esqueça de
declarar entra como "manual" em silêncio. A alternativa (sem default, `NOT NULL` obrigando
toda porta a declarar) falha alto — mas um deploy fora de ordem da RPC quebraria o checkout
do catálogo, que é receita. Escolhido o lado seguro.

### 2. `contatos.revisado_em` — o que faz a fila esvaziar

`timestamptz NULL`, carimbado por trigger `BEFORE UPDATE` quando `auth.uid() IS NOT NULL`
e a coluna ainda estiver nula: o instante em que um humano salva o contato pela primeira vez.

**Por que não reusar `updated_by`, que já existe.** O `whatsapp-ingestor` atualiza
`ultimo_contato` a cada mensagem nova rodando como service role, e o trigger
`handle_audit_fields` regrava `updated_by = auth.uid()` — que nesse contexto é NULL.
O Gilmar arrumaria a Najla hoje e ela voltaria pra fila amanhã, na primeira mensagem dela.
`revisado_em` só anda pra frente.

### 3. UI — 6º chip "Novos da IA"

Um item novo em `storyItems` (`apps/interno/src/pages/Contatos.tsx`), que flui de graça pro
carrossel do mobile (`ContactStoryFilter`) e pras tabs do desktop (`ContatosFilterTabs`).

- Mostra a **fila**: `origem_cadastro = 'whatsapp' AND revisado_em IS NULL`.
  **Corrigido durante a implementação:** a regra escrita aqui era `<> 'manual'`, o que
  arrastaria os 17 do catálogo pra fila. Mas quem se cadastra no site digita o próprio
  nome e endereço reais — não há o que conferir. Incluí-los inventaria 17 tarefas
  inexistentes e a fila nunca esvaziaria. O chip aprovado já dizia 7, não 24.
- Só aparece quando a contagem é > 0 — barra intocada no dia a dia.
- Filtro client-side, igual aos outros (a lista já vem inteira do servidor).

**Mobile:** o diretor autorizou explicitamente esta mudança no mobile ao escolher esta opção
(19/08/2026), abrindo exceção pontual ao "mobile é sagrado".

### 4. O selo é do servidor, não do cliente

`CreateContato`/`UpdateContato` excluem `origemCadastro` e `revisadoEm` por `Omit`. Quem
manda neles é o banco (DEFAULT + gatilho). Sem isso, uma tela poderia carimbar o próprio
selo e um contato digitado à mão se declararia "capturado pela IA".

Descoberto na implementação: existe uma **5ª porta** que o levantamento inicial não
pegou — o cadastro rápido dentro do Nova Venda (`ClientSelector`). Ela chama o mesmo
`contatoService.create`, então herda o default corretamente; quem revelou foi o
`tsc -b` do build, que reprova o que o `tsc --noEmit` deixou passar.

## Fora de escopo

- Detectar a colisão no modal e oferecer "abrir o contato existente" (a dor original da
  Najla). Vale, mas é outra onda.
- Filtro cruzado por porta (Manual/WhatsApp/Catálogo separados) — o chip único da fila
  resolve a necessidade declarada. YAGNI até provar o contrário.

## Verificação

- Migration versionada + backup (`supabase/scripts/dump-prod.ps1`) antes de aplicar — Regra #3.
- Teste do trigger de `revisado_em` via DO-block com RAISE (rollback), sem sujar a prod.
- Teste de unidade da contagem/filtro do chip.
- `tsc --noEmit` + suíte unitária verdes nos dois apps.
