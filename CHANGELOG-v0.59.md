# Fé Survivor — v0.59
## Economia: centralização e limite de dobros

- **Novo bloco `ECO`** (início do arquivo de jogo, após o save) com todos os números de moedas que não são preços de herói ou pacote: limite de dobros, anúncio grátis da loja, bônus diário, bênção Oferta e custos das runas.
- **Dobro por anúncio limitado a 3 por dia** (antes ilimitado). Quando o limite é atingido, o botão fica desabilitado com a mensagem "limite de hoje atingido". O contador é diário e segue o mesmo padrão do anúncio grátis da loja.
- Valores que não mudaram: preços dos heróis (`HU`), pacotes (`PRODUCTS`), mundos, provas, custos das runas e bônus diário. Todos continuam com os mesmos números.
- Gancho de depuração `dblSetup` exposto em `window.__dbg` (apenas com `?debug`).

### Verificações
- `node --check`: aprovado.
- Teste do limite: 3 dobros concluídos, o 4º e o 5º bloqueados e com o texto de limite.
- Partida padrão rodada sem erros JavaScript.

### Pendente (aguarda decisão de economia)
Ver `Economia_auditoria_v0.58.md`, seção 7.

---

# Fé Survivor — v0.57
## Runas do Reino (nova tela de Tesouros)

### O que muda para o jogador
Os Tesouros do Reino deixam de ser uma lista de melhorias com +% e passam a ser uma árvore de runas, em três ramos: **Ataque**, **Defesa** e **Utilidade**.

- Cada ramo tem uma **pedra-chave** (escolha uma entre três) e três **níveis**. Em cada nível escolhe-se uma runa entre duas.
- Um nível só abre depois das escolhas anteriores do ramo: nível 1 pede a pedra-chave, nível 2 pede duas escolhas, nível 3 pede três.
- Cada runa tem ícone, efeito descrito e custo. O painel de detalhes mostra o que ela faz, o que exige e se substitui outra.
- Trocar uma runa custa de novo. "Refazer ramo" (200 moedas) limpa as escolhas daquele ramo.
- São 12 escolhas no total, entre 27 opções. Não há como ter tudo, então dinheiro sozinho não compra todas as runas.

### Runas
**Ataque**
- Pedra-chave: Lâmina Ardente (+12% de dano), Olho Sagrado (+8% de crítico; críticos com 3× de dano), Fúria do Justo (ao abater, +25% de dano por 3 s).
- Nível 1: Julgamento (+35% de dano contra inimigos abaixo de 30% de vida), Cadência Sagrada (−12% no intervalo entre disparos).
- Nível 2: Alcance da Luz (+12% de área e alcance), Impacto Divino (empurrão 80% maior).
- Nível 3: Sede de Justiça (cada abate restaura 0,5 de Salvação), Juízo Súbito (10% de chance de abater na hora inimigos abaixo de 30% de vida).

**Defesa**
- Pedra-chave: Fortaleza da Fé (+3 de Salvação máxima), Coroa de Espinhos (reflete 5 de dano ao ser atingido), Misericórdia (recupera 1 de Salvação a cada 8 s).
- Nível 1: Couraça de Fé (+10% de bloqueio), Pele de Ferro (−1 de dano recebido, mínimo 1).
- Nível 2: Refúgio (invulnerável por 1,4 s após dano), Vigor da Fé (+2 de Salvação máxima).
- Nível 3: Escudo Divino (a cada 25 s, 3 s de invulnerabilidade), Aura Sagrada (inimigos próximos perdem 4 de vida por segundo).

**Utilidade**
- Pedra-chave: Ascensão (+12% de velocidade), Graça Abundante (+20% de Fé e de moedas), Peregrino (+5% de velocidade e +30% de alcance de coleta).
- Nível 1: Ímã da Graça (+25% de coleta), Sabedoria (+15% de Fé).
- Nível 2: Dízimo (+20% de moedas ao fim da partida), Passos Leves (+10% de velocidade).
- Nível 3: Juízo Acumulado (a cada 20 abates, o próximo golpe causa 50% a mais), Colheita (15% de chance de cada abate render 1 moeda extra na partida).

### Migração
- Melhorias antigas compradas são convertidas em moedas de volta (o valor pago em cada nível). Um aviso aparece na primeira abertura da tela.
- As conquistas continuam funcionando: a "Primeira Oferta" é liberada pela primeira runa comprada.

### Técnico
- Os efeitos de atributo entram em `shopMods`, recalculado a cada partida.
- Efeitos especiais usam ganchos novos no motor: execução e Juízo Súbito em `hurt`; Fúria, cura por abate, Juízo Acumulado e Colheita em `kill`; Escudo Divino e Aura por quadro; Refúgio em `hurtPlayer`.
- Migração executada uma única vez, quando o save não tem o campo `rt`.

### Verificações
- `node --check`: aprovado.
- Teste no Chromium: compra, bloqueio por nível, troca, refazer e migração do save.
- Combate com três combinações de runas, cobrindo 25 das 27 opções (ficaram sem teste em combate Fortaleza da Fé e Ascensão, que são só aumentos de atributo): sem erros JavaScript, e os modificadores aparecem corretamente na partida.
- Regressão: modos Amanhecer e Vigília Eterna executam sem erros.

### Ainda não testado
- Equilíbrio das runas: os valores foram escolhidos, mas não foram medidos com jogadores.
- Layout em celular: a tela tem três colunas e quebra em linhas em telas estreitas; falta testar em dispositivo real.
- Textos novos estão só em português, no código.
