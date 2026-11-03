/**
 * Aba Produtos (03/11/2026): desativado fica fora da lista por padrão; "Mostrar desativados"
 * traz de volta. Desativado com venda não é apagado (o histórico aponta para ele).
 */
export function produtosDoCadastro<T extends { ativo: boolean }>(produtos: T[], mostrarDesativados: boolean): T[] {
    return mostrarDesativados ? produtos : produtos.filter((p) => p.ativo)
}
