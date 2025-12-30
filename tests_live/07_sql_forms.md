# 07 - Testes de SQL Forms

Este arquivo contém testes para a nova funcionalidade de formulários dinâmicos.

## 1. Formulário Automático
O bloco abaixo gera um formulário automático baseado na estrutura da tabela `tarefas`.
```mysql
FORM tarefas
```

## 2. Formulário Customizado
Use este bloco para testar rótulos personalizados e tipos de campos específicos.
```mysql
FORM tarefas
  titulo TEXT "Nome da Tarefa"
  status SELECT "Situação" ('Pendente', 'Em Andamento', 'Concluída')
```

## 3. Teste de Estoque
Um formulário para entrada de produtos no estoque.
```mysql
FORM estoque
  produto TEXT "Nome do Item"
  qtd NUMBER "Quantidade Inicial"
```

## 4. Teste de Logs (Apenas Leitura/Oculto)
Note que se a tabela tiver `AUTO_INCREMENT`, o campo será ocultado.
```mysql
FORM info
```

---

> [!TIP]
> **Como testar a reatividade:**
> 1. Abra a nota `02_dashboard_live.md` em um painel lateral (**Split Right**).
> 2. Preencha um dos formulários acima e clique em **Save Record**.
> 3. Observe que o painel lateral se atualiza instantaneamente sem você precisar clicar em nada!
