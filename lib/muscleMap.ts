export type MuscleGroup = 
  | 'chest' | 'back' | 'shoulders' | 'quads' 
  | 'hamstrings' | 'glutes' | 'biceps' | 'triceps' 
  | 'core' | 'calves';

export interface ExerciseDefinition {
  id: string;
  name: string;
  translations: {
    en: string;
    cs: string;
  };
  primary: MuscleGroup[];
  secondary: MuscleGroup[];
}

export const EXERCISE_DATABASE: ExerciseDefinition[] = [
  { id: 'benchpress-barbell', name: 'Benchpress (velká činka)', translations: { cs: 'Benchpress (velká činka)', en: 'Bench Press (barbell)' }, primary: ['chest'], secondary: ['triceps', 'shoulders'] },
  { id: 'squat', name: 'Dřep (Squat)', translations: { cs: 'Dřep (Squat)', en: 'Squat' }, primary: ['quads', 'glutes'], secondary: ['core'] },
  { id: 'deadlift', name: 'Mrtvý tah (Deadlift)', translations: { cs: 'Mrtvý tah (Deadlift)', en: 'Deadlift' }, primary: ['back', 'glutes', 'hamstrings'], secondary: ['core'] },
  { id: 'pull-ups', name: 'Shyby (Pull-ups)', translations: { cs: 'Shyby (Pull-ups)', en: 'Pull-ups' }, primary: ['back'], secondary: ['biceps'] },
  { id: 'military-press', name: 'Military Press (vstoje)', translations: { cs: 'Military Press (vstoje)', en: 'Military Press (standing)' }, primary: ['shoulders'], secondary: ['triceps'] },
  { id: 'leg-press', name: 'Leg Press', translations: { cs: 'Leg Press', en: 'Leg Press' }, primary: ['quads'], secondary: ['glutes'] },
  { id: 'lunges', name: 'Výpady (Lunges)', translations: { cs: 'Výpady (Lunges)', en: 'Lunges' }, primary: ['quads', 'glutes'], secondary: ['hamstrings'] },
  { id: 'dips', name: 'Kliky na bradlech (Dips)', translations: { cs: 'Kliky na bradlech (Dips)', en: 'Dips' }, primary: ['chest', 'triceps'], secondary: ['shoulders'] },
  { id: 'rows', name: 'Přítahy v předklonu (Rows)', translations: { cs: 'Přítahy v předklonu (Rows)', en: 'Bent-over Rows' }, primary: ['back'], secondary: ['biceps'] },
  { id: 'romanian-deadlift', name: 'Rumunský mrtvý tah', translations: { cs: 'Rumunský mrtvý tah', en: 'Romanian Deadlift' }, primary: ['hamstrings', 'glutes'], secondary: ['back'] },
  { id: 'barbell-curl', name: 'Bicepsový zdvih (velká činka)', translations: { cs: 'Bicepsový zdvih (velká činka)', en: 'Barbell Curl' }, primary: ['biceps'], secondary: [] },
  { id: 'triceps-pushdown', name: 'Tricepsové stahování kladky', translations: { cs: 'Tricepsové stahování kladky', en: 'Cable Triceps Pushdown' }, primary: ['triceps'], secondary: [] },
  { id: 'hanging-leg-raises', name: 'Zvedání nohou ve visu', translations: { cs: 'Zvedání nohou ve visu', en: 'Hanging Leg Raises' }, primary: ['core'], secondary: [] },
  // ... sem můžeš dopsat všech 40 cviků ze SQL skriptu
];

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Hrudník',
  back: 'Záda',
  shoulders: 'Ramena',
  quads: 'Kvadricepsy',
  hamstrings: 'Hamstringy',
  glutes: 'Hýždě',
  biceps: 'Biceps',
  triceps: 'Triceps',
  core: 'Střed těla',
  calves: 'Lýtka'
};

export const MUSCLE_LABELS_EN: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  biceps: 'Biceps',
  triceps: 'Triceps',
  core: 'Core',
  calves: 'Calves'
};

export function getLocalizedMuscleLabels(language: "en" | "cs") {
  return language === "cs" ? MUSCLE_LABELS : MUSCLE_LABELS_EN;
}

export function getLocalizedExerciseName(
  exercise: ExerciseDefinition,
  language: "en" | "cs",
) {
  return exercise.translations[language] ?? exercise.name;
}
