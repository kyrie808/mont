# Diagnóstico Cirúrgico — Fluxo de Fiado e Vencimento

## TL;DR
A "Data de Vencimento" do fiado **é capturada e persistida com sucesso**, mas com o nome de `data_prevista_pagamento` no banco de dados e no código. Os dados trafegam perfeitamente até o frontend (via `DomainVenda`), mas morrem na renderização: nem a Lista de Vendas nem o Histórico do Cliente exibem a data de vencimento. Além disso, não existe hoje nenhuma lógica de estado "Vencido" ou "A Vencer"; os badges avaliam puramente se está `Pago` ou `Pendente`.

---

## 1. Schema atual

- **Tabela:** `public.vendas`
- **Coluna Alvo:** Não existe uma coluna chamada literalmente `data_vencimento`. A informação é armazenada na coluna `data_prevista_pagamento`.

**Evidência (Query MCP):**
```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'vendas';
```

**Resultado relevante:**
```json
[
  {"column_name":"id","data_type":"uuid","is_nullable":"NO"},
  {"column_name":"contato_id","data_type":"uuid","is_nullable":"NO"},
  {"column_name":"data","data_type":"date","is_nullable":"NO"},
  {"column_name":"forma_pagamento","data_type":"text","is_nullable":"NO"},
  {"column_name":"status","data_type":"text","is_nullable":"NO"},
  {"column_name":"pago","data_type":"boolean","is_nullable":"NO"},
  {"column_name":"data_prevista_pagamento","data_type":"date","is_nullable":"YES"}
]
```

---

## 2. Fluxo de captura

**Interface de Nova Venda (CheckoutSidebar)**
- **Path:** `d:\1. LUCCAS\aplicativos ai\mont\apps\interno\src\components\features\vendas\NovaVenda\CheckoutSidebar.tsx`
- **Comportamento:** O campo "Data de Vencimento" só é renderizado quando `formaPagamento === 'fiado'`. Ele atua sobre a chave `data_prevista_pagamento` do formulário. Há um efeito invisível que, ao selecionar Fiado, automaticamente ajusta a data para `hoje + 30 dias`.

**Trecho de Código (CheckoutSidebar.tsx, linha 79-85):**
```tsx
    // Update data_prevista_pagamento automatically for Fiado
    useEffect(() => {
        if (formaPagamento === 'fiado') {
            setValue('data_prevista_pagamento', addDays(new Date(), 30).toISOString())
        } else {
            setValue('data_prevista_pagamento', null)
        }
    }, [formaPagamento, setValue])
```

**Validação (Zod Schema)**
- **Path:** `d:\1. LUCCAS\aplicativos ai\mont\apps\interno\src\schemas\venda.ts`
- **Comportamento:** É optional/nullable na base, mas se a forma de pagamento for `fiado`, o `refine` do Zod torna a `data_prevista_pagamento` estritamente obrigatória.

**Trecho de Código (venda.ts, linha 23-32):**
```typescript
    data_prevista_pagamento: z.string().optional().nullable(),
}).refine((data) => {
    if (data.forma_pagamento === 'fiado' && !data.data_prevista_pagamento) {
        return false
    }
    return true
}, {
    message: "Informe a data prevista de pagamento para vendas fiado",
    path: ["data_prevista_pagamento"],
})
```

**Persistência (vendaService)**
- **Path:** `d:\1. LUCCAS\aplicativos ai\mont\apps\interno\src\services\vendaService.ts`
- **Comportamento:** O payload recebe o dado com sucesso e o insere em `data_prevista_pagamento`. Não há perda de dados.

**Trecho de Código (vendaService.ts, linha 123-132):**
```typescript
        const vInsert: VendaInsert = {
            contato_id: data.contatoId,
            data: data.data,
            // ...
            forma_pagamento: data.formaPagamento,
            data_prevista_pagamento: data.dataPrevistaPagamento,
            // ...
        }
```

---

## 3. Fluxo de display — lista de vendas

**Renderização do Card Intefaz**
- **Path do componente da lista (referência implícita):** Usa o hook `useVendas`, que chama `vendaService.getVendas(...)`. Este método executa um `from('vendas').select('*, ...')`, o que garante que `data_prevista_pagamento` desce para o front-end e o mapper `toDomainVenda` joga isso em `venda.dataPrevistaPagamento` corretamente.
- **Path do Card de Venda:** `d:\1. LUCCAS\aplicativos ai\mont\apps\interno\src\components\features\vendas\VendaCard.tsx`

**Comportamento:** O dado chega via prop `venda: DomainVenda` mas é **ignorado**. O badge de pagamento se baseia estritamente em uma validação boleana, sem contexto de prazo/vencimento. A data mostrada é sempre `venda.data` (data em que a venda ocorreu).

**Trecho de Código - Decisão do Badge (VendaCard.tsx, linhas 47-54):**
```tsx
                        {/* Payment Status */}
                        <div className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border shadow-sm",
                            (venda.pago || venda.valorPago >= venda.total)
                                ? "bg-success/10 text-success-foreground border-success/20 dark:bg-success/20 dark:text-success dark:border-success/30"
                                : "bg-warning/10 text-yellow-700 border-warning/20 dark:bg-warning/20 dark:text-warning dark:border-warning/30"
                        )}>
                            <DollarSign className="h-3.5 w-3.5" />
                            <span>{(venda.pago || venda.valorPago >= venda.total) ? 'Pago' : 'Pagamento Pendente'}</span>
                        </div>
```

---

## 4. Fluxo de display — histórico do cliente

**Renderização do Histórico e Receibos**
- **Path Histórico Geral:** `d:\1. LUCCAS\aplicativos ai\mont\apps\interno\src\components\features\contatos\detalhe\VendasHistory.tsx`
- **Path do Item Individual:** Componente interno `ReceiptCard` contido no arquivo `VendasHistory.tsx`.
- **Query/hook:** Usa `useVendas({ excludeCatalogo: true })` e filtra localmente pelo ID do cliente (`todasVendas.filter(v => v.contatoId === contatoId)`).

**Comportamento:** Da mesma forma, `dataPrevistaPagamento` chega até aqui, mas o componente internaliza o status ignorando a data. 

**Trecho de Código - Decisão do Badge (VendasHistory.tsx, linhas 28-32):**
```tsx
                    {venda.pago ? (
                        <span className="bg-semantic-green/10 text-semantic-green text-[10px] font-bold px-2 py-0.5 rounded uppercase border border-semantic-green/20">Pago</span>
                    ) : (
                        <span className="bg-semantic-yellow/10 text-semantic-yellow text-[10px] font-bold px-2 py-0.5 rounded uppercase border border-semantic-yellow/20">A Receber</span>
                    )}
```

---

## 5. Gaps e inconsistências

1. **A data é lida, mas descartada na renderização:** A modelagem carrega perfeitamente a propriedade `venda.dataPrevistaPagamento` no mappers (linha 176 em `mappers.ts`), mas todo lugar que consome `DomainVenda` omite essa chave. 
2. **Inexistência do estado "Vencido" ou "A Vencer":** O sistema tem uma visão binária para fiado: "A Receber/Pendente" ou "Pago" (`VendaCard.tsx` linha 54 e `VendasHistory.tsx` linha 31). A condição de transbordamento de data (vencimento já passou e ainda não pagou) não existe na UI atual.
3. **Ausência de badges derivados de tempo:** O badge não só é hardcoded para refletir o status de pagamento `(venda.pago)` como não interage com o dia atual de forma condicional.
4. Nenhuma inconsistência grave de Tipagem / Any encontrada especificamente nesse funil. O contrato via zod -> domínio está sólido.

---

## 6. Perguntas em aberto

1. Uma vez que formos exibir "Vencimento: X" no Card e no Histórico, essa informação deve substituir a "Data da venda" `formatDate(venda.data)` **ou** devemos apresentar as duas (Data da venda e Data de Vencimento) para fins de clareza?
2. Precisamos implementar o estado visual vermelho/danger para pagamentos indicados como "**Vencidos**" (onde `data_prevista_pagamento < Date.now()` e `venda.pago === false`)?
3. Para vendas passadas (vendas antigas onde fiado foi marcado, porém `data_prevista_pagamento` pode estar nula no banco porque era *nullable* na criação inicialmente ou por conta de bypass antigo): A regra de fallback ao exibir deve ser silenciosa (ocultar vencimento) ou devemos assumir um prazo retrospectivo genérico?
4. Devemos trazer as "Vendas Vencidas" ou de fiados como um filtro rápido/badge à parte nos relatórios do Dashboard posteriormente, dado que o `DomainVenda` já suporta o rastreio?

---

## 7. Fora de escopo, mas notado

- O serviço de KPI `vendaService.calculateKPIs` filtra a métrica "A Receber" descartando brindes e canceladas, mas é completamente cego ao vencimento (não te avisa sobre inadimplência explícita vencida, só joga no bolo todo de "A Receber").
- O módulo `ContasAPagar` parece possuir alarmes específicos de vencimento em seus próprios hooks, mas `vendas` / Fiado em si (que é "Contas A Receber") ainda está bem passivo.

---

## 8. Limitações do diagnóstico

- O `useVendas` principal pode conter lógicas secundárias que afetam a performance quando os arrays processam datas no layout, porém as consultas atômicas confirmam a passagem dos dados via supabase `toDomainVenda`. 
- Não fiz query de amostra viva nas vendas reais do banco (tipo `SELECT * FROM vendas LIMIT 10`) para ver possíveis nulls herdados do passado via MCP para não comprometer / expor dados e priorizar o fluxo da arquitetura, mas assumo a coerência pela estrutura da tabela.
