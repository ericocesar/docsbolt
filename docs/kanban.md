# Tutorial: Criando um Kanban no Docsbolt

Este guia mostra, passo a passo, como criar um quadro Kanban, adicionar colunas (etapas) e criar cards.

> **Pre-requisitos**
> - App rodando em `http://localhost:3000` (ou `http://localhost:5173` em modo dev)
> - Logado em um workspace
> - Feature **Bases** ativa (Settings → License deve mostrar *Enterprise*)

---

## Parte 1 — Criar o Kanban

### Opção A — A partir de uma página vazia (mais rápido)

1. Crie uma nova página (botão **+** na sidebar do espaço, ou `/base` no editor).
2. Com a página vazia aberta, aparece a faixa **"Get started with"** no corpo da página.
3. Clique no chip **Kanban**.
4. O Docsbolt converte a página em um quadro e cria automaticamente:
   - Uma propriedade **Status** (tipo *status*) com as etapas padrão: **To do**, **In progress**, **Done**
   - Uma view **Kanban** agrupada por Status

> O chip **Base** cria um quadro vazio (tabela) sem etapas pré-definidas — use-o se quiser montar as colunas do zero.

### Opção B — Inserir um quadro dentro de uma página existente

1. Abra a página desejada no editor.
2. Digite `/base` (ou use o menu de blocos) e escolha **Base**.
3. Selecione **Kanban** no submenu.
4. Um quadro embutido é criado como sub-página.

### Resultado esperado

Você verá um quadro com as colunas de Status mais uma coluna extra **"Sem valor"** (No value) — ela guarda cards sem Status definido e aparece por padrão, não é um erro:

```
┌─────────────┬───────────────┬────────┬───────────┐
│   To do     │  In progress  │  Done  │ Sem valor │
├─────────────┼───────────────┼────────┼───────────┤
│             │               │        │           │
│  (vazio)    │   (vazio)     │(vazio) │ (vazio)   │
└─────────────┴───────────────┴────────┴───────────┘
```

Para ocultá-la: menu **⋮** da coluna → **Hide group** (Ocultar grupo).

---

## Parte 2 — Adicionar colunas (etapas)

As colunas do Kanban **são as opções (choices) da propriedade usada para agrupar** (por padrão, *Status*). Não existe um botão "adicionar coluna" separado — você adiciona uma **opção** à propriedade Status.

> **Onde fica "Edit property"?** No **cabeçalho de cada coluna** há dois controles à direita: um ícone **⋮** (três pontos) e um **+**. O menu **⋮** é o que abre as opções da propriedade. Clicar no **nome/título** da coluna só renomeia aquela etapa — não abre o editor de opções.

### Passo a passo

1. No cabeçalho de qualquer coluna, clique no ícone **⋮** (três pontos, à direita do nome).
2. Escolha **Edit property** (Editar propriedade) — abre o editor de opções da propriedade de agrupamento (Status).
3. Clique em **+ Add option**.
4. Digite o nome da nova etapa (ex: `Blocked`).
5. Escolha uma cor para a etapa (paleta rotativa automática).
6. (Opcional) Para etapas do tipo *status*, marque a **categoria**: `To do` / `In progress` / `Done` — isso controla o "tom" da coluna.
7. Clique em **Save**.

A nova coluna **Blocked** aparece imediatamente no quadro.

### Reordenar colunas

- Segure o **cabide (⠿)** que aparece no cabeçalho da coluna ao passar o mouse e **arraste** para a esquerda/direita. A ordem fica salva na view (`choiceOrder`).
- Alternativa: no editor de opções, use **Alphabetize** para ordenar por nome.

### Ocultar uma coluna

- Menu **⋮** da coluna → **Hide group** (Ocultar grupo). Ela some do quadro mas os cards permanecem (visíveis na view Table).
- Para reexibir: editor de opções da propriedade → reative a opção (ou limpe `hiddenChoiceIds` no menu da view).

---

## Parte 3 — Adicionar cards

### Método 1 — Botão "+" da coluna

1. Em qualquer coluna, clique no **+** no cabeçalho (à direita do ⋮) para criar um card no topo.
2. O card é criado e abre o modal de detalhes — digite o título nele.
3. O card entra na coluna escolhida com o valor de Status correspondente.

> Se não houver botões **+** nem ⋮ nos cabeçalhos e nem "Nova linha" no rodapé, o quadro está em modo somente leitura (sem permissão de edição ou falha de permissão — ver Troubleshooting).

### Método 2 — Botão do rodapé

- No rodapé de cada coluna há um botão **+ Nova linha** (New row): cria um card no fim da coluna e abre o modal de detalhes para digitar o título.

### Método 3 — Via view Table

1. Crie uma view **Table** (menu **+** de views → **Table**).
2. Adicione linhas normalmente; preencha a coluna **Status** com a etapa desejada.
3. Volte para a view Kanban — o card aparece na coluna certa.

---

## Parte 4 — Mover cards entre colunas

- **Arraste** o card de uma coluna para outra. O valor da propriedade Status do card é atualizado automaticamente para a etapa da coluna de destino.
- Alternativa: abra o card (clique) e mude o campo **Status** manualmente.

---

## Parte 5 — Personalizar o quadro

### Adicionar mais campos (propriedades)

1. Menu da propriedade → **+ New property**.
2. Escolha o tipo: `text`, `number`, `select`, `status`, `date`, `person`, `checkbox`, `url`, `email`, `formula`, etc.
3. Exemplo: adicione **Priority** (tipo *select*) com opções `Low` / `Medium` / `High`.

### Trocar a coluna de agrupamento

1. Na barra de ferramentas do quadro (à direita, aparece apenas na view Kanban), clique no ícone **Agrupar por** (ícone de colunas).
2. Escolha outra propriedade dos tipos `select` ou `status` (ex: agrupar por **Priority** em vez de **Status**).
3. As colunas passam a refletir as opções da nova propriedade.

### Filtros e ordenação

- **Filter**: ícone do **funil** na barra de ferramentas → adicione condições (ex: mostrar só cards com `Priority = High`). No Kanban, o filtro se aplica às colunas visíveis.
- **Sort**: o painel de ordenação aparece apenas na view **Table** (no Kanban os cards seguem a ordem de arraste).

### Views (Kanban / Table)

- As views ficam nas **abas à esquerda da barra de ferramentas** (ex: aba "Kanban"). Para criar uma view **Table**: clique no **+** ao lado da última aba → escolha **Table**. O **+** só aparece se você tiver permissão de edição.

---

## Troubleshooting

| Sintoma | Causa / Solução |
|---|---|
| Não aparece a faixa "Get started with" | A página não está vazia, você não tem permissão de edição, ou a sincronização (websocket) ainda não conectou — aguarde/recarregue. Alternativa: use `/base` no editor. |
| Chip Kanban não aparece | Feature **Bases** desativada. Verifique Settings → License (Enterprise) e recarregue. |
| Colunas não aparecem após adicionar opção | Recarregue a página (Cmd/Ctrl+R). Se persistir, confirme que a propriedade de agrupamento é `select` ou `status`. |
| Card some ao mover | Ele foi filtrado pela view (Filter ativo). Remova o filtro ou veja na view Table. |
| Coluna vazia extra ("Sem valor") | Não é erro — é a coluna de cards sem Status. Oculte com menu **⋮** → **Hide group**. |
| Sem botões **+**/**⋮** nas colunas, sem "Nova linha", sem menu de views | Quadro em modo somente leitura. Em base embutida numa página, recarregue — versões antigas liam a permissão do lugar errado (correção em `base-embed-view.tsx`). Confirme também que você pode editar a página e que Settings → License mostra Enterprise. |
| Menu "Propriedades do cartão" mostra só Status | Esperado num quadro novo: Status é a propriedade primária e não aparece na lista. Adicione outras propriedades (**New property**) para vê-las ali. |
| Erro 500 ao criar propriedade | Atualize o servidor (`git pull` + restart). Correção aplicada em `fix(ee): generate base property id on create`. |

---

## Modelo de dados (referência)

```
Base (página com is_base=true)
├── Properties (colunas de dados)
│   ├── Status (type: status)
│   │   └── typeOptions.choices = [todo, in_progress, done, ...]  ← as COLUNAS do Kanban
│   └── Priority (type: select)
│       └── typeOptions.choices = [low, medium, high]
├── Rows (os CARDS)
│   └── cells = { status: "todo", priority: "high", ... }
└── Views (formas de visualizar)
    └── Kanban
        └── config.groupByPropertyId = "status"   ← qual propriedade vira coluna
            config.choiceOrder = [...]             ← ordem das colunas
```

**Regra de ouro:** *coluna = opção da propriedade de agrupamento; card = linha (row) cujo valor dessa propriedade define em qual coluna ela fica.*
