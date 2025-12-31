
# 👨‍💻 Development Guidelines - SQL Notebook

Welcome to the development guide for **SQL Notebook**. This document outlines our architectural standards, internationalization workflow, and release strategy.

## 0. Core Philosophy (Senior Persona)

When contributing, please adhere to:
- **Resilience**: Every async operation must have error handling.
- **I18n First**: No hardcoded strings in UI. Use `t('key')` for everything.
- **Security**: All user input must be sanitized via `SQLSanitizer`.
- **Modularity**: Keep components decoupled (`core` vs `ui`).

---

## 1. Project Structure

```bash
src/
├── core/           # Business Logic (AlaSQL, CSV, State)
├── ui/             # Obsidian Views & Components (Modals, Renderers)
├── utils/          # Helpers (Logger, Sanitizer, I18n)
├── locales/        # Translation files (en.ts, pt-BR.ts, etc)
├── styles/         # Modular CSS System
│   ├── theme/      # Variables & Animations
│   └── components/ # Specific component styles
└── types/          # TypeScript Interfaces
```

---

## 2. Internationalization (i18n)

We support multiple languages using a lightweight internal utility.

### Adding a New Language
1. Create a file in `src/locales/[lang].ts` (e.g., `it.ts`).
2. Copy the structure from `src/locales/en.ts`.
3. Import and add it to `src/utils/i18n.ts` in the `locales` object and `resolveLanguage` function.

### Implementing Translations
Never use raw strings.
```typescript
// ❌ Bad
new Notice("Error: File not found");

// ✅ Good
import { t } from 'utils/i18n';
new Notice(t('errors.file_not_found', { file: fileName }));
```

---

## 3. Git Workflow & Deployment (Hybrid Strategy)

We use a hybrid workflow to handle a **private development** repo (Gitea) and a **public showcase** repo (GitHub).

### Branching Model
- **`develop`** (Gitea): Main working branch. Contains all docs, scripts, and internal tools.
- **`master`** (GitHub): Clean public release branch. **Do not push manually**.

### Release Process
1. **Develop**: Commit your changes to `develop`.
2. **Version**: Bump version in `manifest.json` and `package.json`.
3. **Changelog**: Update `CHANGELOG.md`.
4. **Deploy Script**: Run the automated release tool:
   ```bash
   ./tools/release_public.sh
   ```
   *This script automatically sanitizes the codebase (removing internal docs/tools) and pushes a clean build to GitHub.*

---

## 4. CSS Architecture

We do not use a monolithic CSS file file for development.
- Edit styles in `src/styles/**/*.css`.
- The build process bundles them into `styles.css`.
- Use CSS Variables (`var(--background-primary)`) to support Obsidian themes automatically.

---

## 5. Testing

- **Unit Tests**: Run `npm run test` (Vitest).
- **Manual Testing**:
  - Test on **Desktop** (Linux/Mac/Windows).
  - Verify **Translations** (Switch language in settings).
  - Verify **Theme Compatibility** (Light/Dark mode).

---

## 6. Contribution Checklist
Before submitting a PR:
- [ ] `npm run build` passes without errors.
- [ ] `npm run test` passes.
- [ ] No hardcoded English strings (use i18n).
- [ ] `CHANGELOG.md` is updated.
