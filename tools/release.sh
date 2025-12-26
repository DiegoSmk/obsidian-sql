#!/bin/bash
# Professional Release Script for Gitea/Obsidian
VERSION=$(node -p "require('./package.json').version")
echo "📦 Preparando Release v$VERSION..."

# 1. Build
npm run build

# 2. Organizar arquivos
mkdir -p release
cp main.js manifest.json styles.css release/

# 3. Criar ZIP para o Gitea Release
zip -j "sql-notebook-$VERSION.zip" release/*

echo "✅ Release v$VERSION pronta!"
echo "🚀 Próximos passos sugeridos:"
echo "   1. git tag -a v$VERSION -m \"Release v$VERSION\""
echo "   2. git push origin v$VERSION"
echo "   3. Upload 'sql-notebook-$VERSION.zip' no Gitea Releases."
