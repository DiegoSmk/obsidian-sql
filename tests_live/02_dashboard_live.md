# 02 - Dashboard LIVE

Este é o seu painel de controle. Mantenha esta nota aberta em uma aba lateral enquanto executa comandos na nota `03_acoes.md`.

## Status das Tarefas
```mysql
LIVE SELECT * FROM tarefas
```

## Nível de Estoque (Agregado)
```mysql
LIVE SELECT count(*) as quantidade_total FROM estoque
```

## Logs de Sistema
```mysql
LIVE SELECT * FROM info ORDER BY data_log DESC
```

> [!NOTE]
> Observe o indicador **LIVE** pulsando no rodapé de cada bloco acima. Isso indica que eles estão "escutando" mudanças no banco de dados.
