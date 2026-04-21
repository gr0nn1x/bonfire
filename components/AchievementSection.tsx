import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ACHIEVEMENT_DEFINITIONS, CalculatedStats } from "@/lib/achievements";
import { useLanguage } from "@/hooks/useLanguage";

const ACHIEVEMENT_TRANSLATIONS = {
  big_three: {
    en: { title: "The Big Three", description: "The sum of your best Bench, Squat, and Deadlift lifts." },
    cs: { title: "Svatá trojice", description: "Součet tvých maximálek na Bench, Dřep a Mrtvý tah." },
  },
  volume: {
    en: { title: "Mover", description: "Your total lifted volume across all history." },
    cs: { title: "Stěhovák", description: "Celkový nazvedaný objem (váha × opakování) v historii." },
  },
  workouts_count: {
    en: { title: "Consistent Visitor", description: "Total number of completed workouts." },
    cs: { title: "Pravidelný návštěvník", description: "Celkový počet odjetých tréninků." },
  },
  reps_master: {
    en: { title: "Rep Master", description: "Total number of reps completed." },
    cs: { title: "Pán desítek", description: "Celkový počet provedených opakování." },
  },
  variety: {
    en: { title: "Versatile Athlete", description: "How many unique exercises you've tried." },
    cs: { title: "Všestranný atlet", description: "Počet různých unikátních cviků, které jsi zkusil." },
  },
  bench: {
    en: { title: "Bench Crusher", description: "Your best Bench Press." },
    cs: { title: "Drtič lavičky", description: "Tvé maximum na Benchpress." },
  },
  deadlift: {
    en: { title: "Deadlift Boss", description: "Your best Deadlift." },
    cs: { title: "Pán Mrtvých tahů", description: "Tvé maximum na Mrtvý tah." },
  },
  squat: {
    en: { title: "Squat King", description: "Your best Squat." },
    cs: { title: "Král Dřepu", description: "Tvé maximum na Dřep." },
  },
  morning_bird: {
    en: { title: "Early Bird", description: "Workouts completed before 9:00 AM." },
    cs: { title: "Ranní ptáče", description: "Počet tréninků dokončených před 9:00 ráno." },
  },
  night_owl: {
    en: { title: "Night Owl", description: "Workouts completed after 9:00 PM." },
    cs: { title: "Noční sova", description: "Počet tréninků dokončených po 21:00 večer." },
  },
} as const;

// --- KOMPONENTA PRO JEDNU KARTU ---
function AchievementCard({ title, description, currentValue, targets, unit }: any) {
  const { language } = useLanguage();
  const isCs = language === "cs";
  let level = 0;
  for (let i = 0; i < targets.length; i++) {
    if (currentValue >= targets[i]) level = i + 1;
  }

  const nextTarget = level < targets.length ? targets[level] : targets[targets.length - 1];
  const prevTarget = level > 0 ? targets[level - 1] : 0;
  
  let progress = 0;
  if (level >= targets.length) progress = 100;
  else progress = ((currentValue - prevTarget) / (nextTarget - prevTarget)) * 100;

  return (
    <View className="bg-slate-900/60 p-4 rounded-2xl mb-3 border border-slate-700/50">
      <View className="flex-row justify-between items-center mb-1">
        <Text className="text-white font-bold text-base">{title}</Text>
        <Text className="text-orange-400 font-bold text-xs uppercase italic">Lvl {level}</Text>
      </View>
      <Text className="text-slate-500 text-[11px] mb-3">{description}</Text>
      <View className="flex-row justify-between mb-1">
        <Text className="text-slate-300 text-[10px] font-bold">{currentValue.toLocaleString()} {unit}</Text>
        {level < targets.length && (
          <Text className="text-slate-500 text-[10px]">{isCs ? "Cíl" : "Goal"}: {nextTarget.toLocaleString()} {unit}</Text>
        )}
      </View>
      <View className="bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-700/30">
        <View className={`h-full ${level === targets.length ? 'bg-green-500' : 'bg-orange-500'}`} style={{ width: `${Math.max(5, progress)}%` }} />
      </View>
    </View>
  );
}

// --- HLAVNÍ SEKCE S DROPDOWNEM ---
export function AchievementSection({ stats }: { stats: CalculatedStats }) {
  const { language } = useLanguage();
  const isCs = language === "cs";
  const [isOpen, setIsOpen] = useState(false); // Defaultně zavřeno

  return (
    <View className="mb-6">
      <TouchableOpacity 
        onPress={() => setIsOpen(!isOpen)}
        className="bg-slate-800 p-4 rounded-2xl flex-row justify-between items-center border border-slate-700 shadow-sm"
      >
        <View className="flex-row items-center">
            <Text className="text-xl mr-2">🏆</Text>
            <View>
            <Text className="text-white font-bold text-lg">{isCs ? "Achievementy" : "Achievements"}</Text>
            <Text className="text-slate-400 text-xs">{isCs ? "Klikni pro zobrazení úspěchů" : "Tap to view your progress"}</Text>
          </View>
        </View>
        <Text className="text-orange-500 font-bold text-lg">
          {isOpen ? "▲" : "▼"}
        </Text>
      </TouchableOpacity>

      {isOpen && (
        <View className="mt-3 bg-slate-800/30 p-2 rounded-2xl border border-slate-800">
          {ACHIEVEMENT_DEFINITIONS.map((ach) => {
            const translation = ACHIEVEMENT_TRANSLATIONS[ach.id as keyof typeof ACHIEVEMENT_TRANSLATIONS]?.[language] ?? {
              title: ach.title,
              description: ach.description,
            };

            return (
            <AchievementCard 
              key={ach.id}
              title={translation.title}
              description={translation.description}
              currentValue={ach.getValue(stats)}
              unit={ach.unit}
              targets={ach.targets}
            />
            );
          })}
        </View>
      )}
    </View>
  );
}
