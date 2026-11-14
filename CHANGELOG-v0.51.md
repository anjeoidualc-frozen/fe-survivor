# Fé Survivor v0.51 — Áudio de combate variado e feedback de coleta (inclui v0.49 e v0.50)

## Áudios (pacote CC0 "Vigília", 18 efeitos + 2 músicas — ver assets/LICENSE-audio.md)
- Efeitos mantidos em WAV (todos < 120 KB, ~660 KB no total); músicas convertidas para OGG (212 KB no total).
- music_vigil: o loop original terminava com um degrau (estalo ao repetir); a emenda foi refeita com crossfade de 1 s de potência constante.
- music_dawn toca uma vez no Amanhecer e segue pela tela de vitória; depois volta a música do menu.
- hit.ogg e kill.ogg antigos (1 MB) removidos: substituídos por sfx_impact e sfx_enemy_death.

## Motor de áudio novo (WebAudio)
- Sem atraso; variação de tom/volume a cada toque (sequência anti-repetição), por tamanho do inimigo, dano e vida.
- Limite de vozes por tipo e total; limitador no volume final; panorama e distância nos golpes e abates.
- Ao carregar, cada arquivo tem o silêncio cortado e o volume equilibrado; ganhos calibrados para caixinha de celular
  (sons muito graves como alerta de chefe e dano ganham camada aguda sintetizada).
- Reserva sintetizada para todos os sons.

## Feedback de coleta
- Fé: cada coleta seguida sobe uma nota (até 1 oitava); cristais grandes soam mais cheios; coletas em rajada viram um som mais forte.
- A barra de Fé pulsa; marcos ×10/×25/×50 mostram "Fé ×N". Moedas e abates em sequência também sobem de tom.

## Combate e UI
- Sons para Espada, Queixada, Machado, Cajado, Jarros, Rede, Aura/Menorá, Pomba, ondas e tremores.
- Passos por mundo; carta, Arca/Evolução Suprema, escudo e bloqueio com som próprio.
- Música abaixa nos grandes momentos; fade entre faixas.

Arquivos alterados: game.js, style.css, index.html, assets/sfx/*, assets/music/music_dawn.ogg, music_vigil.ogg.
