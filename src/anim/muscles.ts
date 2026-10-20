/**
 * Músculos que o app mostra (mesmos nomes no mapa muscular e no destaque da animação).
 * Toda ficha de exercício só pode usar estes ids (verificado nos testes).
 */
export const MUSCLES = {
  peitoral: 'Peitoral',
  deltoide_anterior: 'Deltoide anterior',
  deltoide_lateral: 'Deltoide lateral',
  deltoide_posterior: 'Deltoide posterior',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  antebraco: 'Antebraço',
  trapezio: 'Trapézio',
  dorsal: 'Grande dorsal',
  romboides: 'Romboides (costas altas)',
  eretores: 'Eretores da espinha',
  abdomen: 'Abdômen',
  obliquos: 'Oblíquos',
  gluteos: 'Glúteos',
  quadriceps: 'Quadríceps',
  posteriores: 'Posteriores de coxa',
  adutores: 'Adutores',
  panturrilhas: 'Panturrilhas',
} as const

export type MuscleId = keyof typeof MUSCLES
export const MUSCLE_IDS = Object.keys(MUSCLES) as MuscleId[]

/**
 * Vocabulário do dataset (target / secondary) → músculos do app. Usado para o mapa muscular dos exercícios
 * que continuam com o GIF do dataset. Nome desconhecido → nenhum (o teste lista os que faltam).
 */
export const DATASET_MUSCLES: Record<string, MuscleId[]> = {
  abs: ['abdomen'],
  abdominals: ['abdomen'],
  deltoids: ['deltoide_anterior', 'deltoide_lateral'],
  'grip muscles': ['antebraco'],
  'latissimus dorsi': ['dorsal'],
  core: ['abdomen', 'obliquos'],
  obliques: ['obliquos'],
  'lower abs': ['abdomen'],
  abductors: ['gluteos'],
  adductors: ['adutores'],
  'inner thighs': ['adutores'],
  biceps: ['biceps'],
  brachialis: ['biceps'],
  calves: ['panturrilhas'],
  soleus: ['panturrilhas'],
  'cardiovascular system': [],
  delts: ['deltoide_anterior', 'deltoide_lateral'],
  shoulders: ['deltoide_anterior', 'deltoide_lateral'],
  'rear deltoids': ['deltoide_posterior'],
  'front deltoids': ['deltoide_anterior'],
  forearms: ['antebraco'],
  wrists: ['antebraco'],
  'wrist flexors': ['antebraco'],
  'wrist extensors': ['antebraco'],
  grip: ['antebraco'],
  glutes: ['gluteos'],
  hamstrings: ['posteriores'],
  'hip flexors': ['quadriceps'],
  lats: ['dorsal'],
  latissimus: ['dorsal'],
  'levator scapulae': ['trapezio'],
  pectorals: ['peitoral'],
  chest: ['peitoral'],
  'upper chest': ['peitoral'],
  quads: ['quadriceps'],
  quadriceps: ['quadriceps'],
  'serratus anterior': ['peitoral'],
  spine: ['eretores'],
  'lower back': ['eretores'],
  back: ['dorsal', 'romboides'],
  'upper back': ['romboides', 'trapezio'],
  rhomboids: ['romboides'],
  traps: ['trapezio'],
  trapezius: ['trapezio'],
  triceps: ['triceps'],
  'rotator cuff': ['deltoide_posterior'],
  shins: [],
  ankles: [],
  feet: [],
  'ankle stabilizers': [],
  groin: ['adutores'],
  sternocleidomastoid: [],
  neck: [],
  hands: ['antebraco'],
}

export const fromDataset = (names: string[]): MuscleId[] => [...new Set(names.flatMap((n) => DATASET_MUSCLES[n.toLowerCase()] ?? []))]
