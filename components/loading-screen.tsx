import { ActivityIndicator, Text, View } from "react-native";
import { useLanguage } from "@/hooks/useLanguage";

export function LoadingScreen() {
  const { language } = useLanguage();

  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <ActivityIndicator size="large" color="#f97316" />
      <Text className="mt-4 text-center text-sm text-muted">
        {language === "cs"
          ? "Kontroluji session a pripravuji appku..."
          : "Checking your session and preparing the app..."}
      </Text>
    </View>
  );
}
