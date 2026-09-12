# Visão Geral

> Fork brasileiro do [Docmost](https://docmost.com) (v0.96.0) — wiki colaborativa open-source adaptada para documentação, SOPs e gestão de conhecimento em português.

## 1. Objetivo do projeto

Oferecer uma plataforma única, auto-hospedada e em português para:

1. **Centralizar documentação** — wikis, manuais, políticas e atas em um só lugar, com hierarquia de espaços → páginas → subpáginas.
2. **Padronizar operações com SOPs** — biblioteca pronta em `docs/SOP_Templates/` (Financeiro, Compras, RH, Tecnologia, CS, Suporte, Operações de TI, Jurídico) com fluxo Mermaid, matriz RACI, SLA, riscos/controles, KPIs e checklist.
3. **Colaborar em tempo real** — edição simultânea com sincronização via Yjs/Hocuspocus, histórico de versões, comentários e menções.
4. **Organizar trabalho estruturado** — Bases (tabelas) com views Kanban/Table, propriedades tipadas (status, select, data, pessoa, fórmula, etc.) e blocos sincronizados entre páginas.
5. **Operar em PT-BR por padrão** — interface traduzida, datas `dd/MM/yyyy`, moeda `BRL (R$)`, guias em português em `docs/guias/` e `docs/kanban.md`.

Imagem oficial do fork: `ghcr.io/ericocesar/boltplan` (tags por SHA — ex.: `sha-2823b4e`). Deploy via Docker Compose ou Portainer (`scripts/deployportainer.sh`).

## 2. O que é (contexto)

- **Base upstream:** Docmost `0.96.0`, licença AGPL-3.0 (núcleo) + licença Enterprise Docmost para `apps/*/src/ee`, `packages/ee`.
- **Nome do fork:** código e pacotes usam `boltplan` (`package.json`), UI usa **DocsPlan**.
- **Stack:**
  - `apps/client` — React + Vite + Mantine + Tiptap + Yjs (editor colaborativo).
  - `apps/server` — NestJS + Postgres + Redis + Hocuspocus (servidor de colaboração) + Gotenberg (export PDF) + Draw.io.
  - `packages/editor-ext` — extensões do editor (inclui transclusão/bloco sincronizado).
  - `packages/base-formula` — motor de fórmulas das Bases.
  - Infra: `Dockerfile` multi-stage (Node 26 + pnpm), `docker-compose.yml` (app + Postgres 18 + Redis 8).

## 3. Funcionalidades

### 3.1 Herdadas do Docmost

| Área | Funcionalidades |
|---|---|
| Editor | Blocos ricos (texto, títulos, listas, to-do, tabelas, callout, toggle, colunas, código com highlight, equações, embeds YouTube/Loom/Miro/Airtable, anexos, PDF, áudio/vídeo, Draw.io, Excalidraw, Mermaid) |
| Colaboração | Edição em tempo real, cursores compartilhados, histórico de páginas, comentários, favoritos, watchers/notificações |
| Organização | Spaces, grupos, permissões granulares (CASL), labels, busca full-text, anexos, espaço público e links compartilhados |
| Diagramas | Draw.io (self-host via `DRAWIO_URL`), Excalidraw, Mermaid |
| I18n | 10+ idiomas, incluindo `pt-BR` |
| Export | DOCX, PDF server-side (Gotenberg), Markdown |
| API | REST + OpenAPI (`docs/guias/openapi-docsplan.json`) |

### 3.2 Diferenciais do fork (DocsPlan)

| Diferencial | Descrição | Onde ver |
|---|---|---|
| Rebrand DocsPlan | Sidebar, tooltips e fontes (Roboto Condensed) com identidade própria | `apps/client` |
| PT-BR como padrão | Traduções, formato de data `dd/MM/yyyy`, moeda padrão `BRL` nas Bases | commit `2823b4e` |
| Bases + Kanban/Table | Páginas-base (`is_base=true`) com propriedades, linhas (cards) e views Kanban agrupadas por Status/Select, Table com filtros/ordenação | `docs/kanban.md` |
| Bloco sincronizado (transclusão) | Origem editável espelhada como somente-leitura em N páginas (`sourcePageId::transclusionId`), lookup em lote, dropdown "Sincronizado com", Unsync/Remove, suporte a share/espaço público | `docs/guias/bloco_sincronizado.md` |
| Auto-subpáginas | Toggle `autoSubpages` por espaço: cria bloco de subpáginas automaticamente em páginas novas | `UpdateSpaceDto`, `AutoSubpagesToggle` |
| Biblioteca de SOPs | 10 SOPs empresariais + template universal prontos para importar | `docs/SOP_Templates/` |
| Guias operacionais | Kanban passo a passo, bloco sincronizado, histórico de builds por SHA | `docs/kanban.md`, `docs/guias/`, `docs/historico/` |
| Build info + deploy | `public/build-info.json`, push GHCR (`scripts/build-and-push-ghcr.sh`), deploy Portainer dev/prod | `scripts/` |

## 4. Público-alvo e casos de uso

- **Pequenas/médias empresas** que precisam de wiki interna + SOPs sem depender de Notion/Confluence SaaS.
- **Times de operações, CS e suporte** — manuais, políticas LGPD/SLA, roteiros de atendimento espelhados via bloco sincronizado.
- **Times de produto/engenharia** — docs técnicas, ADRs, atas e roadmaps com Kanban de acompanhamento.
- **Escritórios/consultorias** — base de conhecimento replicável por cliente (duplicação de espaço preserva malha origem↔espelhos).

## 5. Como rodar (resumo)

```bash
pnpm install
pnpm run dev        # client:dev (Vite) + server:dev (Nest) em paralelo
# ou
docker compose up -d  # app :3000 + postgres + redis
```

Variáveis principais (ver `.env.example`): `APP_URL`, `APP_SECRET` (≥32 chars), `DATABASE_URL`, `REDIS_URL`, `STORAGE_DRIVER` (local/s3/azure), `MAIL_DRIVER` (smtp/postmark), `DRAWIO_URL`, `GOTENBERG_URL`.

## 6. Estrutura de pastas (leitura rápida)

- `apps/client/` — frontend (editor, spaces, pages, bases, transclusion).
- `apps/server/` — backend (auth, workspace, space, page, share, comment, search, collaboration).
- `packages/editor-ext/` — nós Tiptap custom (inclui transclusão).
- `packages/base-formula/` — fórmulas das Bases.
- `packages/ee/` — recursos Enterprise (licença própria).
- `docs/` — guias (`guias/`), Kanban (`kanban.md`), SOPs (`SOP_Templates/`), histórico de builds (`historico/`).
- `scripts/`, `Dockerfile`, `docker-compose.yml` — build, push GHCR e deploy.

## 7. Licença

Núcleo sob AGPL-3.0 (herdado do Docmost). Diretórios `apps/server/src/ee`, `apps/client/src/ee`, `packages/ee` sob licença Enterprise Docmost (`packages/ee/License`).
