# Professional Development Guidelines - Obsidian SQL

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
... (fluxo de branches e commits)

We follow a strict branching model:

- **`master`**: Only stable, production-ready code. No direct commits.
- **`develop`**: Integration branch for new features.
- **`feature/xxx`**: Dedicated branch for new features, branched from `develop`.
- **`fix/xxx`**: Dedicated branch for bug fixes, branched from `develop` or `master` (hotfix).

### Commit Message Standard (Conventional Commits)
Format: `<type>: <description>`
- `feat`: New feature for the user.
- `fix`: Bug fix for the user.
- `refactor`: Refactoring that doesn't change behavior.
- `chore`: Maintenance tasks (build scripts, dependencies).
- `docs`: Documentation changes.
- `test`: Adding or correcting tests.

---

## 2. Architecture & Modularization

The project is modularized in `src/` to prevent monolithic growth:

- **`src/core`**: Business logic.
    - `QueryExecutor`: SQL parsing, safety checks, and execution.
    - `DatabaseManager`: Persistence and snapshotting.
    - `CSVManager`: Import/Export logic.
- **`src/ui`**: Rendering and user interaction.
    - `ResultRenderer`: Decoupled rendering logic (must consume `ResultSet[]`).
- **`src/utils`**: Cross-cutting concerns.
    - `Logger`, `SQLSanitizer`, `PerformanceMonitor`.
- **`src/types`**: Unified type definitions to prevent circular dependencies.

---

## 3. Engineering Rules (High Robustness)

### SQL Parsing & Security
1. **Unsafe Manipulation**: Never use naive `.split(';')` to parse SQL. Use AlaSQL's AST or conservative single-statement checks.
2. **LIMIT Injection**: Only inject `LIMIT 1000` to top-level `SELECT` statements that are clearly single-statement queries and lack a `LIMIT`.
3. **Safe Mode**: Always use Regex patterns for command detection (e.g., `/\bDROP\s+TABLE\b/i`) to avoid bypasses via whitespace/newlines.

### Result Normalization
1. **Normalization Layer**: Always use `QueryExecutor.normalizeResult` before sending data to the UI.
2. **ResultSet Integrity**: Do not filter out numeric results (DML status). Convert them to `type: "message"` with "X rows affected".
3. **UI Decoupling**: The UI must remain agnostic to AlaSQL internals. It only understands `table`, `scalar`, `message`, and `error` types.

---

## 4. UI/UX Standards
- **Localized Actions**: Action buttons (Copy, Screenshot, Insert) must be scoped to individual result sets, not the global container.
- **Clipboard Management**: 
    - Tables -> TSV format.
    - Scalars -> Plain text value.
    - Objects -> Prettified JSON.
- **Performance**: Use batch rendering for large tables and avoid main-thread blocking for heavy operations.

---

## 5. Development Rituals
1. **Build**: Always run `npm run build` after changes.
2. **Artifacts**: Production builds should be copied to `versions/X.X.X/`.
3. **Verification**: Verify multi-statement scripts and subqueries whenever changing the engine logic.
