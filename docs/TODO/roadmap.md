# TODO - Obsidian SQL Notebook

Este documento rastreia as funcionalidades planejadas, melhorias pendentes e ideias para futuras versões do plugin.

## 🏗️ Grandes Funcionalidades (Roadmap)

### 1. SQL Forms (`FORM` Engine)
Transformar blocos SQL em interfaces de entrada de dados.
- [ ] Criar `FormRenderer.ts` para gerar formulários HTML a partir de tabelas.
- [ ] Suporte a syntax `FORM tabela` (automático via metadados).
- [ ] Suporte a syntax customizada para labels e tipos de input.
- [ ] Conexão com `DatabaseEventBus` para atualizar tabelas `LIVE` após o envio.

### 2. Live Visuals (`LIVE CHART`)
Visualizações de dados que se atualizam sozinhas.
- [ ] Integração com Chart.js ou similar.
- [ ] Syntax `LIVE CHART <tipo>`.
- [ ] Renderizador dedicado para gráficos no workbench.

### 3. Integração Profunda com Obsidian
Sair apenas dos blocos de notas e integrar com a IDE.
- [ ] **Sidebar (View)**: Uma aba lateral para navegar pelo Schema (tabelas, colunas, índices).
- [ ] **Ribbon Icon**: Ícone na barra lateral esquerda para acesso rápido ao Workbench Global.
- [ ] **Properties Sync**: Integrar com as propriedades (YAML) do Obsidian, permitindo consultar notas como se fossem linhas de uma tabela (ex: `SELECT * FROM folder_notes`).

---

## 💅 Melhorias de UI & UX

### 1. Refinamento de Modais
- [ ] **Modal de Ajuda**: Redesign completo para ser mais educativo e visual (shortcuts, cheatsheet de syntax).
- [ ] **Visualização de Tabelas**: Melhorar a exibição de dados dentro das configurações (atualmente muito simples).

### 2. Feedback Visual
- [ ] **Nomes de Tabela em LIVE**: Exibir claramente quais tabelas estão sendo monitoradas no cabeçalho do bloco LIVE.
- [ ] **Status de Execução**: Melhorar indicadores de erro e sucesso com micro-animações.

---

## 🌍 Global & Core

### 1. Internacionalização (i18n)
- [ ] Implementar suporte a múltiplos idiomas (PT-BR, EN-US).
- [ ] Traduzir mensagens de erro do banco de dados para termos amigáveis.

### 2. Tabelas Interativas (Inline Actions)
- [ ] Botões de ação rápida por linha nos resultados do `SELECT`.
- [ ] Edição inline de células (opcional/experimental).

---

## 📂 Organização
- **Prioridade 0**: SQL Forms (Escrita de dados).
- **Prioridade 1**: Refinamento de UI (Help/Settings) e Reatividade (Visualização de Nomes).
- **Prioridade 2**: Integração com Sidebar e Properties.
