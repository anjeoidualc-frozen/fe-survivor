# v0.52 — Arte e animações renovadas

## Heróis (10)
- Novo sprite 16×22 (antes 14×18) com cabeça, tronco, braços, pernas e arma em camadas.
- **22 quadros por herói**: parado 6 (respiração, piscar, balanço de tecido/cabelo), andando 8 (contato, descida, passagem, subida), ataque 4 (preparar, golpe, continuação, recuperar), dano 1, investida 2.
- Cada herói ataca com a própria arma: funda (Davi), espada (Paulo), cajado de palma (Débora), mandíbula (Sansão), cetro (Ester), tocha (Elias), bengala (Mendigo), cajado (Moisés), tocha (Gideão), rede (Pedro).
- Moisés, Gideão e Pedro agora têm arte própria (antes eram recolorações de Paulo, Davi e Elias).

## Inimigos (12)
- Ciclos de 6–8 quadros (antes 2): imp, bomber, shade, wraith, bat, fangbat, brute, hexer, elite, stalker, scorp e umbra.
- Quadros de preparação (agachar, braços erguidos, fusível aceso) e de ataque (mergulho, pisada, salto do lobo), ligados à IA real.

## Chefes (5)
- Antes 1 quadro estático; agora **17 quadros cada**: movimento 8, preparação 2, ataque 3, investida 2 (o flash de dano continua).
- Legião: massa de rostos com fogos-fátuos. Belzebu: mosca demoníaca de asas batendo. Abadom: rei-gafanhoto com cauda de escorpião. Leviatã: serpente marinha ondulante. O Dragão: três cabeças coroadas e asas que batem.
- Os estados seguem a IA: preparação durante o telégrafo, ataque ao disparar, investida durante o dash.

## Técnico
- Nova arte em `art_v2.js` (carregado antes de `game.js`). Se o arquivo faltar, o jogo usa a arte antiga.
- `tools/art_gen/`: geradores Python (`python3 export.py` recria `art_v2.js`; requer Pillow e numpy).
- Retratos do menu agora centralizam quadros de tamanhos diferentes.
