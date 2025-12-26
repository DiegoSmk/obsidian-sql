# Professional Development Guidelines - SQL Notebook (PT-BR)

Este documento define os padrões arquiteturais, o fluxo de git e as normas de codificação deste projeto. Todas as contribuições (humanas ou IA) devem aderir estritamente a estas diretrizes.

## 0. Instruções para a IA (Senior Persona)

Sempre que atuar neste repositório, **atue como um Engenheiro de Software Sênior**. O código produzido deve ser **production-grade**, seguindo rigorosamente:

1.  **Tratamento de Erros**: Implemente blocos try/catch, mensagens de erro claras e informativas. Nunca deixe erros silenciosos.
2.  **Segurança**: Garanta a sanitização de entradas (SQL Injection protection) e evite exposição de dados sensíveis. Utilize o `SQLSanitizer` existente.
3.  **Observabilidade**: Inclua logs estruturados (utilizando o `Logger.ts` do projeto) em pontos críticos para facilitar a depuração.
4.  **Escalabilidade e Clean Code**: Utilize princípios SOLID, tipagem forte (TypeScript) e garanta que funções sejam pequenas, modulares e testáveis.
5.  **Resiliência**: Para operações assíncronas ou externas, aplique estratégias de timeout e garanta o uso correto do `AbortSignal` quando disponível.
6.  **Documentação**: Adicione comentários JSDoc explicativos em classes e métodos complexos.

---

## 1. Git Workflow (Professional Flow)

Seguimos um modelo rigoroso de branches:

- **`master`**: Apenas código estável e pronto para produção (Lançamentos de Release).
- **`develop`**: Branch de integração para novas funcionalidades.
- **`feature/xxx`**: Branch dedicada para novas features, derivada de `develop`.
- **`fix/xxx`**: Branch dedicada para correções de bugs.

### Padrão de Commits (Conventional Commits)
Formato: `<type>: <description>`
- `feat`: Nova funcionalidade.
- `fix`: Correção de bug.
- `refactor`: Refatoração sem mudança de comportamento.
- `chore`: Manutenção (build, dependências, CI/CD).
- `docs`: Documentação.

---

## 2. Arquitetura & Modularização

O projeto é modularizado em `src/` para evitar crescimento monolítico:

- **`src/core`**: Lógica de negócio (QueryExecutor, DatabaseManager, CSVManager).
- **`src/ui`**: Renderização e interação (ResultRenderer).
- **`src/utils`**: Utilitários transversais (Logger, Sanitizer).
- **`src/types`**: Definições de tipos globais.

---

## 3. Arquitetura CSS (Design Modular)

Para manter a consistência e escalabilidade do design, não utilizamos um único arquivo CSS monolítico. Em vez disso, adotamos uma abordagem modular em `src/styles/`:

- **Design System**: Todos os tokens de design (cores, fontes, tamanhos) são centralizados em `src/styles/theme/variables.css`.
- **Estilos de Componentes**: Cada componente principal da UI possui seu próprio arquivo CSS em `src/styles/components/`.
- **Bundling**: O arquivo `styles.css` final é gerado pelo sistema de build a partir do ponto de entrada `src/styles/index.css`.

---

## 4. Regras de Engenharia (Alta Robustez)

1.  **SQL Parsing**: Nunca use `.split(';')` ingênuo. Use o AST do AlaSQL ou verificações conservadoras de comando único.
2.  **LIMIT Injection**: Apenas injete `LIMIT 1000` em `SELECT` de nível superior que sejam claramente queries únicas e sem LIMIT manual.
3.  **Safe Mode**: Utilize Regex robustos para detecção de comandos bloqueados.

---

## 5. Rituais de Desenvolvimento & Release
1.  **Build**: Sempre execute `npm run build` após alterações para validar o bundle.
2.  **Versionamento**: Atualize a versão no `package.json` e `manifest.json` antes de lançar.
3.  **Release Automática**: O lançamento é disparado por **Git Tags** (`vX.X.X`). O Gitea Actions cuida do empacotamento (`sql-notebook.zip`) e da publicação da Release via API.
4.  **Limpeza**: Binários não devem ser submetidos ao Git. Utilize a aba de Releases do Gitea para download de versões compiladas.
