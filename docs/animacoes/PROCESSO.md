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
5. **Um visual só.** Mesmo motor, mesma câmera, mesmas cores e mesmo mapa muscular para todos os exercícios.

## Ciclo de vida de um exercício

```
rascunho ──► verificado ──► revisado ──► (publicado no app)
   │            │              │
   │            │              └─ portão 3: revisão técnica humana (checklist abaixo), registrada no arquivo
   │            └─ portão 2: testes automáticos verdes + folha de contato gerada
   └─ portão 1: ficha técnica completa (fases, pontos-chave, músculos com fonte, referência do dataset)
```

O status fica no próprio arquivo do exercício (`review.status`). O app só usa a animação própria quando
`review.status === 'revisado'`; senão mostra o GIF do dataset.

## Etapas

### 1. Ficha técnica (portão 1)

Antes de qualquer pose, preencha no arquivo do exercício:

- `datasetId`: o exercício do dataset de referência (o GIF que ele vai substituir).
- `phases`: as fases do movimento em ordem (ex.: "Descida", "Fundo", "Subida"), com 1 frase cada.
- `keyPoints`: 3–6 pontos técnicos verificáveis (ex.: "cotovelos a ~45° do tronco na descida").
  Cada ponto técnico verificável vira uma restrição na etapa 3.
- `muscles`: por fase, `primary` (vermelho) e `secondary` (rosa), usando só nomes de `MUSCLES`
  (`src/anim/muscles.ts`). `source`: de onde veio (livro, revisão de EMG, NSCA etc.).
- `equipment`: aparelho(s) usados, só da biblioteca de aparelhos (`src/anim/props/`). Se faltar um aparelho,
  ele entra primeiro na biblioteca (com teste próprio), nunca desenhado dentro do exercício.

### 2. Poses-chave

- Use os construtores de pose (`src/anim/pose.ts`): você informa onde ficam a pelve, a inclinação do tronco,
  as mãos e os pés (pontos de contato); joelhos e cotovelos saem da cinemática inversa.
- Uma pose por início/fim de fase; no máximo 6 poses por exercício.
- Unidades em centímetros, atleta de 175 cm. Eixos: x para a frente do atleta, y para cima, z para a esquerda.
- Exercícios simétricos usam `mirror()`; unilaterais descrevem os dois lados.

### 3. Restrições e testes (portão 2)

- Declare em `checks` as restrições do exercício (biblioteca em `src/anim/checks.ts`):
  contatos (mão na barra, costas no banco, pés na plataforma), alinhamentos (barra sobre o meio do pé),
  amplitudes (ângulo do joelho no fundo do agachamento) e limites articulares.
- Todo exercício passa também pelas verificações gerais, que rodam em todos os quadros do ciclo:
  comprimento dos ossos constante, mão/pé alcançam o alvo (sem "esticar"), articulações dentro dos limites
  humanos, nada atravessa o chão ou o aparelho, figura inteira dentro do quadro.
- `npm test` precisa passar. Depois gere a folha de contato (`npm run anim:sheet -- <id>`), que salva em
  `docs/animacoes/folhas/<id>.png` as poses-chave, a tira do movimento e o GIF do dataset ao lado.
- Com testes verdes e folha gerada: `review.status = 'verificado'`.

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

1. Copie `src/anim/exercises/terra.ts` (exemplo de referência) para `src/anim/exercises/<nome>.ts`.
   O arquivo precisa terminar com `export default <spec>` — o cadastro é automático (não edite `index.ts`).
2. Preencha a ficha técnica (etapa 1) **antes** das poses.
3. Escreva as poses-chave (etapa 2), dando `name` às poses que terão restrições próprias.
4. Declare as restrições (etapa 3) e rode `npx vitest run src/anim` até ficar verde.
5. Gere a folha de contato: `npm run anim:sheet -- <id>` e **olhe a imagem** comparando com o GIF do dataset.
   Teste verde não basta: a folha é onde aparecem pose estranha, câmera ruim e aparelho tapando o movimento.
6. Ajuste e repita 4–5. Com tudo certo, `review.status = 'verificado'` e peça a revisão humana (etapa 4).

### Câmera

Escolha `camera` (no arquivo do exercício) comparando com o GIF do dataset: o ângulo precisa **mostrar o
ponto técnico** (ex.: supino visto do lado dos pés e de cima, para ver a barra tocar o peito; leg press de
perfil, para a plataforma não tapar as pernas). Convenção em `spec.ts` (`yaw` 0 = de frente, 90 = perfil
esquerdo, 180 = de costas).

### Erros comuns (e a ferramenta que evita)

| Erro | Como evitar |
|---|---|
| Braço "quase reto" (164° em vez de 172°) | Use `hang()` (braços pendurados) ou `pressUp()` (braços para cima): calculam a altura exata |
| Mão "solta" da barra entre duas poses (verificação de alcance) | A interpolação é em linha reta; acrescente uma pose intermediária no ponto do caminho que curva (ex.: barra no meio da coxa no terra) |
| Restrição aplicada à pose errada | Dê `name` à pose e use `at: { pose: 'Nome' }` em vez de `at: { phase }` |
| Teste verde mas visual errado | Sempre gere e olhe a folha de contato; se faltar uma restrição que pegaria o erro, crie-a |
| Sinal invertido (giro, lado) | Escreva um teste do caso simples (ex.: "em pé, twist +90 vira o peito para a esquerda") |

### Quando o motor não tem o que você precisa

Não contorne nem altere arquivos compartilhados (`pose.ts`, `checks.ts`, `props.ts`, `render/`). Pare e
registre o pedido (o que falta, para qual exercício, por quê). Isso inclui: aparelho que não existe, postura
que o construtor de poses não descreve, restrição que deveria estar na biblioteca. Restrições específicas de
um exercício podem ficar no próprio arquivo dele.

## Onde fica cada coisa

| O quê | Onde |
|---|---|
| Este processo | `docs/animacoes/PROCESSO.md` |
| Motor (esqueleto 3D, cinemática, câmera) | `src/anim/` |
| Biblioteca de aparelhos | `src/anim/props/` |
| Músculos (nomes e regiões) | `src/anim/muscles.ts` |
| Restrições reutilizáveis | `src/anim/checks.ts` |
| Um arquivo por exercício | `src/anim/exercises/<id>.ts` |
| Folhas de contato (revisão) | `docs/animacoes/folhas/` |
| Estúdio de revisão | rota `/#/estudio` (só em desenvolvimento) |

## Definição de pronto (por exercício)

- Ficha técnica completa, com fonte dos músculos.
- Restrições específicas declaradas e verdes; verificações gerais verdes.
- Folha de contato gerada e anexada ao commit.
- Revisão humana registrada no arquivo (`revisado`, quem, quando).
