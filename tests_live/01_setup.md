# 01 - Setup dos Testes LIVE

Execute o bloco abaixo uma única vez para preparar seu banco de dados para os testes de reatividade.

```mysql
-- Criar tabelas para os testes
CREATE TABLE IF NOT EXISTS tarefas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titulo STRING,
    status STRING
);

CREATE TABLE IF NOT EXISTS estoque (
    id INT AUTO_INCREMENT,
    produto STRING,
    qtd INT
);

CREATE TABLE IF NOT EXISTS info (
    msg STRING,
    data_log DATETIME
);

-- Inserir dados iniciais
INSERT INTO estoque (produto, qtd) VALUES ('Mouse', 50);
INSERT INTO estoque (produto, qtd) VALUES ('Teclado', 20);
```

Após rodar, você pode conferir as tabelas clicando no botão **"Tables"** no rodapé do bloco.
