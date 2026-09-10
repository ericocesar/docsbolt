# Bloco Sincronizado entre Páginas

> Guia completo do recurso **Synced block** (internamente chamado de *transclusion*) do DocsBolt/Docmost.

Um **bloco sincronizado** é um trecho de conteúdo criado em uma página (a **origem**) e **espelhado como somente-leitura em qualquer outra página** (as **referências**). Edite uma vez na origem e todas as cópias são atualizadas automaticamente.

```
Página A (ORIGINAL)              Página B (referência)        Página C (referência)
┌─────────────────────┐          ┌─────────────────────┐      ┌─────────────────────┐
│ Bloco sincronizado  │ ───────▶ │ ▸ mesmo conteúdo    │      │ ▸ mesmo conteúdo    │
│ - texto             │  sync    │   (somente leitura) │      │   (somente leitura) │
│ - tabela, imagem... │          └─────────────────────┘      └─────────────────────┘
└─────────────────────┘
   edita aqui ──► propaga para todas
```

---

## 1. Conceitos

| Conceito | Nome técnico | O que é |
|---|---|---|
| **Origem** | `transclusionSource` | O bloco “verdadeiro”. Contêiner editável que mora em uma página. Tem um `id` único (gerado via extensão `UniqueID`). |
| **Referência** | `transclusionReference` | Espelho somente-leitura colado em outra página. Guarda apenas dois ponteiros: `sourcePageId` + `transclusionId`. Não duplica o conteúdo. |
| **Chave de sincronização** | `sourcePageId::transclusionId` | Identificador composto usado pelo frontend e pelo backend para buscar conteúdo, listar páginas vinculadas e resolver permissões. |
| **Índice servidor** | `page_transclusions` + `page_transclusion_references` | Tabelas Postgres sincronizadas a cada salvamento colaborativo. Permitem lookup em lote, contagem de “sincronizado com N páginas” e checagem de acesso sem abrir o documento Yjs. |

Pontos importantes do modelo:

- **Fonte única da verdade:** o conteúdo vive só na página de origem. A referência resolve o conteúdo em tempo de leitura via API (`POST /pages/transclusion/lookup`).
- **Edição só na origem:** referências renderizam em um editor Tiptap aninhado com `editable={false}` (`transclusion-content.tsx`). Para alterar, clique em **Edit source** (ícone lápis) e edite na página original.
- **Sem aninhamento:** um bloco sincronizado **não pode conter outro bloco sincronizado** — nem como origem dentro de origem, nem como referência dentro de origem. Isso mantém o grafo de transclusão **acíclico** e dispensa travessia com detecção de ciclo (ver `packages/editor-ext/src/lib/transclusion/constants.ts`).
- **Nós atômicos vs. contêiner:** a origem é um nó contêiner (`defining + isolating`, editável); a referência é um nó `atom: true` (selecionável como um todo, não editável por dentro).

---

## 2. Como criar um bloco sincronizado

### 2.1 Via menu `/` (slash menu)

1. Em qualquer página, digite `/` e busque por **`sync`**, **`synced`**, **`bloco sincronizado`**, `excerpt`, `transclusion` ou `reusable`.
2. Escolha **Synced block / Bloco sincronizado** — *“Create a block that stays in sync across pages.”* (`apps/client/src/features/editor/components/slash-menu/menu-items.ts:570`).
3. Um bloco destacado é inserido no cursor com um parágrafo vazio dentro.
4. Digite o conteúdo dentro dele: texto, títulos, listas (incluindo to-do), citação, código, tabela, imagem, vídeo, áudio, anexo, PDF, callout, toggle (`details`), embed/iframe, equação, Draw.io, Excalidraw, colunas, bloco YouTube, lista de subpáginas.

> Se o cursor estiver em um parágrafo vazio, o parágrafo é **substituído** pelo bloco; caso contrário o bloco é inserido na posição. Se o cursor já estiver **dentro** de outro bloco sincronizado, o comando é recusado (retorna `false`).

### 2.2 Identidade do bloco

- Cada origem recebe um atributo `id` (ex.: `data-id="..."` no HTML). O `UniqueID` do editor gera e mantém esse id para `heading`, `paragraph` e `transclusionSource`.
- Não edite esse id manualmente. É ele que liga todas as referências (`data-transclusion-id`).

---

## 3. Como espelhar em outra página (copiar → colar)

Existem duas formas equivalentes — ambas produzem o mesmo HTML de referência:

```html
<div data-type="transclusionReference"
     data-source-page-id="<ID-DA-PAGINA-ORIGEM>"
     data-transclusion-id="<ID-DO-BLOCO>"></div>
```

### Passo a passo (botão Copiar)

1. Passe o mouse sobre o **bloco origem**. Uma barra flutuante aparece no topo (só em modo edição).
2. Clique no ícone **Copy synced block / Copiar bloco sincronizado** (ou aguarde o tooltip “Copied”).
   - O HTML acima é gravado na área de transferência como `text/html` **e** `text/plain` (com fallback para `writeText` em navegadores sem `ClipboardItem`).
   - Um toast confirma: *“Copied. Paste on any page to embed this synced block.”* (`transclusion-view.tsx:33`).
3. Abra a **página de destino** e **cole** (`Ctrl/Cmd + V`). O editor interpreta o `div[data-type="transclusionReference"]` e cria o espelho.
4. O espelho renderiza o conteúdo da origem em segundos (com batch + cache — ver § 6).

### Indicadores visuais após colar

- Na **origem**, o selo no topo passa a ler **“Editing original / Editando original”**.
- Na **referência**, o selo lê **“Synced to N other pages / Sincronizado com N outras páginas”**.
- Clicando no selo abre o **dropdown de páginas vinculadas** (§ 5).

---

## 4. Editando, atualizando e navegando

### 4.1 Editar (sempre na origem)

- Edite normalmente **dentro do bloco origem**. Cada tecla é sincronizada via colaboração em tempo real (Yjs/Hocuspocus) na página origem e persistida no servidor.
- Nas referências **não há edição**: o bloco é somente-leitura por construção. O dropdown da referência mostra o aviso: *“This section is read-only here. Edit it on the original source page.”*
- Atalho: na referência, clique no ícone **lápis (Edit source)** para pular para a página origem com âncora `#<transclusionId>`.

### 4.2 Atualizar uma referência (Refresh)

- Na barra da referência há um botão **Refresh / Atualizar** (ícone circular). Ele ignora cache e força uma nova leitura no servidor (`refresh(key)` no `transclusion-lookup-context.tsx`).
- Use após suspeita de conteúdo desatualizado, após restaurar permissões ou após edição simultânea intensa.

### 4.3 Navegação por âncora

- Links para a origem têm o formato `/p/<sourcePageId>#<transclusionId>` (ou URL amigável com `spaceSlug` via `buildPageUrl`). Isso rola até o bloco exato.

---

## 5. O dropdown “Sincronizado com…”

Componente: `apps/client/src/features/transclusion/components/sync-block-references-dropdown.tsx`.

- **Modo `source`** (na origem): selo **“Editing original”**.
- **Modo `reference`** (no espelho): selo **“Synced to N other pages”**, onde `N` = total de páginas vinculadas **exceto a atual**.
- Conteúdo do dropdown:
  - Banner (só em referências) com link para a página original.
  - Seção **“Synced to / Sincronizado com”** listando **origem + todas as referências**, cada linha com ícone/emoji, título (ou “Untitled / Sem título”) e selos:
    - `ORIGINAL` — a página onde mora o bloco verdadeiro.
    - `THIS PAGE / ESTA PÁGINA` — a página que você está vendo agora.
  - Clique em qualquer linha navega até aquela página.
- A contagem é alimentada pela query `useReferencesQuery(sourcePageId, transclusionId)` (`POST /pages/transclusion/references`), com cache compartilhado entre origem e referência (mesma chave), então não há fetch duplicado.

---

## 6. Como a sincronização funciona por dentro

### 6.1 Visão em camadas

```
┌─ Editor (Tiptap) ──────────────────────────────────┐
│ transclusionSource (editável, com NodeView + menu)  │
│ transclusionReference (átomo, NodeView somente-leit)│
└───────────────────────┬────────────────────────────┘
                        │ Yjs / Hocuspocus (tempo real)
┌─ Servidor (NestJS) ───┴────────────────────────────┐
│ persistence.extension → syncPageTransclusions()     │
│                         syncPageReferences()        │
│ tabelas: page_transclusions /                       │
│          page_transclusion_references                │
└───────────────────────┬────────────────────────────┘
                        │ POST /pages/transclusion/lookup (lote)
┌─ Leitura ─────────────┴────────────────────────────┐
│ TransclusionLookupProvider (batch 10ms + debounce,  │
│   cache, dedup in-flight, refresh forçado)          │
│ TransclusionContent (sub-editor read-only aninhado) │
└────────────────────────────────────────────────────┘
```

### 6.2 Salvamento (origem → banco)

- A cada persistência colaborativa, `persistence.extension.ts:261` chama:
  - `transclusionService.syncPageTransclusions(pageId, workspaceId, pmJson)` — extrai todos os `transclusionSource` do JSON ProseMirror (`collectTransclusionsFromPmJson`), compara com o banco por `transclusionId` (comparação profunda com `isDeepStrictEqual`) e faz insert/update/delete diferencial, retornando `{ inserted, updated, deleted }`.
  - `transclusionService.syncPageReferences(referencePageId, ...)` — mesmo para `transclusionReference` via `collectReferencesFromPmJson`.
- Se a origem for excluída, o registro some de `page_transclusions`; referências passam a resolver como **not_found** (placeholder “The original synced block no longer exists / O bloco sincronizado original não existe mais”).

### 6.3 Leitura (referência → tela)

1. Cada `TransclusionReferenceView` se inscreve no `TransclusionLookupProvider` com a chave `sourcePageId::transclusionId`.
2. O provider **agrupa (batch)** todas as inscrições em uma janela de ~10 ms e dispara **um único** `POST /pages/transclusion/lookup` com `references: [{sourcePageId, transclusionId}, ...]`.
3. Respostas alimentam `resultCacheRef` + assinantes; enquanto carrega, a referência mostra um espaço reservado (`minHeight: 24`); erros de rede mantêm o estado pendente e liberam `inFlight` para nova tentativa.
4. O `TransclusionContent` renderiza o `content` retornado em um **sub-editor Tiptap somente-leitura**, com eventos de mouse/drag isolados (`stopPropagation`) para não confundir seleção/arrasto com o editor hospedeiro.

### 6.4 Permissões e compartilhamento

- **App autenticado:** `lookupTransclusion` valida permissão pessoal na página origem via `PageAccessService`. Sem acesso → status `no_access` → placeholder **“You don't have access to this synced block / Você não tem acesso a este bloco sincronizado”**.
- **Link compartilhado (`shareId`):** usa `POST /shares/transclusion/lookup`; a origem precisa ter share próprio ou herdado do grafo de compartilhamento.
- **Espaço público (`spaceSlug`):** usa `POST /public-spaces/transclusion/lookup`; a origem precisa estar publicada no espaço.
- Falha inesperada de render → `ErrorBoundary` mostra **“Failed to load this synced block / Falha ao carregar este bloco sincronizado”** (`error-placeholder.tsx`).

---

## 7. Ações disponíveis (barra flutuante)

### Na origem (`TransclusionView`)

| Ação | Rótulo PT-BR | Efeito |
|---|---|---|
| Dropdown de páginas | Editando original | Lista origem + referências; navega entre elas. |
| Copiar | Copiar bloco sincronizado | Copia HTML da referência (§ 3). |
| Menu `⋯` → Unsync | Desfazer sincronização | **Desmonta o contêiner origem** naquela posição: mantém o conteúdo interno como blocos normais (`tr.replaceWith(start, end, node.content)`). As referências existentes passam a dar `not_found` (a origem deixou de existir como bloco). |
| Menu `⋯` → Delete | Excluir bloco sincronizado | Apaga origem **e** conteúdo (`deleteNode()`). Referências passam a mostrar “não existe mais”. |

### Na referência (`TransclusionReferenceView`)

| Ação | Efeito |
|---|---|
| Dropdown de páginas | Mostra “Sincronizado com N outras páginas” + banner somente-leitura + lista navegável. |
| Refresh | Releitura forçada do servidor. |
| Lápis (Edit source) | Navega para a página origem com âncora. |
| Menu `⋯` → Unsync | **Congela uma cópia local**: chama `POST /pages/transclusion/unsync-reference` (que resolve o conteúdo atual + reescreve anexos via `rewriteAttachmentsForUnsync`) e **substitui o átomo pelos blocos reais** (`insertContentAt({from, to}, content)`). A partir daí a cópia é independente — edições na origem não propagam mais. |
| Menu `⋯` → Remove | **Remove da página** (`deleteNode()`). Apaga só o espelho na página atual; origem e outros espelhos intactos. Rótulo: “Remove from page”. |

> **Unsync na origem ≠ Unsync na referência.** Na origem, “unsync” dissolve o contêiner (vira conteúdo normal e quebra os espelhos). Na referência, “unsync” materializa o conteúdo (vira cópia independente e preserva o texto).

---

## 8. O que pode (e não pode) ir dentro do bloco

Allow-list oficial (`TRANSCLUSION_SOURCE_ALLOWED_NODE_TYPES`):

`paragraph`, `heading`, `blockquote`, `codeBlock`, `horizontalRule`, `bulletList`, `orderedList`, `taskList`, `image`, `video`, `audio`, `attachment`, `callout`, `details` (toggle), `embed`, `mathBlock`, `table`, `drawio`, `excalidraw`, `pdf`, `subpages`, `columns`, `youtube`.

Regras:

- ✅ Praticamente todo bloco de nível superior do editor.
- ❌ **Sem bloco sincronizado dentro de bloco sincronizado** (nem origem, nem referência) — o editor bloqueia inserção aninhada.
- ❌ Nós exclusivamente filhos (`listItem`, `tableRow`, `column`, etc.) não entram diretamente — já são regidos pelos pais (lista, tabela, colunas).
- Exportação DOCX: `transclusionSource` é serializado normalmente; `transclusionReference` é ignorado no export (`packages/editor-ext/src/lib/prosemirror-docx/schema.ts:159/194`) — o DOCX leva o conteúdo visível conforme renderizado, não o ponteiro.

---

## 9. Casos de uso recomendados

- **Avisos e políticas repetidas:**LGPD, SLA, horário de suporte — um bloco origem em “Central de políticas”, espelhado em manuais e propostas.
- **Cabeçalhos de projeto:** status, responsável, links — origem na página do projeto, espelhos em atas e relatórios.
- **Snippets de documentação:** comandos de instalação, pré-requisitos, tabelas de preços — edita uma vez, propaga para todos os tutoriais.
- **Assinaturas e rodapés:** contato do time, links úteis — espalhe sem copiar-e-colar manual.
- **Roadmap/OKR resumido:** números-chave mantidos em uma página e exibidos em várias dashboards de texto.

Anti-padrões: não use para conteúdo que **vai divergir** por página (prefira duplicar e fazer Unsync logo após colar); não use como “pasta” para dezenas de páginas gigantes (cada espelho é uma leitura adicional em lote — funciona, mas polui o dropdown).

---

## 10. Duplicação, impressão e limitações conhecidas

- **Duplicar espaço/página** (`page.service.ts:650`): referências têm o `sourcePageId` **remapeado para as cópias** quando a origem também foi duplicada; transclusões e referências das páginas novas são reinseridas em lote (`insertTransclusionsForPages`, `insertReferencesForPages`). Ou seja, duplicar um conjunto origem+espelhos preserva a malha interna.
- **Arrastar (drag handle):** origens e referências são registradas como `customNodes` no `GlobalDragHandle`; tabelas aninhadas e editores aninhados têm tratamento anti-duplicação de drop (`drag-handle.ts`).
- **Impressão/CSS:** em modo leitura/impressão os controles flutuantes são ocultos e o contêiner perde borda/sombra (`transclusion.module.css:191`).
- **Colar entre workspaces:** a referência carrega `sourcePageId` do workspace original — sem acesso cruzado, resolve como `no_access`/`not_found`. Para mover conteúdo entre workspaces, use **Unsync na referência** antes de copiar o texto.
- **Exclusão da origem:** espelhos **não são deletados em cascata** — viram placeholder “não existe mais” até serem removidos ou religados manualmente.

---

## 11. Solução de problemas (FAQ)

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Espelho mostra “O bloco sincronizado original não existe mais” | Origem excluída ou “Unsync/Delete” na origem | Recrie a origem ou apague o espelho (Remove from page). |
| “Você não tem acesso a este bloco sincronizado” | Sem permissão na página origem; origem fora do share/espaço público | Peça acesso à origem; ou faça Unsync para congelar cópia local (se ainda visível para alguém com acesso). |
| “Falha ao carregar” | Erro de render do conteúdo (nó inesperado) | Refresh; se persistir, abra a origem e simplifique o bloco (remova embeds problemáticos). |
| Colou e apareceu HTML cru | Colagem em campo de texto puro / app externo | Cole dentro de outra página do DocsBolt; o HTML só é interpretado pelo editor Tiptap. |
| Contador “Synced to N” zerado/errado | Leitura antes do salvamento colaborativo persistir | Aguarde o salvamento (indicador “synced” no editor) e use Refresh. |
| Não acho “Synced block” no `/` | Termo traduzido | Busque `sync`, `bloco`, `excerpt` ou `transclusion` — o fuzzy-match cobre título + descrição traduzidos. |
| Edição no espelho não “pega” | Comportamento esperado: espelho é read-only | Clique no lápis (Edit source) e edite na origem. |

---

## 12. Referência rápida de arquivos (para desenvolvedores)

- Definição dos nós: `packages/editor-ext/src/lib/transclusion/transclusion-source.ts`, `transclusion-reference.ts`, `constants.ts`, `index.ts`.
- Slash menu: `apps/client/src/features/editor/components/slash-menu/menu-items.ts:569-590`.
- Views: `apps/client/src/features/editor/components/transclusion/transclusion-view.tsx` (origem), `transclusion-reference-view.tsx` (referência), `transclusion-content.tsx` (sub-editor read-only), `transclusion-lookup-context.tsx` (batch/cache), placeholders `not-found/no-access/error-placeholder.tsx`, estilos `transclusion.module.css`.
- Dropdown de vínculos: `apps/client/src/features/transclusion/components/sync-block-references-dropdown.tsx`, queries `apps/client/src/features/transclusion/queries/transclusion-query.ts`, API `apps/client/src/features/transclusion/services/transclusion-api.ts`.
- Registro no editor: `apps/client/src/features/editor/extensions/extensions.ts` (UniqueID + GlobalDragHandle + NodeViews).
- Backend: `apps/server/src/core/page/transclusion/transclusion.service.ts` (sync/lookup/unsync), `transclusion.module.ts`, `utils/transclusion-prosemirror.util.ts`, `utils/transclusion-unsync.util.ts`; persistência em `apps/server/src/collaboration/extensions/persistence.extension.ts:261-292`; repos `apps/server/src/database/repos/page-transclusions/`; migração `20260501T202258-page-transclusions.ts`; duplicação em `apps/server/src/core/page/services/page.service.ts:650-748`; share/espaço público em `share.service.ts:302` e `public-space.service.ts:203`.
- Textos PT-BR: `apps/client/public/locales/pt-BR/translation.json` (chaves `Synced block`, `Editing original`, `Copy synced block`, `Unsync`, `Delete synced block`, `Synced to {{count}} other page_*`, `ORIGINAL`, `THIS PAGE`, placeholders de erro).

---

*Última atualização: gerado a partir da implementação atual (transclusion source/reference + lookup em lote + índice `page_transclusions`). Se o comportamento visível divergir deste guia, confira primeiro os arquivos listados em § 12.*
