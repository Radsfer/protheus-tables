---
name: protheus-tables
description: Use quando o usuário perguntar sobre tabelas, campos, índices ou dicionário de dados do Protheus/TOTVS — por exemplo "qual tabela guarda X", "o que significa o campo CN9_NUMERO", "lista os campos da tabela de contratos". Consulta o índice local offline com 10.632 tabelas.
---

# Tabelas Protheus (offline)

Índice local com 10.632 tabelas do dicionário de dados Protheus (SX2/SX3/SIX):
tabelas, campos, índices, descrições, help, relações e triggers. Fonte:
sempreju.com.br/tabelas_protheus. Funciona 100% offline, sem servidor e sem
instalar nada (Node puro, zero dependências).

## Como consultar

Use SEMPRE o script de busca antes de responder. Ele está em `scripts/query.mjs`
e roda com Node (já presente em qualquer Claude Code / DSH):

```sh
node scripts/query.mjs search "<termos>"     # busca livre
node scripts/query.mjs table "<código>"      # conteúdo completo (ex: CN9)
node scripts/query.mjs list "<prefixo>"      # lista por prefixo (ex: CN)
```

Exemplos:
- `node scripts/query.mjs search "CN9_NUMERO"`
- `node scripts/query.mjs search "condição de pagamento"`
- `node scripts/query.mjs table "CN9"`
- `node scripts/query.mjs list "CN"`

Para código de campo exato (ex: `CN9_NUMERO`), use `search` com o código entre
aspas — o índice resolve por token exato. Se o termo não for encontrado, o
script faz fallback por substring automaticamente.

## Convenções (prefixos comuns)

O prefixo do campo é o código da tabela. Exemplos:

| Tabela | Descrição |
|---|---|
| CN9 | Contratos |
| CN1 | Tipos de Contrato |
| SE4 | Condições de Pagamento |
| SE1 | Contas a Receber |
| SE2 | Contas a Pagar |
| SA1 | Clientes |
| SA2 | Fornecedores |
| SB1 | Descrição Genérica do Produto |
| SC5 | Pedidos de Venda |
| SED | Naturezas |
| A00 | Território x Nível do Agrup. |

Não tente memorizar a lista completa — use `list <prefixo>` ou `search` para
descobrir. Campos customizados costumam usar prefixo `X_` ou `Z_`. Campos de
sistema terminam em `_` (ex: `D_E_L_E_T_`, `R_E_C_N_O_`).

## Observações

- Repositório: https://github.com/Radsfer/protheus-tables
- Somente leitura: o script nunca altera os dados.
- O índice fica em `data/` (meta.json.gz, inv.json.gz, texts.json.gz) e é
  carregado sob demanda; a primeira busca numa sessão pode levar alguns segundos.
