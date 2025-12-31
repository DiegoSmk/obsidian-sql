#!/bin/bash

# ==========================================
# Script de Publicação GitHub (Versão Limpa)
# ==========================================
# Uso: ./tools/release_public.sh
#
# O que este script faz:
# 1. Garante que você está na branch 'develop' e atualizado.
# 2. Deleta e recria a branch 'public' baseada na 'develop'.
# 3. Remove pastas internas (.gitea, scripts, tools, etc).
# 4. Envia o código limpo para o GitHub (sobrescrevendo a master pública).
# 5. Volta para a branch 'develop'.

set -e

# Configurações
GITHUB_REMOTE="github"
PUBLIC_BRANCH="public"
TARGET_BRANCH="master"
INTERNAL_FOLDERS=".gitea improvements scripts tests_live tools docs"

echo "🚀 Iniciando processo de publicação pública..."

# 1. Verifica estado inicial
current_branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$current_branch" != "develop" ]; then
    echo "❌ Erro: Você deve estar na branch 'develop' para publicar."
    exit 1
fi

echo "📦 Atualizando develop..."
git pull origin develop

# 2. Prepara branch pública limpa
echo "🧹 Recriando branch '$PUBLIC_BRANCH'..."
git branch -D $PUBLIC_BRANCH 2>/dev/null || true
git checkout -b $PUBLIC_BRANCH

# 3. Remove arquivos internos
echo "🗑️ Removendo arquivos internos ($INTERNAL_FOLDERS)..."
rm -rf $INTERNAL_FOLDERS
git rm -r --cached $INTERNAL_FOLDERS --quiet || true
git commit -m "chore: remove internal development files for public release" --quiet

# 4. Publica no GitHub
echo "🌍 Enviando para GitHub ($GITHUB_REMOTE/$TARGET_BRANCH)..."
git push -f $GITHUB_REMOTE $PUBLIC_BRANCH:$TARGET_BRANCH

# 5. Limpeza e Retorno
echo "🔙 Voltando para develop..."
git checkout develop
git branch -D $PUBLIC_BRANCH

echo "✅ Sucesso! Versão pública atualizada em https://github.com/DiegoSmk/obsidian-sql"
