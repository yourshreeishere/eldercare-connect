import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import BigButton from "../components/BigButton";
import useRealtimeRefresh from "../hooks/useRealtimeRefresh";
import { COLORS, FONT, SPACING, RADIUS, TAP } from "../constants/theme";

export default function ElderlyHome() {
  const { familyId, profile, signOut, refreshProfile } = useAuth();
  const [meds, setMeds] = useState([]);
  const [loadingMeds, setLoadingMeds] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [sosBusy, setSosBusy] = useState(false);

  const profileId = profile ? profile.id : null;

  const loadMeds = useCallback(async () => {
    if (!familyId) {
      setMeds([]);
      setLoadingMeds(false);
      return;
    }

    const { data, error } = await supabase
      .from("medication_logs")
      .select("id, med_name, status, updated_at")
      .eq("family_id", familyId)
      .order("updated_at", { ascending: true });

    if (error) {
      console.log("Error loading meds:", error.message);
      setMeds([]);
    } else {
      setMeds(data);
    }
    setLoadingMeds(false);
  }, [familyId]);

  useEffect(() => {
    loadMeds();
  }, [loadMeds]);

  useRealtimeRefresh({
    channelName: `elderly-${profileId}`,
    enabled: Boolean(familyId && profileId),
    subscriptions: [
      { table: "medication_logs", filter: `family_id=eq.${familyId}` },
      { table: "profiles", filter: `id=eq.${profileId}` },
    ],
    onChange: async () => {
      await refreshProfile();
      await loadMeds();
    },
  });

  async function onRefresh() {
    setRefreshing(true);
    await refreshProfile();
    await loadMeds();
    setRefreshing(false);
  }

  async function markTaken(medId) {
    setUpdatingId(medId);

    const { error } = await supabase
      .from("medication_logs")
      .update({ status: "taken", updated_at: new Date().toISOString() })
      .eq("id", medId);

    setUpdatingId(null);

    if (error) {
      Alert.alert("Could not save", "Please try again.");
      return;
    }
    loadMeds();
  }

  async function triggerSOS() {
    Alert.alert(
      "Send emergency alert?",
      "Your caregiver will be notified right away.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, send alert",
          style: "destructive",
          onPress: async () => {
            setSosBusy(true);
            const { error } = await supabase
              .from("profiles")
              .update({ is_emergency: true })
              .eq("id", profile.id);
            setSosBusy(false);

            if (error) {
              Alert.alert("Alert failed", "Please call your caregiver directly.");
              return;
            }
            await refreshProfile();
            Alert.alert("Alert sent", "Your caregiver has been notified.");
          },
        },
      ]
    );
  }

  async function cancelSOS() {
    setSosBusy(true);
    await supabase
      .from("profiles")
      .update({ is_emergency: false })
      .eq("id", profile.id);
    setSosBusy(false);
    await refreshProfile();
  }

  const emergencyActive = profile ? profile.is_emergency : false;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.greeting}>Hello</Text>
        <Text style={styles.subGreeting}>Here are your medicines today.</Text>

        {emergencyActive && (
          <View style={styles.emergencyBanner}>
            <Text style={styles.emergencyBannerText}>
              Emergency alert is active. Your caregiver has been told.
            </Text>
          </View>
        )}

        {loadingMeds && <Text style={styles.infoText}>Loading your medicines...</Text>}

        {!loadingMeds && !familyId && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Not connected yet</Text>
            <Text style={styles.cardBody}>
              Ask your caregiver to add you to their family group.
            </Text>
          </View>
        )}

        {!loadingMeds && familyId && meds.length === 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No medicines listed</Text>
            <Text style={styles.cardBody}>
              Your caregiver has not added any medicines yet.
            </Text>
          </View>
        )}

        {meds.map((med) => {
          const taken = med.status === "taken";
          return (
            <View key={med.id} style={styles.medCard}>
              <Text style={styles.medName}>{med.med_name}</Text>
              <View
                style={[
                  styles.statusPill,
                  taken ? styles.statusPillTaken : styles.statusPillPending,
                ]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    taken ? styles.statusTextTaken : styles.statusTextPending,
                  ]}
                >
                  {taken ? "Taken" : "Not taken yet"}
                </Text>
              </View>

              {!taken && (
                <BigButton
                  label="I took this"
                  variant="success"
                  loading={updatingId === med.id}
                  onPress={() => markTaken(med.id)}
                />
              )}
            </View>
          );
        })}

        <View style={styles.sosSection}>
          {emergencyActive ? (
            <BigButton
              label="Cancel emergency alert"
              variant="neutral"
              loading={sosBusy}
              onPress={cancelSOS}
              height={TAP.minHeight}
            />
          ) : (
            <BigButton
              label="EMERGENCY"
              variant="danger"
              loading={sosBusy}
              onPress={triggerSOS}
              height={TAP.sosHeight}
            />
          )}
        </View>

        <View style={styles.signOutSection}>
          <BigButton label="Sign out" variant="neutral" onPress={signOut} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: SPACING.xl },
  greeting: { fontSize: FONT.huge, fontWeight: "800", color: COLORS.text },
  subGreeting: {
    fontSize: FONT.body,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  emergencyBanner: {
    backgroundColor: COLORS.dangerLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.danger,
  },
  emergencyBannerText: {
    fontSize: FONT.label,
    color: COLORS.danger,
    fontWeight: "700",
  },
  infoText: {
    fontSize: FONT.body,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  cardTitle: {
    fontSize: FONT.heading,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  cardBody: { fontSize: FONT.body, color: COLORS.textMuted },
  medCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  medName: {
    fontSize: FONT.title,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  statusPillTaken: { backgroundColor: COLORS.successLight },
  statusPillPending: { backgroundColor: COLORS.warningLight },
  statusPillText: { fontSize: FONT.label, fontWeight: "700" },
  statusTextTaken: { color: COLORS.success },
  statusTextPending: { color: COLORS.warning },
  sosSection: { marginTop: SPACING.lg },
  signOutSection: { marginTop: SPACING.xl },
});