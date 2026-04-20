export type MuscleGroup = 
  | 'chest' | 'back' | 'shoulders' | 'quads' 
  | 'hamstrings' | 'glutes' | 'biceps' | 'triceps' 
  | 'core' | 'calves';

export interface ExerciseDefinition {
  name: string;
  primary: MuscleGroup[];
  secondary: MuscleGroup[];
}

export const EXERCISE_DATABASE: ExerciseDefinition[] = [
  { name: 'Benchpress (velká činka)', primary: ['chest'], secondary: ['triceps', 'shoulders'] },
  { name: 'Dřep (Squat)', primary: ['quads', 'glutes'], secondary: ['core'] },
  { name: 'Mrtvý tah (Deadlift)', primary: ['back', 'glutes', 'hamstrings'], secondary: ['core'] },
  { name: 'Shyby (Pull-ups)', primary: ['back'], secondary: ['biceps'] },
  { name: 'Military Press (vstoje)', primary: ['shoulders'], secondary: ['triceps'] },
  { name: 'Leg Press', primary: ['quads'], secondary: ['glutes'] },
  { name: 'Výpady (Lunges)', primary: ['quads', 'glutes'], secondary: ['hamstrings'] },
  { name: 'Kliky na bradlech (Dips)', primary: ['chest', 'triceps'], secondary: ['shoulders'] },
  { name: 'Přítahy v předklonu (Rows)', primary: ['back'], secondary: ['biceps'] },
  { name: 'Rumunský mrtvý tah', primary: ['hamstrings', 'glutes'], secondary: ['back'] },
  { name: 'Bicepsový zdvih (velká činka)', primary: ['biceps'], secondary: [] },
  { name: 'Tricepsové stahování kladky', primary: ['triceps'], secondary: [] },
  { name: 'Zvedání nohou ve visu', primary: ['core'], secondary: [] },
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