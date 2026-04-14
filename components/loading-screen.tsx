import { ActivityIndicator, Text, View } from "react-native";

export function LoadingScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <ActivityIndicator size="large" color="#f97316" />
      <Text className="mt-4 text-center text-sm text-muted">
        Kontroluji session a pripravuji appku...
      </Text>
    </View>
  );
}
