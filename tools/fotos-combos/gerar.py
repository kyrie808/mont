"""
Fotos PROVISÓRIAS dos combos da Black: composição automática com as fotos dos produtos da loja.
Item principal atrás (balde/baldinhos), potes na frente, fundo areia da loja, sombra de contato.

Passos (cada um com cache em tools/fotos-combos/cache/, fora do git):
  1. baixa a foto de capa de cada produto (cat_imagens_produto, pelo código do produto);
  2. recorta o fundo com rembg (modelo por item, ver RECORTE);
  3. monta uma imagem 1200x1200 por combo e grava em apps/loja/public/combos/<codigo>.webp.

Uso (da raiz do repositório): python tools/fotos-combos/gerar.py [--refazer-recortes]
Ver tools/fotos-combos/README.md.
"""
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter
from rembg import new_session, remove

RAIZ = Path(__file__).resolve().parents[2]
CACHE = Path(__file__).resolve().parent / 'cache'
SAIDA = RAIZ / 'apps' / 'loja' / 'public' / 'combos'

LADO = 1200
AREIA = (239, 231, 220)
CREME = (250, 247, 242)

# Nome curto usado na composição -> código do produto no sistema.
PRODUTOS = {
    'balde4': 'balde_pao_queijo_4kg',
    'baldinho': 'balde_pao_queijo_1kg',
    'doce680': 'doce_leite_tradicional_680g',  # o "pote de doce genérico" (não é o sabor escolhido)
    'doce400': 'doce_leite_tradicional_400g',
    'geleia_morango': 'geleia_morango_680g',
    'doce_zero': 'doce_leite_zero_400g',
    'brigadeiro_zero': 'brigadeiro_zero_400g',
}

# Modelo de recorte por item. O balde é branco no fundo cinza-claro: o birefnet acerta a alça;
# o isnet deixava uma mancha. Os potes de vidro saem melhor no isnet.
RECORTE = {'balde4': 'birefnet-general-lite'}
RECORTE_PADRAO = 'isnet-general-use'

# (item, altura em px, centro x, linha da base em px); desenhados de trás para a frente.
COMBOS = {
    'combo_black_familia': [
        ('baldinho', 440, 235, 930),
        ('baldinho', 440, 965, 930),
        ('balde4', 800, 600, 960),
        ('doce680', 370, 330, 1150),
        ('doce680', 390, 600, 1170),
        ('doce680', 370, 870, 1150),
    ],
    'combo_black_balde_doce': [
        ('balde4', 880, 470, 1060),
        ('doce680', 540, 860, 1150),
    ],
    'combo_black_3_doces': [
        ('doce680', 640, 600, 1020),
        ('doce680', 600, 330, 1140),
        ('doce680', 600, 870, 1140),
    ],
    'combo_black_cafe_da_tarde': [
        ('baldinho', 500, 330, 1000),
        ('baldinho', 500, 870, 1000),
        ('geleia_morango', 560, 500, 1150),
        ('doce400', 470, 770, 1160),
    ],
    'combo_black_dupla_zero': [
        ('doce_zero', 740, 420, 1110),
        ('brigadeiro_zero', 700, 800, 1140),
    ],
}


def credenciais() -> tuple[str, str]:
    """URL e chave PÚBLICA (anon) do Supabase: do ambiente ou de apps/loja/.env.local. Nada é impresso."""
    url = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
    chave = os.environ.get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    env_local = RAIZ / 'apps' / 'loja' / '.env.local'
    if (not url or not chave) and env_local.exists():
        for linha in env_local.read_text(encoding='utf-8-sig').splitlines():
            nome, _, valor = linha.strip().removeprefix('export ').partition('=')
            valor = valor.strip().strip('"').strip("'")
            if nome.strip() == 'NEXT_PUBLIC_SUPABASE_URL' and not url:
                url = valor
            if nome.strip() == 'NEXT_PUBLIC_SUPABASE_ANON_KEY' and not chave:
                chave = valor
    if not url or not chave:
        sys.exit('Faltam NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY (ambiente ou apps/loja/.env.local).')
    return url.rstrip('/'), chave


def capas(url: str, chave: str) -> dict[str, str]:
    """codigo -> url da foto de capa (tipo 'cover'; senão a de menor ordem), como a loja escolhe."""
    codigos = ','.join(PRODUTOS.values())
    consulta = urllib.parse.urlencode({
        'select': 'url,tipo,ordem,produto:produtos!inner(codigo)',
        'ativo': 'eq.true',
        'produto.codigo': f'in.({codigos})',
        'order': 'ordem',
    })
    req = urllib.request.Request(f'{url}/rest/v1/cat_imagens_produto?{consulta}', headers={'apikey': chave, 'Authorization': f'Bearer {chave}'})
    linhas = json.load(urllib.request.urlopen(req))
    escolha: dict[str, str] = {}
    for l in linhas:
        codigo = l['produto']['codigo']
        if codigo not in escolha or l['tipo'] == 'cover':
            escolha[codigo] = l['url']
    faltando = set(PRODUTOS.values()) - set(escolha)
    if faltando:
        sys.exit(f'Sem foto ativa para: {sorted(faltando)}')
    return escolha


def recortes(refazer: bool) -> None:
    (CACHE / 'originais').mkdir(parents=True, exist_ok=True)
    (CACHE / 'recortes').mkdir(parents=True, exist_ok=True)
    pendentes = [n for n in PRODUTOS if refazer or not (CACHE / 'recortes' / f'{n}.png').exists()]
    if not pendentes:
        return
    url, chave = credenciais()
    fotos = capas(url, chave)
    sessoes: dict[str, object] = {}
    for nome in pendentes:
        original = CACHE / 'originais' / nome
        urllib.request.urlretrieve(fotos[PRODUTOS[nome]], original)
        modelo = RECORTE.get(nome, RECORTE_PADRAO)
        sessao = sessoes.setdefault(modelo, new_session(modelo))
        recorte = remove(Image.open(original).convert('RGB'), session=sessao, post_process_mask=True)
        caixa = recorte.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
        recorte.crop(caixa).save(CACHE / 'recortes' / f'{nome}.png')
        print(f'recorte {nome} ({modelo})')


def fundo() -> Image.Image:
    """Areia com o centro um pouco mais claro (luz suave de estúdio), sem textura."""
    base = Image.new('RGB', (LADO, LADO), AREIA)
    luz = Image.new('L', (LADO, LADO), 0)
    ImageDraw.Draw(luz).ellipse((150, 50, LADO - 150, LADO - 250), fill=150)
    luz = luz.filter(ImageFilter.GaussianBlur(220))
    return Image.composite(Image.new('RGB', (LADO, LADO), CREME), base, luz)


def sombra(canvas: Image.Image, cx: int, base_y: int, largura: int) -> None:
    """Sombra de contato: elipse baixa e desfocada sob o item."""
    camada = Image.new('L', (LADO, LADO), 0)
    ImageDraw.Draw(camada).ellipse((cx - largura * 0.48, base_y - 22, cx + largura * 0.48, base_y + 18), fill=120)
    camada = camada.filter(ImageFilter.GaussianBlur(18))
    canvas.paste(Image.new('RGB', (LADO, LADO), (120, 95, 75)), (0, 0), camada.point(lambda a: int(a * 0.55)))


def compor(itens) -> Image.Image:
    canvas = fundo()
    for nome, altura, cx, base_y in itens:
        img = Image.open(CACHE / 'recortes' / f'{nome}.png').convert('RGBA')
        largura = round(img.width * altura / img.height)
        img = img.resize((largura, altura), Image.LANCZOS)
        sombra(canvas, cx, base_y, largura)
        canvas.paste(img, (cx - largura // 2, base_y - altura), img)
    return canvas


def main() -> None:
    recortes(refazer='--refazer-recortes' in sys.argv)
    SAIDA.mkdir(parents=True, exist_ok=True)
    for codigo, itens in COMBOS.items():
        destino = SAIDA / f'{codigo}.webp'
        compor(itens).save(destino, 'WEBP', quality=82, method=6)
        print(f'{destino.relative_to(RAIZ)}  {destino.stat().st_size // 1024} KB')


if __name__ == '__main__':
    main()
