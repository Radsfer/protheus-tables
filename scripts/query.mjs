// Busca offline das tabelas Protheus (zero dependências, Node puro).
// Dados: data/meta.json.gz, data/inv.json.gz, data/texts.json.gz
// Gerados por build_fast_site.py a partir de site_tabelas/data/index.json.

import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DATA_DIR = path.join(path.dirname(SCRIPT_PATH), '..', 'data');
// Teto da varredura por substring (fallback) e da listagem por prefixo.
const FALLBACK_MAX = 200;
const LIST_MAX = 200;
// Acima disso a saída de "table" ganha aviso de tamanho.
const HUGE_TEXT = 20000;
// Conectores que não ajudam a identificar uma tabela.
const STOPWORDS = new Set(['de', 'da', 'do', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas',
  'os', 'as', 'um', 'uma', 'para', 'com', 'por', 'que']);
// Tabelas mestras clássicas do dicionário. Vários módulos repetem o mesmo nome
// canônico ("Clientes" em SA1/SS2/NUH, "Plano de Contas" em CT1/SI1/CS3,
// "Contratos" em CN9/NJR/FSC), e nem sempre a maior é a clássica; esta lista só
// desempata nomes já empatados pela relevância, nunca sobrepõe um match melhor.
const MASTER_TABLES = ['sa1', 'sa2', 'sa3', 'sb1', 'sb2', 'sc1', 'sc5', 'sc6', 'sc7',
  'sd1', 'sd2', 'sd3', 'sd4', 'se1', 'se2', 'se4', 'sed', 'sf1', 'sf2', 'sf4', 'sft',
  'sra', 'sx5', 'sx6', 'ct1', 'ct2', 'ctt', 'cn9', 'cn1', 'sc9'];

function loadGz(name) {
  const buf = readFileSync(path.join(DATA_DIR, name));
  return JSON.parse(gunzipSync(buf).toString('utf8'));
}

// Mesma normalização do indexador (build_fast_site.py): minúsculas + remove acentos.
function normalize(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function tokenize(q) {
  const all = (normalize(q).match(/[a-z0-9_\-]+/g) || []).filter((t) => t.length >= 2);
  const useful = all.filter((t) => !STOPWORDS.has(t));
  return useful.length ? useful : all.filter((t) => t.length >= 3);
}

function fileCode(f) {
  return normalize(f).replace(/^tabela_/, '').replace(/\.html$/, '');
}

function alnum(s) {
  return normalize(s).replace(/[^a-z0-9]/g, '');
}

let meta = null;
let inv = null;
let texts = null;
let codes = null;
let titles = null;
let names = null;
let nameTokens = null;

const ensureMeta = () => { if (!meta) meta = loadGz('meta.json.gz'); };
const ensureInv = () => { if (!inv) inv = loadGz('inv.json.gz'); };
const ensureTexts = () => { if (!texts) texts = loadGz('texts.json.gz'); };

// Código, título, nome canônico (X2_NOME) e tokens do nome de cada tabela.
function ensureDerived() {
  ensureMeta();
  if (codes) return;
  codes = meta.map((m) => fileCode(m.f));
  titles = meta.map((m) => normalize(m.t || ''));
  names = meta.map((m) => {
    const t = m.t || '';
    const sep = t.indexOf(' - ');
    return normalize(sep >= 0 ? t.slice(sep + 3) : t.replace(/^tabela:\s*/i, ''));
  });
  nameTokens = names.map((n) => n.split(/[^a-z0-9_]+/).filter(Boolean));
}

function intersect(arrays) {
  if (!arrays.length) return [];
  let result = new Set(arrays[0]);
  for (let i = 1; i < arrays.length; i++) {
    const s = new Set(arrays[i]);
    result = new Set([...result].filter((x) => s.has(x)));
    if (!result.size) break;
  }
  return [...result];
}

function fallbackSearch(terms) {
  ensureMeta();
  ensureTexts();
  const out = [];
  for (let i = 0; i < texts.length; i++) {
    const hay = normalize((meta[i].t || '') + ' ' + texts[i]);
    if (terms.every((t) => hay.includes(t))) {
      out.push(i);
      if (out.length >= FALLBACK_MAX) break;
    }
  }
  return out;
}

// Tabelas apontadas diretamente pelo texto da consulta: o próprio código ou o
// prefixo de um campo (convenção Protheus: CN9_NUMERO pertence à tabela CN9).
function directHits(terms, qAlnum) {
  ensureDerived();
  const out = [];
  const add = (code) => {
    const i = codes.indexOf(code);
    if (i >= 0) out.push(i);
  };
  if (qAlnum) add(qAlnum);
  for (const t of terms) {
    const prefix = t.split('_')[0];
    if (prefix && prefix !== t) add(prefix);
  }
  return out;
}

// Relevância, da evidência mais forte para a mais fraca: código exato, nome
// canônico exato, tabela mestra cujo nome cobre a consulta, campo pertencente à
// tabela, nome/título contendo os termos.
function relevance(i, terms, qAlnum, phrase) {
  const code = codes[i];
  const title = titles[i];
  const name = names[i];
  const toks = nameTokens[i];
  // Flexão: a palavra menor é prefixo quase inteiro da maior e o comprimento
  // fica próximo (condicao/condicoes, cliente/clientes, movimento/movimentacoes).
  // Sem o limite de comprimento, "contas" traria "contabilidade".
  const fold = (term) => toks.some((t) => {
    if (t === term) return false;
    const n = Math.min(t.length, term.length);
    if (Math.abs(t.length - term.length) > 5) return false;
    let k = 0;
    while (k < n && t[k] === term[k]) k++;
    return k >= 4 && k >= n - 2;
  });
  const allExact = terms.length > 0 && terms.every((t) => name.includes(t));
  const allName = allExact || (terms.length > 0 && terms.every((t) => name.includes(t) || fold(t)));
  const allInTitle = terms.length > 0 && terms.every((t) => title.includes(t));
  const exactName = phrase.length >= 3 && name === phrase;
  const master = masterRank(i) < MASTER_TABLES.length;
  let score = 0;
  if (code === qAlnum) score += 100000;
  if (exactName) score += 50000;
  else if (phrase.length >= 3 && name.includes(phrase)) score += 6000;
  else if (phrase.length >= 3 && title.includes(phrase)) score += 3000;
  // A tabela mestra do conceito vence um homônimo de módulo: para "condicao de
  // pagamento" vale SE4 (Condições de Pagamento), não HE4 (Condição de Pagamento).
  if (master && allName) score += 60000;
  for (const term of terms) {
    if (term === code) score += 20000;
    if (term.startsWith(code + '_')) score += 15000;
  }
  if (terms.length > 1 && allName) score += 2000;
  else if (terms.length > 1 && allInTitle) score += 1500;
  for (const term of terms) {
    if (name.includes(term) || fold(term)) score += 500;
    if (term.length >= 2 && term.length <= 4 && code.startsWith(term)) score += 200;
  }
  return score;
}

function masterRank(i) {
  const r = MASTER_TABLES.indexOf(codes[i]);
  return r < 0 ? MASTER_TABLES.length : r;
}

// Tamanho do texto da tabela, usado só em empate: entre nomes canônicos
// idênticos e igualmente relevantes, a mestra costuma ter mais campos.
function textSize(i) {
  ensureTexts();
  return texts[i].length;
}

// Ordena por relevância; empate cai para a tabela mestra e, depois, para o
// tamanho do dicionário. texts.json.gz só é carregado quando ainda há empate.
function rank(ids, terms, query) {
  const qAlnum = alnum(query);
  const phrase = normalize(query).trim();
  const entries = ids
    .map((i) => ({ i, score: relevance(i, terms, qAlnum, phrase) }))
    .sort((a, b) => b.score - a.score || masterRank(a.i) - masterRank(b.i) || a.i - b.i);
  const best = entries[0].score;
  const tied = entries.filter((e) => e.score === best);
  const topRank = masterRank(tied[0].i);
  let end = 0;
  while (end < tied.length && masterRank(tied[end].i) === topRank) end++;
  const grupo = tied.slice(0, end);
  if (grupo.length > 1) {
    grupo.sort((a, b) => textSize(b.i) - textSize(a.i) || a.i - b.i);
    entries.splice(0, grupo.length, ...grupo);
  }
  return entries.map((e) => e.i);
}

function search(query, limit) {
  ensureMeta();
  ensureInv();
  ensureDerived();
  const terms = tokenize(query);
  const qAlnum = alnum(query);
  if (!terms.length) return { ids: [], terms, qAlnum, fallback: false };
  const arrays = terms.map((t) => inv[t] || []).filter((a) => a.length);
  let ids = [];
  let fallback = false;
  if (arrays.length === terms.length) ids = intersect(arrays);
  if (!ids.length) {
    ids = fallbackSearch(terms);
    fallback = true;
  }
  const merged = [...new Set([...ids, ...directHits(terms, qAlnum)])];
  return { ids: rank(merged, terms, query).slice(0, limit), terms, qAlnum, fallback };
}

function findByCode(code) {
  ensureMeta();
  ensureDerived();
  return codes.indexOf(alnum(code));
}

function listByPrefix(prefix) {
  ensureMeta();
  ensureDerived();
  const p = alnum(prefix);
  return codes
    .map((c, i) => ({ i, code: c, title: meta[i].t || '' }))
    .filter((e) => e.code.startsWith(p))
    .sort((a, b) => a.code.localeCompare(b.code));
}

function printSearch(query, limit) {
  const { ids, terms, qAlnum, fallback } = search(query, limit);
  if (!ids.length) {
    console.log(`Nenhum resultado para "${query}".`);
    return false;
  }
  console.log(`${ids.length} resultado(s) para "${query}"${fallback ? ' (busca por substring)' : ''}:`);
  ids.forEach((id, n) => {
    const m = meta[id];
    console.log(`\n[${n + 1}] ${m.f}  ${m.t || ''}`);
    if (m.s) console.log(`    ${m.s}`);
  });
  const top = codes[ids[0]];
  const porCodigo = top === qAlnum || terms.some((t) => t.startsWith(top + '_'));
  if (porCodigo) {
    console.log(`\nDica: node "${SCRIPT_PATH}" table "${top.toUpperCase()}" traz a tabela completa.`);
    return true;
  }
  // Em consulta por nome, avise quando outro resultado tem nome praticamente
  // igual: o mesmo conceito existe em vários módulos (SA1/SS2/NUH = "Clientes")
  // e a escolha certa depende do módulo do usuário.
  const chave = (i) => names[i].replace(/[^a-z0-9]/g, '').slice(0, 6);
  const parecidos = ids.slice(1, 5).filter((i) => chave(i) === chave(ids[0]));
  if (parecidos.length) {
    const outros = parecidos.map((i) => `${codes[i].toUpperCase()} (${(meta[i].t || '').replace(/^Tabela:\s*/, '')})`).join(', ');
    console.log(`\n[atenção: ${outros} ${parecidos.length > 1 ? 'têm' : 'tem'} nome praticamente igual.`
      + ' Confirme qual é a do módulo do usuário antes de afirmar que a tabela é esta.]');
  }
  return true;
}

function printTable(code) {
  ensureMeta();
  ensureTexts();
  const id = findByCode(code);
  if (id < 0) {
    console.log(`Tabela não encontrada: "${code}". Use "list <prefixo>" para ver as opções.`);
    return false;
  }
  console.log(`${meta[id].f}  ${meta[id].t || ''}\n`);
  console.log(texts[id]);
  if (texts[id].length > HUGE_TEXT) {
    console.log(`\n[aviso: ${texts[id].length} caracteres. Tabela grande — para um campo específico, use "search <CODIGO_DO_CAMPO>".]`);
  }
  return true;
}

function printList(prefix, limit) {
  const rows = listByPrefix(prefix);
  if (!rows.length) {
    console.log(`Nenhuma tabela com prefixo "${prefix}".`);
    return false;
  }
  const shown = rows.slice(0, limit);
  console.log(`${rows.length} tabela(s) com prefixo "${prefix}":`);
  for (const r of shown) console.log(`  ${r.code.toUpperCase()}  ${r.title}`);
  if (rows.length > shown.length) {
    console.log(`  ... e mais ${rows.length - shown.length}. Refine o prefixo para ver o resto.`);
  }
  return true;
}

function parseLimit(args, fallback) {
  const i = args.indexOf('--limit');
  const n = i >= 0 && args[i + 1] ? parseInt(args[i + 1], 10) : fallback;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function usage() {
  console.log(`Busca offline das tabelas Protheus (10.632 tabelas)

Uso (o caminho absoluto funciona de qualquer pasta):
  node "${SCRIPT_PATH}" search "<termos>" [--limit N]    busca livre (código, campo, palavra)
  node "${SCRIPT_PATH}" table "<código>"                 conteúdo completo (ex: CN9)
  node "${SCRIPT_PATH}" list "<prefixo>" [--limit N]     lista por prefixo (ex: CN)

Exemplos:
  node "${SCRIPT_PATH}" search "CN9_NUMERO"
  node "${SCRIPT_PATH}" search "condicao de pagamento"
  node "${SCRIPT_PATH}" table "CN9"
  node "${SCRIPT_PATH}" list "CN"

Saída: 0 = encontrou, 1 = nada encontrado, 2 = uso inválido.`);
}

function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  if (!cmd || cmd === '--help' || cmd === '-h') { usage(); return; }
  if (cmd === 'search') {
    const q = args[1];
    if (!q) { usage(); process.exitCode = 2; return; }
    if (!printSearch(q, parseLimit(args, 20))) process.exitCode = 1;
    return;
  }
  if (cmd === 'table') {
    const code = args[1];
    if (!code) { usage(); process.exitCode = 2; return; }
    if (!printTable(code)) process.exitCode = 1;
    return;
  }
  if (cmd === 'list') {
    const prefix = args[1];
    if (!prefix || !alnum(prefix)) {
      console.log('Informe um prefixo: "list <prefixo>" (ex: list CN).');
      process.exitCode = 2;
      return;
    }
    if (!printList(prefix, parseLimit(args, LIST_MAX))) process.exitCode = 1;
    return;
  }
  usage();
  process.exitCode = 2;
}

main();
