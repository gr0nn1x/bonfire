import type { PropsWithChildren } from "react";
import { SafeAreaView, ScrollView, View } from "react-native";

export function ScreenContainer({ children }: PropsWithChildren) {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 24 }}
      >
        <View className="gap-6">{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}
