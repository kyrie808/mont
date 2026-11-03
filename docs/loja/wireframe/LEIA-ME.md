# Wireframe — como ler estes arquivos

Cópia do canvas de design aprovado (https://claude.ai/artifact/E2KTqtUQ6NXazo9N6GxsY8), 29/10/2026.
Cada `.dc.html` é **uma tela de celular de 390 px de largura**. A ordem e o nome de cada tela estão em `canvas.json` (`boards` e `order`). As regras das notas amarelas (`notes`) estão no `BRIEFING.md`, seção 6.

O formato é HTML com um runtime próprio do editor de design. Não é para rodar, e sim para ler como especificação:

- **`style="…"` inline** = especificação visual exata: espaçamentos, tamanhos, raios, cores, fontes. Reproduza com Tailwind.
- **`<helmet><style>`** = classes repetidas (`.ph` = placeholder de foto, `.add` = botão Adicionar, `.step`/`.st` = seletor − n +, `.chip` = filtro de categoria).
- **`{{nome}}`** = valor vindo de `renderVals()` no `<script>` no fim do arquivo.
- **`renderVals()`** = dados de exemplo + lógica de estado da tela (quantidades, contador 0/6, método de pagamento selecionado). A lógica vale; os dados de produto são exemplo.
- **`<sc-for list="{{x}}" as="item">`** = lista (map).
- **`<sc-if value="{{cond}}">`** = renderização condicional.
- **`onClick="{{fn}}"`** = handler.
- **`href="Outra.dc.html"`** = navegação para aquela tela (mapeamento de rotas no `BRIEFING.md`, seção 4).
- **`./support.js`** = runtime do editor; ignore.

Paleta usada (guia Mont):

| Uso | Cor |
|---|---|
| Fundo creme | `#FAF7F2` |
| Texto marrom | `#2C1810` |
| Marrom médio | `#3D2B22` |
| Texto secundário | `#6B5A4E` |
| Linhas | `#E6DDD2` |
| Placeholder | `#EFE7DC` |
| Borda tracejada | `#C9B9A6` |
| CTA laranja (texto marrom sobre ele) | `#E8923A` |
| Verde de confirmação | `#2E7D32` |

Fontes:

| Uso | Fonte |
|---|---|
| Títulos | Anton |
| Corpo | DM Sans |
| Frase de apoio | Instrument Serif itálico |
