-- Auditoria das notas reais (Luccas, 15/10/2026), item 3: Brasilio (14/10 15:18) saiu
-- "aceitou", mas a frase dele é "Sim com certeza só aguardar entrar $" — compra condicionada
-- ao dinheiro entrar = adiou. Lembrete no dia da conversa + 7 (14/10 → 21/10), a mesma regra
-- do analista para adiamento sem prazo claro. A nota é reescrita na regra nova (sem
-- "confirmou pedido"; a sugestão de retomar foi NOSSA).
--
-- Efeito (simulado antes em transação descartada): card segue em_negociacao, sai da
-- aceitou_sem_venda e aparece em follow_up em 21/10. Guarda `resultado = 'aceitou'`:
-- rodar de novo não muda nada.

UPDATE public.interacoes
   SET resultado  = 'adiou',
       retomar_em = DATE '2026-10-21',
       observacao = 'Quer o pão de queijo, mas vai esperar o dinheiro entrar; sugerimos retomar quando ele quiser. Cliente: "Sim com certeza só aguardar entrar $"'
 WHERE id = '8bfbbd2d-1995-4ebf-b7e5-d6251dfc0ba3'
   AND resultado = 'aceitou';
