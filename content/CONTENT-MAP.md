# Mapa de conteúdo — Fé Survivor (schema 3)

O arquivo `content/registry.js` é carregado por `index.html` antes de `game.js`. Ele define `window.FE_SURVIVOR_CONTENT`. O motor agora consome diretamente os registros centralizados; os nomes locais (`HEROES`, `WEAPONS`, `ET`, etc.) são apenas referências de compatibilidade, não novos cadastros.

## Heróis

- `heroes[id]`: ficha-base usada na partida — `name`, `role`, `hp`, `spd`, `start`, `bonus`, `dmg`, `pickup`, `xp`, `pal` e metadados opcionais de personagem (ex.: `extraWeaponSlots`, `freeRerolls`, `weaponModifiers`).
- `heroProfiles[id]`: apresentação, Graça, Maestrias, bloqueio/quest e dados consultivos.
- `heroProfiles[id].grace.effect`: objeto de dados declarativo, sem callback JavaScript.
- `heroProfiles[id].perks[index][2]`: objeto de efeito declarativo, sem callback JavaScript.
- `heroAttackRange[id]`: alcance base de ataque.
- `heroPowers[id]`: nome, descrição e ID de comportamento implementado no motor.
- `heroArt[id]`: arte-base pixelada.
- `lockedHeroIds` e `externalSpriteHeroIds`: regras/listas de compatibilidade e carregamento.
- Jonathan (`jonathan`) é desbloqueado por 8.000 moedas; seu Arco da Aliança e a habilidade Flecha de Sinal têm lógica dedicada em `game.js`, incluindo a zona sagrada temporária.
- A spritesheet de Jonathan em `assets/sprites/jonathan_spritesheet.png` usa PNG indexado de 16 cores, com 10 quadros de caminhada e 7 de ataque. As mesmas sequências alimentam a animação do herói durante a partida.
- A árvore do Arco da Aliança oferece os caminhos Mira de Jonatas, Ponta da Aliança e Aljava Renovada. A Evolução Suprema é Arco do Pacto Eterno: exige Arco Nv. 6 e Cinto Nv. 3 e fortalece as flechas e a zona da Flecha de Sinal.

## Armas

- `weapons[id]`: nome, referência, descrição, `base`, `up`, `behavior` e, quando necessário, `variant`.
- Cada entrada `up[index]` possui `d` (texto apresentado ao jogador) e `ops` (lista de operações declarativas sobre os atributos da arma).
- Operações aceitas: `add`, `multiply` e `set`. Exemplo: `{ key: "dmg", op: "add", value: 2 }`.
- `weaponBehaviorContracts` documenta o comportamento implementado e os atributos-base exigidos.

O motor interpreta as operações da melhoria em `statsFor()`. Não há mais funções `f(s)` dentro dos cadastros das armas. Um comportamento de arma inédito ainda exige implementação no motor e contrato correspondente.

## Dons/passivas e habilidades ativas

- `passives[id]`: nome, referência, descrição, ID `behavior` e, quando informado, `maxLevel` e `pickWeight`. `recalc()` executa o handler declarado.
- A versão de expansão de dons possui 21 passivas: 11 originais e 10 novas. Os níveis máximos e pesos individuais são lidos por `passiveMaxLevel(id)` e `passivePickWeight(id)`.
- `builtInIconIds` identifica os dez novos dons que usam ícones vetoriais já desenhados em `ICON_DRAW`; não precisam de PNG separado.
- Os dez novos comportamentos são `flat_armor`, `max_salvation_percent`, `weapon_area`, `effect_duration`, `weapon_amount`, `luck`, `greed`, `curse`, `revival` e `omni_curse`.
- `actives[id]`: nome, referência, descrição, recarga, evolução e ID `behavior`. Os handlers permanecem no motor porque usam funções internas de dano, cura, partículas e áudio.
- `passiveBehaviorContracts` e `activeBehaviorContracts` descrevem os comportamentos reconhecidos.

## Demônios

- `demons[id]`: ficha de combate, peso e regra de aparição, movimento, habilidade, template de arte e metadados de Perfil/Biblioteca.
- `demonDefinitions[id]`: composição de ficha, paleta e dados da Biblioteca, usada pelo motor.
- `demonMovementBehaviors`, `demonAbilityBehaviors`, `demonSpawnPools` e `demonArtTemplates`: listas de comportamentos/valores reconhecidos.
- Um novo comportamento de IA ou ataque à distância precisa de handler/contrato implementado no motor.

## Chefes

- `bossDefinitions[index]`: catálogo canônico, incluindo ID, atributos, sprite, tempo de entrada, padrões de ataque, dica e dados de Perfil.
- Os arrays antigos (`bosses`, `bossIds`, `bossSchedule`, `bossPatterns`, `bossTips`) são derivados do catálogo canônico para compatibilidade com sistemas existentes.
- Um padrão novo exige implementação correspondente no sistema de IA do chefe.

## Evoluções, categorias e Biblioteca

- `categories`: categoria dos conteúdos.
- `slingTree` e `evolutionTrees.weapon/passive/active`: caminhos e Maestrias.
- `libraryTips`, `movementLabels`, `bossPatternNames`, `bossPatternDescriptions`: textos consultivos.
- `heroShopPrices` e `heroShop`: preço e ficha da Loja.
- `profileEnemyIds` e `profileBossIds`: listas ordenadas de ícones do Perfil.

## Formato dos dados e serialização

Os registros de conteúdo são dados serializáveis em JSON: não há callbacks/funções aninhados em heróis, perfis, armas, dons, ativas, demônios, chefes, árvores ou artes. `FE_SURVIVOR_CONTENT.validate` é a única função utilitária exposta pelo arquivo, não é um registro de conteúdo.

Isso deixa o conteúdo preparado para ser carregado, validado, editado e exportado por uma ferramenta como o Content Studio. O arquivo ainda é `registry.js` para funcionar como script clássico sem etapa de build; o objeto de catálogo em si pode ser serializado.

## O que ainda requer código ou assets

O registro declara dados e seleciona comportamentos já existentes; ele não inventa lógica de gameplay. Conteúdo que use um comportamento existente e seus atributos documentados pode ser cadastrado sem alterar o motor, desde que também tenha os assets/ícones necessários. Um comportamento realmente novo, padrão de chefe inédito, IA inédita, Poder Heroico exclusivo ou efeito visual especial ainda exige implementação no motor.


## Expansão de dons — benchmark de passivas (2026-11)

Foram adicionados dez registros: `armadura`, `coracao`, `incenso`, `uncao`, `paes`, `alegria`, `provisao`, `provacao`, `manto` e `coroa`. Os novos registros têm `maxLevel` e `pickWeight` individuais. O motor usa `passiveMaxLevel(id)` para controlar progressão e `passivePickWeight(id)` para reduzir a frequência dos dons novos.

Os comportamentos registrados são `flat_armor`, `max_salvation_percent`, `weapon_area`, `effect_duration`, `weapon_amount`, `luck`, `greed`, `curse`, `revival` e `omni_curse`. Os dez novos ícones são desenhados por `ICON_DRAW`. Ver `PASSIVE-COMPARISON.md` no pacote de expansão para as fórmulas e os paralelos com Vampire Survivors.
