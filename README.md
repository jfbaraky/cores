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

## Mercado: automação por botão (não 100% automático)

`game-scripts.js` tem 3 funções para o Mercado — `setupMarket()`,
`replenishMarket()`, `advanceMarket()` — mas nenhuma delas dispara sozinha
mais. Elas só rodam quando alguém clica um dos 3 botões na aba "Reserva":
**Abrir Mercado**, **Repor Mercado**, **Avançar Mercado (Renovação)**
(ver "Testado ao vivo" abaixo para o que cada uma faz exatamente).

Isso não era o plano original — as 3 foram disparadas automaticamente por
eventos (`onPlayersReady`, `onNewTurn`, etc.), do mesmo jeito que
`placeCapital()`. Dois motivos concretos, confirmados ao vivo, mudaram
isso:

- **O Mercado é uma zona compartilhada.** Cada jogador conectado roda sua
  própria cópia inteira de `game-scripts.js`, com seu próprio estado de
  módulo — uma flag tipo `let marketSetup = false` só impede *aquele*
  cliente de repetir o trabalho; não impede um SEGUNDO jogador de também
  embaralhar/revelar as mesmas pilhas compartilhadas de novo.
  `placeCapital()` nunca teve esse problema porque só mexe nas zonas
  *daquele* jogador (Território/Mão/Império), então execução redundante
  entre clientes é inofensiva ali.
- **Mesmo `game.isHost` (restringir a mutação a um único cliente) não foi
  suficiente sozinho.** Um log de depuração ao vivo mostrou 3 chamadas
  seguidas de `setupMarket()` no MESMO cliente (host) todas lendo
  `marketSetup=false` — inclusive a 2ª e a 3ª, que deveriam ter visto
  `true` se a atribuição síncrona da 1ª chamada realmente "grudasse" antes
  delas rodarem. Ou seja: variáveis de módulo não estão se mantendo de
  forma confiável entre chamadas rápidas em sequência neste motor, ao
  contrário do que a documentação da plataforma sugere ("scripts file is
  loaded once per client session, so top-level variables persist"). Na
  prática isso causou revelação de Mercado MUITO acima do esperado (o
  pior caso ao vivo: 45/65/58 cartas restantes nas pilhas em vez de
  53/69/70 — quase o triplo do esperado).

Um clique de botão é uma ação única e deliberada — não tem a cascata de
múltiplos eventos disparando em sequência que expôs os dois problemas
acima, então contorna ambos por completo. O preço é que "Repor Mercado"
não acontece sozinho no instante em que alguém compra uma carta; alguém
(qualquer jogador) precisa clicar depois da compra.
- **Assalto/Combate:** casamento de cartas, Formações, cavalaria vs. muralha,
  cálculo de dano, [REAÇÃO] — tudo lido e resolvido pelos jogadores nas
  próprias cartas, no Campo de Batalha.
- **Primazia (ordem de turno):** o token "Primazia" é passado manualmente a
  cada Renovação, seguindo a regra combinada (quem jogou por último vira o
  primeiro).
- **"Trabalhar"/"Comerciar":** o jogador arrasta o(s) Trabalhador(es) da Mão
  para o Descanso (botão direito na carta → "To Descanso" → "Top") e ajusta o
  contador correspondente na Reserva manualmente (clique no campo numérico e
  digite o valor, ou use as setas ▲▼). Testado e funcionando ao vivo.
- **Colocar a Capital em jogo:** automático, via `game-scripts.js`
  (`placeCapital()`). A Capital continua embaralhada dentro do Império de
  13 cartas (um teste ao vivo descartou `beforeGameStart.
  boardCategoriesInSideboard` — ver nota abaixo), então ela só sai no
  saque inicial de 6 cerca de 46% das vezes (6/13). `placeCapital()`
  cobre os outros 54%: se a Capital não estiver na Mão logo após o saque,
  a função saca o resto do baralho (`functions.draw(7)` — Deck é
  `isHidden:"yes"` e **confirmadamente ilegível para scripts** mesmo para
  o dono, mas `draw()` funciona mesmo assim, já que só *lê* o topo, não
  precisa inspecionar o conteúdo) até encontrar a Capital pela Mão. De
  um jeito ou de outro, depois de mover a Capital para o Território a
  função corrige o tamanho da mão de volta para 6: saca mais uma carta se
  a Capital tiver sido uma das 6 originais (sobrariam só 5), ou devolve o
  excesso ao Império e reembaralha (`shuffleSection`) se a busca trouxe
  cartas demais. Roda em vários eventos (`onPlayersSideboardClosed`,
  `onPlayersMulligan`, `onPlayersReady`, `onNewTurn`, `onCardsUpdate`) e
  tenta ser idempotente — a primeira coisa que checa é se já existe uma
  Capital no Território, mais uma flag `inFlight` em memória — mas testado
  ao vivo, a busca+correção completa ainda roda **duas vezes seguidas**
  para o mesmo jogador em alguns jogos (provavelmente dois desses eventos
  disparando próximos o bastante para cada um ler `cards` antes do outro
  terminar). Isso é inofensivo — o resultado final observado (Capital no
  Território, mão com exatamente 6) foi o mesmo com uma ou duas execuções,
  já que cada rodada só mexe em cartas que ela mesma já sabe que são
  seguras — mas gera linhas duplicadas no chat/log de partida e um
  reembaralhamento a mais. **Confirmado ao vivo, com o resultado final
  correto em todos os testes** (ver "Testado ao vivo" abaixo) — a
  duplicação ocasional fica registrada aqui como um item cosmético, não
  uma correção pendente.
- **`boardCategoriesInSideboard` não funciona para este baralho
  pré-construído:** testado ao vivo (com e sem o toggle "Disable
  sideboard for all players" do anfitrião) — a tela "Swap cards with your
  sideboard" sempre mostrou `Deck (13)` com a Capital ainda dentro e
  `Sideboard (0)` vazio. Ou o recurso não se aplica a decks vindos de
  `decks.json` (só ao deck-builder nativo da plataforma), ou exige outra
  configuração não documentada — de qualquer forma, o projeto não depende
  mais dele. Essa tela ainda aparece para os jogadores (é um passo padrão
  da plataforma para qualquer jogo), mas como este jogo não usa Sideboard
  o jogador só precisa clicar "Continue" sem mexer em nada — ou o
  anfitrião pode ligar "Disable sideboard for all players" na tela "Start
  the game" para pular essa etapa por completo.

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
  desde o início.** Ver "Colocar a Capital em jogo" acima —
  `placeCapital()` garante isso via busca no baralho por script, sem
  depender de `boardCategoriesInSideboard` (que não funcionou para este
  baralho) nem de um `gameplay` separado por civilização.

## Testado ao vivo no TCG Arena

As seções abaixo já foram verificadas numa partida real de 2 jogadores
(2 abas do navegador conectadas na mesma sala), não apenas inferidas da
documentação:

- **Link do jogo:** gerado com sucesso em `tcg-arena.fr` a partir da URL do
  `gamefile.json` — o jogo é reconhecido pelo nome ("Cores da Guerra").
- **Os 4 baralhos iniciais** aparecem corretamente na aba "Preconstructed
  decks" da tela de seleção de baralho, com os nomes certos e o conteúdo
  certo (12 Trabalhadores + 1 Capital cada).
- **Mão inicial:** exatamente 6 cartas por jogador, sempre — confirmado
  com 2 jogadores reais simultâneos em ambos os casos: quando a Capital
  saiu no saque nativo de 6 (ficam 5, `placeCapital()` saca 1 de reposição)
  e quando não saiu (a função busca o resto do baralho, acha a Capital, e
  devolve/reembaralha o excesso). O baralho sacável continua com as 13
  cartas do Império (Capital incluída) — ver "`boardCategoriesInSideboard`
  não funciona..." acima. (Esse número de 6 já ficou incorretamente
  dobrado para 12/0 antes da correção de `beforeGameStart`, ver histórico
  do git.)
- **Mercado — montagem inicial das pilhas:** as 3 pilhas ocultas
  (Combatentes/Estratégias/Melhorias) são populadas automaticamente no
  início da partida com a contagem certa (57/73/74 cópias, batendo com o
  campo `copies` de cada carta) via `beforeGameStart.initialBoardSetup`.
  Isso é só a montagem da pilha oculta — **revelar as 4 cartas do topo de
  cada pilha é um passo separado, manual** (botão "Abrir Mercado"), ver
  "Mercado: automação por botão" acima.
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

- **Botões "Abrir Mercado" / "Repor Mercado" / "Avançar Mercado
  (Renovação)":** implementados com `functions.drawFromExtraDeck()` /
  `moveCard()` / `shuffleSection()` (ver `game-scripts.js`), mas a versão
  *com botão* ainda não foi clicada numa partida de teste — só a versão
  anterior (disparo automático por evento) foi testada ao vivo, e essa
  versão tinha os bugs de revelação em excesso descritos acima
  (exatamente por isso virou botão). Testar os 3 botões antes de confiar
  neles: confirmar que "Abrir Mercado" revela exatamente 4 por pilha,
  que "Repor Mercado" completa até 4 sem estourar, e que "Avançar
  Mercado" descarta exatamente 1 carta por pilha (a mais antiga) e repõe.
- **Compra de cartas (pagar com fichas de recurso)** e o bônus de "compra
  plena" — não testados ao vivo ainda.
- **Assalto/Combate completo** (casamento de cartas, Formações, etc.) — por
  natureza é 100% manual/lido pelos jogadores; a zona "Campo de Batalha"
  existe mas o fluxo completo de um Conflito não foi executado neste teste.

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
