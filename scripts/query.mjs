// Busca offline das tabelas Protheus (zero dependências, Node puro).
// Dados: data/meta.json.gz, data/inv.json.gz, data/texts.json.gz
// Gerados por build_fast_site.py a partir de site_tabelas/data/index.json.

import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');

function loadGz(name) {
  const buf = readFileSync(path.join(DATA_DIR, name));
  return JSON.parse(gunzipSync(buf).toString('utf8'));
}

// Mesma normalização do indexador (build_fast_site.py): minúsculas + remove acentos.
function normalize(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function tokenize(q) {
  return (normalize(q).match(/[a-z0-9_\-]+/g) || []).filter((t) => t.length >= 2);
}

let meta = null;
let inv = null;
let texts = null;
const ensureMeta = () => { if (!meta) meta = loadGz('meta.json.gz'); };
const ensureInv = () => { if (!inv) inv = loadGz('inv.json.gz'); };
const ensureTexts = () => { if (!texts) texts = loadGz('texts.json.gz'); };

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
  ensureTexts();
  const out = [];
  for (let i = 0; i < texts.length; i++) {
    const hay = normalize((meta[i].t || '') + ' ' + texts[i]);
    if (terms.every((t) => hay.includes(t))) {
      out.push(i);
      if (out.length >= 200) break;
    }
  }
  return out;
}

function search(query, limit) {
  ensureMeta();
  ensureInv();
  const terms = tokenize(query);
  if (!terms.length) return { ids: [], fallback: false };
  const arrays = terms.map((t) => inv[t] || []).filter((a) => a.length);
  let ids = [];
  let fallback = false;
  if (arrays.length === terms.length) {
    ids = intersect(arrays).slice(0, limit);
  }
  if (!ids.length) {
    ids = fallbackSearch(terms).slice(0, limit);
    fallback = true;
  }
  return { ids, fallback };
}

function fileCode(f) {
  return normalize(f).replace(/^tabela_/, '').replace(/\.html$/, '');
}

function findByCode(code) {
  ensureMeta();
  const c = normalize(code).replace(/[^a-z0-9]/g, '');
  return meta.findIndex((m) => fileCode(m.f) === c);
}

function listByPrefix(prefix) {
  ensureMeta();
  const p = normalize(prefix).replace(/[^a-z0-9]/g, '');
  return meta
    .map((m, i) => ({ i, code: fileCode(m.f), title: m.t || '' }))
    .filter((e) => e.code.startsWith(p))
    .sort((a, b) => a.code.localeCompare(b.code));
}

function printSearch(query, limit) {
  const { ids, fallback } = search(query, limit);
  if (!ids.length) {
    console.log(`Nenhum resultado para "${query}".`);
    return;
  }
  console.log(`${ids.length} resultado(s) para "${query}"${fallback ? ' (busca por substring)' : ''}:`);
  ids.forEach((id, n) => {
    const m = meta[id];
    console.log(`\n[${n + 1}] ${m.f}  ${m.t || ''}`);
    if (m.s) console.log(`    ${m.s}`);
  });
}

function printTable(code) {
  ensureMeta();
  ensureTexts();
  const id = findByCode(code);
  if (id < 0) {
    console.log(`Tabela não encontrada: "${code}". Use "list <prefixo>" para ver as opções.`);
    return;
  }
  console.log(`${meta[id].f}  ${meta[id].t || ''}\n`);
  console.log(texts[id]);
}

function printList(prefix) {
  const rows = listByPrefix(prefix);
  if (!rows.length) {
    console.log(`Nenhuma tabela com prefixo "${prefix}".`);
    return;
  }
  console.log(`${rows.length} tabela(s) com prefixo "${prefix}":`);
  for (const r of rows) console.log(`  ${r.code.toUpperCase()}  ${r.title}`);
}

function usage() {
  console.log(`Busca offline das tabelas Protheus (10.632 tabelas)

Uso:
  node scripts/query.mjs search "<termos>" [--limit N]   busca livre (código, campo, palavra)
  node scripts/query.mjs table "<código>"                conteúdo completo da tabela (ex: CN9)
  node scripts/query.mjs list "<prefixo>"                lista tabelas por prefixo (ex: CN)

Exemplos:
  node scripts/query.mjs search "CN9_NUMERO"
  node scripts/query.mjs search "condição de pagamento"
  node scripts/query.mjs table "CN9"
  node scripts/query.mjs list "CN"`);
}

function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  if (!cmd || cmd === '--help' || cmd === '-h') { usage(); return; }
  if (cmd === 'search') {
    const q = args[1] || '';
    const li = args.indexOf('--limit');
    const n = li >= 0 && args[li + 1] ? parseInt(args[li + 1], 10) : 20;
    printSearch(q, Number.isFinite(n) && n > 0 ? n : 20);
    return;
  }
  if (cmd === 'table') { printTable(args[1] || ''); return; }
  if (cmd === 'list') { printList(args[1] || ''); return; }
  usage();
}

main();
