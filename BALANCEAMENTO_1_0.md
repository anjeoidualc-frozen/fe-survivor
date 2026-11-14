# Balanceamento econômico 1.0 — Fé Survivor (Android / Release Candidate)

Base: `game_1.js` e `registry_1.js` enviados por você (versão mais recente). Backups em `backup_originais/`.
Arquivos alterados: `game.js` e `content/registry.js`. **Não alterados:** `art_v2.js`, `style.css`, `index.html`, `android-bridge.js`.

## 1. Resumo da arquitetura

Todo cálculo de moedas da partida passa pelo bloco **"Economia central"** do `game.js`:

| Função | O que faz |
|---|---|
| `coinMul()` | `1 + Graça (0,2) + Dízimo (0,2) + Bolsa (≤ 0,4)`, aditivo, com limites defensivos (NaN, negativo, acima do máximo) |
| `mapCoinMul()` | multiplicador do mapa, limitado a 1 … 1,75 |
| `runCoinMul()` | `coinMul × mapCoinMul` (máximo 1,8 × 1,75 = **3,15**) |
| `vigFactor(t)` | fator temporal da Vigília: 1 até 600 s, cai linear até 0,25 aos 1800 s |
| `ecoGain(kind, base)` | concede moedas-base de uma fonte (`drop`, `harvest`, `offer`) já com o fator da Vigília e contabiliza por fonte |
| `harvestTick()` | sorteio da Colheita por abate, com limite de 30 moedas-base |
| `runCoinsRaw()` / `runCoins()` | moedas da partida antes / depois do teto da Vigília. **HUD, tela final, saldo, perfil, botão de anúncio e telemetria usam só `runCoins()`** |
| `dailyBonus(seq, vitória)` | bônus fixo do Desafio do Dia |
| `adGoldUsed()` | contador diário compartilhado dos anúncios de moedas (com migração) |

Contabilização na partida: `G.coins` = moedas-base (inimigos + Colheita), sujeitas a multiplicadores; `G.offerCoins` = Oferta (fixa, fora dos multiplicadores); `G.eco` = detalhamento por fonte para a telemetria.

## 2. Valores finais

| Item | Antes | Agora | Justificativa |
|---|---:|---:|---|
| Pular: moedas | +20 por uso | **0** (concede XP) | a bateria mostrou que 2 pulos pagavam ~40 moedas em 30 s (≈70/min contra ~10/min do jogo normal), e sair da partida também credita |
| Pular: XP | — | `max(1, need × min(0,35, 0,03 + 0,01 × nível))` | nível 2 → 1 XP; nível 10 → 10; nível 20 → 52; nível 30 → 145 |
| Colheita: chance | 15% | **3%** por abate | — |
| Colheita: limite | sem limite | **30 moedas-base/partida**, antes dos multiplicadores | — |
| Oferta: base | 30 | **15** × raridade (15 / 20 / 26 / 36) | — |
| Oferta e multiplicadores | recebia runas e mapa | **não recebe** (`G.offerCoins`) | — |
| Mapa Vale da Sombra | ×1,60 | **×1,75** | texto do mundo atualizado (+75%) |
| Mapa Deserto de Sur | ×1,25 | ×1,25 | inalterado |
| Runas / Bolsa | 0,2 / 0,2 / 0,08 por nível (máx 0,4) | inalterados | limites defensivos adicionados |
| Vigília: fator | 1 | 1 até 10:00 → 0,25 aos 30:00, piso 0,25 | `max(0,25; 1 − 0,75 × min(1; (t − 600)/1200))`, sem valores acima de 1 antes de 10:00 |
| Vigília: teto | sem teto | **600 moedas** creditadas/partida | na bateria, a partida de 27 min rendeu 3.520 |
| Desafio do Dia | 30 fixos | **30 + 70 (vitória) + 10 × (seq − 1), máx +50** | tabela do pedido validada nos testes |
| Desafio: abandono | pagava e avançava sequência | **não paga nem avança** | só a 1ª partida concluída do dia vale |
| Anúncios de moedas | loja 5/dia + tela final 3/dia | **5/dia compartilhado**, +30, 1 por partida na tela final | falha/cancelamento não consomem |
| Mundos Sur / Sombra | compra (ou legado por tempo) | **conquista `b4` (Sur) / `b5` (Sombra)** ou compra | ver seção 4 |

## 3. Interpretações que adotei (revise se discordar)

1. **Fator da Vigília sobre Colheita e Oferta:** aplico o fator no momento do ganho para as três fontes (inimigos, Colheita, Oferta). A Oferta continua fora das runas/mapa, mas depois dos 10 min vale menos.
2. **Teto de 600 na Vigília:** aplicado ao total creditado da partida (inclui Oferta). O anúncio de +30 e o Desafio do Dia ficam fora do teto.
3. **HUD:** o contador "Moedas" da partida agora mostra o valor que será creditado (com multiplicadores). Antes mostrava só as moedas-base.
4. **Desafio do Dia — conquista `d1`:** passou a exigir um desafio **concluído** (antes abandonar já contava).
5. **Pular + XP:** o XP passa pelo `gainXp` normal (multiplicadores de XP do herói e do mapa se aplicam; o teto de XP existente continua valendo).

## 4. Mundos por conquista

Critérios escolhidos a partir da sua bateria (Davi no Vale de Elá, 16 partidas; probabilidade de derrotar cada chefe numa partida):

| Chefe (conquista) | Aparece em média | Derrotado (Davi) | Derrotado (todas as partidas) | Partidas esperadas (Davi) |
|---|---:|---:|---:|---:|
| Legião (`b1`) | 1:12 | 94% | 68% | ~1 |
| Belzebu (`b2`) | 2:45 | 81% | 43% | ~1,2 |
| Abadom (`b3`) | 4:20 | 50% | 23% | 2 |
| **Leviatã (`b4`)** | 5:55 | **38%** | 12% | **~2,7** |
| **O Dragão (`b5`)** | 7:30 | **25%** | 7% | **~4** |
| Amanhecer (`t10`) | 10:00 | 19% | 5% | ~5,3 |

* **Deserto de Sur (R$ 3,49) ← `b4` "Leviatã Vencido"** · **Vale da Sombra (R$ 5,49) ← `b5` "Dragão Vencido"**. A razão entre as partidas esperadas (4 ÷ 2,7 ≈ 1,5) acompanha a razão entre os preços (5,49 ÷ 3,49 ≈ 1,57). Para quem não é o Davi o caminho é bem mais longo (cerca de 8 partidas para o Leviatã e 14 para o Dragão).
* A vida curta do chefe (14 s a 38 s) não é o obstáculo: a dificuldade está em **chegar** vivo até ele. Legião e Belzebu caem em quase toda partida do Davi, por isso foram descartados; a amostra é pequena (16 partidas), então os números são estimativas.
* Para endurecer ou facilitar, troque o id em `WORLD_ACH` (`game.js`). `ww2`, `ww3`, `b1`, `b2`, `b3`, `t5` e `t10` **não** liberam mapas (testado).
* Cada mapa é condição independente (`b5` libera a Sombra sem `b4`). Vale de Elá sempre aberto.
* Compra (`save.iap`) continua valendo; o desbloqueio gratuito **não grava em `save.iap`**, então a restauração de compras não o remove. A migração legada (`GRANDFATHER_WORLDS`, `iapMig`) ficou intacta.
* Ao concluir a conquista em partida o mundo abre na hora ("Mundo liberado"). Textos: `DESBLOQUEIO GRATUITO: Conquiste "Leviatã Vencido" derrotando Leviatã.` e `... "Dragão Vencido" derrotando O Dragão.`, mais "Ou compre por <preço do Google Play>".
* Atenção: quem já tinha `b1`/`b2` numa versão de teste anterior **deixa de ter** acesso gratuito com a regra nova (nada disso foi publicado; compras e a migração legada seguem valendo).

## 5. Produtos e SKUs

| Produto | SKU (preservado) | Entrega antes | **Entrega agora** |
|---|---|---:|---:|
| Bolsa de Moedas | `coins_1000` | 1.000 | 1.000 |
| Cofre de Moedas | `coins_3500` | 3.500 | **3.000** |
| Tesouro Real | `coins_9000` | 9.000 | **7.000** |
| Pacote inicial | `starter_pack` | 9.000 + Sansão + Sur + sem intersticiais | **3.500** + Sansão + Sur + sem intersticiais |
| Deserto de Sur | `world_sur` | acesso permanente | igual |
| Vale da Sombra | `world_sombra` | acesso permanente | igual |
| Remover anúncios | `null` (legado) | só intersticiais | igual |

* Os SKUs `coins_3500` e `coins_9000` **mantêm o nome antigo** (não se renomeia SKU no Google Play) mas entregam 3.000 e 7.000. Documente isso no Console para evitar confusão; se preferir SKUs novos (`coins_3000`/`coins_7000`), basta trocar o campo `sku` em `PRODUCTS`.
* **Risco conhecido:** qualquer compra antiga ainda pendente/não consumida que for recuperada depois desta versão será entregue com a quantia nova, menor. Se o app ainda não foi publicado com esses pacotes, não há impacto.
* Selos de bônus (calculados contra a Bolsa): Cofre **+15%**, Tesouro Real **+16%**. A diferença entre os dois é pequena para o selo "Melhor valor" no Tesouro; se quiser destacar mais, mude as quantidades ou o selo.
* Mantidos: tokens de compra e proteção contra entrega duplicada (`iapTok`), `save.paid`, `save.coins`, `save.iap`, restauração.
* O Pacote inicial deixou de exibir "58% OFF" e o preço riscado; mostra "Oferta única" e o preço localizado do Google Play.

## 6. Alterações manuais no Google Play Console (nada foi alterado lá)

* Atualizar nome/descrição dos produtos `coins_3500` (Cofre: 3.000 moedas) e `coins_9000` (Tesouro Real: 7.000 moedas) e do `starter_pack` (3.500 moedas).
* Conferir preços: `coins_1000` R$ 4,99 · `coins_3500` R$ 12,99 · `coins_9000` R$ 29,99 · `starter_pack` R$ 24,90 · `world_sur` R$ 3,49 · `world_sombra` R$ 5,49 · produto legado de remover anúncios (R$ 9,90).
* Os preços exibidos no jogo vêm do Billing; os valores `fb`/`brl` do código são só reserva (as referências dos mundos voltaram para R$ 3,49 e R$ 5,49).

## 7. Telemetria (Balance Lab)

`BALANCE_TELEMETRY_VERSION` 5 → **6** (schema continua 2; mudança só aditiva, históricos antigos seguem legíveis). Cada partida ganha `result.economy`:
`coinsFromEnemies`, `coinsFromHarvest` (com `cap`), `coinsFromOffer`, `coinsFromSkip` (sempre 0), `skipXp`, `skipsUsed`, `runeMultiplier`, `mapMultiplier`, `vigilFactorAtEnd`, `vigilFactorMin`, `coinsBeforeLimit`, `coinsCredited`, `vigilCapApplied`, `adCoins`, `dailyBonus`, `totalGranted`. `adCoins` e `dailyBonus` são preenchidos depois do fim da partida (anúncio / bônus diário). O evento `choice_skipped` agora traz `xp`, e `reward` é sempre 0. Os campos antigos (`coinsCollectedRaw`, `coinMultiplier`, `coinsEarned`) continuam, agora calculados pela função central.

## 8. Persistência e migração

* Nada de `save` é apagado. Novo campo: `save.adg = {d, n}` (anúncios de moedas do dia). Na 1ª leitura, soma `save.adc` + `save.dbl` **do dia atual** (limitado a 5) e ignora dias anteriores; é idempotente.
* O Desafio do Dia continua em `save.daily` (`date`, `best`, `streak`, `last`); "(feito)" agora usa `last` (dia efetivamente concluído).
* Reviver: continua restaurando o saldo anterior à partida e o `save.daily`; a recompensa é recalculada no fim seguinte sem duplicar (testado). Passou a existir no máximo 1 anúncio de moedas por partida, inclusive depois de reviver.

## 9. Testes executados

`node tests/test_economia.js` (jsdom, ganchos `window.__dbg.eco` que só existem com `?debug` no navegador; no app nativo `IS_NATIVE` os desliga). **180 verificações, 0 falhas** (`tests/resultado_testes.txt`). Também: verificação de sintaxe, ESLint `no-undef` limpo e smoke de interface (`tests/ui_smoke.js`).

| Bloco | Verificado |
|---|---|
| Multiplicadores | sem bônus, Graça, Dízimo, Bolsa 1/3/5, limites, NaN/negativo, mapas, ×3,15, Sur+runas |
| Colheita | 3%, limite 30, sorteio por abate, limite antes dos multiplicadores, reinício por partida |
| Oferta | 15 × raridade, fora de runas/mapa/Bolsa, contabilidade separada |
| Pular | sem moedas, sem `+20`/ícone, XP crescente, anúncio de bônus presente |
| Vigília | fator em 0/9:59/10:00/15/20/25/30/40 min, ganho antigo preservado, teto 600 (cálculo e crédito real), Amanhecer sem teto |
| Desafio do Dia | 10 combinações da tabela, uma vez por dia, abandono, sequência quebrada, sem multiplicadores, desistir e depois concluir |
| Anúncios | migração (3+2, 5+3, ontem, só loja, só final), limite 5 compartilhado, falha não consome, 1 por partida, "sem anúncios" não bloqueia |
| Mundos | sem conquistas, só `b4`, só `b5`, `b1`/`b2`/`b3`/`t5`/`t10`/`ww2`/`ww3` não liberam, compras, legado, abertura imediata (3 chefes não liberam, 4 e 5 sim), sem `save.iap` falso, persistência |
| Produtos | SKUs preservados; Bolsa 1.000, Cofre 3.000, Tesouro 7.000, Pacote inicial 3.500; token repetido não entrega duas vezes; Pacote inicial libera Sansão e Sur |
| Saldo/telemetria | HUD = tela final = saldo = telemetria, reviver, sair da partida, reabrir o jogo |

## 10. Não foi possível validar aqui

* Google Play Billing real (compra, pendente, restauração, consumo), anúncios AdMob reais e Play Games: dependem do app Android e da Play Store.
* Execução no dispositivo com o Capacitor (o teste foi em navegador simulado, sem canvas real).
* Migração a partir de um salvamento real de um aparelho de produção (usei salvamentos sintéticos).
* A aparência visual da tela de mundos e do Pacote inicial em tela pequena (textos novos mais longos).
* Se a versão web também deve receber esta economia: ela está baseada na versão anterior do `game.js` e precisa ser regenerada a partir desta.
