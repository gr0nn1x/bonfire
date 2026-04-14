import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';

interface RestTimerProps {
  duration: number; // v sekundách
  onClose: () => void;
}

export function RestTimer({ duration, onClose }: RestTimerProps) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } 
    
    if (timeLeft === 0) {
      // Zavibruje jen jednou při dosažení nuly
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    // Odstraněno absolute pozicování - o to se postará rodič (index.tsx)
    <View className="bg-slate-800 border-2 border-orange-500 rounded-3xl p-5 shadow-2xl flex-row items-center justify-between">
      <View>
        <Text className="text-orange-500 font-bold text-xs uppercase tracking-widest">Odpočinek</Text>
        <Text className={`text-4xl font-black ${timeLeft === 0 ? 'text-green-500' : 'text-white'}`}>
          {timeLeft === 0 ? "JDI NA TO!" : formatTime(timeLeft)}
        </Text>
      </View>

      <View className="flex-row gap-3">
        {/* Tlačítko +15s */}
        <TouchableOpacity 
          onPress={() => setTimeLeft(prev => prev + 15)}
          className="bg-slate-700 w-12 h-12 rounded-full items-center justify-center border border-slate-600"
        >
          <Text className="text-white font-bold">+15s</Text>
        </TouchableOpacity>

        {/* Tlačítko Zavřít */}
        <TouchableOpacity 
          onPress={onClose}
          className="bg-orange-500 px-6 h-12 rounded-full items-center justify-center shadow-lg"
        >
          <Text className="text-white font-black uppercase text-xs">Hotovo</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}