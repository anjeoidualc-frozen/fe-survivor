# Fé Survivor — Etapa 2: integração do motor com o registro central

**Base:** versão 0.65, a partir dos arquivos da Etapa 1 que o usuário validou.

## Objetivo

Fazer o motor usar o registro centralizado como fonte de dados, eliminar callbacks executáveis dos registros e deixar o formato pronto para uma futura ferramenta de edição. Foram preservados os valores de balanceamento e o resultado dos efeitos existentes.

## O que mudou

- `game.js` exige `content/registry.js` schema 3 e interrompe a inicialização com mensagem de diagnóstico se a validação encontrar inconsistências.
- Heróis, perfis, alcance, Poderes Heroicos, arte, armas, dons, ativas, demônios, chefes, categorias, árvores, preços e metadados da Biblioteca/Perfil são lidos do registro central.
- Armas usam `behavior`/`variant` e handlers do motor, em vez de depender do ID do item para selecionar o tipo de ataque sempre que o comportamento pode ser compartilhado.
- As melhorias das armas foram convertidas de funções `f(s)` para `ops` declarativas (`add`, `multiply`, `set`).
- Graças e Maestrias foram convertidas de callbacks para objetos de efeito declarativos. O motor interpreta esses objetos com handlers controlados.
- A seleção de demônios usa `spawnPool`, pesos e tempo mínimo descritos nos registros.
- Dados de chefes têm um catálogo canônico do qual são derivados arrays de compatibilidade.
- Alguns modificadores especiais de heróis (espaço extra do Gideão, modificador de Jarros e rerolls do Pedro) são lidos de metadados do herói.
- Validação verifica vínculos, campos obrigatórios, IDs de comportamento, operações de melhoria e efeitos declarativos.

## O que muda para quem vai cadastrar conteúdo

Para uma nova arma que use um comportamento já suportado, você poderá preencher um registro com `base`, `up[].ops`, `behavior` e `variant` compatíveis. Exemplo didático:

```js
{
  name: 'Nova Arma',
  ref: 'Referência bíblica',
  desc: 'Descrição curta.',
  behavior: 'projectile_target',
  base: { cd: 1.5, dmg: 5, count: 1, pierce: 0, speed: 200 },
  up: [
    { d: '+2 de dano', ops: [{ key: 'dmg', op: 'add', value: 2 }] }
  ]
}
```

O ID do comportamento precisa existir em `weaponBehaviorContracts` e no handler correspondente do motor. Esse exemplo ilustra o formato; não deve ser copiado como conteúdo sem reservar um ID único e criar ícone/assets necessários.

## Limites que permanecem

- Comportamentos inéditos de arma, dom, habilidade ativa, Poder Heroico, IA de demônio ou padrão de chefe ainda exigem código no motor.
- Habilidades ativas continuam usando handlers específicos do motor, não código serializado no registro.
- Assets, sprites, animações e ícones precisam existir nos caminhos reconhecidos pelo manifesto de assets ou nos templates suportados.
- A lógica de desbloqueio por conquistas e alguns eventos especiais continua no motor/save. A etapa 3 deve transformar isso em um fluxo configurável onde possível.
- Não foi alterada a estrutura do save nem a versão comercial do jogo (APP_VER continua 0.65).

## Arquivos para instalar

Copie para `www/`:

1. `game.js`
2. `index.html`
3. a pasta `content/` com `registry.js`

Não substitua `style.css`, `android-bridge.js`, `assets/`, `sprites/`, `icons/`, `fonts/`, `home-verses.js`, `art_v2.js` ou outros recursos do seu projeto.

## Testes realizados

- `node --check game.js`: aprovado.
- `node --check content/registry.js`: aprovado.
- `FE_SURVIVOR_CONTENT.validate()`: `[]`.
- Validação de referências e handlers de gameplay: aprovada.
- Comparação semântica contra a Etapa 1: 75 melhorias de armas, 9 Graças e 27 efeitos de Maestria produziram os mesmos atributos.
- Nenhuma função aninhada dentro dos registros de conteúdo; os dados principais serializam em JSON.
- Teste completo no Chromium não pôde ser concluído neste ambiente. A validação que você já fez da Etapa 1 não substitui o teste dessa nova versão; teste no navegador local antes de sincronizar/compilar Android.

## Reversão

Restaure `game.js` e `index.html` da etapa anterior e remova `www/content/registry.js` para voltar à Etapa 1.
