-- 5 saudações automáticas da Mont (interactiveMessage com o botão "ver catálogo", fromMe =
-- true) entraram pelo resgate de histórico como "entrada" e com o texto do cliente no lugar
-- do conteúdo. Correção pedida pelo Luccas em 15/10/2026: direção = saida, conteúdo = o texto
-- da saudação (o corpo da mensagem interativa).
--
-- Sem efeito colateral: mensagens_whatsapp não tem trigger; as 5 são `historico` (o analista
-- não lê), então não geram interação; ultimo_contato fica em contatos e não é tocado.
-- Guardas: só os 5 ids, só se ainda estiverem como entrada — rodar de novo não muda nada.

UPDATE public.mensagens_whatsapp
   SET direcao  = 'saida',
       conteudo = payload -> 'message' -> 'interactiveMessage' -> 'body' ->> 'text'
 WHERE message_id IN (
         'AC66E5F0BE0170F1E95BA0D32F996768',
         'ACFC865C7BCCE012303D9A46920E54C9',
         'AC1A3E0AC1E6D4527D10F3A02BEB3055',
         'AC444839B0A7B58707D74E4D8BC3F5C6',
         'AC3362DBED0A29B49C1C919F38486669'
       )
   AND direcao = 'entrada'
   AND payload -> 'key' ->> 'fromMe' = 'true'
   AND payload -> 'message' -> 'interactiveMessage' -> 'body' ->> 'text' IS NOT NULL;
