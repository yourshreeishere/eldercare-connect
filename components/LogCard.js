import { View, Text, StyleSheet } from "react-native";
import { COLORS, FONT, SPACING, RADIUS } from "../constants/theme";

export default function LogCard({ medName, status, updatedAt }) {
  const taken = status === "taken";
  const time = updatedAt
    ? new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.medName}>{medName}</Text>
        <View style={[styles.pill, taken ? styles.pillTaken : styles.pillPending]}>
          <Text style={[styles.pillText, taken ? styles.textTaken : styles.textPending]}>
            {taken ? "Taken" : "Pending"}
          </Text>
        </View>
      </View>
      {!!time && <Text style={styles.time}>Last updated {time}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  medName: { fontSize: FONT.label, fontWeight: "700", color: COLORS.text },
  pill: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.md },
  pillTaken: { backgroundColor: COLORS.successLight },
  pillPending: { backgroundColor: COLORS.warningLight },
  pillText: { fontSize: FONT.small, fontWeight: "700" },
  textTaken: { color: COLORS.success },
  textPending: { color: COLORS.warning },
  time: { fontSize: FONT.small, color: COLORS.textMuted, marginTop: SPACING.xs },
});