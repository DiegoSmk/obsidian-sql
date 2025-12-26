# Automação com Gitea Actions

Este projeto utiliza **Gitea Actions** para automatizar o processo de Build e Release. Isso garante que o código seja validado e empacotado profissionalmente a cada mudança.

## 1. Configuração do Ambiente

### Habilitar Actions no Repositório
1. Vá em **Configurações -> Repositório**.
2. Marque a opção **Habilitar Actions**.

### Configurar o Runner (Motor)
O workflow está configurado para rodar em runners com a label `docker`. Certifique-se de que seu `act_runner` esteja devidamente registrado e ativo no servidor.

### Configurar o Secret do Token
Para que a automação possa criar Releases e fazer upload de arquivos, ela precisa de permissão:
1. No seu perfil do Gitea, vá em **Configurações -> Aplicativos**.
2. Gere um novo token chamado `release_token`.
3. No repositório, vá em **Configurações -> Actions -> Secrets**.
4. Adicione um novo segredo:
   - **Nome**: `RELEASE_TOKEN`
   - **Valor**: (Cole o token gerado no passo 2)

---

## 2. Como Funciona o Workflow

O arquivo de configuração reside em `.gitea/workflows/release.yaml`.

### Build Automático (CI)
Toda vez que você faz um `git push` para as branches `develop` ou `master`:
1. O Gitea Actions inicia um container Docker com Node.js.
2. Instala as dependências (`npm ci`).
3. Executa o build (`npm run build`).
4. Gera um **Artifact** chamado `obsidian-sql-build` (um arquivo .zip) que fica disponível para download na aba **Actions** por 7 dias.

### Release Automática (CD)
Este fluxo é focado em tags de versão (ex: `v1.2.3`):
1. O Gitea Actions inicia um container ultraleve (**Alpine**).
2. Valida a existência dos arquivos `main.js` e `manifest.json`.
3. Empacota o plugin em um arquivo `.zip`.
4. Utiliza o `RELEASE_TOKEN` para criar a Release oficial no Gitea e anexar o arquivo.

---

## 3. Comandos Úteis

### Testar apenas o Build
```bash
git push origin develop
```

### Disparar uma Release Completa
```bash
# 1. Garanta que a versão no package.json está correta
# 2. Crie e envie a tag
git tag -a v1.2.3 -m "Descrição da versão"
git push origin v1.2.3
```

## 4. Troubleshooting (Resolução de Problemas)
- **Workflow não inicia**: Verifique se o Runner está online em *Configurações do Site -> Actions -> Runners*.
- **Erro no passo 'Create Gitea Release'**: Geralmente indica que o `RELEASE_TOKEN` está ausente ou expirou.
- **Erro de 'runs-on'**: Verifique se a label no YAML (`docker`) coincide com as labels registradas no seu Runner.
