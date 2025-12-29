# Plano de Implementação: Core LIVE Engine (V2)

Este documento estabelece o contrato técnico e a arquitetura para o sistema de **Live Tables** (Tabelas Reativas). O foco é transformar o Obsidian de um editor estático em um dashboard dinâmico baseado em dados.

## 1. O Conceito de Bloco LIVE
Um bloco LIVE não é um script de execução; é uma **View Sincronizada**. Diferente do bloco padrão, o código que gera os dados é ocultado para dar lugar à interface de dados pura.

### 2. O Contrato do Bloco LIVE
*   **Sintaxe Obrigatória:** Deve iniciar com `LIVE SELECT`. Qualquer variação (ex: `SELECT LIVE`) é tratada como erro ou SQL padrão.
*   **Atomicidade:** Deve conter **exatamente um** comando `SELECT`. 
*   **Imutabilidade:** É estritamente *Read-Only*. Não pode conter `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `DROP`, `ALTER` ou `USE`.
*   **Validação:** Se o parser encontrar mais de um comando ou comandos de escrita, o bloco renderiza um erro crítico: *"LIVE blocks must contain exactly one SELECT statement."*

## 3. Arquitetura Reativa (O DatabaseEventBus)

Para garantir reatividade sem polling, usaremos um Barramento de Eventos.

### O Evento de Mudança
Sempre que uma query de escrita é executada em **qualquer lugar do plugin**, um evento é disparado:
```typescript
interface DatabaseChangeEvent {
    database: string;      // Banco que sofreu a alteração
    tables: string[];      // Tabelas afetadas (extraídas via AST do SQL)
    timestamp: number;     // Hora da alteração
    originId: string;      // ID do bloco que gerou a alteração (evita auto-refresh infinito)
}
```

### Identidade do Bloco (`liveBlockId`)
Cada bloco LIVE recebe um ID imutável baseado em sua localização física:
`liveBlockId = notePath + blockPosition`
Isso permite que o sistema identifique exatamente quem causou a mudança e quem precisa reagir.

## 4. Ciclo de Vida do Bloco LIVE

### Fase 1: Ancoragem (Iniciação)
Ao carregar o bloco, o plugin captura o `activeDatabase` atual.
*   **Regra de Ouro:** O banco é travado no momento da criação. Mudanças globais no seletor de banco do plugin **não afetam** blocos LIVE já renderizados.

### Fase 2: Parser e Extração de Metadados (Uso de AST)
**Não utilizaremos Regex** para extrair nomes de tabelas, pois queries complexas com JOINS e Subqueries geram bugs.
1.  O prefixo `LIVE` é removido.
2.  Utilizaremos o próprio parser do AlaSQL: `const ast = alasql.parse(sql)`.
3.  **Análise de AST**: Extrairemos recursivamente todas as tabelas mencionadas em `ast.from`, `ast.join` e subqueries.
4.  O bloco se registra no `DatabaseEventBus` informando seu `liveBlockId`, o banco ancorado e a lista exata de tabelas observadas.

### Fase 3: Renderização (View Mode)
*   O editor de código é **ocultado**.
*   A interface exibe apenas o `ResultRenderer`.
*   Um pequeno indicador visual de "Sincronizado" aparece no rodapé.

### Fase 4: Re-execução (Reação)
Ao receber um evento do `EventBus`:
1.  **Proteção de Origem**: Se `event.originId === this.liveBlockId`, o bloco ignora o evento (ele não reage à mudança que ele mesmo causou).
2.  **Validação de Banco**: O `database` do evento deve coincidir com o banco ancorado.
3.  **Interseção de Tabelas**: O bloco re-executa o `SELECT` apenas se houver intersecção entre as tabelas do evento e as tabelas observadas por ele.

### Fase 5: Cleanup (Destruição)
Quando o Obsidian descarrega a nota (ou o nó DOM é removido), o bloco chama `unregister()` no `EventBus` para evitar vazamentos de memória.

## 5. Estratégias de Segurança e Performance

*   **Prevenção de Loops:** Queries LIVE são proibidas de escrever por contrato. A lógica de `originId` adiciona uma camada extra de segurança para futuras expansões.
*   **Precisão Cirúrgica**: O uso de AST via AlaSQL garante que o bloco só dê "refresh" quando necessário, economizando processamento.
*   **Throttling:** O `EventBus` agrupa notificações rápidas para evitar "flicker" (piscadas) na interface durante operações em lote.

---

## 🛠 Próximos Passos Técnicos

1.  Desenvolver o `DatabaseEventBus.ts`.
2.  Atualizar o `QueryExecutor.ts` para emitir eventos de mudança (utilizando AST para identificar as tabelas afetadas).
3.  Implementar o parser de `LIVE SELECT` e a lógica de `liveBlockId` no `main.ts`.
4.  Migrar a renderização para o "View Mode" (ocultar SQL).
