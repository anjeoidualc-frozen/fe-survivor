# Fé Survivor v0.69 — Desempenho e estabilidade

Base de trabalho: `game_1.js`, `style_1.css` e `index_1.html` enviados em 18/11/2026 (já com HUD, skins, ícones e História/Aparências).
**Só o `game.js` foi alterado.** `style.css` e `index.html` continuam exatamente como você enviou.
Todas as mudanças novas estão marcadas no código com `v0.69`.

---

## 1. Resumo

| O quê | Resultado (simulador, ver seção 4) |
|---|---|
| Chamadas de canvas por quadro com ~200 inimigos | **de ~7.300 para ~2.000** (-72%); nos mundos 2 e 3, -75% |
| Trocas de estado do canvas (`fillStyle`, `globalAlpha`, `filter`...) | -50% a -61% |
| Congelamento (item de gelo): `ctx.filter` por inimigo | de ~210 trocas por quadro para **0** |
| Borda de fogo da arena do chefe | de ~1.250 curvas + 2 `shadowBlur` por quadro para ~1 `drawImage` por chama |
| Gravação da telemetria durante a partida | de `JSON.stringify` do histórico inteiro a cada 30 s para **0** (só uma chave pequena) |
| Qualidade adaptativa | **novo**: reduz enfeites sozinha se o aparelho não acompanha |

**Sobre o travamento depois do anúncio recompensado:** não consegui reproduzir o anúncio em aparelho real (a ponte nativa não está nos arquivos), então não posso afirmar uma causa única. Encontrei três candidatas concretas e corrigi as três (seção 3.5). Peço que você valide no aparelho com o roteiro da seção 6.

---

## 2. Diagnóstico: onde o tempo estava indo

Medi com um navegador simulado (jsdom + node-canvas), contando cada chamada de canvas por quadro. Isso não é FPS real de celular, mas é uma métrica que não depende do aparelho e que sempre pesa no WebView: cada chamada e cada troca de estado custam, e o custo cresce com o número de inimigos.

1. **Uma chamada de canvas por inimigo virou sete.** `spr()` fazia `save + translate + scale + drawImage + restore`, e o contorno claro que adicionei na v0.66 dobrou os `drawImage` dos inimigos (inclusive o meu: eu mesmo piorei isso na entrega anterior, agora corrigido).
2. **Borda de fogo da arena do chefe** (o momento mais pesado da partida): cada chama era 4 camadas de curva (~6 chamadas cada), ~150 chamas por lado, mais 2 `strokeRect` com `shadowBlur`, mais uma string `rgba(...)` nova por faísca.
3. **Congelamento:** `ctx.filter = "hue-rotate..."` ligado e desligado **para cada inimigo**. Filtro de canvas é um dos recursos mais caros do WebView.
4. **Chão:** recalculava `hash` e ruído e fazia 1 `drawImage` por tile, ~650 por quadro (o dobro no amanhecer).
5. **Sombras:** 3 `fillRect` + 3 strings por ser na tela, e `save/transform/restore` por objeto do cenário.
6. **Mundo 3 (Vale da Sombra):** a camada de escuridão de tela cheia consumia ~65% do tempo de desenho.
7. **Lixo por quadro (GC):** `Array.sort` com comparador em ~240 inimigos, 7 `.filter()` por quadro, `Object.entries`, strings de cor, vinheta com `createRadialGradient` nova a cada quadro.
8. **Travadas pontuais (não por quadro):**
   - A telemetria de balanceamento (`BTL.persist`) gravava o **histórico inteiro** (até 100 partidas) no `localStorage`, de forma síncrona, no início da partida, **a cada 30 s de jogo** e depois do anúncio de moedas. Com histórico cheio são ~4 MB de `JSON.stringify` (20 ms no desktop; em celular, várias vezes mais). Se o armazenamento enchia, um laço descartava 1 partida por vez regravando tudo.
   - O trovão gerava um buffer de 61 mil amostras aleatórias a cada raio.

---

## 3. O que mudou

### 3.1 Sprites (`spr`, `sprVar`, `frzDraw`)
- `spr()` agora é **1 `drawImage`**, sem `save/restore`. Contorno claro, espelhamento e tom de congelado são **variantes em cache** por sprite (WeakMap, somem junto com o sprite).
- Congelado: a matriz `hue-rotate(170°) saturate(.5) brightness(1.2)` é calculada uma vez e aplicada por pixel na variante em cache (com `ctx.filter` só como reserva, uma única vez, se o canvas for protegido).
- `glow()` sem `save/restore`.

### 3.2 Cenário
- **Chão** em blocos de 16×16 tiles (256 px), gerados sob demanda, máximo `GRD_MAX = 24` por variante (~6 MB). Cada quadro desenha de 2 a 6 blocos. Saída idêntica pixel a pixel.
- **Sombras** dos seres: 1 `drawImage` em cache (`NXSH`). Sombras de contato e projetadas do cenário: cache (`NXCS`, `NXCW`). A luz radial do mundo 3 segue o caminho original, só trocando `save/transform/restore` por `setTransform`.
- **Escuridão do Vale da Sombra** (`nxDark`): máscara montada em **meia resolução** e ampliada com suavização (`DKS = 0.5`).
- **Névoa:** vinheta em cache (sem gradiente novo por quadro); em qualidade reduzida a névoa é refeita a cada 2º/3º quadro.
- **Chuva:** um `globalAlpha` por traço em vez de um por gota (o traço só usa o último de qualquer forma); menos gotas em qualidade reduzida.

### 3.3 Arena do chefe (`drawArenaBorder`)
- Cada chama é um **sprite pré-renderizado** (camadas somadas), por lado/altura/balanço, com 1 `drawImage`.
- O brilho que era `shadowBlur` virou **tiras de 128 px** pré-renderizadas (o `shadowBlur` roda uma vez) e repetidas só nos trechos visíveis. O formato das chamas ficou igual ao original na comparação lado a lado.
- Faíscas com cores pré-montadas.

### 3.4 Memória e GC
- `sortByKey` (ordenação por inserção, estável, ~O(n) porque as listas quase não mudam entre quadros) para inimigos e para a fila do cenário.
- `keepIf` (remoção no lugar) no lugar de 7 `.filter()` por quadro; buffer reaproveitado para os voadores; contagem de `enemyDeath` sem criar array.
- Sem `Object.entries` nos laços de desenho; partículas só trocam `fillStyle` quando a cor muda.
- Teto de segurança de partículas (520). Antes só um ponto de criação respeitava o limite de 400.

### 3.5 Estabilidade e depois do anúncio
1. **Telemetria (`BTL`)**:
   - `persist()` agora só **agenda** e espera a partida sair de `play`. Fora da partida ainda espera um momento ocioso (`requestIdleCallback`).
   - Durante a partida só a corrida ativa (pequena) é gravada, em `fe-survivor-balance-active-v1`. O histórico completo vai ao fim da partida, ao ir para segundo plano (`visibilitychange`/`pagehide`) ou ao sair.
   - `recoverInterrupted()` também lê a chave ativa, então a recuperação de partida interrompida continua funcionando.
   - Teto `BALANCE_MAX_CHARS = 1.8 M` caracteres e descarte em lotes de 20–25% (antes, de 1 em 1).
   - **O formato dos dados e o dashboard não mudaram.**
2. **Retorno do anúncio** (recompensado e intersticial): nova `adResume()` reinicia o relógio do loop, zera contadores de voz do áudio e acorda o `AudioContext`. O mesmo acontece ao voltar para o app (`visibilitychange`) e no primeiro toque.
3. **Áudio:** `SFX` não cria osciladores com o contexto suspenso/interrompido, limita vozes simultâneas (40), tenta `resume()` com intervalo mínimo e zera `NXA.active`/`NXA.voices` quando o áudio volta (o `onended` nunca dispara numa interrupção, então o contador de vozes ficava preso e os sons sumiam). O buffer de ruído do trovão é gerado uma vez.
4. Intervalos globais (retratos animados do menu, prévias de skin) não rodam durante a partida.

### 3.6 Qualidade adaptativa (`PERF`)
Mede o tempo real entre quadros **só durante a partida** (quadros perdidos por segundo plano/anúncio não contam).

| Nível | Quando entra | O que reduz |
|---|---|---|
| 0 | padrão | tudo ligado |
| 1 | média > 1,4× o esperado por ~110 quadros | sombras projetadas suaves, brilhos fracos, 1 de cada 2 partículas, névoa a cada 2 quadros, chuva e partículas com teto menor |
| 2 | mais ~110 quadros ruins | + sem brilhos aditivos, sem faíscas da arena, névoa a cada 3 quadros |

Volta um nível depois de ~12 s estáveis. **Não mexe na jogabilidade**, só em efeitos. Respeita o limite de FPS escolhido. O nível fica entre partidas (um aparelho lento não recomeça no máximo). Com "Mostrar FPS" ligado aparece `Q2`/`Q1` ao lado do número quando há redução.
Ajustes: `perfTick` (limites 1,4 / 1,12 e contadores 110 / 720).

---

## 4. Medições (simulador, 8 s com ~200 inimigos; antes → depois)

| Cenário | Chamadas/quadro | Trocas de estado/quadro | Quadros em 8 s |
|---|---|---|---|
| Mundo 1 (Vale de Elá), chefe e arena | 7.269 → **2.025** | 1.601 → 819 | 219 → 473 |
| Mundo 2 (Deserto de Sur) | 6.607 → **1.653** | 1.366 → 986 | 224 → 485 |
| Mundo 3 (Vale da Sombra) | 6.310 → **1.561** | 1.346 → 963 | 67 → 103 |
| Mundo 1 com inimigos congelados | 5.810 → **1.340** | 1.436 → 560 | 235 → 489 |

- Soak (~7 minutos simulados por rodada, heróis variados, mundos 1 a 3, níveis 0/1/2, chefe, congelamento): **0 erros**.
- Comparação visual com mesma semente: chão, sprites, chamas e escuridão do Vale equivalentes (o brilho "extra" que aparecia na versão antiga no simulador era o `shadowBlur` do node-canvas iluminando a cena toda; sem esse halo a versão antiga dá o mesmo brilho).
- Telemetria com histórico de 4,3 M de caracteres: 1 `stringify` de ~20 ms durante 100 s de jogo → **0**.
- Os testes funcionais das entregas anteriores (skins, ícones, Biblioteca, Loja) continuam passando.

**Limite honesto:** são números de um simulador em CPU. Em aparelho real o ganho em FPS depende da GPU e do WebView; a redução de chamadas e de lixo tende a aparecer mais em celulares de entrada.

---

## 5. Compatibilidade e riscos

- **Aparência:** igual ao original nas comparações. Diferenças pequenas e esperadas: chamas e sombras do cenário com altura/inclinação arredondadas (1 px / 0,025); no congelamento só o sprite é tingido (antes o filtro também tingia brilhos e contornos do inimigo); a escuridão do Vale é suavizada na ampliação.
- **Memória:** os caches somam, no pior caso, alguns MB (chão ~6 MB por variante, ~24 blocos; variantes de sprite e sombras são pequenas). Todos têm teto ou são WeakMap.
- **Telemetria:** se o app for morto sem passar por `pagehide`/`visibilitychange`, o histórico completo pode perder até a última partida; a corrida ativa é preservada pela chave pequena (gravada a cada 30 s de jogo).
- `index.html` e `style.css`: sem mudanças. A versão do app foi para **0.69** (`APP_VER`). Texto de Notícias fica com você (`registry.js`).

---

## 6. Como validar no celular

1. Ative **Mostrar FPS** e jogue até um chefe (arena de fogo) e um item de gelo: o FPS deve ficar mais alto e estável.
2. **Anúncio recompensado:** assista um, volte ao jogo e observe: som volta, sem travadas nos 10 primeiros segundos.
3. Jogue 2 a 3 minutos em cada mundo (o Vale da Sombra é o mais exigente).
4. Se o aparelho for fraco, observe se aparece `Q2`/`Q1` e se o jogo parece mais fluido sem perder o essencial.
5. No Chrome do computador (`chrome://inspect`), aba **Performance**, grave 10 s de chefe + gelo: deve haver bem menos barras longas de `drawImage`/`fillRect` e menos coletas de lixo.
6. Para testes com `?debug`: `__dbg.perfLvl(0|1|2)` fixa o nível de qualidade, `__dbg.perfLvl()` (sem argumento) volta ao automático e `__dbg.perf()` mostra o estado do governador.

---

## 7. Ajustes rápidos (constantes)

| Constante | Onde | Efeito |
|---|---|---|
| `GRD_MAX` | chão | blocos em cache por variante |
| `DKS` | `nxDark` | resolução da escuridão (1 = original) |
| `BALANCE_MAX_CHARS` | telemetria | tamanho máximo do histórico |
| `ARENA_TW`, `AG_M` | arena | tamanho dos sprites de chama e do brilho |
| limites 1,4 / 1,12 e 110 / 720 | `perfTick` | sensibilidade do governador |
| `RIM_ON` | sprites | contorno claro dos inimigos (agora sem custo extra de chamada) |

---

## 8. Próximos passos (não feitos agora)

- Atlas de sprites (uma única textura) e `OffscreenCanvas` para pré-gerar caches fora da thread principal.
- Atualizar a HUD em DOM (barras de vida e Fé) com `transform: scaleX` em vez de `width`.
- Medir em aparelho real com `performance.now()` por passe de `draw()` e exportar junto da telemetria.
- Ter a ponte nativa do anúncio avisando ao jogo quando o anúncio abre/fecha, para pausar também o `requestAnimationFrame` de forma explícita.
