-- Origem "WhatsApp": quem apareceu sozinho na conversa.
--
-- PROBLEMA: o `whatsapp-ingestor` gravava `origem = 'direto'` em todo estranho que
-- mandasse mensagem. Só que `'direto'` NÃO é balde neutro — é a venda que nasce da
-- atitude do Gilmar de vender/prospectar (definição do diretor, 20/08/2026). Estampar
-- isso em quem chegou por conta própria credita a ele um trabalho que não houve, e
-- infla justamente o número que mede a prospecção dele. Com a secretária capturando
-- gente todo dia, a mistura só cresceria.
--
-- A tabela `origens` não tinha nenhuma opção honesta pra "apareceu na conversa e não
-- sabemos como chegou" — podia ser a sacola, um post, um amigo que passou o número.
-- Agora tem. Quando descobrirem a origem real, o contato é editado na mão.

INSERT INTO public.origens (slug, label, ordem, ativo)
VALUES ('whatsapp', 'WhatsApp', 8, true)
ON CONFLICT (slug) DO NOTHING;

-- Os contatos que o ingestor criou e carimbou 'direto' sozinho. Ninguém escolheu esse
-- valor num dropdown: ele foi o default do código, e o default estava errado.
--
-- Este UPDATE mexe em `origem`, então vale registrar por que é seguro: os gatilhos
-- `trg_contato_entrada_anuncio` e `trg_enfileirar_lead_meta` disparam em
-- `UPDATE OF origem`, mas ambos abrem com `IF origem = 'anuncio'`. O valor novo é
-- 'whatsapp' — nenhum evento é enfileirado pra CAPI da Meta.
UPDATE public.contatos
   SET origem = 'whatsapp'
 WHERE origem_cadastro = 'whatsapp'
   AND origem = 'direto';
