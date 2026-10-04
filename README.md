# Cores da Guerra — implementação no TCG Arena

Este repositório contém a implementação de **Cores da Guerra** (jogo de construção de
baralhos sobre o Mediterrâneo helenístico) na plataforma [TCG Arena](https://documentation.tcg-arena.fr/),
com base no *Cores da Guerra — Manual de Regras (v1)* e nas artes reais das cartas.

## Estrutura de arquivos

```
gamefile.json                  Configuração principal do jogo (formato, turnos, zonas, layout)
cards.json                     SAÍDA GERADA — nunca editar à mão, ver "Como funciona" abaixo
decks.json                     Baralho pré-montado "Império Inicial"
data/
  extracted-combatentes.json   Transcrição bruta das 58 imagens de COMBATENTES
  extracted-estrategias.json   Transcrição bruta das 75 imagens de ESTRATÉGIAS
  extracted-melhorias.json     Transcrição bruta das 79 imagens de MELHORIAS (exceto Capitais)
  raw-cards.json               Saída do consolidate-extracted.js — entrada de generate-cards.js
  hand-authored-cards.json     As 8 cartas escritas à mão (4 Capitais + 4 Trabalhadores)
scripts/
  consolidate-extracted.js     Deduplica/normaliza as transcrições → data/raw-cards.json
  compress-images.js           Comprime assets/cards/final/*.png → assets/cards/web/*.webp
  generate-cards.js            Reconstrói cards.json do zero a partir de data/raw-cards.json
                                + data/hand-authored-cards.json
assets/
  cards/COMBATENTES/           Imagens originais (Slide1.PNG...), como recebidas
  cards/ESTRATÉGIAS/           Idem
  cards/MELHORIAS/             Idem
  cards/final/                 Imagens renomeadas para {id}.png (originais, ~1-2MB cada)
  cards/web/                   Imagens comprimidas {id}.webp — o que cards.json referencia
```

## Como as cartas foram extraídas

As 213 imagens de carta (59 Combatentes + 75 Estratégias + 79 Melhorias, incluindo as
4 Capitais) foram lidas uma a uma e transcritas para JSON (nome, civilização, custo,
força, palavras-chave, texto de habilidade, etc.) a partir do próprio layout visual das
cartas. Isso passou por duas etapas:

1. **Transcrição** (`data/extracted-*.json`): leitura literal de cada imagem.
2. **Consolidação** (`scripts/consolidate-extracted.js` → `data/raw-cards.json`):
   - remove os 2 rascunhos "Sem Nome Ainda" (Estratégias incompletas) e a carta-piada
     "Dyego, Cachorro" (excluída por decisão do projeto);
   - funde "Santuário de Epona" em "Templo de Epona" (mesma carta, nome desatualizado —
     decisão do projeto);
   - agrupa cartas com o mesmo nome+civilização impressas em mais de um slide (a mesma
     carta escaneada duas vezes) em uma única definição com um campo `copies` (número de
     cópias físicas), em vez de IDs duplicados. **Estratégias não passam por essa
     deduplicação** — o único nome repetido lá ("Circunvalação") são duas cartas
     mecanicamente diferentes, não uma reimpressão.

3. **Compressão** (`scripts/compress-images.js`): as imagens originais são
   exports de slide em PNG (~720×1040px, ~1-2MB cada — 313MB no total para as
   185 cartas). A documentação do TCG Arena não recomenda nenhum tamanho
   específico, então foi usado um padrão razoável para uma UI de jogo de
   cartas: redimensiona para 600px de largura e converte para WebP qualidade
   82 (`cwebp`, via Homebrew: `brew install webp`). Resultado: **313MB → 15MB
   (20.7× menor)**, com o texto das cartas ainda legível. `cards.json`
   referencia essas imagens comprimidas (`assets/cards/web/`), não os
   originais.

**`cards.json` é saída pura — nunca edite esse arquivo diretamente.** Para
mudar o conteúdo de uma carta, edite `data/extracted-*.json` (ou
`data/hand-authored-cards.json` para Capitais/Trabalhadores) e rode de novo:

```bash
node scripts/consolidate-extracted.js
node scripts/compress-images.js   # só necessário se assets/cards/final/ mudou
node scripts/generate-cards.js
```

## Como funciona (motor)

O TCG Arena **não é um motor de regras** — é um simulador de zonas/tabuleiro com
suporte a scripts para automação de contadores. Ele não resolve Conflitos,
Formações ou textos de carta sozinho: os jogadores aplicam as regras manualmente,
como em uma mesa física. O `gamefile.json` só define:

- **Formato de baralho:** um único formato "Padrão", com Império Inicial fixo
  (3 Trabalhadores de cada uma das 4 civilizações = 12 cartas), sem escolha real
  de deckbuilding — a única decisão pré-partida é a **Capital**.
- **Turnos:** sem compra automática por turno (o jogo não tem essa mecânica);
  a mão só é reposta para 6 cartas na Renovação.
- **Zonas por jogador:** Mão, Império (Deck), Descanso (Discard), Desterro
  (Remove), Território, e um painel "Reserva & Hegemonia" (contadores de
  recursos temporários + pontuação, via seção customizada).
- **Zona compartilhada:** o Mercado (3 pilhas + 3 fileiras reveladas, uma por
  tipo de carta) e o Campo de Batalha (onde Conflitos são resolvidos).
- **Fichas arrastáveis:** recursos (Roxo/Vermelho/Azul/Verde), Ouro, Força e
  Muralha — representados como tokens que os jogadores arrastam sobre as
  cartas, exatamente como as fichas físicas do jogo.

## Como o jogo roda no TCG Arena (estado atual)

Tudo abaixo usa só recursos nativos do motor (ver `docs/TCGA-REFERENCE.md`);
o que cada decisão custou em tentativas está em `docs/DIAGNOSTICS.md`.

- **Capital em jogo:** `sections.categoriesAlreadyOnBoard: ["Capital->Territorio"]`.
  O motor coloca a Capital direto no Território, fora do Império, e a mão
  inicial de 6 cartas sai dos 12 Trabalhadores. Não há script (o antigo
  `placeCapital()` e a busca no baralho foram removidos).
- **Mercado abre sozinho:** a seção "Reserva" tem `onPlayersReady` →
  `setupMarket()` (só o host embaralha as 3 pilhas e revela 4 por fileira).
- **Comprar:** passe o mouse sobre uma carta revelada e clique no ícone do
  canto (`cardActionShortcut` → Mão). A fileira se reabastece sozinha: a
  seção Reserva tem `onCardsUpdate` → `keepMarketFull()` (só o host; roda ~0,5 s
  depois da última mudança de cartas e completa cada fileira até 4).
- **Trabalhar automático:** clicar num Trabalhador da Mão o manda ao Descanso **e soma 1 recurso da cor dele**
  na Reserva (`Descanso.onCardsEnter`). Comerciar (2 Trabalhadores → 1 Ouro) continua manual: tire as 2 cores e some 1 Ouro.
- **Fim do turno (barra de espaço):** a Reserva zera Roxo/Vermelho/Azul/Verde/Ouro de quem acabou de passar
  (manual §10.3: recurso não armazenado nas Melhorias é descartado). Hegemonia não é zerada.
- **Renovação:** botão "Renovação (minha parte)" (cada jogador): desvira o Território, completa a mão até 6 (só
  embaralha o Descanso se precisar sacar com o Império vazio). "Avançar Mercado" (uma vez por mesa) descarta a carta
  mais antiga (a mais à esquerda) de cada fileira. As Melhorias ficam viradas entre turnos (§12.1).
- **Comprar (normal ou plena):** clique no atalho do canto da carta do Mercado. Abre um quadro "Comprar X (custo N)" com
  **Compra plena / Compra normal / Cancelar** (só aparece para quem está comprando; o log da mesa registra a escolha).
  - Combatente: o token do Mercado é trocado por uma carta de verdade. *Plena* → topo do Império; *normal* → Descanso (entra
    no próximo Império, aproximando "fundo"). Estratégia/Melhoria: vão para a Mão; *plena* mostra na Reserva
    "2ª compra: tipo, custo ≤ N" até o fim do turno.
  - *Cancelar* devolve a carta ao Mercado; a carta que já tinha sido reposta vai para o descarte do Mercado.
  - O pagamento (contadores) continua manual: a escolha é a declaração do jogador.
- **Jogar da mão:** clique na carta (`autoPlayFromHand`): Capital e Melhoria vão para o Território, Combatente para o
  Campo de Batalha, Estratégia para a Pilha (resolve e vai ao Descanso) e Trabalhador para o Descanso ("Trabalhar").
- **Final de Campanha (manual §15.3):** depois da trégua (todos passam em sequência, sem agir) cada jogador aperta
  "Final de Campanha (minha pontuação)". O script conta a civilização de cada carta do Território (a Capital conta, Melhorias
  neutras não): 3/5/7 da mesma civilização = 1/2/3 pontos; ao menos uma de cada uma das 4 = 1 ponto (política). Os pontos
  entram direto na Hegemonia; cada civilização pontuada fica registrada em "Influências: …" (as 4 = **Influência Total**, vitória
  imediata) e enfileira o bônus da Renovação. Chegar a 12 de Hegemonia também é anunciado no chat. O botão é protegido
  contra pontuar duas vezes na mesma Campanha.
- **Renovação:** "Renovação (minha parte)" (cada jogador) aplica os bônus de civilização pontuados (Fenícia +1 Ouro, Helênica
  mão de 7; Latina e Celta são avisados no chat, pois dependem de ficha física/escolha), desvira o Território e completa a mão.
  "Avançar Mercado (Renovação)" (uma vez por mesa) descarta a carta mais antiga de cada fileira (as fileiras se repõem pelo
  evento acima). "Repor Mercado" completa fileiras até 4 na hora (útil se algo falhar); "Abrir Mercado" é a montagem
  inicial (idempotente). "DEBUG" escreve no log o que o script enxerga.
- **As cartas do Mercado são *tokens* para o motor** e o padrão do motor apaga
  tokens movidos para Mão/Descanso/Desterro; por isso `gamefile.json` define
  `tokenForbiddenSections` e `ownerOnlySections` com essas seções em `false`
  (sem isso a compra "logava" mas a carta nunca saía da fileira).
- **Continua manual:** Assalto/Combate (casamento de cartas, Formações, cavalaria
  vs. muralha, dano, [REAÇÃO]) no Campo de Batalha; **pagar os custos** (a compra não desconta os contadores da Reserva e o que
  sobra é descartado ao passar); Comerciar; a Hegemonia de um Combate (campo numérico: o valor só vale, aparece no log e chega ao
  outro jogador quando o campo perde o foco ou você aperta Tab).
  - **Primazia:** o motor não alterna o primeiro jogador. O primeiro da Campanha seguinte é quem joga depois do último a passar na
    trégua; para entregar a primazia basta o jogador sem ela passar uma vez a mais (trégua: A passa, B passa, A passa → começa B).
    O +1 na coluna mais nova do Mercado para o primeiro jogador também é só lembrete.
  - **Um jogador não consegue mover as cartas do outro** (o menu do botão direito mostra só "Duplicate"). Num Assalto, descartar
    ou destruir a Melhoria (e entregar os recursos guardados nela) é feito pelo dono, a pedido do atacante.
- **`boardCategoriesInSideboard` não é usado:** testado ao vivo, a tela de
  Sideboard continuou mostrando a Capital dentro do baralho. A tela ainda
  aparece (passo padrão da plataforma): basta "Continue", ou ligar "Disable
  sideboard for all players" em "Start the game".

## Itens de dados a revisar

Achados durante a transcrição que merecem um olhar humano antes de considerar
o conteúdo "fechado":

- **`melhoria-argentarii` (Argentarii):** o ícone de custo está ilegível na
  imagem de origem — `cost` ficou `null` no lugar de um número inventado.
  Confira a carta original e preencha o valor real.
- **`estrategia-circunvalacao` / `estrategia-circunvalacao-2`:** duas
  Estratégias latinas *diferentes* imprimiram o mesmo nome "Circunvalação".
  Mantidas como cartas distintas (textos diferentes), mas uma delas
  provavelmente merece um nome novo numa próxima revisão de arte.
- **Contagem de cópias físicas:** o conjunto atual tem 57 cópias de
  Combatentes e 147 cópias somadas de Estratégias+Melhorias, enquanto o
  Manual de Regras (seção 4) descreve o alvo como 60 Combatentes e 120
  Estratégias+Melhorias — o baralho pode ainda estar sendo fechado ou alguns
  desenhos ainda não têm arte escaneada.
- **Ícone "saco de moedas"** (`bottomLeftIcon` em várias Melhorias): aparece
  quase sempre em cartas de subtipo "Templo", não claramente ligado a
  "gera recurso sozinha" como o §16.2 do manual sugeria para outro ícone.
  Mantido como dado bruto (`bottomLeftIcon`), **não** usado para inferir
  nenhum campo de jogo — confirme o significado real quando a seção 16 do
  manual (léxico de palavras-chave e iconografia) for finalizada.
- **Ícones embutidos no texto** (⚔ para bônus de força, 💰 para
  ouro/recurso, em algumas Estratégias): são placeholders Unicode para os
  ícones gráficos reais das cartas — funcionam para leitura, mas talvez você
  prefira trocá-los por outra notação mais tarde.
- **`combatente-hipaspista` (Hipaspista):** a carta imprime duas classes de
  peso ao mesmo tempo ("LIGEIRA/MÉDIA"); ficou registrado como `Médio`.
- **`combatente-elefante-de-guerra` (Elefante de Guerra):** não segue o
  padrão Infantaria/Cavalaria; `weightClass` ficou `null`, `role: "Elefante"`.
- **Trabalhadores:** ainda usam URLs de imagem placeholder — não há arte
  própria para eles ainda (cartas simples, coloridas por civilização, sem
  nome/arte única, conforme confirmado).
- **(Resolvido e confirmado ao vivo) Capital garantida no Território
  desde o início**, via `categoriesAlreadyOnBoard` (ver "Como o jogo roda"
  acima).

## Testado ao vivo no TCG Arena

As seções abaixo já foram verificadas numa partida real de 2 jogadores
(2 abas do navegador conectadas na mesma sala), não apenas inferidas da
documentação:

- **Link do jogo:** gerado com sucesso em `tcg-arena.fr` a partir da URL do
  `gamefile.json` — o jogo é reconhecido pelo nome ("Cores da Guerra").
- **Os 4 baralhos iniciais** aparecem corretamente na aba "Preconstructed
  decks" da tela de seleção de baralho, com os nomes certos e o conteúdo
  certo (12 Trabalhadores + 1 Capital cada).
- **Mão inicial:** exatamente 6 Trabalhadores, com a Capital já no
  Território (`categoriesAlreadyOnBoard`; verificado em ~8 partidas solo). O
  Império começa com 12 cartas.
- **Mercado — montagem e reposição (ao vivo, solo e 2 jogadores):** as 3 pilhas ocultas são
  populadas por `beforeGameStart.initialBoardSetup` (57/73/74 cartas) e abrem
  4/4/4 sozinhas; comprar uma carta leva-a à Mão e repõe a fileira (pilha
  53→52); clicar a carta comprada a joga no Território; "Avançar Mercado
  (Renovação)" deixa 4/4/4 reveladas, 1 carta em cada Descarte e as pilhas
  −1 cada (52/68/69).
- **Zonas e ações básicas:** "Mão" some por padrão atrás de um botão
  "Show" (clique para abrir o leque de cartas — não é um bug de
  visibilidade, é só a UI padrão do app); botão direito numa carta dá um
  menu "To Descanso / To Império / To Pilha de X / ..." para mover cartas
  entre zonas; o painel "Reserva & Hegemonia" aceita edição direta do
  contador numérico.
- **`defaultRessources`** (não `defaultResources`) é o nome de campo real
  usado pelo motor — confirmado via inspeção de rede ao vivo (o app tentava
  buscar uma URL `undefined` até a correção).
- **Categoria de baralho "Capital"** precisa de um `type` de carta distinto
  (`"Capital"`, não `"Melhoria"` com um campo `category` customizado) para
  ser reconhecida pelo `deckRuleset` — confirmado ao vivo com o
  deck-builder real.

## Pontos ainda não verificados

- **Partida com 2 jogadores:** testado ao vivo (2 abas): o Mercado abre 4/4/4,
  o convidado compra uma carta (vai para a Mão dele) e aperta Renovação, e o
  host repõe as fileiras. Ainda falta: compra feita pelo host nessa mesma
  partida. Uma vez a fileira de Combatentes foi revertida no início (voltou
  vazia); "Repor Mercado" corrige e o refil por `onCardsUpdate` também.
- **Pagar custos com as fichas da Reserva** — só manual (a compra não desconta nada).
- **Fuga e Perseguição, Formações, fichas de força:** manuais e não simulados; o Assalto (dano 1) e a Batalha Campal
  (diferença → Hegemonia) foram simulados com 2 navegadores (ver `docs/DIAGNOSTICS.md`, E19).
- **Influência Total e a vitória por 12 pontos** foram verificadas por teste unitário e, ao vivo, só o anúncio dos 12 pontos
  (com a Hegemonia posta à mão em 10); a Influência Total ao vivo exigiria ~10 Melhorias por jogador.
- **Partida completa:** 4 Campanhas inteiras com 2 navegadores (compras normais/plenas, trégua, Final de Campanha com
  pontos por civilização e política, bônus Fenícia/Helênica, Renovação com reembaralho, rolagem do Mercado) sem erros de script;
  ver E20/E21 em `docs/DIAGNOSTICS.md`.

## Próximos passos

1. **Revisar os "Itens de dados a revisar" acima**, principalmente o custo
   faltante de Argentarii.

2. **Trabalhadores:** se/quando houver arte própria para eles, salve em
   `assets/cards/final/trabalhador-{civilização}.png` e atualize as 4
   entradas correspondentes em `cards.json` (ou adicione um pipeline
   equivalente ao dos outros tipos).

3. **Hospedagem:** todas as URLs em `gamefile.json`/`cards.json`/`decks.json`
   hoje apontam para `https://coresdaguerra.example.com/...` (placeholder).
   Com as imagens comprimidas (15MB no total), GitHub Pages é uma opção
   razoável — grátis, HTTPS, CORS permissivo, sem os problemas de peso que um
   repositório com 313MB de PNGs teria. A única exigência é que o repositório
   seja **público** no plano gratuito do GitHub. Suba o conteúdo de
   `assets/cards/web/` (não `final/`, que são os originais não comprimidos) e
   troque as URLs placeholder pelas reais. Aviso: publicar um repositório
   público é uma ação visível — combine comigo antes de eu criar ou dar push
   em qualquer repositório remoto.

4. **Playtestar no editor:** carregar `gamefile.json` no TCG Arena e jogar uma
   Preparação → um turno completo → uma Renovação, conferindo especialmente
   os 3 pontos da seção "Pontos a validar" acima e a montagem manual inicial
   do Mercado.
