# 03 - Ações de Teste

Execute os blocos abaixo e veja a mágica acontecer na nota `02_dashboard_live.md`.

## 1. Adicionar Tarefa
```mysql
INSERT INTO tarefas (titulo, status) 
VALUES ('Validar Engine LIVE', 'Em Progresso');
```

## 2. Atualizar Estoque
```mysql
UPDATE estoque SET qtd = qtd + 5 WHERE produto = 'Mouse';
```

## 3. Registrar Log
```mysql
INSERT INTO info (msg, data_log) 
VALUES ('Teste de reatividade executado', NOW());
```

## 4. Limpar Dados (Teste de Deleção)
```mysql
DELETE FROM tarefas;
DELETE FROM info;
```
