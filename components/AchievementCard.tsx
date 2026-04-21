import { View, Text } from "react-native";
import { useLanguage } from "@/hooks/useLanguage";

interface AchievementProps {
  title: string;
  description: string;
  currentValue: number;
  targets: number[]; // Cíle pro Level 1, 2, 3... (např. [50, 100, 150])
  unit: string;
}

export function AchievementCard({ title, description, currentValue, targets, unit }: AchievementProps) {
  const { language } = useLanguage();
  const isCs = language === "cs";
  // Zjistíme, na jakém levelu uživatel je
  let level = 0;
  for (let i = 0; i < targets.length; i++) {
    if (currentValue >= targets[i]) level = i + 1;
  }

  const nextTarget = level < targets.length ? targets[level] : targets[targets.length - 1];
  const prevTarget = level > 0 ? targets[level - 1] : 0;
  
  // Výpočet procent do dalšího levelu
  let progress = 0;
  if (level >= targets.length) {
    progress = 100; // Max level dosažen
  } else {
    progress = ((currentValue - prevTarget) / (nextTarget - prevTarget)) * 100;
  }

  return (
    <View className="bg-slate-800 p-4 rounded-2xl mb-3 border border-slate-700 shadow-sm">
      <View className="flex-row justify-between items-center mb-1">
        <Text className="text-white font-bold text-lg">{title}</Text>
        <View className="bg-orange-500/20 px-2 py-1 rounded-lg border border-orange-500/30">
          <Text className="text-orange-400 font-bold text-xs uppercase">{isCs ? "Level" : "Level"} {level}</Text>
        </View>
      </View>
      
      <Text className="text-slate-400 text-xs mb-3">{description}</Text>
      
      <View className="flex-row justify-between mb-1">
        <Text className="text-slate-300 text-xs font-bold">{currentValue.toLocaleString()} {unit}</Text>
        {level < targets.length && (
          <Text className="text-slate-500 text-xs">{isCs ? "Cíl" : "Goal"}: {nextTarget.toLocaleString()} {unit}</Text>
        )}
      </View>

      <View className="bg-slate-900 h-3 rounded-full overflow-hidden border border-slate-700">
        <View 
          className={`h-full ${level === targets.length ? 'bg-green-500' : 'bg-orange-500'}`} 
          style={{ width: `${Math.min(progress, 100)}%` }} 
        />
      </View>
    </View>
  );
}
