// Prova da migração 20261110142732_datas_sp_gravacao (datas gravadas no dia de São Paulo).
//
// Roda numa transação que SEMPRE termina em RAISE (rollback: nada gravado) e confere:
//  A. Em cada uma das 7 funções mudou SÓ a linha prevista (diff linha a linha antes × depois),
//     e SECURITY DEFINER/INVOKER, search_path e permissões (ACL) ficaram iguais.
//  B. Os 5 defaults de coluna passaram a ser public.hoje_sp().
//  C. As 2 contas de 07/07/2026 ficam com emissão 07/07 e o resto de contas_a_pagar fica idêntico
//     (md5 de todas as outras linhas antes × depois). Nenhuma outra tabela muda de tamanho.
//  D. A expressão nova do gatilho dá o dia de SP às 23h30 (a antiga dava o dia seguinte).
//
// Uso (da raiz):  node supabase/tests/datas_sp_gravacao.mjs [--aplicada]

import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const aplicada = process.argv.includes('--aplicada')
const arquivoMigracao = readFileSync(path.join(raiz, 'supabase/migrations/20261110142732_datas_sp_gravacao.sql'), 'utf8')
const FUNCOES = ['criar_pedido', 'entregador_marcar_recebido_dinheiro', 'fn_sync_cat_pedido_to_venda', 'registrar_ajuste_saldo', 'registrar_despesa_manual', 'registrar_entrada_manual', 'admin_extrato_entregadores']
const IDS = ['df0b2cbb-6007-4b31-891a-fe6afb141b72', '4c3159a7-5222-4f68-beee-38e8c198e5e0']
const lista = (xs) => xs.map((x) => `'${x}'`).join(',')

const fotoFuncoes = `(select jsonb_object_agg(p.proname, jsonb_build_object('def', pg_get_functiondef(p.oid), 'secdef', p.prosecdef, 'config', p.proconfig, 'acl', p.proacl::text))
   from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in (${lista(FUNCOES)}))`
const fotoDefaults = `(select jsonb_object_agg(table_name || '.' || column_name, column_default)
   from information_schema.columns where table_schema = 'public' and data_type = 'date' and column_default is not null)`
const md5Outras = `(select md5(string_agg(c::text, '|' order by c.id)) from public.contas_a_pagar c where c.id not in (${lista(IDS)}))`
const tamanhos = `(select jsonb_build_object('vendas', (select count(*) from public.vendas), 'lancamentos', (select count(*) from public.lancamentos),
   'contas_a_pagar', (select count(*) from public.contas_a_pagar), 'pagamentos_conta_a_pagar', (select count(*) from public.pagamentos_conta_a_pagar),
   'purchase_orders', (select count(*) from public.purchase_orders)))`

const lote = `
create temp table _antes on commit drop as
  select ${fotoFuncoes} funcoes, ${fotoDefaults} defaults, ${md5Outras} md5_outras, ${tamanhos} tamanhos;
${aplicada ? '' : arquivoMigracao}
DO $p$
DECLARE v jsonb;
BEGIN
  SELECT jsonb_build_object(
    'antes', (select to_jsonb(a) from _antes a),
    'depois', jsonb_build_object('funcoes', ${fotoFuncoes}, 'defaults', ${fotoDefaults}, 'md5_outras', ${md5Outras}, 'tamanhos', ${tamanhos}),
    'contas', (select jsonb_agg(jsonb_build_object('id', id, 'data_emissao', data_emissao, 'descricao', descricao) order by id) from public.contas_a_pagar where id in (${lista(IDS)})),
    'D', jsonb_build_object(
      'nova_23h30', ((timestamptz '2026-11-10 23:30:00-03') at time zone 'America/Sao_Paulo')::date,
      'antiga_23h30', (timestamptz '2026-11-10 23:30:00-03')::date,
      'nova_10h', ((timestamptz '2026-11-10 10:00:00-03') at time zone 'America/Sao_Paulo')::date,
      'hoje_sp_23h30', public.hoje_sp('2026-11-10 23:30:00-03'))
  ) INTO v;
  RAISE EXCEPTION 'PROVA|%|FIM', v;
END $p$;
`

const arquivo = path.join(mkdtempSync(path.join(tmpdir(), 'prova-datas-')), 'lote.sql')
writeFileSync(arquivo, lote)
const r = spawnSync(`npx supabase db query --linked --agent no -f "${arquivo}"`, { cwd: raiz, shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const saida = `${r.stdout}\n${r.stderr}`
const m = saida.match(/PROVA\|([\s\S]*)\|FIM/)
if (!m) { console.error('O lote não devolveu o resultado esperado:\n' + saida.slice(0, 3000)); process.exit(2) }
let dados
try { dados = JSON.parse(m[1]) } catch { dados = JSON.parse(JSON.parse(`"${m[1]}"`)) }

const falhas = []
const { antes, depois } = dados

// A — diff por função (quando aplicada, o "antes" já é o novo: o diff é contra a definição do arquivo)
const tabelaA = {}
for (const nome of FUNCOES) {
  const a = antes.funcoes[nome], b = depois.funcoes[nome]
  if (!a || !b) { falhas.push(`A ${nome}: função ausente`); continue }
  const la = a.def.split('\n'), lb = b.def.split('\n')
  const mudadas = []
  for (let i = 0; i < Math.max(la.length, lb.length); i++) if (la[i] !== lb[i]) mudadas.push({ antes: (la[i] ?? '').trim(), depois: (lb[i] ?? '').trim() })
  const ok = aplicada ? mudadas.length === 0 : (la.length === lb.length && mudadas.length === 1 && !/current_date/i.test(b.def))
  if (!ok) falhas.push(`A ${nome}: ${mudadas.length} linha(s) mudaram`)
  for (const k of ['secdef', 'config', 'acl']) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) falhas.push(`A ${nome}: ${k} mudou`)
  if (aplicada && /current_date/i.test(b.def)) falhas.push(`A ${nome}: ainda tem current_date`)
  tabelaA[nome] = { 'linhas mudadas': mudadas.length, antes: mudadas[0]?.antes.slice(0, 70) ?? '—', depois: mudadas[0]?.depois.slice(0, 80) ?? '—' }
}
if (aplicada) for (const nome of FUNCOES) if (!arquivoMigracao.includes(depois.funcoes[nome].def.trim().split('\n')[0])) falhas.push(`A ${nome}: cabeçalho difere do arquivo`)

// B — defaults
for (const [col, expr] of Object.entries(depois.defaults)) if (expr !== 'hoje_sp()' && expr !== 'public.hoje_sp()') falhas.push(`B ${col}: default = ${expr}`)
if (Object.keys(depois.defaults).length !== 5) falhas.push(`B: ${Object.keys(depois.defaults).length} defaults de data (esperava 5)`)

// C — dados
for (const c of dados.contas) if (c.data_emissao !== '2026-07-07') falhas.push(`C ${c.descricao}: emissão ${c.data_emissao}`)
if (dados.contas.length !== 2) falhas.push(`C: ${dados.contas.length} contas`)
if (antes.md5_outras !== depois.md5_outras) falhas.push('C: outras linhas de contas_a_pagar mudaram')
if (JSON.stringify(antes.tamanhos) !== JSON.stringify(depois.tamanhos)) falhas.push('C: tamanho de tabela mudou')

// D — expressão do gatilho
const D = dados.D
if (D.nova_23h30 !== '2026-11-10' || D.nova_10h !== '2026-11-10' || D.hoje_sp_23h30 !== '2026-11-10' || D.antiga_23h30 !== '2026-11-11') falhas.push('D: ' + JSON.stringify(D))

console.log(aplicada ? 'Migração já aplicada (A compara com o estado atual).' : 'Migração em transação descartada.')
console.log('A. Linhas mudadas por função:'); console.table(tabelaA)
console.log('B. Defaults depois:', depois.defaults)
console.log('C. Contas:', dados.contas.map((c) => `${c.descricao}: ${c.data_emissao}`).join(' · '), '| outras linhas iguais:', antes.md5_outras === depois.md5_outras, '| tamanhos iguais:', JSON.stringify(antes.tamanhos) === JSON.stringify(depois.tamanhos))
console.log('D. 23h30 de 10/11 em SP → nova:', D.nova_23h30, '| antiga:', D.antiga_23h30, '| hoje_sp:', D.hoje_sp_23h30)
if (falhas.length) { console.log(`FALHAS: ${falhas.length}`); for (const f of falhas) console.log(' -', f); process.exit(1) }
console.log('FALHAS: 0')
