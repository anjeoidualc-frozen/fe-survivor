# Fé Survivor — Etapa 1: centralização do conteúdo

**Base:** arquivos enviados em 04/11/2026 — `game(20261104-143732).js` e `index(20261104-143733).html`, versão v0.65.

## Objetivo desta etapa

Retirar do `game.js` os grandes cadastros estáticos de conteúdo e reuni-los em `content/registry.js`, sem mudar números de balanceamento, fórmulas de combate, progressão, preços ou regras de desbloqueio.

O `game.js` continua usando aliases locais (`HEROES`, `WEAPONS`, `ET` etc.). Isso reduz o risco de alterar centenas de pontos de uso no motor de uma só vez.

## O que foi centralizado

| Conteúdo | Chave no registro | Quantidade |
|---|---|---:|
| Heróis — ficha base | `heroes` | 10 |
| Heróis — perfil, Graça e Maestrias | `heroProfiles` | 10 |
| Alcance de ataque por herói | `heroAttackRange` | 10 |
| Textos de Poder Heroico | `heroPowers` | 9 (Mendigo não possui Poder Heroico) |
| Dados de armas e melhorias por nível | `weapons` | 15 |
| Dons/passivas | `passives` | 11 |
| Metadados de habilidades ativas | `actives` | 4 |
| Dados dos demônios | `demons` | 12 |
| Descrições dos demônios na Biblioteca | `demonInfo` | 12 |
| Fichas de chefes | `bosses` | 5 |
| Cronograma, padrões e dicas dos chefes | `bossSchedule`, `bossPatterns`, `bossTips` | 5 cada |
| Categorias e árvores evolutivas | `categories`, `slingTree`, `evolutionTrees` | — |
| Dicas e dados auxiliares da Biblioteca | `libraryTips`, `movementLabels`, `bossPatternDescriptions` | — |
| Paletas de demônios e arte-base dos heróis | `demonPalettes`, `heroArt` | — |
| Listas usadas no carregamento de sprites e Perfil | `bossIds`, `externalSpriteHeroIds`, `profileEnemyIds`, `profileBossIds` | — |

As extensões adicionadas mais tarde no arquivo original também foram incorporadas: Gideão, Pedro, Moisés, as armas Cajado de Moisés/Machado de Eliseu/Jarros de Gideão/Rede de Pedro/Menorá, Fervor, Corrida de Elias e os inimigos Escorpião de Sur/Sombra Rastejante.

## O que permanece em `game.js` de propósito

Estes pontos não são apenas fichas: contêm lógica que depende do motor e de funções privadas do jogo.

- Combate e comportamento das armas (`updWeapons`, `nxStaff`, `nxAxe`, `nxJars`, `nxNet`, `nxMenorah` etc.).
- Efeitos das habilidades ativas (`ACT[id].go`), que chamam dano, cura, áudio, partículas e outros recursos internos.
- Cálculo e aplicação dos dons (`recalc`) e das Graças/Maestrias que executam callbacks.
- Poderes Heroicos (`nxHero`) e comportamentos específicos de cada herói.
- IA, movimentação, ataques e regras de aparição dos demônios e chefes.
- Desenho dos ícones (`ICON_DRAW`), construção de sprites e arte procedural derivada de Gideão, Pedro e Moisés.
- Preços e regras dinâmicas da Loja (`HU`/`ECO`), estado de desbloqueio e integração com o save.
- Integrações de apresentação e assets que dependem de arquivos externos.

**Importante:** esta etapa organiza o cadastro, mas ainda não permite criar qualquer arma ou comportamento inédito apenas preenchendo um formulário. O próximo passo será separar comportamentos reutilizáveis do motor e só então construir o Content Studio.

## Formato do registro

`content/registry.js` é um arquivo JavaScript, não JSON puro. Alguns perfis contêm funções (`grace.fx` e callbacks de Maestria), então não é seguro converter o arquivo inteiro para JSON nesta etapa. O registro é exposto em `window.FE_SURVIVOR_CONTENT` e tem `schemaVersion: 1`.

O método `FE_SURVIVOR_CONTENT.validate()` verifica referências entre os catálogos. Se encontrar inconsistências, escreve avisos no console com o prefixo `[FE Content Registry]`.

## Alterações em `index.html`

Foi adicionada uma única referência, antes de `game.js`:

```html
<script src="content/registry.js"></script>
```

Os demais scripts e caminhos foram preservados.

## Instalação

1. Faça uma cópia de segurança da pasta `www` inteira.
2. Substitua `www/game.js` pelo `game.js` deste pacote.
3. Substitua `www/index.html` pelo `index.html` deste pacote.
4. Copie a pasta `content/` deste pacote para `www/content/`.
5. Não remova nem substitua `style.css`, `art_v2.js`, `android-bridge.js`, `assets/`, `sprites/`, `icons/`, `fonts/` ou `home-verses.js`.
6. Teste primeiro no navegador local: menu, seleção de herói, Loja, Perfil, Biblioteca, início de partida, cartas, ataques e chefes.
7. Só depois de validar no navegador, sincronize/compile o Android (`npx cap sync android` e Android Studio).

## Validação realizada nesta entrega

- `node --check game.js`: aprovado.
- `node --check content/registry.js`: aprovado.
- Execução isolada de `content/registry.js` em Node: aprovada.
- `FE_SURVIVOR_CONTENT.validate()`: lista vazia (`[]`).
- Conferência de categorias, dicas, árvores e referências cruzadas: aprovada.
- Teste de navegador e partida completa: **não concluído neste ambiente**. A tentativa de abrir Chromium foi bloqueada pelo ambiente (`ERR_BLOCKED_BY_ADMINISTRATOR`). Portanto, faça o teste web com os assets originais do seu projeto antes de gerar APK/AAB.

## Reversão

Se houver qualquer problema, restaure os arquivos `game.js` e `index.html` do backup e remova a pasta `www/content/` criada por esta etapa. Nenhum formato de save ou chave de armazenamento foi alterado intencionalmente.
