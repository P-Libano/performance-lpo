/**
 * Catálogo curado: exercícios "de academia" mais comuns, com nome em pt-BR e
 * metadados que o dataset não traz (grupo muscular de treino, padrão de
 * movimento, composto vs. isolado). É a base do gerador de rotina.
 * IDs conferidos contra data/exercises.json (ver curated.test.ts).
 */

export const MUSCLE_GROUPS = [
  'peito',
  'costas',
  'ombros',
  'biceps',
  'triceps',
  'quadriceps',
  'posteriores',
  'gluteos',
  'panturrilhas',
  'abdomen',
  'trapezio',
  'antebracos',
  'condicionamento',
] as const
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number]

export const MUSCLE_GROUP_PT: Record<MuscleGroup, string> = {
  peito: 'Peito',
  costas: 'Costas',
  ombros: 'Ombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  quadriceps: 'Quadríceps',
  posteriores: 'Posteriores',
  gluteos: 'Glúteos',
  panturrilhas: 'Panturrilhas',
  abdomen: 'Abdômen',
  trapezio: 'Trapézio',
  antebracos: 'Antebraços',
  condicionamento: 'Condicionamento',
}

/** Grupos de membros inferiores: incremento de carga maior na progressão. */
export const LOWER_BODY_GROUPS: ReadonlySet<MuscleGroup> = new Set([
  'quadriceps',
  'posteriores',
  'gluteos',
  'panturrilhas',
])

export type MovementPattern =
  | 'empurrar_horizontal'
  | 'empurrar_inclinado'
  | 'empurrar_vertical'
  | 'crucifixo'
  | 'puxar_horizontal'
  | 'puxar_vertical'
  | 'pulldown_isolado'
  | 'elevacao_lateral'
  | 'elevacao_frontal'
  | 'deltoide_posterior'
  | 'rosca'
  | 'triceps_isolado'
  | 'triceps_composto'
  | 'agachamento'
  | 'avanco'
  | 'extensora'
  | 'terra'
  | 'flexora'
  | 'gluteo'
  | 'panturrilha'
  | 'abdominal'
  | 'encolhimento'
  | 'punho'
  | 'olimpico'
  | 'condicionamento'

export interface CuratedExercise {
  id: string
  pt: string
  group: MuscleGroup
  pattern: MovementPattern
  compound: boolean
}

type Row = [id: string, pt: string, group: MuscleGroup, pattern: MovementPattern, compound: boolean]

const C = true
const I = false

const ROWS: Row[] = [
  // Peito
  ['0025', 'Supino reto com barra', 'peito', 'empurrar_horizontal', C],
  ['0047', 'Supino inclinado com barra', 'peito', 'empurrar_inclinado', C],
  ['0033', 'Supino declinado com barra', 'peito', 'empurrar_horizontal', C],
  ['0289', 'Supino reto com halteres', 'peito', 'empurrar_horizontal', C],
  ['0314', 'Supino inclinado com halteres', 'peito', 'empurrar_inclinado', C],
  ['0301', 'Supino declinado com halteres', 'peito', 'empurrar_horizontal', C],
  ['0577', 'Supino na máquina', 'peito', 'empurrar_horizontal', C],
  ['1299', 'Supino inclinado na máquina', 'peito', 'empurrar_inclinado', C],
  ['0748', 'Supino reto no Smith', 'peito', 'empurrar_horizontal', C],
  ['0757', 'Supino inclinado no Smith', 'peito', 'empurrar_inclinado', C],
  ['0662', 'Flexão de braço', 'peito', 'empurrar_horizontal', C],
  ['1311', 'Flexão com mãos afastadas', 'peito', 'empurrar_horizontal', C],
  ['0279', 'Flexão declinada (pés elevados)', 'peito', 'empurrar_inclinado', C],
  ['0493', 'Flexão inclinada (mãos elevadas)', 'peito', 'empurrar_horizontal', C],
  ['0251', 'Mergulho nas paralelas (peito)', 'peito', 'empurrar_horizontal', C],
  ['0308', 'Crucifixo reto com halteres', 'peito', 'crucifixo', I],
  ['0319', 'Crucifixo inclinado com halteres', 'peito', 'crucifixo', I],
  ['0596', 'Voador (peck deck)', 'peito', 'crucifixo', I],
  ['0227', 'Crossover em pé', 'peito', 'crucifixo', I],
  ['0188', 'Crucifixo na polia média', 'peito', 'crucifixo', I],
  ['0179', 'Crossover polia baixa', 'peito', 'crucifixo', I],

  // Costas
  ['0027', 'Remada curvada com barra', 'costas', 'puxar_horizontal', C],
  ['3017', 'Remada Pendlay', 'costas', 'puxar_horizontal', C],
  ['0293', 'Remada curvada com halteres', 'costas', 'puxar_horizontal', C],
  ['0292', 'Remada unilateral com halter (serrote)', 'costas', 'puxar_horizontal', C],
  ['0861', 'Remada sentada na polia', 'costas', 'puxar_horizontal', C],
  ['1350', 'Remada sentada na máquina', 'costas', 'puxar_horizontal', C],
  ['0606', 'Remada cavalinho (T-bar)', 'costas', 'puxar_horizontal', C],
  ['0581', 'Remada alta na máquina (high row)', 'costas', 'puxar_horizontal', C],
  ['0499', 'Remada invertida', 'costas', 'puxar_horizontal', C],
  ['2300', 'Remada invertida com joelhos flexionados', 'costas', 'puxar_horizontal', C],
  ['3165', 'Remada com toalha', 'costas', 'puxar_horizontal', C],
  ['3161', 'Remada unilateral com toalha', 'costas', 'puxar_horizontal', C],
  ['1772', 'Elevação escapular deitado (elbow lift)', 'costas', 'pulldown_isolado', I],
  ['2330', 'Puxada frontal na polia', 'costas', 'puxar_vertical', C],
  ['0198', 'Puxada na polia (pulldown)', 'costas', 'puxar_vertical', C],
  ['0818', 'Puxada com pegada neutra', 'costas', 'puxar_vertical', C],
  ['0579', 'Puxada frontal na máquina', 'costas', 'puxar_vertical', C],
  ['0017', 'Barra fixa assistida (máquina)', 'costas', 'puxar_vertical', C],
  ['0652', 'Barra fixa (pronada)', 'costas', 'puxar_vertical', C],
  ['1326', 'Barra fixa supinada (chin-up)', 'costas', 'puxar_vertical', C],
  ['0651', 'Barra fixa pegada neutra', 'costas', 'puxar_vertical', C],
  ['0238', 'Pulldown com braços estendidos', 'costas', 'pulldown_isolado', I],

  // Ombros
  ['0091', 'Desenvolvimento sentado com barra', 'ombros', 'empurrar_vertical', C],
  ['1457', 'Desenvolvimento militar em pé', 'ombros', 'empurrar_vertical', C],
  ['0405', 'Desenvolvimento sentado com halteres', 'ombros', 'empurrar_vertical', C],
  ['0426', 'Desenvolvimento em pé com halteres', 'ombros', 'empurrar_vertical', C],
  ['2137', 'Desenvolvimento Arnold', 'ombros', 'empurrar_vertical', C],
  ['0603', 'Desenvolvimento na máquina', 'ombros', 'empurrar_vertical', C],
  ['0774', 'Desenvolvimento no Smith', 'ombros', 'empurrar_vertical', C],
  ['0471', 'Flexão em parada de mão', 'ombros', 'empurrar_vertical', C],
  ['0334', 'Elevação lateral com halteres', 'ombros', 'elevacao_lateral', I],
  ['0178', 'Elevação lateral na polia', 'ombros', 'elevacao_lateral', I],
  ['0120', 'Remada alta com barra', 'ombros', 'elevacao_lateral', I],
  ['0310', 'Elevação frontal com halteres', 'ombros', 'elevacao_frontal', I],
  ['0378', 'Crucifixo invertido com halteres', 'ombros', 'deltoide_posterior', I],
  ['0602', 'Crucifixo invertido na máquina', 'ombros', 'deltoide_posterior', I],
  ['0203', 'Remada para deltoide posterior na polia (corda)', 'ombros', 'deltoide_posterior', I],

  // Bíceps
  ['0031', 'Rosca direta com barra', 'biceps', 'rosca', I],
  ['0447', 'Rosca direta com barra W', 'biceps', 'rosca', I],
  ['0294', 'Rosca com halteres', 'biceps', 'rosca', I],
  ['0313', 'Rosca martelo', 'biceps', 'rosca', I],
  ['0318', 'Rosca inclinada com halteres', 'biceps', 'rosca', I],
  ['0070', 'Rosca Scott com barra', 'biceps', 'rosca', I],
  ['0297', 'Rosca concentrada', 'biceps', 'rosca', I],
  ['0868', 'Rosca na polia', 'biceps', 'rosca', I],
  ['0165', 'Rosca martelo na polia (corda)', 'biceps', 'rosca', I],
  ['0140', 'Barra fixa para bíceps', 'biceps', 'rosca', C],

  // Tríceps
  ['0030', 'Supino fechado com barra', 'triceps', 'triceps_composto', C],
  ['0814', 'Mergulho nas paralelas (tríceps)', 'triceps', 'triceps_composto', C],
  ['0259', 'Flexão com pegada fechada', 'triceps', 'triceps_composto', C],
  ['0283', 'Flexão diamante', 'triceps', 'triceps_composto', C],
  ['0129', 'Mergulho no banco', 'triceps', 'triceps_composto', C],
  ['0201', 'Tríceps na polia', 'triceps', 'triceps_isolado', I],
  ['0200', 'Tríceps na polia com corda', 'triceps', 'triceps_isolado', I],
  ['0241', 'Tríceps na polia com barra V', 'triceps', 'triceps_isolado', I],
  ['0061', 'Tríceps testa com barra', 'triceps', 'triceps_isolado', I],
  ['0453', 'Tríceps francês sentado com barra W', 'triceps', 'triceps_isolado', I],
  ['2188', 'Tríceps francês sentado com halter', 'triceps', 'triceps_isolado', I],
  ['0194', 'Tríceps acima da cabeça na polia (corda)', 'triceps', 'triceps_isolado', I],
  ['0333', 'Tríceps coice com halter', 'triceps', 'triceps_isolado', I],

  // Quadríceps
  ['0043', 'Agachamento livre com barra', 'quadriceps', 'agachamento', C],
  ['0042', 'Agachamento frontal com barra', 'quadriceps', 'agachamento', C],
  ['0770', 'Agachamento no Smith', 'quadriceps', 'agachamento', C],
  ['0743', 'Agachamento hack na máquina', 'quadriceps', 'agachamento', C],
  ['0739', 'Leg press 45°', 'quadriceps', 'agachamento', C],
  ['1760', 'Agachamento goblet com halter', 'quadriceps', 'agachamento', C],
  ['0413', 'Agachamento com halteres', 'quadriceps', 'agachamento', C],
  ['1685', 'Agachamento livre com elevação dos braços', 'quadriceps', 'agachamento', C],
  ['3132', 'Agachamento com apoio', 'quadriceps', 'agachamento', C],
  ['1476', 'Agachamento unilateral', 'quadriceps', 'agachamento', C],
  ['1759', 'Agachamento pistol', 'quadriceps', 'agachamento', C],
  ['2368', 'Agachamento afundo (split squat)', 'quadriceps', 'avanco', C],
  ['0410', 'Agachamento afundo com halteres', 'quadriceps', 'avanco', C],
  ['0336', 'Avanço com halteres', 'quadriceps', 'avanco', C],
  ['0054', 'Avanço com barra', 'quadriceps', 'avanco', C],
  ['0381', 'Avanço reverso com halteres', 'quadriceps', 'avanco', C],
  ['1460', 'Avanço caminhando', 'quadriceps', 'avanco', C],
  ['0431', 'Subida no banco com halteres', 'quadriceps', 'avanco', C],
  ['0585', 'Cadeira extensora', 'quadriceps', 'extensora', I],
  ['1489', 'Agachamento sissy', 'quadriceps', 'extensora', I],

  // Posteriores
  ['0032', 'Levantamento terra com barra', 'posteriores', 'terra', C],
  ['0085', 'Levantamento terra romeno com barra', 'posteriores', 'terra', C],
  ['1459', 'Levantamento terra romeno com halteres', 'posteriores', 'terra', C],
  ['0432', 'Stiff com halteres', 'posteriores', 'terra', C],
  ['0811', 'Levantamento terra com trap bar', 'posteriores', 'terra', C],
  ['0117', 'Levantamento terra sumô', 'posteriores', 'terra', C],
  ['0044', 'Good morning com barra', 'posteriores', 'terra', C],
  ['1757', 'Terra unilateral com halter', 'posteriores', 'terra', C],
  ['0116', 'Stiff com barra', 'posteriores', 'terra', C],
  ['0586', 'Mesa flexora', 'posteriores', 'flexora', I],
  ['0599', 'Cadeira flexora', 'posteriores', 'flexora', I],
  ['3193', 'Glute-ham raise (flexão nórdica)', 'posteriores', 'flexora', I],
  ['0795', 'Flexão de joelho em pé unilateral', 'posteriores', 'flexora', I],

  // Glúteos
  ['1409', 'Elevação pélvica com barra', 'gluteos', 'gluteo', C],
  ['0196', 'Pull-through na polia', 'gluteos', 'gluteo', C],
  ['3523', 'Elevação pélvica com pés no banco', 'gluteos', 'gluteo', I],
  ['3013', 'Ponte de glúteo no solo', 'gluteos', 'gluteo', I],
  ['0597', 'Cadeira abdutora', 'gluteos', 'gluteo', I],

  // Panturrilhas
  ['0605', 'Panturrilha em pé na máquina', 'panturrilhas', 'panturrilha', I],
  ['0594', 'Panturrilha sentado na máquina', 'panturrilhas', 'panturrilha', I],
  ['1391', 'Panturrilha no leg press', 'panturrilhas', 'panturrilha', I],
  ['1372', 'Panturrilha em pé com barra', 'panturrilhas', 'panturrilha', I],
  ['0417', 'Panturrilha em pé com halteres', 'panturrilhas', 'panturrilha', I],
  ['0409', 'Panturrilha unilateral com halter', 'panturrilhas', 'panturrilha', I],
  ['1373', 'Panturrilha em pé (peso corporal)', 'panturrilhas', 'panturrilha', I],

  // Abdômen
  ['0175', 'Abdominal ajoelhado na polia', 'abdomen', 'abdominal', I],
  ['0472', 'Elevação de pernas na barra', 'abdomen', 'abdominal', I],
  ['0620', 'Elevação de pernas no banco', 'abdomen', 'abdominal', I],
  ['0274', 'Abdominal no solo (crunch)', 'abdomen', 'abdominal', I],
  ['0832', 'Abdominal com carga', 'abdomen', 'abdominal', I],
  ['0687', 'Giro russo', 'abdomen', 'abdominal', I],
  ['0276', 'Dead bug', 'abdomen', 'abdominal', I],
  ['0464', 'Prancha com rotação', 'abdomen', 'abdominal', I],
  ['0857', 'Roda abdominal', 'abdomen', 'abdominal', I],

  // Trapézio e antebraços (fora do gerador padrão, mas com nome pt)
  ['0095', 'Encolhimento com barra', 'trapezio', 'encolhimento', I],
  ['0406', 'Encolhimento com halteres', 'trapezio', 'encolhimento', I],
  ['0126', 'Rosca de punho com barra', 'antebracos', 'punho', I],

  // Condicionamento (finishers e circuitos; trabalho por tempo)
  ['1160', 'Burpee', 'condicionamento', 'condicionamento', C],
  ['0630', 'Escalador (mountain climber)', 'condicionamento', 'condicionamento', C],
  ['3224', 'Polichinelo com salto', 'condicionamento', 'condicionamento', C],
  ['3361', 'Salto lateral (skater)', 'condicionamento', 'condicionamento', C],
  ['2612', 'Pular corda', 'condicionamento', 'condicionamento', C],
  ['0549', 'Swing com kettlebell', 'condicionamento', 'condicionamento', C],
  ['0550', 'Thruster com kettlebell', 'condicionamento', 'condicionamento', C],
  ['3305', 'Thruster com barra', 'condicionamento', 'condicionamento', C],
  ['1201', 'Burpee com halteres', 'condicionamento', 'condicionamento', C],
  ['2133', 'Caminhada do fazendeiro', 'condicionamento', 'condicionamento', C],
  ['2138', 'Bicicleta ergométrica', 'condicionamento', 'condicionamento', C],
]

export const CURATED: readonly CuratedExercise[] = ROWS.map(([id, pt, group, pattern, compound]) => ({
  id,
  pt,
  group,
  pattern,
  compound,
}))

export const CURATED_BY_ID: ReadonlyMap<string, CuratedExercise> = new Map(CURATED.map((c) => [c.id, c]))

/** Exigem técnica/força acima de iniciante: o gerador só usa para iniciante se não houver outra opção. */
export const ADVANCED_IDS: ReadonlySet<string> = new Set([
  '1759', // pistol
  '1476', // agachamento unilateral
  '0471', // flexão em parada de mão
  '3193', // glute-ham raise
  '1489', // sissy
  '3017', // pendlay
  '0032', // terra convencional
  '0857', // roda abdominal
])

/** Peso corporal que precisa de barra fixa ou paralelas. */
export const NEEDS_BAR_IDS: ReadonlySet<string> = new Set([
  '0652', // barra fixa
  '1326', // chin-up
  '0651', // barra neutra
  '0140', // barra fixa para bíceps
  '0251', // mergulho peito
  '0814', // mergulho tríceps
  '0499', // remada invertida
  '2300', // remada invertida joelhos flexionados
  '0472', // elevação de pernas na barra
])
