# protheus-tables — skill offline de tabelas Protheus

Skill (formato Agent Skills) que dá a qualquer agente (Claude Code, DeepSeek
Harness, etc.) acesso offline a **10.632 tabelas** do dicionário de dados
Protheus/TOTVS: tabelas, campos, índices, descrições, help, relações e triggers.

- **Sem servidor.** Tudo roda local, o índice fica embutido em `data/`.
- **Sem instalação de dependências.** O script de busca é Node puro
  (`scripts/query.mjs`), e qualquer harness de agente já tem Node.
- **Só baixar uma pasta.** Igual qualquer skill: joga na pasta de skills e pronto.
- **Resistente a queda do site.** A base do sempreju é pública, feita por um dev
  da TOTVS para quebrar um galho — não é um serviço com garantia. Como o clone
  fica em disco, o dicionário continua consultável se o site sair do ar ou se a
  máquina estiver sem internet.

## Para quem vai USAR (não técnico)

A pessoa só copia e cola isto no Claude Code (uma vez):

```
Instale a ferramenta de tabelas Protheus. Clone o repositório
https://github.com/Radsfer/protheus-tables para dentro da pasta
~/.claude/skills/protheus-tables (crie a pasta "skills" se não existir).
Quando terminar, me diga que está pronta.
```

Depois, abra uma conversa nova e pergunte normal:

> O que é o campo `CN9_NUMERO`? Em qual tabela fica e o que significa?

> Qual tabela guarda a condição de pagamento de contrato?

> Me mostra todos os campos da tabela de contratos.

## Para quem vai USAR no DeepSeek Harness (DSH)

Copie e cole isto no agente (uma vez):

```
Instale a skill protheus-tables. Clone o repositório
https://github.com/Radsfer/protheus-tables para dentro de
~/.dsh/skills/protheus-tables (ou .dsh/skills/protheus-tables no projeto).
Quando terminar, confirme que está pronta.
```

O DSH descobre a skill automaticamente pela pasta; depois é só perguntar.

## Instalação manual (fallback)

Descompacte/baixe o repositório e coloque a pasta `protheus-tables` em:

| Harness | Pasta de skills |
|---|---|
| Claude Code (pessoal) | `~/.claude/skills/` |
| Claude Code (projeto) | `.claude/skills/` |
| DeepSeek Harness (usuário) | `~/.dsh/skills/` |
| DeepSeek Harness (projeto) | `.dsh/skills/` |

## Como a busca funciona (uso direto, sem agente)

Use o caminho absoluto do script para rodar de qualquer diretório:

```sh
node scripts/query.mjs search "CN9_NUMERO"              # busca exata por campo
node scripts/query.mjs search "condicao de pagamento"   # busca por palavras
node scripts/query.mjs search "contratos"               # acha a tabela pelo nome
node scripts/query.mjs fields "SE2"                     # lista os campos da tabela
node scripts/query.mjs fields "SE2" E2_SALDO            # definição de um campo
node scripts/query.mjs table "CN9"                      # conteúdo completo da tabela
node scripts/query.mjs list "CN"                        # todas as tabelas CN*
node scripts/query.mjs list "S" --limit 50              # teto da listagem
```

A busca ignora acentos e maiúsculas. O resultado sai **ordenado por relevância**,
não na ordem do arquivo: código de tabela exato, nome canônico exato, tabela
mestra clássica do conceito (vários módulos repetem nome — "Clientes" está em
SA1, SS2 e NUH), campo pertencente à tabela (`CN9_NUMERO` pertence à CN9) e, por
fim, nome/título contendo os termos. Empates caem para a tabela mestra e depois
para o dicionário mais completo.

Duas anotações aparecem no fim da saída: `Dica:` quando a consulta foi resolvida
para uma tabela (sugerindo `table`), e `[atenção: ...]` quando outro resultado
tem nome praticamente igual — aí a escolha depende do módulo do usuário.

Códigos de saída: `0` encontrou, `1` nada encontrado, `2` uso inválido.

## Para o mantenedor: como regenerar o índice

Os arquivos de `data/` vêm do projeto-mãe (`scrpper sem preju`). Para atualizar
a base (ex: depois de baixar novas tabelas do sempreju.com.br ou importar dados
do Protheus interno), rode no projeto-mãe:

```sh
python build_fast_site.py
```

e copie os três arquivos gerados para cá:

```sh
cp site_tabelas/data/meta.json.gz   protheus-tables/data/
cp site_tabelas/data/inv.json.gz    protheus-tables/data/
cp site_tabelas/data/texts.json.gz  protheus-tables/data/
```

Depois dê commit e push — os usuários só precisam refazer o clone/atualizar.

## Proveniência dos dados

Os dados são extraídos de <https://sempreju.com.br/tabelas_protheus> e de
exportações do dicionário de dados do Protheus (SX2/SX3/SIX). A base é pública e
comunitária; mesmo assim, tabelas e campos customizados da sua empresa podem não
estar nela — verifique a política da empresa antes de publicar dados próprios.
