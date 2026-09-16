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

Use SEMPRE o script de busca antes de responder. Ele é `scripts/query.mjs` e
roda com Node. **Chame pelo caminho absoluto**: o caminho relativo só funciona
se o diretório atual for o da skill, e o normal é não ser.

O DSH informa o diretório base ao carregar esta skill; nesta máquina é
`C:\Users\rafael.ferreira\.dsh\skills\protheus-tables`. Ou seja:

```sh
node "C:\Users\rafael.ferreira\.dsh\skills\protheus-tables\scripts\query.mjs" search "<termos>"
```

- `search "<termos>" [--limit N]` — busca livre por código de tabela, código de
  campo ou palavra da descrição. Limite padrão: 20.
- `fields "<código>" [<campo>]` — lista os campos da tabela, um por linha. Com o
  código de um campo, mostra a definição inteira. **Use isto antes de citar
  qualquer campo numa query.**
- `table "<código>"` — conteúdo completo da tabela (ex: CN9), com índices.
- `list "<prefixo>" [--limit N]` — lista tabelas por prefixo (ex: CN). Limite
  padrão: 200, com aviso do que ficou de fora.

Códigos de saída: `0` encontrou, `1` nada encontrado, `2` uso inválido (ex:
`list` sem prefixo). Use isso para confirmar a consulta em vez de assumir.

Exemplos:

```sh
node "...\scripts\query.mjs" search "CN9_NUMERO"
node "...\scripts\query.mjs" search "condicao de pagamento"
node "...\scripts\query.mjs" fields "SE2"
node "...\scripts\query.mjs" fields "SE2" E2_SALDO
node "...\scripts\query.mjs" table "CN9"
node "...\scripts\query.mjs" list "CN"
```

**Nunca cite um campo que não apareceu em `fields`.** Campo lembrado de memória
ou deduzido por analogia com outra tabela é a origem mais comum de query errada
(a SE1 não tem o `E2_STATUS` da SE2). Se o campo não aparecer, diga que não está
na base em vez de inventá-lo.

A busca ignora acentos e maiúsculas, então `condicao` acha "Condição". Prefira
termos sem acento quando chamar de um shell onde o encoding possa deturpar o
argumento. Para código de campo exato (`CN9_NUMERO`), o índice resolve por token
e devolve a tabela dona em primeiro lugar; o script imprime uma linha `Dica:`
confirmando qual é.

O prefixo do campo também identifica a tabela, e em tabelas com S inicial o
campo perde o S: `E2_PREFIXO` → SE2, `A1_COD` → SA1, `RD_DTREF` → SRD,
`CT1_CONTA` → CT1, `CN9_NUMERO` → CN9. Quando o campo citado não está no índice,
o script avisa: a tabela veio do prefixo, e o campo pode ser customizado ou não
existir com esse nome.

```sh
node "...\scripts\query.mjs" search "RD_DTREF"   # -> SRD (Histórico de Movimentos)
```

## Escrever SQL sobre o Protheus

Quando a tarefa for escrever, revisar ou explicar uma consulta (DBeaver, dbt,
ETL, script Python), carregue `references/guia-consulta-sql.md` antes. Ele fixa o
padrão do ambiente: nome físico da tabela (`dbo.SE2010` — o sufixo é da empresa),
os filtros que mudam o resultado (`D_E_L_E_T_ = ' '`, `TRIM` nos `CHAR`, data
`AAAAMMDD`, FILIAL de cadastro × de movimento), as junções já validadas
(SE2→SA2, SE2→CN9, SE2→CXN, SE1→SA1) e o checklist antes de entregar.

## Como o resultado é ordenado

A ordem não é a do arquivo. O ranking usa, do mais forte para o mais fraco:
código de tabela exato, nome canônico (X2_NOME) exato, tabela mestra clássica do
conceito, campo pertencente à tabela (o prefixo do campo é o código da tabela),
nome/título contendo os termos. Empates caem para a tabela mestra e depois para
o dicionário mais completo.

Leia as anotações que o script imprime no fim:

- `Dica: ... table "XX"` — a consulta foi resolvida para uma tabela; use `table`
  para o conteúdo completo.
- `[atenção: ... nome praticamente igual ...]` — o mesmo conceito existe em
  vários módulos (`SA1`, `SS2` e `NUH` são "Clientes"; `CT1`, `CS3` e `SI1` são
  "Plano de Contas"). Nesse caso **não** afirme que a tabela é a primeira sem
  confirmar: prefira a que casa com o módulo do usuário (o prefixo dos campos no
  SQL, no ETL ou no dicionário do projeto) e cite as alternativas.
- `[atenção: ... não consta no índice ...]` — o campo consultado não aparece na
  base; o resultado veio do prefixo do campo. Trate como campo a confirmar, não
  como campo documentado.

## Convenções (prefixos comuns)

O prefixo do campo é o código da tabela. Exemplos:

| Tabela | Descrição |
|---|---|
| SA1 | Clientes |
| SA2 | Fornecedores |
| SB1 | Produtos (nome no índice: "Descrição Genérica do Produto") |
| SB2 | Saldos Físico e Financeiro |
| SC5 | Pedidos de Venda |
| SC6 | Itens dos Pedidos de Venda |
| SD1 | Itens das NF de Entrada |
| SD2 | Itens de Venda da NF |
| SD3 | Movimentações Internas |
| SE1 | Contas a Receber |
| SE2 | Contas a Pagar |
| SE4 | Condições de Pagamento |
| SED | Naturezas |
| SF1 | Cabeçalho das NF de Entrada |
| SF2 | Cabeçalho das NF de Saída |
| SX5 | Tabelas (genéricas) |
| CT1 | Plano de Contas |
| CT2 | Lançamentos Contábeis |
| CTT | Centro de Custo |
| CN9 | Contratos |
| CN1 | Tipos de Contrato |
| A00 | Território x Nível do Agrup. |

Não tente memorizar a lista completa — use `list <prefixo>` ou `search` para
descobrir. Campos customizados costumam usar prefixo `X_` ou `Z_`. Campos de
sistema terminam em `_` (`D_E_L_E_T_`, `R_E_C_N_O_`) e existem em toda tabela,
então não identificam nenhuma: a busca os ignora.

## Limitações

- **`SX2`, `SX3` e `SIX` não existem como páginas** neste índice: ele foi
  extraído delas (cada tabela mostra "Tabela(SX2)... Indices(SIX)"). Se pedirem
  a estrutura do dicionário em si, diga isso em vez de inventar conteúdo. Das
  SX, só `SX5` está indexada.
- **Nomes abreviados.** Alguns nomes canônicos encurtam palavras ("NF" em vez de
  "nota fiscal", "Contr.Oper."), então uma consulta por conceito pode não casar
  com o nome. Nesse caso busque pelo código (`SF1`) ou pelo nome que aparece no
  código do usuário.
- **Campos e tabelas internas podem não estar na base.** O índice é público; se
  um campo `X_`/`Z_` ou uma tabela do Protheus da empresa não aparecer, isso não
  prova que não existe — diga que não está na base pública e confirme no
  dicionário interno.
- **Snapshot de 19/08/2025** (data que cada página traz). Para dados novos,
  atualize o clone.
- `table` em tabelas grandes devolve muita coisa (`SA1` ≈ 81 KB); para listar ou
  conferir campos use `fields`, que devolve só a lista. O script avisa quando a
  saída de `table` passa de 20.000 caracteres.
- Somente leitura: o script nunca altera os dados.

## Por que a cópia local importa

O índice é público, mantido por um dev da TOTVS para quebrar um galho — e
justamente por isso não é um serviço com garantia: se o site sair do ar, a
consulta por lá para. Como esta skill mantém o clone em disco, o conhecimento
continua disponível offline. Vale a mesma lógica para ambientes sem internet.

## Atualizar o índice

```sh
git -C "C:\Users\rafael.ferreira\.dsh\skills\protheus-tables" pull
```

O repositório e as melhorias de busca estão documentados em `README.md`.
