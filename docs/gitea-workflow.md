# Fluxo de Trabalho e Release com Gitea

Este documento descreve como gerenciar o repositório e o ciclo de vida de versões (releases) utilizando o servidor Gitea local.

> 💡 **Dica Sênior**: Para automação completa de Builds e Releases, consulte o guia [Gitea Actions](./gitea-actions.md).

## 1. Conexão com o Servidor
O repositório está configurado para o servidor Gitea em:
- **HTTP**: `http://192.168.1.217:3003/Diego/obsidian-sql.git`
- **SSH**: `ssh://git@192.168.1.217:222/Diego/obsidian-sql.git`

### Comandos de Sincronização
Para enviar suas alterações para o servidor:
```bash
# Enviar branch atual para o Gitea
git push origin develop

# Enviar branch master principal
git push origin master
```

---

## 2. Ciclo de Release Profissional

Não salvamos mais binários (pastas `versions/`) diretamente no Git. Em vez disso, usamos a funcionalidade de **Releases** do Gitea.

### Passo 1: Preparar o Pacote
No terminal, execute o script de automação:
```bash
./tools/release.sh
```
Isso irá gerar um arquivo `obsidian-sql-[versao].zip` na raiz do projeto.

### Passo 2: Marcar a Versão (Git Tag)
Crie uma "etiqueta" no tempo para o código atual:
```bash
# Substitua v1.2.2 pela versão correta definida no package.json
git tag -a v1.2.2 -m "Release v1.2.2"
git push origin v1.2.2
```

### Passo 3: Publicar no Gitea
1. Acesse o projeto no Gitea pelo navegador.
2. Vá na aba **Releases** -> **New Release**.
3. Selecione a **Tag** que você acabou de enviar (`v1.2.2`).
4. Escreva um título e uma breve descrição das mudanças.
5. **Upload**: Arraste o arquivo `.zip` gerado no Passo 1 para a área de anexos.
6. Clique em **Publish Release**.

---

## 3. Benefícios deste Modelo
- **Repositório Limpo**: O histórico do Git contém apenas código-fonte, não binários pesados.
- **Rastreabilidade**: Você consegue saber exatamente qual código gerou qual versão através das tags.
- **Distribuição Profissional**: O Gitea serve como seu centro de distribuição, mantendo todos os arquivos `.zip` organizados e datados.

---

## 4. Troubleshooting
Se o Gitea pedir senha toda vez e você quiser usar SSH:
1. Adicione sua chave pública (`~/.ssh/id_rsa.pub`) no seu perfil do Gitea (**Configurações -> Chaves SSH/GPG**).
2. Mude o remoto para SSH:
   `git remote set-url origin ssh://git@192.168.1.217:222/Diego/obsidian-sql.git`
