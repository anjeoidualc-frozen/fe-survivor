/* =====================================================================================================
   Fé Survivor — heroes_stories.js  (histórias dos heróis, mostradas na Biblioteca > Heróis > botão "História")
   -----------------------------------------------------------------------------------------------------
   Cada herói tem: title (subtítulo curto), text (um parágrafo de resumo) e ref (referência bíblica).
   A chave é o id do herói (o mesmo de FE_CONTENT.heroes). Para um herói novo, acrescente uma entrada aqui.
   ===================================================================================================== */
(function (global) {
  "use strict";
  global.FE_HERO_STORIES = {
    davi: {
      title: "O pastor que virou rei",
      text: "Davi era o mais novo dos filhos de Jessé e cuidava das ovelhas da família em Belém quando o profeta Samuel o ungiu como futuro rei de Israel. Com uma funda e cinco pedras lisas, enfrentou o gigante Golias confiando no nome do Senhor e venceu. Perseguido por Saul durante anos, tornou-se rei, escreveu muitos salmos e, mesmo depois de errar gravemente, buscou o perdão de Deus.",
      ref: "1 Samuel 16–17; 2 Samuel 5:1-5",
    },
    paulo: {
      title: "De perseguidor a apóstolo",
      text: "Saulo de Tarso perseguia a igreja com zelo, até encontrar Jesus ressuscitado no caminho de Damasco, ficar cego por alguns dias e ser transformado. Como Paulo, percorreu cidades e mares anunciando o evangelho, fundou igrejas e escreveu cartas que formam grande parte do Novo Testamento. Foi preso, açoitado e naufragou, mas seguiu firme até o fim.",
      ref: "Atos 9:1-19; 2 Coríntios 11:23-28; 2 Timóteo 4:7",
    },
    debora: {
      title: "A juíza sob a palmeira",
      text: "Débora era profetisa e julgava Israel sentada debaixo de uma palmeira, onde o povo vinha buscar justiça. Quando os cananeus oprimiam Israel com seus carros de ferro, ela chamou Baraque e anunciou que o Senhor entregaria o general Sísera em suas mãos. Acompanhou o exército, Israel venceu, e ela celebrou a vitória em um cântico. Depois disso, a terra teve paz por quarenta anos.",
      ref: "Juízes 4–5",
    },
    sansao: {
      title: "O nazireu de força extraordinária",
      text: "Consagrado a Deus desde antes de nascer, Sansão recebeu do Senhor uma força extraordinária para livrar Israel dos filisteus. Venceu um leão e derrotou mil homens com uma queixada de jumento. Traído por Dalila, perdeu o cabelo, foi capturado e cegado. No fim, clamou ao Senhor e, ao derrubar as colunas do templo de Dagom, venceu na morte mais inimigos do que em toda a vida.",
      ref: "Juízes 13–16",
    },
    ester: {
      title: "Rainha para tal tempo",
      text: "Criada pelo primo Mardoqueu, a judia Ester tornou-se rainha da Pérsia. Quando o ministro Hamã tramou a destruição de todo o seu povo, ela pediu que os judeus jejuassem por ela e, arriscando a vida, apresentou-se sem ser chamada diante do rei Assuero. Revelou quem era e intercedeu pelo seu povo, que foi salvo.",
      ref: "Ester 4:14–5:2; 7:3-6",
    },
    elias: {
      title: "O profeta do fogo",
      text: "Elias foi profeta em Israel nos dias do rei Acabe, quando o povo se curvava a Baal. No monte Carmelo, desafiou os profetas de Baal, e o Senhor respondeu com fogo do céu. Depois, desanimado e fugindo de Jezabel, encontrou Deus em uma voz mansa e delicada. Ao fim de seu ministério, foi levado ao céu em um redemoinho, com carros e cavalos de fogo.",
      ref: "1 Reis 18:20-39; 19:11-13; 2 Reis 2:11",
    },
    mendigo: {
      title: "Trinta e oito anos à espera",
      text: "Junto ao tanque de Betesda, em Jerusalém, jazia um homem paralítico havia trinta e oito anos, esperando ser o primeiro a entrar na água quando ela se agitasse. Jesus o viu, perguntou se ele queria ser curado e ordenou que se levantasse, tomasse o seu leito e andasse. Na mesma hora o homem ficou são e saiu caminhando, carregando a maca que antes o carregava.",
      ref: "João 5:1-9",
    },
    gideao: {
      title: "O menor da casa mais fraca",
      text: "Gideão debulhava trigo escondido num lagar, com medo dos midianitas, quando o anjo do Senhor o chamou de homem valente. Mesmo se dizendo o menor da casa de seu pai, obedeceu. O Senhor reduziu o exército de trinta e dois mil para trezentos homens, armados apenas com trombetas, jarros e tochas. Ao quebrarem os jarros durante a noite, os midianitas fugiram em pânico.",
      ref: "Juízes 6–7",
    },
    pedro: {
      title: "O pescador que virou pedra",
      text: "Simão era pescador na Galileia quando Jesus o chamou para ser pescador de homens e lhe deu o nome Pedro. Confessou Jesus como o Cristo e, ainda assim, o negou três vezes na noite em que o Mestre foi preso. Depois da ressurreição, Jesus o restaurou à beira do lago e o encarregou de cuidar de suas ovelhas. No Pentecostes, Pedro pregou com ousadia, e cerca de três mil pessoas creram.",
      ref: "Mateus 16:13-19; João 21:15-17; Atos 2:14-41",
    },
    moises: {
      title: "O libertador e legislador",
      text: "Salvo das águas do Nilo ainda bebê e criado no palácio do Faraó, Moisés fugiu para Midiã, onde Deus o chamou de uma sarça em chamas para libertar o povo hebreu do Egito. Conduziu Israel pelo mar aberto e, no monte Sinai, recebeu a Lei. Por quarenta anos guiou o povo no deserto e, do monte Nebo, viu a terra prometida, sem entrar nela.",
      ref: "Êxodo 3; 14; 20; Deuteronômio 34:1-4",
    },
    jonathan: {
      title: "O amigo leal de Davi",
      text: "Filho do rei Saul e herdeiro do trono, Jônatas era um guerreiro corajoso que, com seu escudeiro, atacou um posto filisteu confiando no Senhor. Fez aliança com Davi e lhe entregou seu manto, suas armas e seu arco, mesmo sabendo que Davi seria o próximo rei. Defendeu o amigo diante de Saul e o ajudou a fugir. Morreu em batalha ao lado do pai, e Davi lamentou a sua perda.",
      ref: "1 Samuel 14:1-14; 18:1-4; 20; 2 Samuel 1:26",
    },
    josue: {
      title: "O sucessor de Moisés",
      text: "Josué serviu a Moisés desde jovem e foi escolhido para levar Israel à terra prometida. O Senhor lhe disse que fosse forte e corajoso. Diante de Jericó, o povo marchou ao redor da cidade por sete dias, com sacerdotes tocando trombetas, e as muralhas caíram. Josué liderou a conquista de Canaã e, no fim da vida, desafiou Israel a escolher a quem serviria: ele e a sua casa serviriam ao Senhor.",
      ref: "Josué 1:6-9; 6; 24:15",
    },
    baltasar: {
      title: "O sábio que seguiu a estrela",
      text: "Magos vindos do Oriente viram uma estrela no céu e atravessaram o deserto para adorar o rei que acabara de nascer. Perguntaram por ele em Jerusalém, e o rei Herodes, perturbado, tentou usá-los para encontrar o menino. Guiados pela estrela até Belém, os sábios se prostraram diante de Jesus e lhe ofereceram ouro, incenso e mirra. Avisados em sonho, voltaram para casa por outro caminho, sem revelar a Herodes onde o menino estava.",
      ref: "Mateus 2:1-12",
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
