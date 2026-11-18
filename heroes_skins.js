/* =====================================================================================================
   Fé Survivor — heroes_skins.js  (conteúdo de skins dos heróis; o motor fica em game.js)
   -----------------------------------------------------------------------------------------------------
   COMO ADICIONAR UMA SKIN: acrescente um objeto na lista do herói em window.FE_HERO_SKINS.heroes.<idDoHeroi>.
   Nenhuma outra linha do jogo precisa mudar: a tela de herói, a Loja e o save leem esta lista sozinhos.

   Campos de uma skin
     id      texto único DENTRO do herói (nunca mude depois de publicar: é o que o save guarda)
     name    título mostrado ao jogador (ex.: "Rei Davi")
     tag     subtítulo curto (opcional)
     desc    descrição curta (opcional)
     ref     versículo/referência (opcional)
     rarity  "rare" | "epic" | "legendary" (cor da moldura nos cartões)
     price   moedas (todas as skins atuais custam 200); 0 = grátis. Comprar a skin libera também o ícone de perfil dela
             (id do ícone = "<herói>_<skin>", ex.: davi_rei; PNG opcional em assets/icons/profile/davi_rei.png)
     remap   troca de cores por hex: { "#cor-original": "#cor-nova" }  ou  { "#cor-original": ["#cor-nova", tolerância] }
             (a troca preserva as variações de tom em volta da cor original; tolerância padrão 7, use 30-45 para arte suavizada)
     parts   peças de pixel art (coroa, capacete, asas...) ancoradas no quadro do herói:
               at   "head" (padrão: topo da cabeça, centro) ou "feet" (base dos pés, centro)
               z    "over" (por cima do herói), "under" (atrás do herói) ou "clip" (só onde já há corpo, ex.: emblema no peito)
               px   linhas de texto; "." = vazio; cada letra é uma cor definida em pal
               pal  { letra: "#cor" }
               ax,ay  coluna/linha da peça que encosta na âncora (centro da cabeça ou dos pés)
               ox,oy  deslocamento extra em pixels de arte (x para a direita, y para baixo)
     Ancora "head" = primeira linha de cabelo/capuz e o centro dela. O motor refaz o contorno escuro sozinho e usa a mesma
     skin em TODOS os quadros (parado, andando, ataque, dano, investida).
   ===================================================================================================== */
(function (global) {
  "use strict";
  const GOLD = { g: "#ffd24a", G: "#c8962c", h: "#fff2a8" };
  const S = {
    classic: {
      id: "classic",
      name: "Clássica",
      tag: "Visual original",
      desc: "O herói como foi desenhado no início da jornada.",
    },
    heroes: {
      /* ---------------------------------------------------------------- DAVI */
      davi: [
        {
          id: "rei",
          name: "Rei Davi",
          tag: "O ungido de Israel",
          desc: "O pastor que virou rei: manto carmesim, colar de arminho e a coroa de Judá.",
          ref: "2 Samuel 5:3",
          rarity: "epic",
          price: 200,
          remap: {
            "#dcb86e": "#b3263f",
            "#b48a46": "#7e1830",
            "#f2dc9c": "#e0586c",
            "#c28a4a": "#a8721f",
            "#7a4a1d": "#c8962c",
            "#4a2c10": "#8a5f18",
            "#f2c14e": "#fff0a0",
          },
          parts: [
            {
              at: "head",
              z: "over",
              ax: 3,
              ay: 2,
              px: ["g.g.g.g", "ggggggg", "gRgBgRg"],
              pal: { g: "#ffd24a", R: "#e0304a", B: "#4a90f0" },
            },
            {
              at: "head",
              z: "clip",
              ax: 4,
              ay: 0,
              oy: 9,
              px: ["wwwwwwwww", "wkwwkwwkw"],
              pal: { w: "#f4f0ff", k: "#2a2438" },
            },
          ],
        },
      ],
      /* --------------------------------------------------------------- PAULO */
      paulo: [
        {
          id: "armadura",
          name: "Soldado de Cristo",
          tag: "A armadura de Deus",
          desc: "Elmo da salvação, couraça da justiça e o cinto da verdade, como na carta aos Efésios.",
          ref: "Efésios 6:11",
          rarity: "epic",
          price: 200,
          remap: {
            "#e9dcc0": "#a9b6c8",
            "#bfae8a": "#7b8aa3",
            "#fff6e0": "#e4edf9",
            "#9a4fd0": ["#c0392b", 34],
          },
          parts: [
            {
              at: "head",
              z: "over",
              ax: 4,
              ay: 3,
              px: [
                "...RRR...",
                "..RRRRR..",
                ".sssssss.",
                "sshsssshs",
                "sSsssssSs",
              ],
              pal: { R: "#d8402e", s: "#b9c6d8", S: "#7b8aa3", h: "#f2f8ff" },
            },
          ],
        },
      ],
      /* -------------------------------------------------------------- DÉBORA */
      debora: [
        {
          id: "palmeira",
          name: "Profetisa da Palmeira",
          tag: "Juíza sob a palmeira",
          desc: "Veste índigo e coroa de folhas de palmeira, como quem julgava Israel à sombra da árvore.",
          ref: "Juízes 4:5",
          rarity: "epic",
          price: 200,
          remap: {
            "#2f9e8f": "#3b4fb5",
            "#1f6e63": "#27337f",
            "#46c4b0": "#6a80e6",
          },
          parts: [
            {
              at: "head",
              z: "over",
              ax: 4,
              ay: 0,
              oy: 1,
              px: ["LgLgLgLgL", "L.......L", "g.......g"],
              pal: { g: "#58b84a", L: "#2e7d32" },
            },
          ],
        },
      ],
      /* -------------------------------------------------------------- SANSÃO */
      sansao: [
        {
          id: "gaza",
          name: "Quebra-Colunas",
          tag: "O nazireu de Gaza",
          desc: "Faixa de guerra na testa e correias de ferro: o juiz que derrubou as colunas do templo.",
          ref: "Juízes 16:30",
          rarity: "epic",
          price: 200,
          remap: {},
          parts: [
            {
              at: "head",
              z: "over",
              ax: 4,
              ay: 0,
              oy: 2,
              px: ["rrrrrrrrr", "rrrgrrrrr"],
              pal: { r: "#c0392b", g: "#ffd24a" },
            },
            {
              at: "head",
              z: "clip",
              ax: 5,
              ay: 0,
              oy: 9,
              px: [
                "ii.......",
                ".iig.....",
                "..iii....",
                "...iig...",
                "....iii..",
                ".....iig.",
                "......iii",
              ],
              pal: { i: "#6a6f7a", g: "#ffd24a" },
            },
          ],
        },
      ],
      /* --------------------------------------------------------------- ESTER */
      ester: [
        {
          id: "persia",
          name: "Rainha da Pérsia",
          tag: "Para tal tempo como este",
          desc: "Azul-real e prata, com o véu que acompanhou a rainha ao salão do rei Assuero.",
          ref: "Ester 4:14",
          rarity: "epic",
          price: 200,
          remap: {
            "#8a3ad0": "#2b64c4",
            "#5a2490": "#1c4290",
            "#b36af0": "#58a0f0",
            "#f2c14e": "#e8eef8",
            "#b8862a": "#98a6bc",
            "#e0b040": "#d0dae8",
          },
          parts: [
            {
              at: "head",
              z: "over",
              ax: 4,
              ay: 2,
              px: ["....w....", "..w.B.w..", "wwwwwwwww"],
              pal: { w: "#e8eef8", B: "#4a90f0" },
            },
          ],
        },
      ],
      /* --------------------------------------------------------------- ELIAS */
      elias: [
        {
          id: "fogo",
          name: "Carro de Fogo",
          tag: "Arrebatado em um redemoinho",
          desc: "O manto em brasa do profeta que subiu ao céu num carro de fogo.",
          ref: "2 Reis 2:11",
          rarity: "epic",
          price: 200,
          remap: {
            "#8a5a2a": "#b8421c",
            "#5e3a18": "#7a2210",
            "#b07a3c": "#ff8a2a",
            "#7a4a1d": "#5a1a0c",
          },
          parts: [
            {
              at: "head",
              z: "over",
              ax: 4,
              ay: 4,
              px: [
                "..y.....y..",
                "..oy..y.oy.",
                ".yoo.yoyoo.",
                ".ooOyooOooy",
                "oOOOooOOOOo",
              ],
              pal: { y: "#fff0a0", o: "#ff9a2a", O: "#e0471a" },
            },
          ],
        },
      ],
      /* ------------------------------------------------------------- MENDIGO */
      mendigo: [
        {
          id: "curado",
          name: "Curado em Betesda",
          tag: "Levanta-te, toma o teu leito",
          desc: "Túnica de linho limpo e uma aura de graça: o homem que deixou a maca e andou.",
          ref: "João 5:8",
          rarity: "epic",
          price: 200,
          remap: {
            "#9a9a9a": ["#eef0fa", 44],
            "#c4c4c4": ["#ffffff", 30],
            "#8a6a42": ["#6aa6e8", 30],
          },
          parts: [
            {
              at: "head",
              z: "over",
              ax: 3,
              ay: 5,
              px: [".yyyyy.", "y.....y", ".yyyyy."],
              pal: { y: "#ffe27a" },
            },
          ],
        },
      ],
      /* -------------------------------------------------------------- GIDEÃO */
      gideao: [
        {
          id: "trezentos",
          name: "Valente dos Trezentos",
          tag: "A espada do Senhor e de Gideão",
          desc: "Manto da meia-noite e elmo de bronze para a vigília em que os jarros se quebraram.",
          ref: "Juízes 7:20",
          rarity: "epic",
          price: 200,
          remap: {
            "#a9743a": "#2a3a78",
            "#7a4f25": "#1a2550",
            "#d09a5a": "#4a64b0",
            "#b07a48": "#3a4f96",
          },
          parts: [
            {
              at: "head",
              z: "over",
              ax: 4,
              ay: 3,
              px: ["...bbb...", "..bbbbb..", ".ooooooo.", "oOhooOoho", "oOooooOoo"],
              pal: { b: "#c0392b", o: "#c9923a", O: "#8a5a1c", h: "#f0c860" },
            },
          ],
        },
      ],
      /* --------------------------------------------------------------- PEDRO */
      pedro: [
        {
          id: "chaves",
          name: "Guardião das Chaves",
          tag: "A rocha sobre a qual a igreja foi edificada",
          desc: "Veste de linho marfim e as chaves do Reino dos céus à vista.",
          ref: "Mateus 16:19",
          rarity: "epic",
          price: 200,
          remap: {
            "#3f7aa0": "#e8dcc0",
            "#2e5a78": "#bda878",
            "#7ab8dc": "#fff4dc",
          },
          parts: [
            {
              at: "head",
              z: "over",
              ax: 2,
              ay: 0,
              ox: -2,
              oy: 10,
              px: [".yy.", "y..y", ".yy.", "..y.", "..yy", "..y."],
              pal: { y: "#ffd24a" },
            },
          ],
        },
      ],
      /* -------------------------------------------------------------- MOISÉS */
      moises: [
        {
          id: "sinai",
          name: "Face Resplandecente",
          tag: "Do monte Sinai",
          desc: "Depois de falar com Deus, o rosto de Moisés brilhava: raios de luz e manto de azul profundo.",
          ref: "Êxodo 34:29",
          rarity: "legendary",
          price: 200,
          remap: {
            "#c9b68e": "#3a56a8",
            "#a8946a": "#27407e",
            "#eadcb4": "#6a86d0",
            "#2e6aa8": "#e0b040",
          },
          parts: [
            {
              at: "head",
              z: "under",
              ax: 6,
              ay: 4,
              px: [
                "y.....y.....y",
                ".y....y....y.",
                "..y...y...y..",
                "...y..y..y...",
              ],
              pal: { y: "#ffe27a" },
            },
          ],
        },
      ],
      /* ------------------------------------------------------------ JÔNATAS */
      jonathan: [
        {
          id: "principe",
          name: "Príncipe da Aliança",
          tag: "O filho do rei, amigo de Davi",
          desc: "Túnica púrpura e diadema de ouro: o herdeiro que entregou o manto a Davi.",
          ref: "1 Samuel 18:4",
          rarity: "epic",
          price: 200,
          remap: {
            "#3f86d0": ["#7a42c8", 24],
            "#2a5ea0": ["#512a96", 24],
            "#7cc0f4": ["#a67ae8", 24],
          },
          parts: [
            {
              at: "head",
              z: "over",
              ax: 5,
              ay: 0,
              oy: 1,
              px: ["gggggBggggg"],
              pal: { g: "#ffd24a", B: "#4a90f0" },
            },
          ],
        },
      ],
      /* -------------------------------------------------------------- JOSUÉ */
      josue: [
        {
          id: "comandante",
          name: "Comandante do Senhor",
          tag: "Capitão do exército do Senhor",
          desc: "Azul celeste e asas de luz: a visão que se apresentou a Josué diante de Jericó.",
          ref: "Josué 5:14",
          rarity: "legendary",
          price: 200,
          remap: {
            "#c0392b": ["#2f63c4", 36],
            "#7a2418": ["#1c3f86", 36],
            "#a82410": ["#1f4aa6", 36],
            "#e63b1a": ["#7fb0ff", 36],
            "#e0583f": ["#9cc4ff", 36],
          },
          parts: [
            {
              at: "head",
              z: "under",
              ax: 11,
              ay: 0,
              oy: 5,
              px: [
                "w.....................w",
                "ww...................ww",
                "xww.................wwx",
                "xwww...............wwwx",
                ".xwww.............wwwx.",
                ".xxwww...........wwwxx.",
                "..xxww...........wwxx..",
                "...xxw...........wxx...",
              ],
              pal: { w: "#f4f8ff", x: "#b4cdf5" },
            },
          ],
        },
      ],
    },
  };
  global.FE_HERO_SKINS = S;
  if (typeof module !== "undefined") module.exports = S;
})(typeof window !== "undefined" ? window : globalThis);
