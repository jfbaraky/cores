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

## O que ainda é 100% manual (por design)

- **Esteira do Mercado:** deslocar as cartas reveladas e revelar novas a cada
  compra/Renovação é um passo manual — o motor não tem uma "esteira" nativa.
- **Montagem inicial do Mercado:** no início da partida, alguém precisa reunir
  as cópias de cada Combatente/Estratégia/Melhoria (respeitando o campo
  `copies` de cada carta em `cards.json`), embaralhar cada pilha e revelar as
  4 cartas do topo — não há automação nativa para "popular uma pilha
  compartilhada com N cópias de cada carta de um tipo".
- **Assalto/Combate:** casamento de cartas, Formações, cavalaria vs. muralha,
  cálculo de dano, [REAÇÃO] — tudo lido e resolvido pelos jogadores nas
  próprias cartas, no Campo de Batalha.
- **Primazia (ordem de turno):** o token "Primazia" é passado manualmente a
  cada Renovação, seguindo a regra combinada (quem jogou por último vira o
  primeiro).
- **"Trabalhar"/"Comerciar":** o jogador arrasta o(s) Trabalhador(es) da Mão
  para o Descanso e ajusta o contador correspondente na Reserva manualmente.

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

## Pontos a validar no editor do TCG Arena (inferidos da documentação)

A documentação pública não detalha 100% do schema em alguns pontos. Isto foi
inferido com base no comportamento descrito e **precisa ser conferido/ajustado
assim que você tiver acesso ao editor real**:

1. **Seleção de Capital** (`customCategories`, `boardCategoriesInSideboard`,
   `boardCardSelection` em `gamefile.json`) — a doc descreve a existência
   dessas funcionalidades, mas não o schema completo nem para onde vai a
   carta *selecionada* (só o destino da *não selecionada* é documentado).
2. **`decks.json`** — a doc diz que normalmente esse arquivo é gerado pelo
   próprio deck builder do TCG Arena ("Exportar → Baralho Inicial"), não
   escrito à mão. O arquivo atual é uma tentativa razoável do formato; o
   caminho mais seguro é recriar esse arquivo pela função de exportação assim
   que `cards.json` tiver conteúdo real carregado no editor.
3. **Nomes dos campos de `tokens`** (`tokens.player` / `tokens.draggable`) —
   inferidos da descrição em prosa da documentação, não confirmados por um
   exemplo de JSON.

Nada disso bloqueia o desenvolvimento — só significa que a primeira sessão no
editor real provavelmente vai exigir pequenos ajustes de nomes de campo.

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
