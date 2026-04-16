import { supabase } from "@/lib/supabase";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unit: string;
  targets: number[];
  getValue: (stats: CalculatedStats) => number;
}

export interface CalculatedStats {
  totalWeight: number;    // Celkový objem (kg)
  totalSets: number;      // Celkový počet sérií
  totalReps: number;      // Celkový počet opakování
  maxBench: number;
  maxDeadlift: number;
  maxSquat: number;
  bigThreeTotal: number;  // Bench + Squat + Deadlift
  uniqueExercisesCount: number; // Počet různých cviků
  totalWorkouts: number;  // Počet unikátních dní, kdy user cvičil
  morningWorkouts: number; // Tréninky před 9:00
  nightWorkouts: number;   // Tréninky po 21:00
  currentStreak: number;
}

// 1. DEFINICE VŠECH ACHIEVEMENTŮ
export const ACHIEVEMENT_DEFINITIONS: Achievement[] = [
  {
    id: 'big_three',
    title: 'Svatá trojice',
    description: 'Součet tvých maximálek na Bench, Dřep a Mrtvý tah.',
    unit: 'kg',
    targets: [100, 250, 400, 600, 800],
    getValue: (s) => s.bigThreeTotal
  },
  {
    id: 'volume',
    title: 'Stěhovák',
    description: 'Celkový nazvedaný objem (váha × opakování) v historii.',
    unit: 'kg',
    targets: [5000, 25000, 100000, 500000, 1000000],
    getValue: (s) => s.totalWeight
  },
  {
    id: 'workouts_count',
    title: 'Pravidelný návštěvník',
    description: 'Celkový počet odjetých tréninků.',
    unit: 'tréninků',
    targets: [5, 20, 50, 150, 300],
    getValue: (s) => s.totalWorkouts
  },
  {
    id: 'reps_master',
    title: 'Pán desítek',
    description: 'Celkový počet provedených opakování.',
    unit: 'opakov.',
    targets: [500, 2000, 10000, 50000],
    getValue: (s) => s.totalReps
  },
  {
    id: 'variety',
    title: 'Všestranný atlet',
    description: 'Počet různých unikátních cviků, které jsi zkusil.',
    unit: 'cviků',
    targets: [5, 15, 30, 50, 80],
    getValue: (s) => s.uniqueExercisesCount
  },
  {
    id: 'bench',
    title: 'Drtič lavičky',
    description: 'Tvé maximum na Benchpress.',
    unit: 'kg',
    targets: [40, 60, 100, 140, 180],
    getValue: (s) => s.maxBench
  },
  {
    id: 'deadlift',
    title: 'Pán Mrtvých tahů',
    description: 'Tvé maximum na Mrtvý tah.',
    unit: 'kg',
    targets: [60, 100, 150, 200, 300],
    getValue: (s) => s.maxDeadlift
  },
  {
    id: 'squat',
    title: 'Král Dřepu',
    description: 'Tvé maximum na Dřep.',
    unit: 'kg',
    targets: [50, 80, 120, 160, 220],
    getValue: (s) => s.maxSquat
  },
  {
    id: 'morning_bird',
    title: 'Ranní ptáče',
    description: 'Počet tréninků dokončených před 9:00 ráno.',
    unit: 'x',
    targets: [1, 5, 20, 50, 100],
    getValue: (s) => s.morningWorkouts
  },
  {
    id: 'night_owl',
    title: 'Noční sova',
    description: 'Počet tréninků dokončených po 21:00 večer.',
    unit: 'x',
    targets: [1, 5, 20, 50, 100],
    getValue: (s) => s.nightWorkouts
  }
];

// 2. SPOLEČNÁ LOGIKA VÝPOČTU
export const calculateStatsFromLogs = (logs: any[]): CalculatedStats => {
  let totalWeight = 0;
  let totalReps = 0;
  let maxBench = 0;
  let maxDeadlift = 0;
  let maxSquat = 0;

  const uniqueExercises = new Set();
  const uniqueDates = new Set<string>();
  const morningDates = new Set<string>();
  const nightDates = new Set<string>();

  logs.forEach(log => {
    const weight = parseFloat(log.weight_lifted) || 0;
    const reps = parseInt(log.reps_done) || 0;
    totalWeight += (weight * reps);
    totalReps += reps;

    if (log.exercise_id) uniqueExercises.add(log.exercise_id);
    
    if (log.date) {
      const d = new Date(log.date);
      const dateKey = d.toISOString().split('T')[0]; 
      uniqueDates.add(dateKey);

      const hour = d.getHours();
      if (hour < 9) morningDates.add(dateKey);
      if (hour >= 21) nightDates.add(dateKey);
    }

    const name = log.exercises?.name?.toLowerCase() || "";
    if (name.includes("bench")) maxBench = Math.max(maxBench, weight);
    if (name.includes("deadlift") || name.includes("tah")) maxDeadlift = Math.max(maxDeadlift, weight);
    if (name.includes("squat") || name.includes("dřep")) maxSquat = Math.max(maxSquat, weight);
  });

  const sortedDates = Array.from(uniqueDates).sort() as string[]; 
  let streak = 0;

  if (sortedDates.length > 0) {
    const today = new Date();
    const lastWorkoutDate = new Date(sortedDates[sortedDates.length - 1]);
    
    const diffToToday = (today.getTime() - lastWorkoutDate.getTime()) / (1000 * 3600 * 24);

    if (diffToToday <= 7) {
      streak = 1;
      for (let i = sortedDates.length - 1; i > 0; i--) {
        const current = new Date(sortedDates[i]);
        const previous = new Date(sortedDates[i - 1]);
        const gap = (current.getTime() - previous.getTime()) / (1000 * 3600 * 24);
        
        if (gap <= 7) {
          streak++;
        } else {
          break;
        }
      }
    } else {
      streak = 0;
    }
  }

  return {
    totalWeight,
    totalSets: logs.length,
    totalReps,
    maxBench,
    maxDeadlift,
    maxSquat,
    bigThreeTotal: maxBench + maxDeadlift + maxSquat,
    uniqueExercisesCount: uniqueExercises.size,
    totalWorkouts: uniqueDates.size,
    morningWorkouts: morningDates.size,
    nightWorkouts: nightDates.size,
    currentStreak: streak
  };
};

// 3. SYNCHRONIZACE DO DATABÁZE
export async function syncAchievements(userId: string, stats: CalculatedStats) {
  const earnedIds: string[] = [];

  // Dynamicky vytvoříme seznam odznaků, na které má uživatel nárok
  ACHIEVEMENT_DEFINITIONS.forEach(def => {
    const currentValue = def.getValue(stats);
    
    def.targets.forEach((target, index) => {
      if (currentValue >= target) {
        // Vytvoříme ID ve formátu: id_level (např. 'bench_1', 'bench_2' atd.)
        earnedIds.push(`${def.id}_${index + 1}`);
      }
    });
  });

  if (earnedIds.length === 0) return;

  try {
    // 1. Zjistíme, co už má zapsané v DB
    const { data: existing, error: fetchErr } = await supabase
      .from('user_achievements')
      .select('achievement_id')
      .eq('user_id', userId);

    if (fetchErr) throw fetchErr;

    const alreadyOwnedIds = existing?.map(e => e.achievement_id) || [];
    
    // 2. Najdeme jen ty, které jsou nové
    const newlyEarnedIds = earnedIds.filter(id => !alreadyOwnedIds.includes(id));

    if (newlyEarnedIds.length > 0) {
      const toInsert = newlyEarnedIds.map(id => ({
        user_id: userId,
        achievement_id: id
      }));

      // 3. Zapíšeme do DB (to spustí Trigger do Feedu)
      const { error: insertErr } = await supabase.from('user_achievements').insert(toInsert);
      
      if (insertErr) {
        console.error("Chyba při zápisu achievementů do DB:", insertErr.message);
      } else {
        console.log(`Odemčeno ${newlyEarnedIds.length} nových odznaků:`, newlyEarnedIds);
      }
    }
  } catch (e) {
    console.error("Achievement sync error:", e);
  }
}