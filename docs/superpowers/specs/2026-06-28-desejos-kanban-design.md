# Tela de Desejos com Kanban

## Objetivo

Criar uma tela **Desejos** para planejar compras antes que elas virem gastos reais. A tela deve permitir cadastrar itens como "PlayStation 5", simular o custo mensal, ver se cabe no orcamento do mes e confirmar a compra somente quando ela realmente acontecer.

## Modelo de dados

Adicionar uma tabela propria `desejos`, separada de `lancamentos`, `metas` e `orcamentos`.

Campos principais:

- `id`: UUID.
- `nome`: nome do desejo.
- `descricao`: observacao opcional.
- `status`: `desejo`, `avaliando`, `planejado`, `pronto`, `comprado`, `arquivado`.
- `valor_total`: valor total estimado.
- `parcela_total`: numero de parcelas, padrao `1`.
- `mes_inicio`: mes de referencia em que a compra comecaria.
- `categoria_id`: categoria/envelope onde a compra entraria.
- `conta_id`: conta/cartao preferido, opcional.
- `dono_id`: pessoa responsavel, opcional.
- `prioridade`: `baixa`, `media`, `alta`, opcional para ordenacao visual.
- `lancamento_grupo_id`: grupo gerado quando a compra real for confirmada, opcional.
- `comprado_em`: data/hora de confirmacao da compra, opcional.
- `criado_em` e `atualizado_em`.

A tabela deve ter RLS habilitado e seguir o modelo domestico atual: usuario autenticado acessa tudo. Como ela sera consumida pelo frontend via Supabase Data API, a implementacao deve garantir que a tabela esteja acessivel ao papel `authenticated`.

## Fluxo da tela

A nova rota sera `/desejos`, adicionada ao menu `Mais`.

O Kanban principal tera quatro colunas ativas:

- **Desejos**: ideias ainda soltas.
- **Avaliando**: itens com pesquisa de preco ou decisao em aberto.
- **Planejado**: itens com valor, parcelas, mes e categoria definidos.
- **Pronto pra comprar**: itens que cabem no mes e no envelope.

Itens com status `comprado` ou `arquivado` nao aparecem no Kanban principal. A tela tera uma secao compacta de historico para consultar compras confirmadas, sem lotar o quadro.

Os cards serao movidos por botoes/menu **Mover para...**, nao por arrastar-e-soltar na primeira versao. Isso mantem a experiencia estavel no celular e evita nova dependencia.

## Regra de viabilidade

Para cada desejo planejado:

1. Calcular `custo_mensal = valor_total / parcela_total`.
2. Usar `mes_inicio` como mes de referencia da simulacao.
3. Calcular a sobra do mes com a renda efetiva e as saidas planejadas/realizadas ja existentes.
4. Calcular o restante do envelope da `categoria_id`.
5. Exibir estado:
   - verde quando `custo_mensal` couber na sobra do mes e no restante do envelope;
   - vermelho quando estourar a sobra ou o envelope;
   - neutro quando faltarem dados essenciais como valor, categoria ou mes.

O card deve mostrar um motivo curto, por exemplo:

- "Cabe na sobra do mes."
- "Estoura Mercado em R$ 320,00."
- "Informe categoria e mes para simular."

## Confirmacao de compra

Ao clicar em **Confirmar compra**, abrir um dialogo de revisao com:

- data da compra;
- conta/cartao;
- categoria;
- valor total;
- numero de parcelas;
- pessoa responsavel;
- observacao.

Ao confirmar, o app deve criar os lancamentos reais em `lancamentos` usando a logica ja existente de expansao de parcelas. Em seguida, deve atualizar o desejo para `comprado`, preencher `comprado_em` e guardar `lancamento_grupo_id` quando houver grupo de parcelas. O desejo sai do Kanban principal e fica no historico.

Se a criacao dos lancamentos falhar, o desejo nao deve mudar para comprado.

## Interface

A tela deve seguir o estilo atual do app: mobile-first, cards compactos, botoes com icones lucide e linguagem calma.

Elementos principais:

- cabecalho com titulo **Desejos** e botao **Novo**;
- resumo superior com total mensal simulado, quantidade de itens prontos e quantidade de itens bloqueados;
- colunas horizontais rolaveis no celular;
- cards com nome, custo mensal, valor total, parcelas, categoria, status de viabilidade e acoes;
- dialogo de criacao/edicao do desejo;
- dialogo de confirmacao de compra.

## Testes e validacao

- Testar calculo de viabilidade para desejo que cabe na sobra e no envelope.
- Testar desejo que estoura envelope.
- Testar desejo sem categoria/mes/valor, retornando estado neutro.
- Testar confirmacao de compra parcelada criando lancamentos reais e arquivando o desejo.
- Testar falha na confirmacao sem alterar o status do desejo.
- Rodar `npm run build`.

## Decisoes fechadas

- Desejos serao uma tabela propria.
- Compra planejada nao vira lancamento real ate confirmacao.
- Viabilidade usa o mes escolhido, a sobra do mes e o envelope da categoria.
- A primeira versao usa botoes/menus para mover cards, sem drag-and-drop.
- Comprados saem do Kanban principal e ficam em historico.
