import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { useLanguage } from "@/hooks/useLanguage";

interface PlateCalculatorProps {
  isVisible: boolean;
  targetWeight: number;
  onClose: () => void;
}

const PLATE_COLORS: { [key: number]: string } = {
  25: 'bg-red-600',
  20: 'bg-blue-600',
  15: 'bg-yellow-500',
  10: 'bg-green-600',
  5: 'bg-white',
  2.5: 'bg-black',
  1.25: 'bg-slate-400',
};

import { calculatePlates } from '@/lib/plates';

export function PlateCalculator({ isVisible, targetWeight, onClose }: PlateCalculatorProps) {
  const { language } = useLanguage();
  const isCs = language === "cs";
  const plates = calculatePlates(targetWeight);

  return (
    <Modal visible={isVisible} transparent animationType="fade">
      <View className="flex-1 bg-black/80 items-center justify-center p-6">
        <View className="bg-slate-800 border-2 border-orange-500 rounded-[40px] p-6 w-full items-center">
          <Text className="text-orange-500 font-bold uppercase mb-2">{isCs ? `Jak naložit ${targetWeight} kg` : `How to load ${targetWeight} kg`}</Text>
          <Text className="text-slate-400 text-[10px] mb-6">{isCs ? "Výpočet pro 20kg osu (na každou stranu)" : "Calculation for a 20 kg barbell (per side)"}</Text>

          {/* VIZUALIZACE OSY A KOTOUČŮ */}
          <View className="flex-row items-center justify-center h-48 mb-6 w-full bg-slate-900/50 rounded-3xl relative overflow-hidden">
            {/* Osa */}
            <View className="absolute h-4 w-full bg-slate-700 rounded-full" />
            
            {/* Výpis kotoučů od největšího po nejmenší */}
            <View className="flex-row items-center gap-1 z-10">
              {plates.length > 0 ? plates.map((p, i) => (
                <View 
                  key={i} 
                  className={`${PLATE_COLORS[p]} rounded-md items-center justify-center shadow-lg`}
                  style={{ 
                    width: p >= 10 ? 25 : 15, 
                    height: 60 + (p * 2), // Čím těžší kotouč, tím vyšší vizuálně
                    borderWidth: 1,
                    borderColor: 'rgba(0,0,0,0.2)'
                  }}
                >
                  <Text className={`font-bold text-[8px] ${p === 5 || p === 1.25 ? 'text-black' : 'text-white'}`}>
                    {p}
                  </Text>
                </View>
              )) : (
                <Text className="text-slate-500 italic">{isCs ? "Stačí prázdná osa" : "An empty bar is enough"}</Text>
              )}
            </View>
          </View>

          {/* DETAILNÍ SEZNAM */}
          <View className="w-full gap-2 mb-6">
            {plates.length > 0 && Array.from(new Set(plates)).map(p => (
              <View key={p} className="flex-row justify-between border-b border-slate-700 pb-1">
                <Text className="text-white font-bold">{p} kg {isCs ? "kotouč" : "plate"}</Text>
                <Text className="text-orange-500 font-bold">{plates.filter(x => x === p).length}x</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity onPress={onClose} className="bg-orange-500 w-full h-14 rounded-2xl items-center justify-center">
            <Text className="text-white font-black uppercase">{isCs ? "Rozumím" : "Got it"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
