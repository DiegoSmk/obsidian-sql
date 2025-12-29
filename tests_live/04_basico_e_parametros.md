# 04 - Funcionalidades Básicas e Parâmetros

Este arquivo testa as funções que já existiam, garantindo que o novo motor não quebrou o básico.

## 1. Bloco Padrão (Não-Reativo)
Este bloco só atualiza quando você clica em **Run**. Ele é útil para queries pesadas que não precisam ser LIVE.
```mysql
SELECT * FROM estoque;
```

## 2. Parâmetros Dinâmicos
Você pode definir parâmetros em blocos de comentário. O plugin criará inputs para eles.
```mysql
/* params: {
  "min_qtd": 10,
  "categoria": "Hardware"
} */
SELECT * FROM estoque WHERE qtd >= :min_qtd;
```
> [!TIP]
> Altere o valor no input acima e clique em **Run**.

## 3. Estados Colapsados e Marcadores
O plugin suporta marcadores na primeira linha (comentário) para mudar o visual e o estado inicial.

### Bloco com Alerta (Começa Aberto)
```mysql
-- ! Cuidado: Query de Limpeza
SELECT 'Esta é uma query de aviso' as mensagem;
```

### Bloco com Sugestão (Ícone de Ajuda)
```mysql
-- ? Dica de Uso
SELECT 'Use o botão Tables para explorar' as dica;
```

### Bloco que Começa Fechado (@)
```mysql
-- @ Query Oculta por Padrão
SELECT 'Você me encontrou!' as segredo;
```
