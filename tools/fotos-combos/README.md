# Fotos provisórias dos combos

Monta uma foto por combo da Black com as fotos dos produtos que já estão na loja, enquanto as fotos definitivas (Flow) não chegam:

- o item principal fica atrás (balde ou baldinhos);
- os potes ficam na frente;
- o fundo é a cor areia da loja.

O resultado vai para `apps/loja/public/combos/<codigo-do-combo>.webp`, e a loja usa esse arquivo quando o combo não tem foto de capa cadastrada (`apps/loja/src/lib/vitrine/fotosProvisorias.ts`).

## Trocar pela foto definitiva

Cadastre a foto como **capa** do combo no sistema interno. A capa cadastrada sempre vence a provisória, então não precisa mexer em código.

Quando as cinco estiverem cadastradas, apague:
- `apps/loja/public/combos/`;
- a lista em `fotosProvisorias.ts`;
- esta pasta.

## Gerar de novo

Gere de novo quando a foto de algum produto mudar ou quando a composição for ajustada.

O ambiente Python fica isolado em `.venv/`, que está fora do git. Na primeira vez, o recorte baixa os modelos (~170 MB).

```powershell
cd tools/fotos-combos
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
cd ../..
tools\fotos-combos\.venv\Scripts\python tools/fotos-combos/gerar.py
```

- **Credenciais:** o script lê `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` do ambiente ou, se faltarem, de `apps/loja/.env.local`. É a chave **pública**, a mesma do navegador. O script não imprime nenhuma das duas.
- **Recortes em cache:** as fotos baixadas e os recortes ficam em `tools/fotos-combos/cache/`, fora do git. Se a foto de um produto mudou, rode com `--refazer-recortes`.
- **Composição:** a posição e o tamanho de cada item estão em `COMBOS`, dentro de `gerar.py`. Os itens são desenhados de trás para a frente.
- **Pote genérico:** Mesa Cheia, Par Mineiro e Trio Mineiro usam sempre o doce de leite 680 g como pote genérico, para não sugerir um sabor escolhido.
