import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useLanguage } from "@/hooks/useLanguage";

// Standardní RTS RPE Tabulka (Reps 1-10, RPE 7-10) - hodnoty v %
const RPE_CHART: Record<number, number[]> = {
  10:  [100, 95.5, 92.2, 89.2, 86.3, 84.1, 81.1, 78.6, 76.5, 73.9],
  9.5: [97.8, 93.9, 90.7, 87.8, 85.0, 82.6, 79.9, 77.4, 75.1, 72.3],
  9:   [95.5, 92.2, 89.2, 86.3, 84.1, 81.1, 78.6, 76.5, 73.9, 70.7],
  8.5: [93.9, 90.7, 87.8, 85.0, 82.6, 79.9, 77.4, 75.1, 72.3, 69.4],
  8:   [92.2, 89.2, 86.3, 84.1, 81.1, 78.6, 76.5, 73.9, 70.7, 68.0],
  7.5: [90.7, 87.8, 85.0, 82.6, 79.9, 77.4, 75.1, 72.3, 69.4, 66.7],
  7:   [89.2, 86.3, 84.1, 81.1, 78.6, 76.5, 73.9, 70.7, 68.0, 65.3]
};

interface RpeCalculatorProps {
  isVisible: boolean;
  onClose: () => void;
}

export function RpeCalculator({ isVisible, onClose }: RpeCalculatorProps) {
  const { language } = useLanguage();
  const isCs = language === "cs";
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('5');
  const [rpe, setRpe] = useState('8');

  // Bezpečný převod vstupů
  const w = parseFloat(weight.replace(',', '.')) || 0;
  const r = parseInt(reps) || 0;
  const rp = parseFloat(rpe.replace(',', '.')) || 0;

  let e1RM = 0;
  let isValid = false;

  // Pokud jsme v rozmezí RTS tabulky (1-10 opakování, RPE 7-10)
  if (w > 0 && r >= 1 && r <= 10 && rp >= 7 && rp <= 10 && RPE_CHART[rp]) {
    const percentage = RPE_CHART[rp][r - 1]; // r-1 protože pole začíná na indexu 0
    if (percentage) {
      e1RM = w / (percentage / 100);
      isValid = true;
    }
  } else if (w > 0 && r > 0) {
    // Záložní výpočet (Epleyho rovnice), pokud jsme mimo tabulku
    e1RM = w * (1 + r / 30);
    isValid = true;
  }

  const rounded1RM = Math.round(e1RM * 2) / 2; // Zaokrouhlení na půlkila

  return (
    <Modal visible={isVisible} animationType="slide" transparent={true}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-end bg-slate-900/90">
        <View className="bg-slate-800 rounded-t-[32px] border-t border-slate-700 h-[85%]">
          
          <View className="p-5 flex-row justify-between items-center border-b border-slate-700">
            <Text className="text-white text-xl font-bold">{isCs ? "Silová & RPE Kalkulačka 🧮" : "Strength & RPE Calculator 🧮"}</Text>
            <TouchableOpacity onPress={onClose} className="bg-slate-700 h-8 w-8 rounded-full items-center justify-center">
              <Text className="text-white font-bold text-lg leading-none mb-1">×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView className="p-6" keyboardShouldPersistTaps="handled">
            <Text className="text-slate-400 mb-6 text-sm">{isCs ? "Zadej svůj nedávný těžký set. Aplikace ti spočítá odhadovanou maximálku (e1RM) a doporučí váhy pro další série." : "Enter a recent hard set. The app will estimate your e1RM and suggest weights for your next sets."}</Text>

            <View className="flex-row gap-4 mb-8">
              <View className="flex-1">
                <Text className="text-slate-500 font-bold uppercase text-[10px] mb-2 ml-1">{isCs ? "Váha (kg)" : "Weight (kg)"}</Text>
                <TextInput 
                  keyboardType="numeric" 
                  value={weight} 
                  onChangeText={setWeight} 
                  placeholder={isCs ? "Např. 100" : "E.g. 100"} 
                  placeholderTextColor="#475569"
                  className="bg-slate-900 text-white font-bold text-xl p-4 rounded-2xl border border-slate-700 text-center" 
                />
              </View>
              <View className="flex-1">
                <Text className="text-slate-500 font-bold uppercase text-[10px] mb-2 ml-1">{isCs ? "Opakování (1-10)" : "Reps (1-10)"}</Text>
                <TextInput 
                  keyboardType="numeric" 
                  value={reps} 
                  onChangeText={setReps} 
                  className="bg-slate-900 text-white font-bold text-xl p-4 rounded-2xl border border-slate-700 text-center" 
                />
              </View>
              <View className="flex-1">
                <Text className="text-slate-500 font-bold uppercase text-[10px] mb-2 ml-1">RPE (7-10)</Text>
                <TextInput 
                  keyboardType="numeric" 
                  value={rpe} 
                  onChangeText={setRpe} 
                  className="bg-slate-900 text-white font-bold text-xl p-4 rounded-2xl border border-slate-700 text-center" 
                />
              </View>
            </View>

            {isValid ? (
              <View>
                <View className="items-center bg-orange-500/10 p-6 rounded-[32px] border border-orange-500/30 mb-8">
                  <Text className="text-orange-500 font-bold uppercase tracking-widest text-xs mb-1">{isCs ? "Odhadovaná maximálka" : "Estimated 1RM"}</Text>
                  <Text className="text-white font-black text-5xl">{rounded1RM} <Text className="text-xl text-orange-400">kg</Text></Text>
                </View>

                <Text className="text-white font-bold text-lg mb-4">{isCs ? "Cílové váhy pro další trénink" : "Target weights for your next session"}</Text>
                <View className="bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden mb-10">
                  <View className="flex-row bg-slate-800 p-3 border-b border-slate-700">
                    <Text className="flex-1 text-slate-400 font-bold text-xs text-center">{isCs ? "Opak." : "Reps"}</Text>
                    <Text className="flex-1 text-slate-400 font-bold text-xs text-center">RPE 8</Text>
                    <Text className="flex-1 text-slate-400 font-bold text-xs text-center">RPE 9</Text>
                    <Text className="flex-1 text-orange-400 font-bold text-xs text-center">RPE 10</Text>
                  </View>
                  
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(rep => (
  <View key={rep} className="flex-row p-4 border-b border-slate-800 items-center">
    <Text className="flex-1 text-white font-bold text-center">{rep}x</Text>
                      <Text className="flex-1 text-slate-300 text-center font-semibold">{Math.round(e1RM * (RPE_CHART[8][rep - 1] / 100) * 2) / 2} kg</Text>
                      <Text className="flex-1 text-slate-300 text-center font-semibold">{Math.round(e1RM * (RPE_CHART[9][rep - 1] / 100) * 2) / 2} kg</Text>
                      <Text className="flex-1 text-orange-400 text-center font-bold">{Math.round(e1RM * (RPE_CHART[10][rep - 1] / 100) * 2) / 2} kg</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <View className="items-center p-8 opacity-50">
                <Text className="text-slate-400 text-center italic">{isCs ? "Zadej platné hodnoty do políček výše pro zobrazení tabulky." : "Enter valid values above to show the table."}</Text>
              </View>
            )}
          </ScrollView>

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
