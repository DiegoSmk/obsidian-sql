# 05 - Bancos de Dados e Exploração

Teste a navegação entre diferentes contextos de banco de dados.

## 1. Criando um Segundo Banco
```mysql
CREATE DATABASE vendas;
USE vendas;
CREATE TABLE pedidos (id INT, valor DECIMAL);
INSERT INTO pedidos VALUES (1, 150.50), (2, 89.90);
```

## 2. Selecionando de Bancos Diferentes
Você pode usar o prefixo `banco.tabela` ou o comando `USE`.
```mysql
-- Buscar do banco padrão (dbo)
SELECT * FROM dbo.estoque;

-- Buscar do novo banco
SELECT * FROM vendas.pedidos;
```

## 3. Alternando Contexto Global
Execute o bloco abaixo e observe o nome do banco mudar no rodapé (footer) do bloco.
```mysql
USE vendas;
SELECT 'Agora o contexto global é Vendas' as status;
```

---

## Como testar o Explorer de Tabelas:
1. No bloco acima, clique no botão **"Tables"** no canto inferior direito.
2. Você verá a lista de tabelas do banco `vendas`.
3. Clique em uma tabela para ver os detalhes.
4. No detalhe da tabela, clique em **"Export CSV"** para testar a exportação.
5. Clique em **"Back"** para voltar.
