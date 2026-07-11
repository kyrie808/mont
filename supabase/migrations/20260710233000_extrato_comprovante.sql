-- Admin vê o comprovante do repasse no extrato: expõe lancamentos.comprovante_url
-- na view_extrato_mensal. ⚠️ Preserva security_invoker=on (o CREATE OR REPLACE VIEW
-- reseta essa opção se não for reafirmada — footgun conhecido).
-- Backup: dump-schema/-data-20260710 (extrato_comprovante).

CREATE OR REPLACE VIEW public.view_extrato_mensal WITH (security_invoker = on) AS
 SELECT combined.data,
    combined.descricao,
    combined.tipo,
    combined.valor,
    COALESCE(pc.categoria,
        CASE
            WHEN combined.origem = 'compra_fabrica'::text THEN 'variavel'::text
            WHEN combined.origem = 'venda'::text THEN 'Vendas'::text
            ELSE 'Sem categoria'::text
        END) AS categoria_tipo,
    COALESCE(pc.nome,
        CASE
            WHEN combined.origem = 'compra_fabrica'::text THEN 'Compra Fábrica'::text
            WHEN combined.origem = 'venda'::text THEN 'Venda'::text
            ELSE 'Sem categoria'::text
        END) AS categoria_nome,
    combined.origem,
    combined.id,
    combined.conta_id,
    combined.comprovante_url
   FROM ( SELECT l.data,
            l.descricao,
            l.tipo,
                CASE
                    WHEN l.tipo = 'saida'::text THEN - l.valor
                    ELSE l.valor
                END AS valor,
            l.plano_conta_id,
            l.origem,
            l.id::text AS id,
            l.conta_id,
            l.comprovante_url
           FROM lancamentos l
        UNION ALL
         SELECT pop.payment_date::date AS payment_date,
            'Pgto Fábrica: '::text || COALESCE(c.nome, 'PO'::text),
            'saida'::text,
            - pop.amount,
            pcf.id,
            'compra_fabrica'::text,
            pop.id::text AS id,
            pop.conta_id,
            NULL::text AS comprovante_url
           FROM purchase_order_payments pop
             JOIN purchase_orders po ON po.id = pop.purchase_order_id
             LEFT JOIN contatos c ON c.id = po.fornecedor_id
             LEFT JOIN plano_de_contas pcf ON pcf.codigo = 'COMPRA_FABRICA'::text) combined
     LEFT JOIN plano_de_contas pc ON pc.id = combined.plano_conta_id;
