# Gerador de arte (v0.52)
`python3 export.py` gera `art_v2.js` (copie para a raiz do jogo). Requer `pip install pillow numpy`.
- `specs.py`: paletas, troncos e armas dos heróis. `poses.py`: poses de ataque/dano/investida. `heroes.py`: rig e ciclos de parado/andando.
- `enemies.py`: inimigos (parâmetros de cada quadro em `SEQ`). `boss_dragon.py` e `bosses_rest.py`: chefes.
- `vec.py`: motor vetorial para pixel (sombreamento por camadas, redução por voto de maioria).
