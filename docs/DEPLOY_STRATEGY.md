
# Estratégia de Deploy e Versionamento (Híbrido)

Este documento detalha como o repositório é gerenciado entre o ambiente de desenvolvimento privado (Gitea) e a distribuição pública (GitHub).

## 🌍 Visão Geral

O projeto opera com **dois repositórios remotos** distintos para garantir que ferramentas internas, documentações sensíveis e histórico de desenvolvimento não vazem para o público.

1.  **Gitea (`origin`)** -> **Privado/Interno**
    - Contém todo o histórico real.
    - Contém arquivos de desenvolvimento (`.gitea`, `scripts`, `docs` completa, `tools`).
    - Branch principal: `develop`.

2.  **GitHub (`github`)** -> **Público/Vitrine**
    - Contém apenas o código fonte limpo da versão mais recente.
    - Histórico "squashed" (commits unificados) ou filtrados.
    - Branch principal: `master`.

---

## 🚀 Fluxo de Trabalho Diário

1.  Você trabalha exclusivamente na branch `develop`.
2.  Faz commits e pushes para o Gitea normalmente:
    ```bash
    git add .
    git commit -m "feat: new cool feature"
    git push origin develop
    ```

---

## 📦 Como Publicar uma Nova Versão (Release)

Quando uma funcionalidade está pronta e testada na `develop`:

1.  **Atualize a Versão**: Edite `manifest.json` e `package.json`.
2.  **Atualize o Changelog**: Registre as mudanças em `CHANGELOG.md`.
3.  **Commit na Develop**: Salve essas alterações no Gitea.
4.  **Execute o Script de Deploy**:

    ```bash
    ./tools/release_public.sh
    ```

    **O que este script faz?**
    1.  Cria uma branch temporária baseada na `develop`.
    2.  **Remove** pastas internas definidas na variável `INTERNAL_FOLDERS` (ex: `.gitea`, `docs`, `scripts`).
    3.  Realiza um *Force Push* para a `master` do GitHub, atualizando a vitrine pública.
    4.  Deleta a branch temporária.

5.  **Tag no Gitea (Opcional mas recomendado)**:
    Para marcar o ponto no histórico interno que corresponde à release:
    ```bash
    git tag -a v0.6.0 -m "Release 0.6.0"
    git push origin v0.6.0
    ```

---

## 🛡️ Segurança e Privacidade

- **Histórico do GitHub**: É intencionalmente artificial. Ele pode ter seu histórico reescrito (`force push`) a cada release para garantir que nenhum arquivo removido permaneça acessível no histórico do Git.
- **Arquivos Internos**:
    - `docs/`: Documentação de dev, roadmap, guias.
    - `scripts/`: Scripts de automação, IA.
    - `.gitea/`: Workflows de CI/CD internos.
    - `assets/`: Imagens do README (Estas **SÃO** publicadas).

## ⚠️ Cuidados Importantes

1.  **Nunca dê `git push` manual para o `github`**. Sempre use o script.
2.  Se adicionar uma nova pasta secreta, lembre-se de incluí-la na lista `INTERNAL_FOLDERS` dentro do arquivo `tools/release_public.sh`.
