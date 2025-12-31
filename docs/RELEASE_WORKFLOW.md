
# Guia de Publicação (Gitea + GitHub)

Este projeto utiliza um fluxo híbrido para manter um histórico de desenvolvimento privado (Gitea) e uma versão limpa pública (GitHub).

## Estrutura de Branches
- **`develop`**: Branch principal de trabalho. Contém **todos** os arquivos (scripts, docs internas, CI do Gitea). Fica apenas no Gitea.
- **`master` (GitHub)**: Versão pública "limpa". Não contém pastas internas (`.gitea`, `tools`, etc).

## Como Publicar uma Nova Versão

Sempre que você finalizar uma versão na `develop` e quiser lançar para o mundo:

1. **Garanta que tudo está salvo na `develop`:**
    ```bash
    git checkout develop
    git push origin develop
    ```

2. **Rode o Script de Publicação:**
    Este script automatiza a limpeza e o envio para o GitHub.
    ```bash
    ./tools/release_public.sh
    ```

    *O script irá:*
    - Criar uma branch temporária.
    - Apagar as pastas `.gitea`, `root`, `scripts`, `improvements`.
    - Fazer um *Force Push* para a `master` do GitHub.
    - Voltar para a `develop` intacta.

## Configuração Inicial (Já feita)
Se precisar configurar em outra máquina:
1. Adicione o remoto do GitHub: `git remote add github https://github.com/DiegoSmk/obsidian-sql.git`
2. Garanta que você tem permissão de push no repo.

---
**Nota:** Nunca dê `git push` manual na `master` do GitHub se você tiver alterado arquivos internos, pois eles ficarão visíveis no histórico. Sempre use o script.
