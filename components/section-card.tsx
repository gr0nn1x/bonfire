import type { PropsWithChildren } from "react";
import { Text, View } from "react-native";

interface SectionCardProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
}

export function SectionCard({ title, subtitle, children }: SectionCardProps) {
  return (
    <View className="rounded-3xl border border-border bg-card p-5">
      <Text className="text-xl font-semibold text-text">{title}</Text>
      {subtitle ? (
        <Text className="mt-1 text-sm leading-5 text-muted">{subtitle}</Text>
      ) : null}
      <View className="mt-4 gap-4">{children}</View>
    </View>
  );
}
