# Fé Survivor — Balance Patch 0.2

**Versão do jogo:** 0.63  
**Objetivo:** instrumentar partidas para que o balanceamento futuro seja baseado em dados observados, não apenas em estimativas.  
**Princípio:** telemetria local, opt-in para exportação e sem envio automático para a rede.

## Como usar

1. Abra o Fé Survivor v0.63 e jogue uma partida normal.
2. Ao terminar, use a seção **Dados de balanceamento** na tela final; ela também pode ser aberta a partir do menu principal.
3. Exporte **Histórico completo (JSON)** para análises detalhadas ou **Resumo para planilha (CSV)** para comparar partidas no Excel/Sheets.
4. Envie os arquivos exportados para análise. O CSV é um resumo por partida; o JSON contém as escolhas e snapshots necessários para investigar sinergias.

Os dados são gravados no armazenamento local do navegador sob a chave `fe-survivor-balance-runs-v1`. Nada é enviado automaticamente. O histórico mantém até 20 partidas recentes; se o navegador ficar sem espaço, partidas antigas são removidas antes de a coleta afetar a jogabilidade. O tutorial roteirizado é excluído da telemetria.

## Dados registrados

### Configuração da partida
- Versão e versão do esquema de telemetria.
- Modo, mundo e modificadores de vida, velocidade, geração e moedas.
- Herói selecionado e seus atributos-base relevantes.
- Prova escolhida, seus benefícios/sacrifícios, Jejum Total e multiplicadores efetivos.
- Runas permanentes equipadas e quantidade de melhorias meta compradas.
- Semente do Desafio Diário, quando aplicável.

### Métricas cumulativas
- Inimigos gerados por tipo, abates por tipo, elites e chefes.
- Dano total causado, dano contra chefes e elites, execução e fonte de dano recebido.
- Dano recebido, acertos sofridos e bloqueios.
- Cura efetiva, tempo com vida abaixo de 30% e 15%.
- XP base e XP efetivamente aplicado, níveis, moedas.
- Coleta de itens, usos de habilidades ativas e máximo de inimigos vivos observado.
- Resultado, duração, nível final, vida restante e origem do último dano registrado.

### Escolhas e evolução
- As três cartas oferecidas e a carta escolhida em cada evolução.
- Nível e tempo aproximado de cada escolha.
- Snapshots no início, no fim e a cada 15 segundos de jogo: vida, nível, XP, inimigos vivos, proporção de vida dos chefes, atributos efetivos, armas, níveis, habilidades ativas/passivas e rotas de evolução.
- Cada chefe registrado individualmente, com vida inicial, nível do jogador ao aparecer, dano registrado e tempo até ser derrotado.

Os eventos detalhados são limitados para não deixar o armazenamento crescer indefinidamente. As métricas principais permanecem agregadas mesmo quando o limite de eventos é alcançado.

## Arquivos exportados

### JSON detalhado
Inclui configuração, métricas, lista de escolhas, snapshots, eventos e lutas de chefes. É o formato preferido para auditoria de balanceamento.

### CSV de resumo
Uma linha por partida, adequada para comparar heróis, Provas, mundos, tempo de sobrevivência, dano, nível, chefes e resultado em uma planilha.

## Alterações de implementação

- Criada a camada `BTL` (Balance Lab Telemetry) dentro do motor, sem alterar fórmulas de combate intencionalmente.
- Adicionados pontos de coleta em início/fim de partida, geração e morte de inimigos, dano, XP, cura, coleta, uso de habilidades e escolhas de nível.
- Adicionados snapshots periódicos e recuperação de partidas interrompidas por recarga/fechamento da página.
- Adicionada a tela **Dados de Balanceamento** e exportação JSON/CSV manual.
- A telemetria usa uma chave de armazenamento separada do progresso do jogador e não inclui o identificador de jogador salvo pelo jogo.
- A versão do jogo foi atualizada para 0.63.

## Validação

- `node --check www/game.js`: aprovado.
- Todos os arquivos JavaScript do projeto verificados sintaticamente: aprovado.
- Teste isolado da camada de telemetria em ambiente Node: aprovado para início, snapshot, escolha, agregação de métricas, finalização, persistência e geração de CSV.
- Teste visual integrado no Chromium headless: não concluído. O Chromium do ambiente travou mesmo com uma página HTML mínima (`data:`), portanto não foi possível validar cliques, renderização ou download real nesse navegador. O patch deve ser testado manualmente em navegador/Android antes de considerar a UI totalmente validada.

## Não faz parte deste patch

- Não foram alterados os atributos de heróis, runas, Provas, armas, demônios ou chefes para tentar forçar resultados antes da coleta de dados.
- Não há envio automático de dados, servidor de analytics ou integração externa.
