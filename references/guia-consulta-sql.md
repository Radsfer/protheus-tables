# Guia: escrever consulta SQL no banco do Protheus

Padrão para montar SQL confiável sobre as tabelas do Protheus neste ambiente.
Carregue este arquivo quando a tarefa for escrever, revisar ou explicar uma
consulta (DBeaver, dbt, ETL ou script Python).

## 1. Nome físico da tabela

O dicionário fala em código lógico (`SE2`, `SA2`, `CXN`, `CTT`); no banco a
tabela é o código mais o sufixo da empresa/filial:

| Ambiente | Nome físico |
|---|---|
| SQL Server (Protheus SA) | `dbo.SE2010`, `dbo.SA2010`, `dbo.CXN010`, `dbo.CTT010` |
| dbt — staging | `source('protheus','protheussa_SE2010')` |
| dbt — RBC | `source('protheus','protheus_SE2010')`, discriminado pela coluna `base` |

O sufixo (`010`, `020`…) muda por ambiente, e a base RBC é outro conjunto de
tabelas. Confirme o sufixo no ambiente antes de rodar; o dicionário não o traz.

As colunas já vêm com o prefixo do campo (`E2_`, `A2_`, `CXN_`), igual ao código
que esta skill mostra.

## 2. Filtros que mudam o resultado

- **`D_E_L_E_T_ = ' '`** (um espaço) em toda tabela usada. Espaço = ativo,
  `'*'` = excluído logicamente. `D_E_L_E_T_ = ''` não é o padrão do Protheus e só
  passa onde o banco ignora espaços à direita.
- **`CHAR` vem preenchido com espaços** até o tamanho do campo: compare com
  `RTRIM`/`TRIM` (`RTRIM(A2.A2_CGC) = '07322276000135'`).
- **Datas são `CHAR(8)`** no formato `AAAAMMDD`. Compare como string
  (`BETWEEN '20260101' AND '20261231'`); não converta para `date` sem precisar.
- **FILIAL do movimento ≠ FILIAL do cadastro.** `E2_FILIAL` é a empresa que
  lançou o título; em cadastro compartilhado (`SA1`, `SA2`, `SB1`, `CT1`, `CTT`)
  o campo FILIAL guarda a filial de cadastro. Filtrar o cadastro pela filial do
  movimento é a principal causa de linhas perdidas.
- **Escape o que não for o foco.** Títulos de adiantamento, provisão e
  transferência se misturam ao movimento: `E2_TIPO`, `E2_NATUREZ` e
  `E2_CCUSTO` costumam ser os campos que separam o que interessa.

## 3. Antes de escrever: confirmar cada campo

Nunca cite um campo por memória nem por analogia com outra tabela (o
`E2_STATUS` da SE2 não tem equivalente na SE1).

```sh
node "…/scripts/query.mjs" fields "SE2"              # todos os campos, um por linha
node "…/scripts/query.mjs" fields "SE2" E2_SALDO     # um campo, com a descrição inteira
node "…/scripts/query.mjs" search "vencimento real"  # não sei o código do campo
node "…/scripts/query.mjs" table "CXN"               # índices e relações (útil p/ performance)
```

Se o campo não aparecer, diga que ele não está na base pública — não invente.
Campos marcados `Virtual` são calculados pela rotina do Protheus: a coluna
existe, mas pode estar defasada em registro alterado por carga direta.

## 4. Junções validadas

| De → Para | Condição |
|---|---|
| SE2 → SA2 (fornecedor) | `A2_COD = E2_FORNECE AND A2_LOJA = E2_LOJA` |
| SE2 → CN9 (contrato) | `CN9_NUMERO = E2_MDCONTR AND CN9_REVISA = E2_MDREVIS` |
| SE2 → CXN (planilha/cronograma da medição) | `CXN_CONTRA = E2_MDCONTR AND CXN_REVISA = E2_MDREVIS AND CXN_NUMPLA = E2_MDPLANI AND CXN_CRONOG = E2_MDCRON` |
| SE2 → CTT (centro de custo) | `CTT_CUSTO = E2_CCUSTO` |
| SE1 → SA1 (cliente) | `A1_COD = E1_CLIENTE AND A1_LOJA = E1_LOJA` |
| SRD (histórico de movimentos) → CTT | `CTT_CUSTO = RD_CC` |

E2_MDCONTR, E2_MDREVIS, E2_MDPLANI e E2_MDCRON são o "Cronograma Financeiro do
Contrato" gravado no próprio título — é por eles que um título a pagar aponta
para contrato e medição, e não por E2_PEDIDO ou E2_NUM.

Não inclua `FILIAL` nas junções de cadastro sem conferir antes:

```sql
SELECT A2_COD, A2_LOJA, COUNT(*) AS linhas, COUNT(DISTINCT A2_FILIAL) AS filiais
FROM dbo.SA2010
WHERE D_E_L_E_T_ = ' '
GROUP BY A2_COD, A2_LOJA
HAVING COUNT(*) > 1;
```

Se voltar linha, o cadastro tem mais de uma cópia por fornecedor: sem `FILIAL` a
junção multiplica títulos; com `FILIAL` ela pode esconder títulos lançados por
outra filial. Escolha de forma consciente e diga qual escolheu.

## 5. Situação do título (aberto / baixado)

- Em aberto: `RTRIM(E2_BAIXA) = ''` e `E2_SALDO > 0` — `E2_SALDO` é o "Valor em
  aberto do título", recalculado a cada movimentação; `E2_VALOR` é o valor
  original.
- `E2_STATUS` (`A` = Aberto, `B` = Baixado, `R` = Reliquidado) existe, mas é
  campo virtual mantido pela rotina de liquidação. Os modelos deste projeto
  derivam a situação de `E2_BAIXA`/`E2_SALDO` (ver
  `int_contas_pagar_titulos`); use `E2_STATUS` como conferência, não como fonte.

## 6. Checklist antes de entregar

1. Todo campo citado apareceu em `fields`.
2. `D_E_L_E_T_ = ' '` em todas as tabelas usadas.
3. O período usa o campo certo — emissão, vencimento ou baixa — e você disse
   qual escolheu.
4. `INNER JOIN` só onde é intencional: juntar medição ou cadastro com `INNER`
   esconde todo título que não passa por lá. Para "as contas do fornecedor",
   `LEFT JOIN` mais uma condição explícita.
5. `TRIM`/`RTRIM` nos `CHAR` comparados.
6. Nome físico da tabela confirmado (sufixo da empresa, base SA ou RBC).
