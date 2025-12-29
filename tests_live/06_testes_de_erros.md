# 06 - Testes de Erros e Palavras Reservadas

Este arquivo serve para testar as novas "Dicas Inteligentes" (💡) que adicionamos para ajudar a resolver erros comuns.

## 1. Conflito com Palavra Reservada (TOTAL)
Tente rodar este bloco. Ele deve disparar o erro que vimos, mas agora com uma sugestão de correção.
```mysql
-- Erro esperado: Got 'TOTAL'
SELECT count(*) as total FROM estoque;
```

## 2. Conflito com Palavra Reservada (VALUE)
`Value` é outra palavra que o banco de dados usa internamente.
```mysql
-- Erro esperado: Got 'VALUE'
SELECT produto as value FROM estoque;
```

## 3. Erro de Sintaxe (Semicolon)
O AlaSQL é chato com a separação de comandos.
```mysql
-- Erro esperado: Parse error
SELECT * FROM estoque SELECT * FROM tarefas
```

## 4. Tabela Inexistente
```mysql
-- Erro esperado: Table does not exist
SELECT * FROM tabela_que_nao_existe;
```

---

### 💡 Desafio: Como Corrigir?
Tente corrigir os blocos 1 e 2 usando aspas. O resultado esperado é:
```mysql
SELECT count(*) as "total" FROM estoque;
```
Ou mude o nome:
```mysql
SELECT count(*) as qtd_dos_itens FROM estoque;
```
