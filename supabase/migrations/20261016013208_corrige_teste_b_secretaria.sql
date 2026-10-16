-- Limpeza do teste do item B (Luccas, 15/10/2026):
--   • a mensagem de teste enviada pelo LID foi gravada com acento e emoji quebrados (o
--     curl do teste, no terminal do Windows, mandou o corpo fora de UTF-8): grava o texto
--     certo na conversa e em wa_envios;
--   • a linha 9a61ab84… de wa_envio_falhas foi erro do teste (chave errada da Evolution →
--     401), não falha real de envio: sai.
-- Guardas: só os ids do teste.

UPDATE public.mensagens_whatsapp
   SET conteudo = 'Teste B da secretária: esta mensagem chegou pelo LID, depois de o telefone dar exists:false. Pode ignorar 🙂'
 WHERE message_id = '3EB05D4F57059D6F13559F';

UPDATE public.wa_envios
   SET texto = 'Teste B da secretária: esta mensagem chegou pelo LID, depois de o telefone dar exists:false. Pode ignorar 🙂'
 WHERE message_id = '3EB05D4F57059D6F13559F';

DELETE FROM public.wa_envio_falhas
 WHERE id = '9a61ab84-57c7-42e5-aad8-ada5a4b81e2e'
   AND erro LIKE '%"status":401%';
