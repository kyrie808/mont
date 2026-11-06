// Paridade app × banco do segmento, termômetro e origem de TODOS os contatos.
//
// Compara, contato por contato, as funções TypeScript reais do interno com a
// fn_contatos_segmento (migração 20261106215818), na MESMA data de referência (o dia de São Paulo):
//   classificarContato(contato, contato_compras_resumo)        × segmento         (hoje, hoje-30, hoje+30, hoje+100)
//   temperaturaCliente(linha da view_relacionamento_kanban)   × temperatura e temperatura_ordem
//   origemBadge(origem, fonte).label                         × origem_rotulo
//   precisaRevisao(contato)                                  × precisa_revisao
//   resumo e ritmo (compras, gasto, última, métricas)        × colunas da função
//   conversões de indicação como o useIndicacoes contava     × contagem pela função
// e confere que a view_contatos_segmento = fn_contatos_segmento(dia de São Paulo).
//
// Nada é gravado: o lote roda numa transação que SEMPRE termina em RAISE (rollback).
// Sem flag, a migração é criada dentro dessa transação e some junto. Com --aplicada, usa a já aplicada.
//
// Uso (da raiz do repo; Node ≥ 22.18, que importa .ts direto):
//   node supabase/tests/contatos_segmento_paridade.mjs [--aplicada]
// Rodar entre 00h e 21h de São Paulo: a view_relacionamento_kanban usa CURRENT_DATE (UTC);
// fora dessa janela as duas datas diferem e o lote aborta.

import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const util = (f) => import(new URL(`file:///${path.join(raiz, 'apps/interno/src/utils', f).replace(/\\/g, '/')}`).href)
const { classificarContato } = await util('segmentoCliente.ts')
const { temperaturaCliente, TEMPERATURA_ORDEM } = await util('temperaturaCliente.ts')
const { origemBadge } = await util('origemContato.ts')
const { precisaRevisao } = await util('filaRevisao.ts')

const aplicada = process.argv.includes('--aplicada')
const migracao = aplicada ? '' : readFileSync(path.join(raiz, 'supabase/migrations/20261106215818_contatos_segmento.sql'), 'utf8')

const ritmoJson = (a) => `jsonb_build_object('tp', ${a}.total_pedidos, 'im', ${a}.intervalo_medio, 'at', ${a}.atraso, 'su', ${a}.sumido, 'ds', ${a}.dias_sem_compra)`
const lote = `${migracao}
DO $p$
DECLARE
    v_sp date := (now() at time zone 'America/Sao_Paulo')::date;
    v jsonb;
BEGIN
    IF current_date <> v_sp THEN
        RAISE EXCEPTION 'FORA_DA_JANELA: data do servidor % diferente da de Sao Paulo % (rodar entre 00h e 21h)', current_date, v_sp;
    END IF;
    SELECT jsonb_build_object(
        'hoje', v_sp,
        'total_contatos', (SELECT count(*) FROM public.contatos),
        'total_view', (SELECT count(*) FROM public.view_contatos_segmento),
        'linhas', jsonb_agg(jsonb_build_object(
            'id', c.id, 'tipo', c.tipo, 'status', c.status, 'origem', c.origem, 'fonte', c.fonte,
            'oc', c.origem_cadastro, 'rv', c.revisado_em, 'ip', c.indicado_por_id,
            'r', CASE WHEN r.contato_id IS NULL THEN NULL
                      ELSE jsonb_build_object('n', r.total_compras, 'g', r.total_gasto, 'u', r.ultima_compra) END,
            'k', CASE WHEN k.contato_id IS NULL THEN NULL ELSE ${ritmoJson('k')} END,
            'f', jsonb_build_object('seg', f.segmento, 'temp', f.temperatura, 'tord', f.temperatura_ordem,
                                    'orot', f.origem_rotulo, 'prv', f.precisa_revisao,
                                    'n', f.total_compras, 'g', f.total_gasto, 'u', f.ultima_compra,
                                    'tp', f.total_pedidos, 'im', f.intervalo_medio, 'at', f.atraso,
                                    'su', f.sumido, 'ds', f.dias_sem_compra),
            'sm30', fm30.segmento, 's30', f30.segmento, 's100', f100.segmento,
            'vw', jsonb_build_object('seg', vw.segmento, 'temp', vw.temperatura)
        ))
    ) INTO v
    FROM public.contatos c
    LEFT JOIN public.contato_compras_resumo r   ON r.contato_id = c.id
    LEFT JOIN public.view_relacionamento_kanban k ON k.contato_id = c.id
    LEFT JOIN public.fn_contatos_segmento(v_sp)       f    ON f.contato_id = c.id
    LEFT JOIN public.fn_contatos_segmento(v_sp - 30)  fm30 ON fm30.contato_id = c.id
    LEFT JOIN public.fn_contatos_segmento(v_sp + 30)  f30  ON f30.contato_id = c.id
    LEFT JOIN public.fn_contatos_segmento(v_sp + 100) f100 ON f100.contato_id = c.id
    LEFT JOIN public.view_contatos_segmento vw ON vw.contato_id = c.id;

    RAISE EXCEPTION 'PARIDADE|%|FIM', v;
END
$p$;
`

const arquivo = path.join(mkdtempSync(path.join(tmpdir(), 'paridade-')), 'lote.sql')
writeFileSync(arquivo, lote)
const r = spawnSync(`npx supabase db query --linked --agent no -f "${arquivo}"`, { cwd: raiz, shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const saida = `${r.stdout}\n${r.stderr}`
const m = saida.match(/PARIDADE\|([\s\S]*)\|FIM/)
if (!m) {
    console.error('O lote não devolveu o resultado esperado:\n' + saida.slice(0, 3000))
    process.exit(2)
}
let bruto = m[1]
let dados
try { dados = JSON.parse(bruto) } catch { dados = JSON.parse(JSON.parse(`"${bruto}"`)) }

const [y, mo, d] = dados.hoje.split('-').map(Number)
const dia = (delta) => new Date(y, mo - 1, d + delta, 12, 0, 0)
const num = (x) => (x === null || x === undefined ? null : Number(x))

const contagem = () => ({ todos: 0, cliente: 0, lead: 0, vip: 0, inativo: 0, fornecedor: 0, novosIa: 0 })
const antes = contagem(), depois = contagem()
const temps = { antes: {}, depois: {} }
const diferencas = []
const dif = (id, campo, app, banco) => diferencas.push({ id, campo, app, banco })

for (const l of dados.linhas) {
    const resumo = l.r ? { totalCompras: num(l.r.n) || 0, totalGasto: num(l.r.g) || 0, ultimaCompra: l.r.u } : undefined
    const contato = { tipo: l.tipo, status: l.status }

    const seg = classificarContato(contato, resumo, dia(0))
    if (seg !== l.f.seg) dif(l.id, 'segmento', seg, l.f.seg)
    for (const [k, delta] of [['sm30', -30], ['s30', 30], ['s100', 100]]) {
        const s = classificarContato(contato, resumo, dia(delta))
        if (s !== l[k]) dif(l.id, `segmento(hoje${delta > 0 ? '+' : ''}${delta})`, s, l[k])
    }

    const ritmoKanban = l.k ? { total_pedidos: l.k.tp, intervalo_medio: num(l.k.im), atraso: l.k.at, sumido: l.k.su, dias_sem_compra: l.k.ds } : undefined
    const temp = temperaturaCliente(ritmoKanban).estado
    if (temp !== l.f.temp) dif(l.id, 'temperatura', temp, l.f.temp)
    if (TEMPERATURA_ORDEM[temp] !== l.f.tord) dif(l.id, 'temperatura_ordem', TEMPERATURA_ORDEM[temp], l.f.tord)

    // O card do app vai calcular o termômetro com as métricas da própria função: tem que dar o mesmo.
    const ritmoFn = l.f.tp === null ? undefined : { total_pedidos: l.f.tp, intervalo_medio: num(l.f.im), atraso: l.f.at, sumido: l.f.su, dias_sem_compra: l.f.ds }
    if (temperaturaCliente(ritmoFn).estado !== l.f.temp) dif(l.id, 'temperatura(métricas da função)', temperaturaCliente(ritmoFn).estado, l.f.temp)
    for (const [campo, a, b] of [
        ['total_pedidos', ritmoKanban?.total_pedidos ?? null, l.f.tp],
        ['intervalo_medio', ritmoKanban?.intervalo_medio ?? null, num(l.f.im)],
        ['atraso', ritmoKanban?.atraso ?? null, l.f.at],
        ['sumido', ritmoKanban?.sumido ?? null, l.f.su],
        ['dias_sem_compra', ritmoKanban?.dias_sem_compra ?? null, l.f.ds],
    ]) if (a !== b) dif(l.id, campo, a, b)

    if ((resumo?.totalCompras ?? 0) !== num(l.f.n)) dif(l.id, 'total_compras', resumo?.totalCompras ?? 0, num(l.f.n))
    if ((resumo?.totalGasto ?? 0) !== num(l.f.g)) dif(l.id, 'total_gasto', resumo?.totalGasto ?? 0, num(l.f.g))
    if ((resumo?.ultimaCompra ?? null) !== l.f.u) dif(l.id, 'ultima_compra', resumo?.ultimaCompra ?? null, l.f.u)

    const orot = origemBadge(l.origem, l.fonte).label
    if (orot !== l.f.orot) dif(l.id, 'origem_rotulo', orot, l.f.orot)

    const prv = precisaRevisao({ origemCadastro: l.oc || 'manual', revisadoEm: l.rv })
    if (prv !== l.f.prv) dif(l.id, 'precisa_revisao', prv, l.f.prv)

    if (l.vw.seg !== l.f.seg || l.vw.temp !== l.f.temp) dif(l.id, 'view ≠ função(hoje SP)', l.vw, { seg: l.f.seg, temp: l.f.temp })

    antes.todos++; antes[seg]++; if (prv) antes.novosIa++
    depois.todos++; depois[l.f.seg]++; if (l.f.prv) depois.novosIa++
    temps.antes[temp] = (temps.antes[temp] ?? 0) + 1
    temps.depois[l.f.temp] = (temps.depois[l.f.temp] ?? 0) + 1
}

// Indicações: como o useIndicacoes contava (sem o corte de 1000) × pela função.
const existe = new Set(dados.linhas.map((l) => l.id))
const convAntes = new Map(), convDepois = new Map()
let indicados = 0
for (const l of dados.linhas) {
    if (!l.ip) continue
    indicados++
    if (existe.has(l.ip) && (num(l.r?.n) || 0) > 0) convAntes.set(l.ip, (convAntes.get(l.ip) ?? 0) + 1)
    if (num(l.f.n) > 0) convDepois.set(l.ip, (convDepois.get(l.ip) ?? 0) + 1)
}
for (const id of new Set([...convAntes.keys(), ...convDepois.keys()]))
    if ((convAntes.get(id) ?? 0) !== (convDepois.get(id) ?? 0)) dif(id, 'conversões do indicador', convAntes.get(id) ?? 0, convDepois.get(id) ?? 0)
const soma = (mp) => [...mp.values()].reduce((a, b) => a + b, 0)

if (dados.total_view !== dados.total_contatos) dif('-', 'linhas da view × contatos', dados.total_view, dados.total_contatos)

console.log(`Data de referência (São Paulo): ${dados.hoje}${aplicada ? ' — migração já aplicada' : ' — migração em transação descartada'}`)
console.log(`Contatos: ${dados.total_contatos} · linhas na view: ${dados.total_view}`)
console.table({ 'app (TS)': antes, 'banco (função)': depois })
console.table({ 'app (TS)': temps.antes, 'banco (função)': temps.depois })
console.log(`Indicações: ${indicados} indicados · conversões app ${soma(convAntes)} × banco ${soma(convDepois)} · indicadores com conversão ${convAntes.size} × ${convDepois.size}`)
console.log(`Comparações por contato: segmento em 4 datas, temperatura, ordem, 5 métricas de ritmo, 3 de resumo, origem, revisão, view`)
if (diferencas.length) {
    console.log(`DIFERENÇAS: ${diferencas.length}`)
    console.table(diferencas.slice(0, 50))
    process.exit(1)
}
console.log('DIFERENÇAS: 0')
