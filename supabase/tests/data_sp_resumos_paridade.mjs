// Paridade da migração 20261107202501_data_sp_resumos_relatorios.
//
// Roda numa transação que SEMPRE termina em RAISE (rollback, nada gravado) e compara:
//  A. Troca CURRENT_DATE → hoje_sp(): kanban, LTV do perfil, LTV dos Relatórios (geral e mês) e
//     view_contatos_segmento ANTES × DEPOIS, linha a linha (EXCEPT nos dois sentidos). Com o dia
//     UTC = dia de São Paulo (rodar entre 00h e 21h) o resultado tem de ser idêntico.
//  B. hoje_sp() nas bordas do dia (23h59 SP, 23h30 SP = 02h30 UTC do dia seguinte, 00h00 SP).
//  C. Resumos novos × as contas que as telas faziam no navegador sobre a lista inteira:
//     Relatórios > Clientes (TabClientes), Marketing (TabMarketing), Produtos (TabProdutos) e o
//     Ranking de compras (KPIs + top 10), no período geral e no mês corrente.
//
// Uso (da raiz):  node supabase/tests/data_sp_resumos_paridade.mjs [--aplicada]

import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const aplicada = process.argv.includes('--aplicada')
const migracao = aplicada ? '' : readFileSync(path.join(raiz, 'supabase/migrations/20261107202501_data_sp_resumos_relatorios.sql'), 'utf8')

const fotos = [
    ['k', 'select * from public.view_relacionamento_kanban'],
    ['lv', 'select * from public.rpt_ltv_por_cliente'],
    ['lg', 'select * from public.rpt_ltv_por_cliente_periodo(null, null)'],
    ['lm', "select * from public.rpt_ltv_por_cliente_periodo(date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date, (date_trunc('month', (now() at time zone 'America/Sao_Paulo')) + interval '1 month - 1 day')::date)"],
    ['sg', 'select * from public.view_contatos_segmento'],
]
const antes = fotos.map(([n, q]) => `create temp table _antes_${n} on commit drop as ${q};`).join('\n')
const comparar = fotos.map(([n, q]) => `
        '${n}', jsonb_build_object(
            'linhas', (select count(*) from _antes_${n}),
            'so_antes', (select count(*) from (select * from _antes_${n} except all ${q}) x),
            'so_depois', (select count(*) from (${q} except all select * from _antes_${n}) x))`).join(',')

const mes = "date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date"
const fimMes = "(date_trunc('month', (now() at time zone 'America/Sao_Paulo')) + interval '1 month - 1 day')::date"
const anoMes = "extract(year from (now() at time zone 'America/Sao_Paulo'))::int, extract(month from (now() at time zone 'America/Sao_Paulo'))::int"
const linhasLtv = (args) => `(select jsonb_agg(jsonb_build_object('ltv', r.ltv_total, 'ticket', r.ticket_medio, 'pedidos', r.total_pedidos, 'status', r.status_atividade, 'origem', r.origem)) from public.rpt_ltv_por_cliente_periodo(${args}) r)`
const linhasRanking = (args) => `(select jsonb_agg(jsonb_build_object('p', r.total_pontos, 'c', r.total_compras)) from public.rpc_ranking_compras(${args}) r)`
const top10 = (args) => `(select jsonb_agg(t.total_pontos) from (select total_pontos from public.rpc_ranking_compras(${args}) order by total_pontos desc limit 10) t)`

const lote = `
DO $pre$ BEGIN
    IF current_date <> (now() at time zone 'America/Sao_Paulo')::date THEN
        RAISE EXCEPTION 'FORA_DA_JANELA: dia UTC % diferente do de Sao Paulo (rodar entre 00h e 21h)', current_date;
    END IF;
END $pre$;
${aplicada ? '-- já aplicada: a comparação A vira ANTES = DEPOIS trivial; o que vale é B e C' : antes}
${migracao}
DO $p$
DECLARE v jsonb;
BEGIN
    SELECT jsonb_build_object(
        'hoje', public.hoje_sp(),
        'A', ${aplicada ? "'{}'::jsonb" : `jsonb_build_object(${comparar})`},
        'B', jsonb_build_object(
            '23h59_sp', public.hoje_sp('2026-11-07 23:59:00-03'),
            '23h30_sp_02h30_utc', public.hoje_sp('2026-11-08 02:30:00+00'),
            '00h00_sp', public.hoje_sp('2026-11-08 00:00:00-03'),
            'utc_current_date_23h30', ('2026-11-08 02:30:00+00'::timestamptz at time zone 'UTC')::date),
        'C', jsonb_build_object(
            'ltv_geral', ${linhasLtv('null, null')},
            'ltv_mes', ${linhasLtv(`${mes}, ${fimMes}`)},
            'resumo_geral', (select to_jsonb(r) from public.rpt_ltv_resumo_periodo(null, null) r),
            'resumo_mes', (select to_jsonb(r) from public.rpt_ltv_resumo_periodo(${mes}, ${fimMes}) r),
            'origem_geral', (select jsonb_agg(to_jsonb(r)) from public.rpt_ltv_por_origem_periodo(null, null) r),
            'ranking_geral', ${linhasRanking('null, null')},
            'ranking_mes', ${linhasRanking(anoMes)},
            'rk_resumo_geral', (select to_jsonb(r) from public.rpc_ranking_compras_resumo(null, null) r),
            'rk_resumo_mes', (select to_jsonb(r) from public.rpc_ranking_compras_resumo(${anoMes}) r),
            'top10_geral', ${top10('null, null')},
            'top10_mes', ${top10(anoMes)})
    ) INTO v;
    RAISE EXCEPTION 'PARIDADE|%|FIM', v;
END $p$;
`

const arquivo = path.join(mkdtempSync(path.join(tmpdir(), 'paridade-sp-')), 'lote.sql')
writeFileSync(arquivo, lote)
const r = spawnSync(`npx supabase db query --linked --agent no -f "${arquivo}"`, { cwd: raiz, shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const saida = `${r.stdout}\n${r.stderr}`
const m = saida.match(/PARIDADE\|([\s\S]*)\|FIM/)
if (!m) { console.error('O lote não devolveu o resultado esperado:\n' + saida.slice(0, 3000)); process.exit(2) }
let dados
try { dados = JSON.parse(m[1]) } catch { dados = JSON.parse(JSON.parse(`"${m[1]}"`)) }

const difs = []
const centavos = (x) => Math.round(Number(x) * 100)
const igual = (onde, app, banco, dinheiro = false) => {
    const ok = dinheiro ? centavos(app) === centavos(banco) : Number(app) === Number(banco)
    if (!ok) difs.push({ onde, app, banco })
}

// ── A ──
const tabelaA = {}
for (const [k, v] of Object.entries(dados.A)) {
    tabelaA[k] = v
    if (v.so_antes !== 0 || v.so_depois !== 0) difs.push({ onde: `A ${k}`, app: v.so_antes, banco: v.so_depois })
}

// ── B ──
const B = dados.B
if (B['23h59_sp'] !== '2026-11-07') difs.push({ onde: 'B 23h59 SP', app: '2026-11-07', banco: B['23h59_sp'] })
if (B['23h30_sp_02h30_utc'] !== '2026-11-07') difs.push({ onde: 'B 23h30 SP', app: '2026-11-07', banco: B['23h30_sp_02h30_utc'] })
if (B['00h00_sp'] !== '2026-11-08') difs.push({ onde: 'B 00h00 SP', app: '2026-11-08', banco: B['00h00_sp'] })

// ── C: as contas que as telas faziam no navegador ──
function contasDoApp(clientes) {
    const sum = (rows) => rows.reduce((s, c) => s + (c.ltv ?? 0), 0)
    const total = clientes.length
    const por = (s) => clientes.filter((c) => c.status === s)
    const top20Count = Math.ceil(total * 0.2)                                  // TabClientes (Pareto)
    return {
        total_clientes: total,
        total_ltv: sum(clientes),
        soma_ticket_medio: clientes.reduce((s, c) => s + (c.ticket ?? 0), 0),
        ativos: por('ativo').length, ativos_ltv: sum(por('ativo')),
        risco: por('risco').length, risco_ltv: sum(por('risco')),
        adormecidos: por('adormecido').length, adormecidos_ltv: sum(por('adormecido')),
        top20_clientes: Math.min(top20Count, total),
        top20_ltv: clientes.slice(0, top20Count).reduce((s, c) => s + (c.ltv ?? 0), 0),
        compras_1: clientes.filter((c) => (c.pedidos ?? 0) === 1).length,          // TabMarketing
        compras_2: clientes.filter((c) => (c.pedidos ?? 0) === 2).length,
        compras_3a5: clientes.filter((c) => { const n = c.pedidos ?? 0; return n >= 3 && n <= 5 }).length,
        compras_6mais: clientes.filter((c) => (c.pedidos ?? 0) >= 6).length,
        recompraram: clientes.filter((c) => (c.pedidos ?? 0) >= 2).length,
    }
}
const DINHEIRO = new Set(['total_ltv', 'soma_ticket_medio', 'ativos_ltv', 'risco_ltv', 'adormecidos_ltv', 'top20_ltv'])
const tabelaC = {}
for (const [periodo, lista, resumo] of [['geral', dados.C.ltv_geral ?? [], dados.C.resumo_geral], ['mês', dados.C.ltv_mes ?? [], dados.C.resumo_mes]]) {
    // a lista chega na ordem da função (ltv desc), como chegava ao app
    const app = contasDoApp(lista)
    for (const [k, v] of Object.entries(app)) igual(`C ltv ${periodo} ${k}`, v, resumo[k], DINHEIRO.has(k))
    tabelaC[`LTV ${periodo}`] = { clientes: app.total_clientes, 'LTV (app)': app.total_ltv.toFixed(2), 'LTV (banco)': Number(resumo.total_ltv).toFixed(2), 'top20 (app/banco)': `${app.top20_clientes}/${resumo.top20_clientes}` }
}
// Qualidade por origem (TabMarketing)
const qMap = new Map()
for (const c of dados.C.ltv_geral ?? []) {
    const o = c.origem ?? 'direto'
    const acc = qMap.get(o) ?? { n: 0, ltv: 0, recompra: 0 }
    acc.n += 1; acc.ltv += c.ltv ?? 0; if ((c.pedidos ?? 0) >= 2) acc.recompra += 1
    qMap.set(o, acc)
}
const origemBanco = new Map((dados.C.origem_geral ?? []).map((r) => [r.origem, r]))
if (origemBanco.size !== qMap.size) difs.push({ onde: 'C origem: quantidade', app: qMap.size, banco: origemBanco.size })
for (const [o, a] of qMap) {
    const b = origemBanco.get(o)
    if (!b) { difs.push({ onde: `C origem ${o}`, app: a.n, banco: 'ausente' }); continue }
    igual(`C origem ${o} clientes`, a.n, b.clientes); igual(`C origem ${o} ltv`, a.ltv, b.ltv_total, true); igual(`C origem ${o} recompra`, a.recompra, b.recompraram)
}
// Ranking (Ranking.tsx: KPIs sobre o conjunto inteiro + top 10)
for (const [periodo, lista, resumo, top] of [['geral', dados.C.ranking_geral ?? [], dados.C.rk_resumo_geral, dados.C.top10_geral ?? []], ['mês', dados.C.ranking_mes ?? [], dados.C.rk_resumo_mes, dados.C.top10_mes ?? []]]) {
    const somaPontos = lista.reduce((a, c) => a + (Number(c.p) || 0), 0)
    const totalCompras = lista.reduce((a, c) => a + (Number(c.c) || 0), 0)
    igual(`C ranking ${periodo} clientes`, lista.length, resumo.total_clientes)
    igual(`C ranking ${periodo} pontos`, somaPontos, resumo.soma_pontos, true)
    igual(`C ranking ${periodo} compras`, totalCompras, resumo.total_compras)
    const topApp = lista.slice(0, 10).map((c) => centavos(c.p)).join(',')
    const topBanco = top.map((p) => centavos(p)).join(',')
    if (topApp !== topBanco) difs.push({ onde: `C ranking ${periodo} top10 (pontos)`, app: topApp, banco: topBanco })
    tabelaC[`Ranking ${periodo}`] = { clientes: lista.length, 'LTV (app)': somaPontos.toFixed(2), 'LTV (banco)': Number(resumo.soma_pontos).toFixed(2), 'top20 (app/banco)': `top10 ${topApp === topBanco ? 'igual' : 'DIFERENTE'}` }
}

console.log(`Dia de São Paulo: ${dados.hoje}${aplicada ? ' — migração já aplicada' : ' — migração em transação descartada'}`)
if (!aplicada) { console.log('A. Antes × depois da troca de data (linhas; só antes / só depois):'); console.table(tabelaA) }
console.log('B. hoje_sp nas bordas:', B)
console.log('C. Resumos do banco × contas do app:'); console.table(tabelaC)
console.log(`   origens: ${qMap.size} (app) × ${origemBanco.size} (banco)`)
if (difs.length) { console.log(`DIFERENÇAS: ${difs.length}`); console.table(difs.slice(0, 40)); process.exit(1) }
console.log('DIFERENÇAS: 0')
