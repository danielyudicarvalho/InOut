import { Image, View, StyleSheet } from "react-native";
/** Shared local artwork with a single accessible name. */
export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <View
      style={compact ? s.compact : s.full}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Ninho"
    >
      <Image
        source={require("../../assets/ninho-logo.png")}
        style={compact ? [s.image, s.symbol] : s.image}
        resizeMode="contain"
        accessible={false}
      />
    </View>
  );
}
const s = StyleSheet.create({
  full: {
    width: 170,
    height: 60,
    justifyContent: "center",
    overflow: "hidden",
  },
  compact: {
    width: 54,
    height: 60,
    justifyContent: "center",
    overflow: "hidden",
  },
  image: { width: 170, height: 70.82 },
  symbol: { marginLeft: -6 },
});
