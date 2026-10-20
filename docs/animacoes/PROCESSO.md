# Animações próprias de exercício — processo

Este documento descreve como uma animação de exercício é criada, verificada e publicada no app.
Vale para qualquer pessoa ou agente que for desenhar um exercício. **Siga as etapas na ordem; não pule
portões.** O objetivo é que o 150º exercício saia com a mesma qualidade do 1º.

## Por que um processo

Um exercício desenhado errado ensina errado. O dataset (Gym Visual) é revisado por quem o produziu; as nossas
animações só são confiáveis se cada uma passar pelas mesmas verificações, automáticas e humanas.

## Princípios

1. **Os dados são a fonte; o desenho é derivado.** Cada exercício é um arquivo de especificação (poses-chave,
   aparelho, músculos por fase, verificações). O motor desenha tudo a partir dele. Ninguém desenha à mão.
2. **Técnica antes de estética.** Uma pose só entra se respeitar as restrições do exercício (ex.: barra sobre o
   meio do pé no terra, costas apoiadas no banco no supino). As restrições são código e rodam a cada mudança.
3. **Músculos por fase, com fonte.** A ativação mostrada vem de uma tabela com referência, não do "achismo".
4. **Na dúvida, o GIF do dataset.** Enquanto um exercício não estiver revisado por uma pessoa, o app continua
   mostrando o GIF do dataset. Nada não revisado chega ao usuário.
5. **Um visual só.** Mesmo motor, mesmo boneco, mesmas cores e mesmo mapa muscular para todos os exercícios.
   A câmera é escolhida por exercício (a que melhor mostra o ponto técnico), dentro da mesma convenção.

## Ciclo de vida de um exercício

```
rascunho ──► verificado ──► revisado ──► (publicado no app)
   │            │              │
   │            │              └─ portão 3: revisão técnica humana (checklist abaixo), registrada no arquivo
   │            └─ portão 2: testes automáticos verdes + folha de contato gerada E olhada
   └─ portão 1: ficha técnica completa (fases, pontos-chave, músculos com fonte, referência do dataset)
```

O status fica no próprio arquivo do exercício (`review.status`). O app só usa a animação própria quando
`review.status === 'revisado'`; senão mostra o GIF do dataset.

**`verificado` = testes verdes + conferência visual da folha contra o GIF.** Teste verde sozinho não basta.

## Etapas

### 1. Ficha técnica (portão 1)

Antes de qualquer pose, preencha no arquivo do exercício (nomes exatos dos campos de `ExerciseSpec`, em
`src/anim/spec.ts`):

- `id` (id do catálogo do app) e `datasetId`: o exercício do dataset de referência (o GIF que ele vai substituir).
- `phases`: as fases do movimento em ordem (ex.: "Descida", "Fundo", "Subida"), com 1 frase cada.
- `keyPoints`: 3–6 pontos técnicos verificáveis (ex.: "cotovelos a ~45° do tronco na descida").
  Cada ponto técnico verificável vira uma restrição na etapa 3.
- `muscles`: por fase, `primary` (vermelho) e `secondary` (rosa), usando só ids de `src/anim/muscles.ts`.
- `muscleSource`: de onde vieram os músculos (livro, revisão de EMG, NSCA etc.).
- `props`: aparelho(s), só da biblioteca (`src/anim/props.ts`). Se faltar um aparelho, ele entra primeiro na
  biblioteca (com teste próprio), nunca desenhado dentro do exercício.

**Antes de seguir, abra o GIF do `datasetId` e confira que ele mostra o exercício do nome.** O catálogo tem
divergências (ex.: "Puxada frontal" cujo GIF é um crossover em pé). Se o GIF não bate com o nome: **pare**,
registre em `review.notes` ("GIF do dataset X mostra Y") e deixe o exercício em `rascunho` até alguém decidir
qual dos dois é o certo. Não anime "o que deveria ser" nem "o que o GIF mostra" por conta própria.

### 2. Poses-chave

- Use os construtores de pose (`src/anim/pose.ts`): você informa onde ficam a pelve, a inclinação do tronco,
  as mãos e os pés (pontos de contato); joelhos e cotovelos saem da cinemática inversa.
- De 2 a 8 poses por exercício: uma por início/fim de fase, mais intermediárias onde o caminho curva.
- **A pose do meio** (índice `floor(n/2)`) vira a miniatura do app: precisa de `holdMs > 0` e deve ser a
  pose mais representativa (fundo do agachamento, barra no peito).
- `phase` de uma pose-chave = a fase que **termina** nela (a transição até ela pertence a essa fase).
- Unidades em centímetros, atleta de 175 cm. Eixos: x para a frente do atleta, y para cima, z para a esquerda.
- Sentado ou deitado: a pelve fica **~11 cm acima da superfície** de apoio (espessura do glúteo).

#### Helpers (use antes de calcular à mão)

| Helper | Para quê |
|---|---|
| `hang(p, x, z)` | braços pendurados segurando algo (terra, remada): calcula a altura exata da mão |
| `pressUp(p, x, z)` | braços estendidos para cima (desenvolvimento, barra fixa, supino no topo) |
| `armsAtSides(p, out?, fwd?)` | braços soltos ao lado do corpo (agachamento livre, afundo sem carga) |
| `shouldersOf(p)` | posição dos ombros de uma pose (para mirar mãos relativas ao ombro) |
| `mirrorPose(p)` | espelha a pose (lado esquerdo ↔ direito); unilaterais: escreva um lado e espelhe |
| `both(x, mirrorZ)` / `mirrorFoot` | mãos/pés simétricos a partir do lado esquerdo |
| `footFlat`, `footOnToes`, `footFree` | pé no chão, na ponta, no ar |
| `{ ankle, toe, sole }` | pé apoiado numa superfície inclinada (plataforma do leg press): `sole` = direção para onde a sola aponta |
| `elbowPole`, `kneePole` | para onde aponta o cotovelo/joelho quando a IK tem duas soluções |
| `handPath: 'shoulder'` (no keyframe) | mão em arco em volta do ombro (balanço livre: burpee, polichinelo, elevação lateral). Padrão `'linear'` = reta, certo quando a mão segue um objeto |

#### Unilaterais e alternados

- Descreva o lado ativo e use `mirrorPose` para o outro (alternado = poses do lado esquerdo seguidas das
  mesmas espelhadas). Não precisa animar os dois lados se o GIF do dataset mostra um só.
- Restrições de um lado só: `lib.knee(min, max, 'L')`, `lib.feetFlat(0, 1.5, 'L')`, `lib.elbow(…, 'R')` etc.

#### Peso do corpo e solo

- Sem aparelho, `props: []` ou `{ kind: 'mat' }` (o colchonete é só visual; o chão é y = 0).
- Prancha/flexão: `lib.bodyLine(165)` garante corpo alinhado.

### 3. Restrições e testes (portão 2)

- Declare em `checks` pelo menos 2 restrições do exercício. Biblioteca (`lib` em `src/anim/checks.ts`):

| Restrição | Verifica |
|---|---|
| `barOverMidfoot(tol)` | barra sobre o meio do pé |
| `handsLevel`, `symmetric` | mãos niveladas; pose simétrica |
| `feetFlat(floor, tol, side?)` | calcanhar e ponta no chão |
| `soleOn(ponto, normal, tol, side?)` | sola apoiada numa superfície fixa (banco, caixa). Superfície que se move (plataforma do leg press): calcule o plano no quadro — `test: (s) => { const { face, rail } = legPressPlatform(prop, s); return lib.soleOn(face, rail, 1)(s) }` (`legPressPlatform` é exportado por `props.ts`) |
| `feetOffFloor(min)` | pés no ar (salto, pendurado) |
| `knee(min, max, side?)`, `elbow(min, max, side?)`, `hipAngle(min, max, side?)` | ângulos internos (180 = reto) |
| `kneeTracksFoot(tol, side?)` | joelho na direção da ponta do pé |
| `trunk(min, max)` | ângulo do tronco com a vertical (sem sinal) |
| `trunkLean(min, max)` | inclinação com sinal: + à frente, − para trás |
| `backOn(…)`, `seatedOn(y)` | costas no banco; sentado (pelve 8–16 cm acima do assento) |
| `bodyLine(min)` | ombro–quadril–tornozelo alinhados |
| `upperArmToTrunk(min, max, side?)` / `elbowFlare` | ângulo braço–tronco (0 = colado, 90 = perpendicular) |
| `forearmVertical(tol)` | antebraço vertical (supino, desenvolvimento) |
| `handsAt(…)`, `heightRel(a, b, min, max, rótulo)` | mão num ponto; diferença de altura entre dois pontos |

- `at`: `'keyframes'` (padrão), `'all'` (todos os quadros), `{ phase }` (poses-chave daquela fase) ou
  `{ pose: 'Nome' }` (uma pose nomeada — prefira esta).
- Todo exercício passa também pelas verificações gerais, que rodam em todos os quadros do ciclo:
  mão/pé alcançam o alvo (sem "esticar"), joelho ≥ 30°, cotovelo ≥ 25°, quadril ≥ 25°, nada abaixo do chão,
  nenhuma articulação **nem ponto ao longo dos ossos** dentro de aparelho (mãos e pés podem tocar).

#### Limites da ficha (o teste acusa)

| Item | Limite |
|---|---|
| poses-chave | 2 a 8 |
| `moveMs` de cada transição | 150–4000 ms |
| ciclo inteiro | 1,5–12 s |
| pose do meio | `holdMs > 0` |
| pontos técnicos | ≥ 3 |
| restrições específicas | ≥ 2 |
| `revisado` | exige `by` e `date` |

### 4. Revisão técnica humana (portão 3)

Quem revisa abre o estúdio (`/#/estudio` no `npm run dev`), escolhe o exercício e confere, com a animação
rodando em velocidade normal e em câmera lenta:

- [ ] O movimento é reconhecível como o exercício, comparando com o GIF do dataset ao lado.
- [ ] Cada ponto técnico da ficha aparece corretamente.
- [ ] Nenhuma pose ensina um erro (lombar arredondada sob carga, joelho para dentro, cotovelo travado, etc.).
- [ ] Os músculos de cada fase estão certos e a fonte é aceitável.
- [ ] Ritmo plausível (fase concêntrica e excêntrica com tempos razoáveis).
- [ ] Aparelho e pegada corretos.

Aprovado: preencha `review` com `status: 'revisado'`, `by` (nome), `date` (AAAA-MM-DD) e `notes`.
Reprovado: anote em `review.notes` o que mudar e volte à etapa 2.

### 5. Publicação

Nada a fazer: o app passa a usar a animação própria assim que o status é `revisado`. Para despublicar,
volte o status para `verificado` (o GIF do dataset reaparece).

## Como começar um exercício (passo a passo prático)

1. Copie `src/anim/exercises/terra.ts` (exemplo de referência) para `src/anim/exercises/<nome>.ts`, com
   `<nome>` em kebab-case, sem acento (ex.: `rosca-halteres.ts`). O arquivo termina com
   `export default <spec>` — o cadastro é automático (não edite `index.ts`).
2. Abra o GIF do `datasetId` e confira que bate com o nome (etapa 1).
3. Preencha a ficha técnica **antes** das poses.
4. Escreva as poses-chave (etapa 2), dando `name` às poses que terão restrições próprias.
5. Declare as restrições (etapa 3) e rode só o seu exercício:
   `npx vitest run src/anim -t "<nome do exercício>" --reporter verbose`.
   Confira que aparece **`animação: <nome>`** na saída (só aparece com `--reporter verbose`) (se não aparecer, o arquivo não foi cadastrado:
   falta o `export default`). Falhas de outros exercícios não bloqueiam o seu.
6. Gere a folha de contato: `npm run anim:sheet -- <id>` (use `--zoom 2` para ver mãos, pés e contatos) e
   **olhe a imagem** comparando com o GIF do dataset. A folha é onde aparecem pose estranha, câmera ruim e
   aparelho tapando o movimento.
7. Ajuste e repita 5–6. Com tudo certo, `review.status = 'verificado'` e peça a revisão humana (etapa 4).
8. **Não faça commit nem `git add`**: quem coordena revisa e faz o commit.

### Câmera

Escolha `camera` (no arquivo do exercício) comparando com o GIF do dataset: o ângulo precisa **mostrar o
ponto técnico** (ex.: supino visto do lado dos pés e de cima, para ver a barra tocar o peito; leg press de
perfil, para a plataforma não tapar as pernas). Convenção em `spec.ts` (`yaw` 0 = de frente, 90 = perfil
esquerdo, 180 = de costas). Sem motivo, fique no padrão `{ yaw: 52, pitch: 12 }`.

Se a câmera certa para o movimento esconde um detalhe (ex.: pés atrás da plataforma do leg press), pode
trocá-la **temporariamente** só para conferir o detalhe na folha, desde que: (1) o detalhe também tenha uma
restrição que o verifique, (2) a câmera final volte à escolhida, e (3) `review.notes` registre o que foi
conferido e com qual câmera. A folha também tem a "vista oposta (costas)", que muitas vezes já mostra o detalhe.

### Erros comuns (e a ferramenta que evita)

| Erro | Como evitar |
|---|---|
| Braço "quase reto" (164° em vez de 172°) | `hang()`, `pressUp()` ou `armsAtSides()`: calculam a distância exata |
| Mão "solta" da barra entre duas poses (verificação de alcance) | A interpolação é em linha reta; acrescente uma pose intermediária no ponto do caminho que curva (ex.: barra no meio da coxa no terra) |
| Braço livre "dobra" ou abre de lado no meio do balanço | `handPath: 'shoulder'` no keyframe de destino |
| Calcanhar para cima numa plataforma inclinada | Pé com `sole` (direção para onde a sola aponta: para a plataforma) |
| Peito do pé apoiado atrás (búlgaro, dorso no banco) | Pé com `sole: v(0, 1, 0)` (sola para cima, calcanhar no ar) |
| Arquivo .ts com BOM (PowerShell 5.1 `Set-Content`/`Out-File`) | Edite com o editor/ferramenta de arquivo, não com PowerShell; se usar, `[IO.File]::WriteAllText` (UTF-8 sem BOM) |
| Restrição aplicada à pose errada | Dê `name` à pose e use `at: { pose: 'Nome' }` em vez de `at: { phase }` |
| Pose do meio sem pausa (miniatura borrada) | `holdMs > 0` na pose do meio |
| Canela/coxa atravessando o banco | A verificação geral acusa; ajuste a pelve ou os pés |
| Teste verde mas visual errado | Sempre gere e olhe a folha de contato; se faltar uma restrição que pegaria o erro, peça-a |
| Sinal invertido (giro, lado) | Escreva um teste do caso simples (ex.: "em pé, twist +90 vira o peito para a esquerda") |

### Quando o motor não tem o que você precisa

Não contorne nem altere arquivos compartilhados (`pose.ts`, `spec.ts`, `checks.ts`, `props.ts`, `render/`).
Pare e registre o pedido (o que falta, para qual exercício, por quê). Isso inclui: aparelho que não existe,
postura que o construtor de poses não descreve, restrição que deveria estar na biblioteca. Restrições
específicas de um exercício podem ficar no próprio arquivo dele. Deixe o exercício em `rascunho` se a falta
impede a técnica correta.

## Onde fica cada coisa

| O quê | Onde |
|---|---|
| Este processo | `docs/animacoes/PROCESSO.md` |
| Motor (esqueleto 3D, cinemática) | `src/anim/body.ts`, `pose.ts`, `spec.ts` |
| Desenho (câmera, boneco, aparelhos, player) | `src/anim/render/` |
| Biblioteca de aparelhos (geometria e sólidos) | `src/anim/props.ts` |
| Músculos (nomes e regiões) | `src/anim/muscles.ts` |
| Restrições reutilizáveis | `src/anim/checks.ts` |
| Um arquivo por exercício | `src/anim/exercises/<nome>.ts` |
| Testes do motor e dos exercícios | `src/anim/*.test.ts` |
| Folhas de contato (revisão) | `docs/animacoes/folhas/` (`npm run anim:sheet -- <id> [--zoom 2]`) |
| Estúdio de revisão | rota `/#/estudio` (só em desenvolvimento) |

## Definição de pronto (por exercício)

- Ficha técnica completa, com fonte dos músculos, e GIF do dataset conferido com o nome.
- Restrições específicas declaradas e verdes; verificações gerais verdes.
- Folha de contato gerada, olhada e anexada ao commit.
- Revisão humana registrada no arquivo (`revisado`, quem, quando).
