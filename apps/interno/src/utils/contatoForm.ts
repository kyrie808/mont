/**
 * Mescla o estado cru do formulário com os valores já validados/transformados
 * pelo Zod, para montar o payload de contato.
 *
 * A ordem importa e é o núcleo de um bug de produção (01/08/2026): o cru entra
 * PRIMEIRO — só para preservar campos que o schema não conhece — e o parseado
 * vence em tudo que ele possui. Inverter isso desfaz as transformações do
 * schema (foi assim que o telefone voltou a ser gravado com máscara e a mesma
 * pessoa virou dois clientes).
 */
export function mesclarValoresContato<
    P extends Record<string, unknown>,
    R extends Record<string, unknown>,
>(parsed: P, raw: R): R & P {
    return { ...raw, ...parsed }
}
