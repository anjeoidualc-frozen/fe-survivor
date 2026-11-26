# Evento de Natal 2026 — A Estrela de Belém (Fé Survivor v0.70)

Janela: 10/12/2026 a 07/01/2027, inclusive, horário de Brasília (UTC-3). A configuração fica em `content/registry.js`, em `events.christmas2026` (datas, missões e recompensas). O evento usa o relógio do aparelho, então um jogador pode alterar a data local; não há validação remota.

## Arquivos para você criar (opcionais: sem eles o jogo usa o visual e a música normais)

### Fundos de tela — pasta `assets/loading/`
Aceita `.jpg`, `.jpeg`, `.png` ou `.webp` (nesta ordem). O código só usa o arquivo se ele existir.

| Arquivo | Tela |
|---|---|
| `christmas_menu` | Menu principal |
| `christmas_hero_select` | Preparar a Jornada |
| `christmas_world_select` | Seleção de mundos |
| `christmas_library` | Biblioteca |
| `christmas_event` | Tela do Evento de Natal |

Banner do evento e miniatura do mundo: `assets/modes/christmas_bethlehem.png` (também aceita `.jpg`, `.jpeg`, `.webp`). Proporção sugerida 2:1 (ex.: 960×480). Aparece no banner da tela do evento e no cartão do mundo.

Prompt-base (inclua em todos): "16-bit pixel art, 16:9 landscape, 1920x1080, biblical medieval fantasy, ancient Judea at night, cold winter, deep purple and navy sky, ivory snow, gold and amber accents, soft glow, painterly pixel shading, NO text, NO letters, NO logos, NO characters in the foreground, NO UI elements, clean dark areas in the center and lower third for interface, no Santa Claus, no reindeer, no sleigh, no modern objects".

- **christmas_menu**: "[prompt-base]. Panoramic night view of hills of Judea covered by thin snow, an ancient stone city glowing warm in the distance, a large golden Star of Bethlehem shining in the violet sky, olive trees with snow, a dirt road winding to the horizon, empty darker area in the center for a title."
- **christmas_hero_select**: "[prompt-base]. Interior of an ancient stone hall or arched courtyard in winter night, snow on the window sills, warm oil lanterns and braziers on the sides, soft golden starlight entering through an arched opening at the top, large empty dark center for a hero grid."
- **christmas_world_select**: "[prompt-base]. Wide landscape of three distant regions seen from a high ridge in the snow: a valley, a desert edge and a dark valley, all dusted with snow, the Star of Bethlehem above the central path, calm and dark lower half."
- **christmas_library**: "[prompt-base]. Ancient scriptorium at night: stone shelves with scrolls and codices, candles and oil lamps, snow visible through a small arched window with a golden star outside, rich purple and amber tones, empty darker central panel area."
- **christmas_event**: "[prompt-base]. Small stable of Bethlehem on a snowy hill, humble stone and wood, warm golden light inside, hay bales, lanterns, olive and palm trees with snow, the Star of Bethlehem blazing above with soft golden rays, composition kept to the upper half so the lower half stays dark and clean."
- **christmas_bethlehem** (banner/miniatura, 2:1): "16-bit pixel art, 2:1, the nativity stable of Bethlehem under a large golden star, snowy hills, stone houses with warm windows, olive trees, deep navy and violet night, ivory snow, no text, no UI, no Santa, no modern objects."

### Músicas — pasta `assets/music/`
Aceita `.ogg`, `.mp3` e `.wav`. Você pode colocar variações com sufixo `_2` e `_3` (ex.: `christmas_menu_2.mp3`); o jogo alterna entre elas. Peça faixas instrumentais, sem vocal, com final que volte ao início (loop). Recomendado `.ogg` ou `.mp3` de 128 kbps. Duração 2 a 3 minutos cada.

| Arquivo | Onde toca |
|---|---|
| `christmas_menu` | Menus e telas do evento (durante o evento) |
| `christmas_run` | Partida no mundo Belém |
| `christmas_boss` | Chefes no mundo Belém |

- **christmas_menu**: "Instrumental, no vocals, loopable, 2-3 minutes, 70 BPM. Warm and hopeful biblical Christmas, ancient Judean winter night. Celesta, soft harp, dulcimer, solo oboe or duduk melody, gentle strings pad, light frame drum, hint of bells. Original melody, inspired by the feeling of hope, not a copy of any known carol. Mood: calm, reverent, golden."
- **christmas_run**: "Instrumental, no vocals, seamless loop, 2-3 minutes, 108 BPM. Adventure survival theme with a Christmas night feeling in ancient Judea. Oud or plucked strings, hand drums and tambourine, rising cello ostinato, warm brass swells, sparkling bells on top, minor-to-major hopeful progression. Original melody, tension without horror, steady drive for a long action session."
- **christmas_boss**: "Instrumental, no vocals, seamless loop, 2-3 minutes, 140 BPM. Epic boss battle, dark forces against the Star of Bethlehem. Heavy low drums, taiko and frame drums, powerful low strings, choir-like pads without words, brass hits, icy glockenspiel and bell accents, intense but with a golden heroic motif. Original melody."

## Ícones
O ícone do evento usa `assets/ui/star.png` (o botão do menu e o cabeçalho da tela do evento).
Os ícones de perfil das 12 skins são gerados automaticamente a partir do sprite com a skin (`<heroi>_natal2026`), como as demais skins.

## Neve em Belém (durante a partida)
Como a chuva do Vale de Elá e a tempestade de areia do Deserto de Sur, Belém tem clima próprio, desenhado em `nxAtmos` (wi 3) com o temporizador em `nxWorldTick`.
- **Neve contínua:** 44 flocos (efeitos altos) ou 14 (efeitos baixos), com parallax da câmera, sombra azulada para ler sobre a neve clara, vetores fixos (nenhuma alocação por quadro) e 4 estilos de preenchimento por quadro.
- **Nevasca:** a cada 60–90 s (primeira após 25 s de partida), por 10 s, nunca durante chefe nem amanhecer. Sobe até 114 flocos (altos) ou 40 (baixos), com véu leve e claro só nas bordas; o centro continua limpo para ler os ataques dos chefes. Aviso "Nevasca" na tela.
- **Gameplay intacto:** a nevasca é só visual. Não empurra jogador, inimigos ou projéteis e não gera inimigos (diferente da tempestade de areia).
- Respeita a opção de efeitos visuais e o menu continua com a neve DOM própria.

## O que foi alterado
- `content/registry.js`: mundo "Belém sob a Estrela" (índice 3), `events.christmas2026`, notas da versão 0.70.
- `heroes_skins.js`: 12 skins `natal2026` (200 ouro).
- `game.js`: `APP_VER` 0.70; integração do mundo (terreno, decoração, presépio, luz, névoa, miniatura); missões e save; botão e tela do evento; neve só nos menus; fundos e música sazonais com fallback; variantes visuais de inimigos e chefes em cache; ganchos em `endRun` e na morte de chefe; correções em `wIdx` e no sorteio do Desafio do Dia.
- `style.css`: estilos do evento e da neve.

## Testes executados (Chromium headless, 960×432)
- Janela de datas: véspera (inativo), 1º dia e último dia (ativos), dia seguinte (inativo, mundo salvo volta ao Vale de Elá, skins e recompensas mantidas).
- Missões: abandonar não conta; derrota conta (missão 1); vitória no Amanhecer conta (missão 3); chefe derrotado em Belém conta (missão 2); cada recompensa paga uma vez.
- Neve nos menus (camada DOM): ligada no menu, desligada durante a partida e no fim da partida.
- Neve em Belém durante a partida: neve contínua e nevasca testadas por captura de tela; fps igual ao do Vale de Elá no headless (limitado a ~62 fps, então não mede aparelho real).
- Skins: as 12 renderizam no seletor de heróis.
- Variantes: 18 sprites gerados e conferidos lado a lado com os originais; console sem erros dentro e fora do evento.

## Não testado (precisa de aparelho/arquivos reais)
- Android/Capacitor em aparelho real, FPS, memória e bateria; qualidade de efeitos baixa e alta.
- Música e fundos com arquivos reais (só o fallback foi exercitado).
- Ícones de perfil das skins na tela de perfil.
- Anúncios, app em segundo plano e mudança de relógio do aparelho.
- Antes de publicar: rodar `npx cap sync` (não edite `android/app/src/main/assets/public` à mão) e conferir `versionCode`/`versionName` no Android.

## Correção de layout (Preparar a Jornada)
Causa: a camada de neve dos menus era inserida como PRIMEIRO filho da tela de subtelas (`SCR`), e o jogo usa `SCR.firstElementChild` como o painel. Agora a camada é adicionada por último (continua atrás do conteúdo pelo `z-index`). Com isso o layout (grade 4×3 de heróis e painel de detalhes) fica igual ao original, dentro e fora do evento.

## Novidades do evento: herói, inimigo e chefe

### Herói: Baltasar, o Mago do Oriente (Mateus 2:1-12)
- Arma inicial: Menorá (orbes de luz). Salvação 95, Passos 60, coleta +20%, Fé +10%.
- **Graça:** Guiado pela Estrela (+15% de alcance de coleta).
- **Poder novo, Presentes do Oriente:** a cada 12 s a estrela traz um presente, em ciclo. **Ouro**: atrai toda a Fé e as moedas do mapa e derruba 4 moedas. **Incenso**: cura 10% da Salvação e purifica os demônios próximos (anel de luz com dano e empurrão). **Mirra**: protege por 2,5 s. A barra do poder mostra qual é o próximo presente.
- **Maestria:** Presente de Ouro (+10% de Fé), Presente de Incenso (+8% de dano), Presente de Mirra (+12 de Salvação máxima).
- Comprado na Loja por 9.000 moedas (valor em `heroShopPrices`); permanece à venda depois do evento.
- **Skins:** "Sábio de Sabá" (regular, 200 ouro) e "Astrólogo de Belém" (Natal, `natal2026`, 200 ouro). Os ícones de perfil saem do sprite, como os demais.
- Arte: 21 quadros (parado, andando, ataque, dano, investida) em `heroArt.baltasar`.

### Inimigo: Espírito Gélido (Jó 38:29)
- Só nasce em Belém (11% das ondas, 20% durante a nevasca). Persegue deixando um **rastro de gelo** (poças de 5,5 s) que reduz a sua velocidade em 38%; ao morrer deixa uma poça gelada maior.
- Vida 7, velocidade 29, dano 8. Aparece na Biblioteca e tem ícone de perfil (200 moedas).

### Chefe: Herodes, o Rei Usurpador (Mateus 2:16)
- Aparece em Belém entre 5:00 e 5:38 se nenhum outro chefe estiver ativo, **fora do cronograma dos 5 chefes** (não avança o índice nem altera tempos, vida ou ataques deles). Vida 1.500, conta para a missão "Vigília dos Pastores".
- **Decreto:** círculos de gelo marcados no chão (um sobre você; 5 após 50% da vida).
- **Geada do Decreto (mecânica única):** a arena se divide em 4 quadrantes; 3 congelam (lentidão e dano por tique) e o **quadrante dourado é seguro**. Dá 1,7 s de aviso.
- Leque de orbes e invocação de Espíritos Gélidos.
- Ícone de perfil: Herodes (1.200 moedas).

### Arquivos novos/alterados nesta etapa
`content/registry.js` (heroi, demônio, habilidade `frost_trail`, dados do chefe em `events.christmas2026.boss`), `art_v2.js` (inimigo e chefe), `heroes_skins.js`, `heroes_stories.js`, `game.js` (bloco "Parte 3" e ganchos), `style.css` sem mudanças.

### Pendências e decisões suas
- A lista de heróis passou de 12 para 13 e rola dentro do painel, como já previsto no CSS (`overflow-y: auto`).
- Valores de balanceamento (vida do Herodes, preço do Baltasar, intervalo do Presente) são estimativas: ajuste em `events.christmas2026.boss` e `heroPowerTuning.magi_gifts`.
- Herodes só aparece em Belém. Para liberar Baltasar e o Gélido fora do evento não é preciso nada: ficam permanentes. Se quiser o herói só durante o evento, é um filtro na Loja.
