# 08 - Stress Test & Performance

Use este arquivo para testar como o plugin se comporta com grandes volumes de dados e múltiplas atualizações reativas.

## 1. Carga de Dados (1000 linhas)
Execute o bloco abaixo para gerar dados em massa.
```mysql
-- Limpar e popular
DELETE FROM estoque;
INSERT INTO estoque (produto, qtd) 
SELECT 'Item ' + CAST(VALUE AS STRING), RANDOM() * 100
FROM RANGE(1, 1000);
```

## 2. Consulta Pagidana (LIVE)
O plugin deve usar paginação (batch de 100) para manter a fluidez.
```mysql
LIVE SELECT * FROM estoque ORDER BY qtd DESC
```

## 3. Agregação em Tempo Real
```mysql
LIVE SELECT 
    count(*) as total_produtos,
    sum(qtd) as estoque_total,
    avg(qtd) as media_por_item
FROM estoque
```

## 4. Updates em Massa
Rode este bloco e observe todos os blocos acima reagindo simultaneamente.
```mysql
UPDATE estoque SET qtd = qtd + 1 WHERE qtd < 10;
```

---

> [!WARNING]
> Testes de performance podem causar lentidão momentânea no Obsidian se houver centenas de blocos `LIVE` abertos ao mesmo tempo. O plugin usa *throttling* de 500ms para mitigar isso.
