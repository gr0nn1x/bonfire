import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ACHIEVEMENT_DEFINITIONS, CalculatedStats } from "@/lib/achievements";

// --- KOMPONENTA PRO JEDNU KARTU ---
function AchievementCard({ title, description, currentValue, targets, unit }: any) {
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
          <Text className="text-slate-500 text-[10px]">Cíl: {nextTarget.toLocaleString()} {unit}</Text>
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
            <Text className="text-white font-bold text-lg">Achievementy</Text>
            <Text className="text-slate-400 text-xs">Klikni pro zobrazení úspěchů</Text>
          </View>
        </View>
        <Text className="text-orange-500 font-bold text-lg">
          {isOpen ? "▲" : "▼"}
        </Text>
      </TouchableOpacity>

      {isOpen && (
        <View className="mt-3 bg-slate-800/30 p-2 rounded-2xl border border-slate-800">
          {ACHIEVEMENT_DEFINITIONS.map((ach) => (
            <AchievementCard 
              key={ach.id}
              title={ach.title}
              description={ach.description}
              currentValue={ach.getValue(stats)}
              unit={ach.unit}
              targets={ach.targets}
            />
          ))}
        </View>
      )}
    </View>
  );
}