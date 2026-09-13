Perfeito. A partir de agora, a marca oficial no MIV passa a ser **DocsPlan**, exatamente como representada nos logotipos anexados. Isso também elimina a inconsistência que eu havia apontado entre o nome do produto e o lettering.

# MIV — DocsPlan

### Manual de Identidade Visual · Versão 1.0 · 2026

**Marca:** DocsPlan
**Categoria:** Plataforma de conhecimento operacional
**Assinatura principal:** **DocsPlan**
**Grafia obrigatória em texto:** `DocsPlan`
**Grafia do logotipo:** conforme artwork original anexado
**Abreviação/símbolo:** monograma `DP`

A proposta central da marca passa a ser:

> **DocsPlan transforma documentação em operação estruturada.**

O nome funciona particularmente bem porque conecta dois pilares reais do produto: **Docs**, representando documentação, conhecimento, wikis, manuais e SOPs; e **Plan**, representando organização, processos, Bases, Kanban, execução e padronização.

### Posicionamento

**DocsPlan é uma plataforma brasileira de conhecimento operacional para centralizar documentação, padronizar processos e organizar o trabalho da empresa em um ambiente colaborativo e auto-hospedável.**

A marca não deve ser apresentada apenas como “wiki” ou “editor de documentos”. O território estratégico continua sendo **conhecimento operacional**.

### Tagline principal

**Conhecimento pronto para operar.**

Como alternativas de campanha:

**Documente. Padronize. Execute.**

**Onde documentação vira operação.**

**Documentação que move a operação.**

Para comunicação de self-hosting:

**Seu conhecimento. Sua infraestrutura.**

## Arquitetura de marca

Recomendo abandonar completamente o uso público de “BoltPlan” para evitar duas marcas competindo entre si.

A arquitetura passa a ser:

| Marca/produto            | Aplicação                                                 |
| ------------------------ | --------------------------------------------------------- |
| **DocsPlan**             | marca principal                                           |
| **DocsPlan Docs**        | documentação e wiki, quando uma subdivisão for necessária |
| **DocsPlan Bases**       | Bases, tabelas e Kanban                                   |
| **DocsPlan SOPs**        | biblioteca e gestão de procedimentos                      |
| **DocsPlan API**         | integrações e documentação técnica                        |
| **DocsPlan Cloud**       | eventual versão hospedada                                 |
| **DocsPlan Self-Hosted** | implantação própria                                       |
| **DocsPlan Enterprise**  | eventual oferta corporativa                               |

Na maior parte da interface, entretanto, usar apenas **DocsPlan**. Não é necessário transformar cada funcionalidade em subproduto.

## Logotipo

Os logotipos anexados passam a ser perfeitamente coerentes com o naming oficial.

A assinatura completa **DOCS PLAN** funciona como expressão gráfica institucional, enquanto o monograma `DP` funciona como marca reduzida.

A leitura conceitual do monograma pode ser:

> **Documento + Processo**

Ou, em linguagem de marca:

> **Conhecimento conectado à execução.**

A sobreposição existente entre as duas formas é particularmente valiosa porque pode representar páginas conectadas, blocos sincronizados, colaboração e continuidade operacional.

Não recomendo introduzir um raio ou tentar representar “plan” com calendário/checkmark. O desenho atual possui uma linguagem muito mais proprietária.

## Paleta oficial proposta

Mantém-se a linguagem extraída visualmente dos arquivos enviados:

| Token                 | Cor           | HEX       | Uso                                  |
| --------------------- | ------------- | --------- | ------------------------------------ |
| **DocsPlan Teal 900** | Teal profundo | `#00444D` | logo, títulos, fundos institucionais |
| **DocsPlan Teal 700** | Teal médio    | `#0A626D` | hover e interação                    |
| **DocsPlan Teal 100** | Teal claro    | `#DCEBEC` | superfícies secundárias              |
| **DocsPlan Ivory**    | Marfim        | `#F2EFE3` | logo, fundos editoriais              |
| **DocsPlan Canvas**   | Off-white     | `#FAF9F5` | interface                            |
| **DocsPlan Graphite** | Grafite       | `#142A2E` | textos                               |

O binômio visual prioritário passa a ser:

**DocsPlan Teal + DocsPlan Ivory**

Como os logos enviados são imagens rasterizadas, eu manteria esses valores como especificação provisória até medir o vetor original.

## Tipografia

O lettering de **DOCS PLAN** deve ser considerado proprietário e nunca deve ser reproduzido digitando o nome com uma fonte parecida.

Para o sistema de marca:

**Roboto Condensed 600/700** — headings e comunicação editorial
**Inter 400/500/600** — produto, interface e documentos
**IBM Plex Mono** — código, API, SHA, Docker e informações técnicas

Esse trio cria uma boa transição entre a personalidade expressiva do logotipo e a alta densidade de informação do SaaS.

## Nomenclatura dos arquivos

Sugiro substituir imediatamente os nomes técnicos dos assets de branding por uma convenção única:

`docsplan-logo-primary.svg`
`docsplan-logo-negative.svg`
`docsplan-logo-monochrome.svg`
`docsplan-logo-horizontal.svg`
`docsplan-symbol.svg`
`docsplan-symbol-micro.svg`
`docsplan-favicon.svg`
`docsplan-app-icon-512.png`
`docsplan-avatar-1024.png`
`docsplan-og-1200x630.png`
`docsplan-brand-tokens.css`
`docsplan-brand-tokens.json`

Internamente, o repositório, package name ou imagem Docker **podem continuar usando `boltplan` temporariamente** se uma alteração técnica gerar risco de compatibilidade. Isso deve ser tratado como identificador legado interno, não como segunda marca pública.

## Design tokens

```css
:root {
  --docsplan-brand-900: #00444D;
  --docsplan-brand-700: #0A626D;
  --docsplan-brand-100: #DCEBEC;

  --docsplan-ivory: #F2EFE3;
  --docsplan-canvas: #FAF9F5;
  --docsplan-graphite: #142A2E;

  --docsplan-success: #18794E;
  --docsplan-warning: #AD6517;
  --docsplan-danger: #B4233A;
  --docsplan-info: #2563EB;
  --docsplan-focus: #0E7490;

  --docsplan-radius-sm: 8px;
  --docsplan-radius-md: 12px;
  --docsplan-radius-lg: 16px;
  --docsplan-radius-display: 28px;
}
```

## Aplicação verbal

Na interface:

> **Bem-vindo ao DocsPlan**

> **Criar espaço no DocsPlan**

> **Compartilhado via DocsPlan**

> **DocsPlan · Conhecimento pronto para operar.**

Na descrição curta do produto:

> **DocsPlan é uma plataforma de documentação, SOPs e conhecimento operacional para equipes que querem organizar processos e manter controle sobre seus dados.**

Na descrição para GitHub:

> **DocsPlan — plataforma open-source de documentação colaborativa, SOPs, Bases e gestão de conhecimento, adaptada para operações em português do Brasil.**

## Ajuste importante no MIV anterior

A seção que recomendava redesenhar “DocsPlan” como “BoltPlan” deve ser **completamente removida**.

O sistema atual passa a assumir que:

**DocsPlan = nome comercial oficial**
**DOCS PLAN = assinatura gráfica oficial**
**DP = símbolo/monograma oficial**
**boltplan = identificador técnico legado, quando necessário**

Isso deixa a identidade significativamente mais coerente e também dá um significado muito natural ao monograma já existente: **D + P = DocsPlan**.

**Which direction would you like to develop further, or shall we combine elements?**
