#!/usr/bin/env bash
set -euo pipefail

REGISTRY="${REGISTRY:-ghcr.io}"
PLATFORM="linux/amd64"

sanitize_component() {
  echo "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's#^[^a-z0-9]+##; s#[^a-z0-9._-]+#-#g; s#-+#-#g; s#[-._]+$##'
}

resolve_history_dir() {
  if [[ -d "docs/historico" ]]; then
    echo "docs/historico"
    return
  fi
  if [[ -d "docs/histórico" ]]; then
    echo "docs/histórico"
    return
  fi
  echo "docs/historico"
}

detect_project_name() {
  local name=""

  if [[ -n "${PROJECT_NAME:-}" ]]; then
    name="${PROJECT_NAME}"
  elif [[ -f "package.json" ]]; then
    name="$(sed -nE 's/^[[:space:]]*"name"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' package.json | head -n1)"
  fi

  if [[ -z "${name}" ]]; then
    name="$(basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)")"
  fi

  name="${name##*/}"
  sanitize_component "${name}"
}

detect_namespace() {
  local namespace=""
  local remote_url=""

  if [[ -n "${IMAGE_NAMESPACE:-}" ]]; then
    namespace="${IMAGE_NAMESPACE}"
  elif [[ -n "${GITHUB_REPOSITORY_OWNER:-}" ]]; then
    namespace="${GITHUB_REPOSITORY_OWNER}"
  elif [[ -n "${GITHUB_REPOSITORY:-}" ]]; then
    namespace="${GITHUB_REPOSITORY%%/*}"
  else
    remote_url="$(git config --get remote.origin.url 2>/dev/null || true)"
    if [[ -n "${remote_url}" ]]; then
      namespace="$(echo "${remote_url}" | sed -E 's#(git@|https?://|ssh://git@)?[^/:]+[:/]([^/]+)/.*#\2#')"
    fi
  fi

  if [[ -z "${namespace}" ]]; then
    namespace="$(whoami)"
  fi

  sanitize_component "${namespace}"
}

# -----------------------------
# Template-like commit doc
# -----------------------------
bucket_for_path() {
  local p="$1"

  # Backend / DB (server + banco + contratos)
  if [[ "${p}" == server/* || "${p}" == drizzle.* || "${p}" == prisma/* || "${p}" == migrations/* ]]; then
    echo "backend"
    return
  fi

  # Frontend
  if [[ "${p}" == components/* || "${p}" == pages/* || "${p}" == src/* || "${p}" == public/* || "${p}" == shared/* || "${p}" == lib/* || "${p}" == services/* || "${p}" == utils/* || "${p}" == types* || "${p}" == vite* || "${p}" == tsconfig* ]]; then
    echo "frontend"
    return
  fi

  # Docs
  if [[ "${p}" == docs/* || "${p}" == README* || "${p}" == CHANGELOG* ]]; then
    echo "docs"
    return
  fi

  # Infra / Automação
  if [[ "${p}" == scripts/* || "${p}" == .github/* || "${p}" == .vercel/* || "${p}" == .context/* || "${p}" == Dockerfile* || "${p}" == nginx.conf* || "${p}" == docker-compose* || "${p}" == .dockerignore* || "${p}" == .env* ]]; then
    echo "infra"
    return
  fi

  echo "outros"
}

bucket_title() {
  local b="$1"
  case "${b}" in
    backend) echo "Backend / DB" ;;
    frontend) echo "Frontend" ;;
    docs) echo "Documentacao" ;;
    infra) echo "Infra / Automacao" ;;
    *) echo "Outros" ;;
  esac
}

is_keyword_match() {
  local hay="$1"
  local needle="$2"
  echo "${hay}" | tr '[:upper:]' '[:lower:]' | grep -qE "${needle}"
}

classify_change_kind() {
  # decide: correcao | implementacao | ajuste | remocao | refatoracao
  local status="$1"   # A/M/D/R...
  local path="$2"
  local msg="$3"

  local low_path
  low_path="$(echo "${path}" | tr '[:upper:]' '[:lower:]')"
  local low_msg
  low_msg="$(echo "${msg}" | tr '[:upper:]' '[:lower:]')"

  if [[ "${status}" == "A" ]]; then
    echo "implementacao"
    return
  fi
  if [[ "${status}" == "D" ]]; then
    echo "remocao"
    return
  fi
  if [[ "${status}" == R* || "${status}" == C* ]]; then
    echo "ajuste"
    return
  fi

  # M e outros:
  if echo "${low_msg} ${low_path}" | grep -qE '(fix|bug|corrig|correc|hotfix|erro|issue|crash|falha|broken)'; then
    echo "correcao"
    return
  fi

  if echo "${low_msg} ${low_path}" | grep -qE '(refactor|refator|cleanup|reorganiz|rename|padron|format|lint)'; then
    echo "refatoracao"
    return
  fi

  echo "ajuste"
}

emit_delivery_line() {
  local kind="$1"
  local status="$2"
  local path="$3"
  local extra="$4" # for rename target, optional

  local verb=""
  case "${kind}" in
    implementacao) verb="Implementacao" ;;
    correcao) verb="Correcao" ;;
    refatoracao) verb="Refatoracao" ;;
    remocao) verb="Remocao" ;;
    *) verb="Ajuste" ;;
  esac

  if [[ "${status}" == R* || "${status}" == C* ]]; then
    if [[ -n "${extra}" ]]; then
      echo "- ${verb}: \`${path}\` -> \`${extra}\`"
    else
      echo "- ${verb}: \`${path}\`"
    fi
    return
  fi

  case "${status}" in
    A) echo "- ${verb}: adicionado \`${path}\`" ;;
    M) echo "- ${verb}: atualizado \`${path}\`" ;;
    D) echo "- ${verb}: removido \`${path}\`" ;;
    *) echo "- ${verb}: alterado \`${path}\`" ;;
  esac
}

generate_commit_doc_template_style() {
  local commit_ref="$1"
  local image_tag="$2"
  local image_name="$3"
  local branch_name="$4"

  local history_dir
  history_dir="$(resolve_history_dir)"
  mkdir -p "${history_dir}"

  local date_pt
  local date_file
  local time_file
  date_pt="$(date '+%d/%m/%Y')"
  date_file="$(date '+%m%d')"
  time_file="$(date '+%H%M')"

  local commit_short commit_subject commit_body commit_msg
  commit_short="$(git rev-parse --short=7 "${commit_ref}")"
  commit_subject="$(git log -1 --pretty=%s "${commit_ref}")"
  commit_body="$(git log -1 --pretty=%b "${commit_ref}" || true)"
  commit_msg="${commit_subject}"
  [[ -n "${commit_body}" ]] && commit_msg="${commit_msg}\n${commit_body}"

  local output_file
  output_file="${history_dir}/${date_file}-${time_file}-${commit_short}.md"

  # 1 doc por exec (idempotente)
  if [[ -f "${output_file}" ]]; then
    echo "Documento de historico já existe (skip): ${output_file}"
    return 0
  fi

  local changes
  changes="$(git show --name-status --pretty='' "${commit_ref}" | sed '/^[[:space:]]*$/d' || true)"

  local shortstat
  shortstat="$(git show --shortstat --pretty='' "${commit_ref}" | tail -n1 | sed 's/^[[:space:]]*//' || true)"

  # buckets relevantes para a documentacao
  local buckets=("backend" "frontend")

  # filtro awk reutilizado nas duas passagens (pre-scan e render)
  local _awk_filter
  _awk_filter='function bucket_for(p) {
    if (p ~ /^server\//) return "backend";
    if (p ~ /^drizzle\./ || p ~ /^prisma\// || p ~ /^migrations\//) return "backend";
    if (p ~ /^(components|pages|src|public|shared|lib|services|utils)\//) return "frontend";
    if (p ~ /^types/ || p ~ /^vite/ || p ~ /^tsconfig/) return "frontend";
    return "outros";
  }
  { st=$1; p=$2; p2=$3; if (bucket_for(p) != bb) next; if (p2 != "") print st "\t" p "\t" p2; else print st "\t" p; }'

  # Pre-scan: contadores para o resumo executivo
  local total_fix=0
  local total_impl=0
  local total_other=0
  local has_frontend_impl=0
  local has_frontend_other=0

  for b in "${buckets[@]}"; do
    local _scan_lines=""
    if [[ -n "${changes}" ]]; then
      _scan_lines="$(echo "${changes}" | awk -F$'\t' -v bb="${b}" "${_awk_filter}")"
    fi
    [[ -z "${_scan_lines}" ]] && continue
    while IFS=$'\t' read -r st p p2; do
      [[ -z "${st}" || -z "${p}" ]] && continue
      local _k
      _k="$(classify_change_kind "${st}" "${p}" "${commit_msg}")"
      case "${_k}" in
        correcao)      total_fix=$((total_fix + 1)) ;;
        implementacao) total_impl=$((total_impl + 1))
                       [[ "${b}" == "frontend" ]] && has_frontend_impl=1 ;;
        *)             total_other=$((total_other + 1))
                       [[ "${b}" == "frontend" ]] && has_frontend_other=1 ;;
      esac
    done <<< "${_scan_lines}"
  done

  {
    echo "# Implementacoes e mudancas - ${date_pt}"
    echo ""
    echo "- Commit: \`${commit_short}\`"
    echo "- Mensagem: ${commit_subject}"
    echo "- Imagem publicada: \`${image_name}:${image_tag}\`"
    [[ -n "${shortstat}" ]] && echo "- Diffstat: ${shortstat}"
    echo ""

    local idx=1
    for b in "${buckets[@]}"; do
      local title
      title="$(bucket_title "${b}")"

      # Filtra linhas do bucket
      local bucket_lines=""
      if [[ -n "${changes}" ]]; then
        bucket_lines="$(echo "${changes}" | awk -F$'\t' -v bb="${b}" "${_awk_filter}")"
      fi

      if [[ -z "${bucket_lines}" ]]; then
        continue
      fi

      echo "## ${idx}) ${title}"
      echo ""
      echo "### Entregas"

      # Separa em 3 blocos (correcoes / implementacoes / ajustes/refatoracao/remocao)
      local deliveries_fix=""
      local deliveries_impl=""
      local deliveries_other=""

      while IFS=$'\t' read -r st p p2; do
        [[ -z "${st}" || -z "${p}" ]] && continue

        local kind
        kind="$(classify_change_kind "${st}" "${p}" "${commit_msg}")"

        local line
        line="$(emit_delivery_line "${kind}" "${st}" "${p}" "${p2:-}")"

        if [[ "${kind}" == "correcao" ]]; then
          deliveries_fix="${deliveries_fix}${line}\n"
        elif [[ "${kind}" == "implementacao" ]]; then
          deliveries_impl="${deliveries_impl}${line}\n"
        else
          deliveries_other="${deliveries_other}${line}\n"
        fi
      done <<< "${bucket_lines}"

      if [[ -n "${deliveries_fix}" ]]; then
        echo "- Correcoes:"
        echo -e "${deliveries_fix}" | sed '/^[[:space:]]*$/d' | sed 's/^/  /'
      fi
      if [[ -n "${deliveries_impl}" ]]; then
        echo "- Novas implementacoes:"
        echo -e "${deliveries_impl}" | sed '/^[[:space:]]*$/d' | sed 's/^/  /'
      fi
      if [[ -n "${deliveries_other}" ]]; then
        echo "- Ajustes e refinamentos:"
        echo -e "${deliveries_other}" | sed '/^[[:space:]]*$/d' | sed 's/^/  /'
      fi
      echo ""

      idx=$((idx + 1))
    done

    echo "## 3) Resumo executivo"
    echo ""

    # Mudancas
    if [[ $((total_impl + total_fix + total_other)) -eq 0 ]]; then
      echo "- Mudancas: Nenhuma alteracao detectada nos escopos backend/frontend."
    else
      local _mud_parts=""
      [[ "${total_impl}" -gt 0 ]] && _mud_parts="${total_impl} nova(s) implementacao(oes)"
      [[ "${total_fix}" -gt 0 ]] && _mud_parts="${_mud_parts:+${_mud_parts}, }${total_fix} correcao(oes)"
      [[ "${total_other}" -gt 0 ]] && _mud_parts="${_mud_parts:+${_mud_parts}, }${total_other} ajuste(s)/refatoracao(oes)"
      echo "- Mudancas: ${_mud_parts} em backend/frontend."
    fi

    # Correcoes
    if [[ "${total_fix}" -gt 0 ]]; then
      echo "- Correcoes: ${total_fix} correcao(oes) aplicada(s). Verificar se resolve(m) comportamento(s) reportado(s)."
    else
      echo "- Correcoes: Nenhuma correcao aplicada neste commit."
    fi

    # Atualizacoes de fluxo
    if [[ "${total_other}" -gt 0 ]]; then
      echo "- Atualizacoes de fluxo: ${total_other} ajuste(s) realizado(s). Revisar impacto em integracao e comportamento esperado."
    else
      echo "- Atualizacoes de fluxo: Nenhuma atualizacao de fluxo neste commit."
    fi

    # Documentacao do usuario
    if [[ "${has_frontend_impl}" -eq 1 ]]; then
      echo "- Documentacao do usuario: Criar documentacao para a(s) nova(s) funcionalidade(s) implementada(s) no frontend."
    elif [[ "${has_frontend_other}" -eq 1 ]]; then
      echo "- Documentacao do usuario: Atualizar documentacao existente para refletir as alteracoes de fluxo no frontend."
    else
      echo "- Documentacao do usuario: Sem impacto em documentacao do usuario neste commit."
    fi
    echo ""
  } > "${output_file}"

  echo "Documento de historico gerado: ${output_file}"
}

# -------------------------
# Resolução de imagem
# -------------------------
PROJECT_NAME_RESOLVED="$(detect_project_name)"
IMAGE_NAMESPACE_RESOLVED="$(detect_namespace)"
if [[ "${PROJECT_NAME_RESOLVED}" == "boltcrm" ]]; then
  PROJECT_NAME_RESOLVED="bcrm"
fi
IMAGE_NAME="${IMAGE_NAME:-${IMAGE_NAMESPACE_RESOLVED}/${PROJECT_NAME_RESOLVED}}"

GIT_SHA_SHORT="$(git rev-parse --short=7 HEAD)"
BRANCH="$(git rev-parse --abbrev-ref HEAD | tr '[:upper:]' '[:lower:]' | tr '/' '-')"
TAG_SHA="sha-${GIT_SHA_SHORT}"
TAG_BRANCH="${BRANCH}"
IMAGE="${REGISTRY}/${IMAGE_NAME}"

echo "============================================="
echo "  Build and Push Docker"
echo "============================================="
echo "Registry:   ${REGISTRY}"
echo "Image:      ${IMAGE}"
echo "Project:    ${PROJECT_NAME_RESOLVED}"
echo "Namespace:  ${IMAGE_NAMESPACE_RESOLVED}"
echo "Platform:   ${PLATFORM}"
echo "Branch:     ${BRANCH}"
echo "Git SHA:    ${GIT_SHA_SHORT}"
echo "Tags:       ${TAG_BRANCH}, ${TAG_SHA}"
echo "============================================="

if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "❌ Este diretório não é um repositório Git."
  exit 1
fi

echo ""
echo ">>> Executando varredura de segurança com Trivy..."

if ! command -v trivy &> /dev/null; then
  echo ""
  echo "  ⚠️  Trivy não encontrado. Instale com:"
  echo "     brew install aquasecurity/trivy/trivy"
  echo ""
  echo "  Abortando build por segurança."
  exit 1
fi

TRIVY_EXIT_CODE=0
trivy fs \
  --scanners misconfig,vuln \
  --severity HIGH,CRITICAL \
  --exit-code 1 \
  --skip-version-check \
  --skip-dirs '.git,.venv,node_modules,.mimocode,dist,build,backups,.context,.turbo,.pytest_cache,.extracted,.agent,.agents,.claude,.dbg,.gemini,.trae,.vscode,scratch,public' \
  . || TRIVY_EXIT_CODE=$?

if [[ "${TRIVY_EXIT_CODE}" -eq 1 ]]; then
  echo ""
  echo "============================================="
  echo "  ❌ Trivy encontrou vulnerabilidades HIGH/CRITICAL!"
  echo "============================================="
  exit 1
elif [[ "${TRIVY_EXIT_CODE}" -ne 0 ]]; then
  echo ""
  echo "============================================="
  echo "  ⚠️  Erro na varredura Trivy (exit ${TRIVY_EXIT_CODE})."
  echo "     Varredura falhou — abortando build por segurança."
  echo "============================================="
  exit "${TRIVY_EXIT_CODE}"
fi

echo "    ✓ Nenhuma vulnerabilidade HIGH/CRITICAL encontrada."

echo ""
echo ">>> Verificando alterações no repositório..."

HISTORY_DIR="$(resolve_history_dir)"
TAG_FILE="${HISTORY_DIR}/latest-tag"

has_relevant_changes() {
  local porcelain
  porcelain="$(git status --porcelain=v1 | sed '/^[[:space:]]*$/d')"
  porcelain="$(echo "${porcelain}" | grep -Ev "^[[:space:]]*(M|A|D|R|C|\\?\\?)[[:space:]]+(${HISTORY_DIR}/|${TAG_FILE}$)" || true)"
  [[ -n "${porcelain}" ]]
}

if ! has_relevant_changes && git diff --cached --quiet; then
  echo "    ✓ Nenhuma alteração relevante para commitar."
else
  echo "    ▸ Alterações detectadas. Fazendo commit e push..."
  git add -A

  COMMIT_MSG="Build $(date '+%Y-%m-%d %H:%M:%S') - ${TAG_SHA}"
  git commit -m "${COMMIT_MSG}" || echo "    ⚠️  Erro ao fazer commit (pode já estar commitado)"

  GIT_SHA_SHORT="$(git rev-parse --short=7 HEAD)"
  TAG_SHA="sha-${GIT_SHA_SHORT}"

  echo "    ▸ Fazendo push para origin/${BRANCH}..."
  git push origin "${BRANCH}" || echo "    ⚠️  Erro ao fazer push. Continuando com o build..."
  echo "    ✓ Commit e push concluídos."
fi

BUILD_COMMIT_REF="HEAD"

echo ""
echo "    TAG_SHA atualizada para: ${TAG_SHA}"

if ! docker system info > /dev/null 2>&1; then
  echo "Docker não está rodando."
  exit 1
fi

if ! docker login "${REGISTRY}" > /dev/null 2>&1; then
  echo "Você não está logado no ${REGISTRY}."
  exit 1
fi

BUILDER_NAME="local-multi"
if ! docker buildx inspect "${BUILDER_NAME}" > /dev/null 2>&1; then
  docker buildx create --name "${BUILDER_NAME}" --use
else
  docker buildx use "${BUILDER_NAME}"
fi
docker buildx inspect --bootstrap > /dev/null

echo ""
echo ">>> Building Docker image (linux/amd64) locally..."

docker buildx build \
  --platform "${PLATFORM}" \
  --load \
  -f "./Dockerfile" \
  -t "${IMAGE}:${TAG_BRANCH}" \
  -t "${IMAGE}:${TAG_SHA}" \
  --build-arg VITE_API_URL=/api \
  --build-arg IMAGE_TAG="${TAG_SHA}" \
  .

echo "    ✓ Imagem construída localmente para ${PLATFORM}:"
echo "      - ${IMAGE}:${TAG_BRANCH}"
echo "      - ${IMAGE}:${TAG_SHA}"

echo ""
echo ">>> Fazendo push para ${REGISTRY}..."

docker push "${IMAGE}:${TAG_BRANCH}"
docker push "${IMAGE}:${TAG_SHA}"

echo "    ✓ Push concluído:"
echo "      - ${IMAGE}:${TAG_BRANCH}"
echo "      - ${IMAGE}:${TAG_SHA}"

echo ""
echo "============================================="
echo "  Build and Push concluído!"
echo "============================================="
echo ""
echo "Imagem disponível: ${IMAGE}:${TAG_SHA}"
echo ""
echo "Para fazer deploy no Portainer, use a tag: ${TAG_SHA}"
echo "============================================="

echo "${TAG_SHA}" > "${TAG_FILE}"
echo "Tag salva em ${TAG_FILE}: ${TAG_SHA}"

echo ""
echo ">>> Atualizando build-info.json local..."
BUILD_INFO_FILE="public/build-info.json"
mkdir -p "$(dirname "${BUILD_INFO_FILE}")"
TZ=America/Recife
DAY="$(TZ=America/Recife date '+%d')"
MONTH="$(TZ=America/Recife date '+%m')"
YEAR="$(TZ=America/Recife date '+%y')"
HOUR="$(TZ=America/Recife date '+%H')"
MINUTE="$(TZ=America/Recife date '+%M')"
cat > "${BUILD_INFO_FILE}" << EOF
{
  "IMAGE_TAG": "${TAG_SHA}",
  "BUILD_DATE": "${DAY}/${MONTH}/${YEAR}",
  "BUILD_TIME": "${HOUR}:${MINUTE}",
  "COMMIT": "${GIT_SHA_SHORT}"
}
EOF
echo "    ✓ build-info.json atualizado: ${DAY}/${MONTH}/${YEAR} ${HOUR}:${MINUTE}"
echo "      Tag: ${TAG_SHA}"

echo ""
echo ">>> Gerando documento de historico do commit..."
generate_commit_doc_template_style "${BUILD_COMMIT_REF}" "${TAG_SHA}" "${IMAGE}" "${BRANCH}"

echo ""
echo "para fazer deploy:"
echo "pnpm deploy:dev"
echo "pnpm deploy:prod"
