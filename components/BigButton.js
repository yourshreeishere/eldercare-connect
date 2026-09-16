import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from "react-native";
import { COLORS, FONT, RADIUS, SPACING, TAP } from "../constants/theme";

export default function BigButton({
  label,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  height,
}) {
  const palette = {
    primary: { bg: COLORS.primary, fg: COLORS.white },
    success: { bg: COLORS.success, fg: COLORS.white },
    danger: { bg: COLORS.danger, fg: COLORS.white },
    neutral: { bg: COLORS.surface, fg: COLORS.text },
  }[variant];

  const isInactive = loading || disabled;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      disabled={isInactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.button,
        { backgroundColor: palette.bg, minHeight: height || TAP.minHeight },
        isInactive && styles.inactive,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} size="large" />
      ) : (
        <Text style={[styles.label, { color: palette.fg }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: "100%",
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  inactive: {
    opacity: 0.5,
  },
  label: {
    fontSize: FONT.body,
    fontWeight: "700",
    textAlign: "center",
  },
});