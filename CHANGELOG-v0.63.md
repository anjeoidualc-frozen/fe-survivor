# Fé Survivor v0.63 — Balance Lab / Balance Patch 0.2

## Novo: Dados de Balanceamento

- Registra localmente a configuração de cada partida (herói, mundo, runas, Prova e modificadores).
- Registra as cartas oferecidas e escolhidas ao subir de nível.
- Mede dano, XP, cura, dano recebido, bloqueios, eliminações, inimigos simultâneos, usos de habilidades ativas e desempenho dos chefes.
- Captura snapshots no início, no fim e a cada 15 segundos de jogo.
- Permite exportar JSON detalhado e CSV de resumo pela tela final ou pelo menu **Dados de Balanceamento**.
- Os dados ficam no dispositivo e não são enviados automaticamente. O tutorial não é contabilizado.

## Escopo de balanceamento

Esta versão instrumentaliza o jogo para medir as builds antes de alterar os valores. Não há nerfs/buffs intencionais nos atributos de combate neste patch.

## Validação

Verificação de sintaxe JavaScript e teste isolado do coletor aprovados. O teste visual integrado via Chromium headless não foi concluído no ambiente de desenvolvimento.
