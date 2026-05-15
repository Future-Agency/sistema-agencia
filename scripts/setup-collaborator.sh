#!/usr/bin/env bash
# =============================================================================
# Future Agency · Sistema · Setup para colaboradores
# =============================================================================
# Uso (Mac / Linux / WSL):
#
#   curl -fsSL https://raw.githubusercontent.com/Future-Agency/sistema-agencia/main/scripts/setup-collaborator.sh | bash
#
# O si ya cloneaste el repo:
#
#   bash scripts/setup-collaborator.sh
#
# Qué hace:
#   1. Verifica que tengas: git, node (>=20), brew (en Mac)
#   2. Instala lo que falte (Node via brew/nvm, gh CLI)
#   3. Instala Claude Code globalmente
#   4. Clona el repo si no está
#   5. npm install
#   6. Crea .env.local con las keys del proyecto
#   7. Te muestra cómo seguir
#
# Idempotente: podés correrlo varias veces sin romper nada.
# =============================================================================

set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'

step() { echo -e "\n${BLUE}━━━ $1 ━━━${NC}"; }
ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
err()  { echo -e "${RED}✗${NC} $1"; }

REPO_URL="https://github.com/Future-Agency/sistema-agencia.git"
REPO_DIR="$HOME/Desktop/sistema-agencia"

# ----- 1. OS detection -----
step "1/7 · Detectando sistema operativo"
OS="$(uname -s)"
case "$OS" in
  Darwin) PLATFORM="mac";   ok "Mac detectado" ;;
  Linux)  PLATFORM="linux"; ok "Linux detectado" ;;
  *)      err "OS no soportado: $OS (este script funciona en Mac, Linux o WSL)"; exit 1 ;;
esac

# ----- 2. Homebrew (solo Mac) -----
if [[ "$PLATFORM" == "mac" ]]; then
  step "2/7 · Homebrew"
  if ! command -v brew >/dev/null 2>&1; then
    warn "Homebrew no está instalado. Instalando ahora (te va a pedir password de Mac)…"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    # Agregar al PATH si recién se instaló
    if [[ -d /opt/homebrew/bin ]]; then
      eval "$(/opt/homebrew/bin/brew shellenv)"
    elif [[ -d /usr/local/Homebrew ]]; then
      eval "$(/usr/local/bin/brew shellenv)"
    fi
  fi
  ok "Homebrew: $(brew --version | head -1)"
fi

# ----- 3. Node.js >= 20 -----
step "3/7 · Node.js"
NODE_OK=false
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR=$(node -v | sed -E 's/v([0-9]+).*/\1/')
  if [[ "$NODE_MAJOR" -ge 20 ]]; then
    ok "Node $(node -v) instalado"
    NODE_OK=true
  else
    warn "Node $(node -v) es viejo. Necesitás >= 20."
  fi
fi

if [[ "$NODE_OK" == "false" ]]; then
  if [[ "$PLATFORM" == "mac" ]]; then
    warn "Instalando Node 20 via brew…"
    brew install node@20
    brew link --overwrite node@20
  else
    warn "Instalando Node 20 via nvm…"
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install 20
    nvm use 20
  fi
  ok "Node $(node -v) instalado"
fi

# ----- 4. git config básico -----
step "4/7 · Git identity"
if [[ -z "$(git config --global user.name 2>/dev/null)" ]]; then
  read -p "Tu nombre completo (para git commits): " GIT_NAME
  git config --global user.name "$GIT_NAME"
fi
if [[ -z "$(git config --global user.email 2>/dev/null)" ]]; then
  read -p "Tu email de GitHub: " GIT_EMAIL
  git config --global user.email "$GIT_EMAIL"
fi
ok "Git: $(git config --global user.name) <$(git config --global user.email)>"

# ----- 5. gh CLI (auth de GitHub sin pegar tokens) -----
step "5/7 · GitHub CLI (gh)"
if ! command -v gh >/dev/null 2>&1; then
  if [[ "$PLATFORM" == "mac" ]]; then
    brew install gh
  else
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
    sudo apt update && sudo apt install gh -y
  fi
fi
ok "gh $(gh --version | head -1 | awk '{print $3}')"

if ! gh auth status >/dev/null 2>&1; then
  warn "Necesitás autenticarte con GitHub. Te abre el browser:"
  gh auth login -h github.com -p https -w
fi
ok "GitHub autenticado como $(gh api user --jq .login)"

# ----- 6. Clonar repo -----
step "6/7 · Clonar el repo"
if [[ ! -d "$REPO_DIR" ]]; then
  git clone "$REPO_URL" "$REPO_DIR"
  ok "Repo clonado en $REPO_DIR"
else
  cd "$REPO_DIR"
  git pull
  ok "Repo ya estaba en $REPO_DIR (actualizado con git pull)"
fi

cd "$REPO_DIR"

# ----- 7. Dependencias + env -----
step "7/7 · Dependencias y variables de entorno"
npm install

if [[ ! -f .env.local ]]; then
  cat > .env.local <<'ENV'
NEXT_PUBLIC_SUPABASE_URL=https://nnwndlyiwjbybcjljdtu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ud25kbHlpd2pieWJjamxqZHR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMDAzNjEsImV4cCI6MjA4OTg3NjM2MX0.c8CTMScj2UoJ8KCTYXw3pih2ucEdp2PI79xOSRGV72c
ENV
  ok ".env.local creado con las keys de Supabase"
else
  ok ".env.local ya existía"
fi

# ----- 8. Claude Code -----
step "Extra · Claude Code (opcional, recomendado)"
if ! command -v claude >/dev/null 2>&1; then
  warn "Claude Code no está instalado. Instalando globalmente…"
  npm install -g @anthropic-ai/claude-code
fi
ok "Claude Code $(claude --version 2>/dev/null || echo 'instalado')"

# =============================================================================
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ Setup terminado.${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Proyecto en: $REPO_DIR"
echo ""
echo "Para arrancar el dev server (Next.js en localhost:3000):"
echo "  cd $REPO_DIR"
echo "  npm run dev"
echo ""
echo "Para usar Claude Code (login + chat conversacional):"
echo "  cd $REPO_DIR"
echo "  claude"
echo ""
echo "Workflow diario:"
echo "  git pull        # antes de empezar (trae los cambios del equipo)"
echo "  # … hacés cambios …"
echo "  git add . && git commit -m 'descripción' && git push"
echo ""
echo "O simplemente abrís claude y le pedís todo en lenguaje natural."
echo ""
