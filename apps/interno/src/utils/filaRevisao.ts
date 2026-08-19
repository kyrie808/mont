import type { DomainContato } from '../types/domain'

/** O mínimo que a fila precisa saber de um contato. */
type Revisavel = Pick<DomainContato, 'origemCadastro' | 'revisadoEm'>

/**
 * `true` quando a secretária de WhatsApp criou o contato e nenhum humano conferiu ainda.
 *
 * Esses cadastros nascem com o *push name* do aparelho — "♡ Cadonhoto ♡", "🦋", ou o
 * próprio número quando a pessoa não tem nome no perfil — e sem endereço. São contatos
 * reais, mas ninguém os reconhece na lista. Em 19/08/2026 isso custou um 409: o Gilmar
 * tentou cadastrar a "Najla" sem saber que ela já estava lá como "♡ Cadonhoto ♡".
 *
 * **Por que só `whatsapp` e não todo cadastro automático.** O catálogo também cria
 * contato sozinho, mas o cliente digita lá o próprio nome e endereço de verdade — não
 * há o que conferir. Botar os 17 do catálogo na fila inventaria 17 tarefas que não
 * existem, e a fila deixaria de esvaziar.
 *
 * O contato sai daqui sozinho: `revisado_em` é carimbado pelo gatilho
 * `tr_contatos_revisado` no instante em que um humano salva o cadastro.
 */
export function precisaRevisao(contato: Revisavel): boolean {
    return contato.origemCadastro === 'whatsapp' && !contato.revisadoEm
}
