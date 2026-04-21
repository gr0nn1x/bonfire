import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useLanguage } from "@/hooks/useLanguage";

interface RestTimerProps {
  isVisible: boolean;
  duration: number; // výchozí čas z index.tsx
  onClose: () => void;
}

export function RestTimer({ isVisible, duration, onClose }: RestTimerProps) {
  const { language } = useLanguage();
  const isCs = language === "cs";
  const [timeLeft, setTimeLeft] = useState(duration);
  const presets = [30, 60, 90, 120, 150, 180];

  // Resetovat čas na výchozí, když se timer otevře zvenčí
  useEffect(() => {
    if (isVisible) setTimeLeft(duration);
  }, [isVisible]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isVisible && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } 
    
    if (timeLeft === 0 && isVisible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    return () => clearInterval(interval);
  }, [isVisible, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const adjustTime = (seconds: number) => {
    setTimeLeft(prev => Math.max(0, prev + seconds));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <Modal visible={isVisible} transparent={true} animationType="fade">
      <View className="flex-1 bg-black/70 items-center justify-center p-6">
        
        <View className="bg-slate-800 border-2 border-orange-500 rounded-[40px] p-6 w-full shadow-2xl items-center">
          <Text className="text-orange-500 font-bold uppercase tracking-[3px] mb-4 text-xs">{isCs ? "Pauza mezi sériemi" : "Rest between sets"}</Text>
          
          {/* HLAVNÍ ČAS A OVLÁDÁNÍ +/- */}
          <View className="flex-row items-center justify-between w-full mb-6">
            <TouchableOpacity 
              onPress={() => adjustTime(-15)}
              className="w-14 h-14 rounded-full bg-slate-700 items-center justify-center border border-slate-600"
            >
              <Text className="text-white text-2xl font-bold">-15</Text>
            </TouchableOpacity>

            <Text className={`text-7xl font-black ${timeLeft === 0 ? 'text-green-500' : 'text-white'}`}>
              {timeLeft === 0 ? (isCs ? "JDI!" : "GO!") : formatTime(timeLeft)}
            </Text>

            <TouchableOpacity 
              onPress={() => adjustTime(15)}
              className="w-14 h-14 rounded-full bg-slate-700 items-center justify-center border border-slate-600"
            >
              <Text className="text-white text-2xl font-bold">+15</Text>
            </TouchableOpacity>
          </View>

          {/* PRESETY (Mřížka nebo řada) */}
          <Text className="text-slate-500 font-bold uppercase text-[10px] mb-3">{isCs ? "Rychlé nastavení (sec)" : "Quick presets (sec)"}</Text>
          <View className="flex-row flex-wrap justify-center gap-2 mb-8">
            {presets.map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => {
                  setTimeLeft(s);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }}
                className={`px-4 py-2 rounded-xl border ${timeLeft === s ? 'bg-orange-500 border-orange-400' : 'bg-slate-900 border-slate-700'}`}
              >
                <Text className={`font-bold ${timeLeft === s ? 'text-white' : 'text-slate-400'}`}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* TLAČÍTKO ZAVŘÍT */}
          <TouchableOpacity 
            onPress={onClose}
            className="bg-orange-500 w-full h-16 rounded-3xl items-center justify-center shadow-lg"
          >
            <Text className="text-white font-black text-xl uppercase italic">{isCs ? "Hotovo / Zavřít" : "Done / Close"}</Text>
          </TouchableOpacity>
        </View>

      </View>
    </Modal>
  );
}
