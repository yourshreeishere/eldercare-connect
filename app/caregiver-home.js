import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TextInput,
  Alert,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import BigButton from "../components/BigButton";
import LogCard from "../components/LogCard";
import { COLORS, FONT, SPACING, RADIUS } from "../constants/theme";

export default function CaregiverHome() {
  const { familyId, signOut } = useAuth();
  const [meds, setMeds] = useState([]);
  const [emergencyProfiles, setEmergencyProfiles] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newMedName, setNewMedName] = useState("");
  const [addingMed, setAddingMed] = useState(false);

  const loadData = useCallback(async () => {
    if (!familyId) {
      setLoadingData(false);
      return;
    }

    const [{ data: medData, error: medError }, { data: emergencyData, error: emergencyError }] =
      await Promise.all([
        supabase
          .from("medication_logs")
          .select("id, med_name, status, updated_at")
          .eq("family_id", familyId)
          .order("updated_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("id")
          .eq("family_id", familyId)
          .eq("role", "elderly")
          .eq("is_emergency", true),
      ]);

    if (medError) console.log("Error loading meds:", medError.message);
    if (emergencyError) console.log("Error loading emergency status:", emergencyError.message);

    setMeds(medData || []);
    setEmergencyProfiles(emergencyData || []);
    setLoadingData(false);
  }, [familyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  async function addMedication() {
    if (!newMedName.trim()) {
      Alert.alert("Missing info", "Please enter a medication name.");
      return;
    }

    setAddingMed(true);
    const { error } = await supabase.from("medication_logs").insert({
      family_id: familyId,
      med_name: newMedName.trim(),
      status: "pending",
      updated_at: new Date().toISOString(),
    });
    setAddingMed(false);

    if (error) {
      Alert.alert("Could not add medication", error.message);
      return;
    }

    setNewMedName("");
    loadData();
  }

  const hasEmergency = emergencyProfiles.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.heading}>Caregiver Dashboard</Text>

        {hasEmergency && (
          <View style={styles.emergencyBanner}>
            <Text style={styles.emergencyBannerText}>
              🚨 Emergency alert active for {emergencyProfiles.length} family member(s).
            </Text>
          </View>
        )}

        {!loadingData && familyId && (
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>Your family code</Text>
            <Text style={styles.codeValue} selectable>{familyId}</Text>
            <Text style={styles.codeHint}>
              Share this with the elderly person you're caring for — they'll enter it during signup.
            </Text>
          </View>
        )}

        <View style={styles.addCard}>
          <Text style={styles.sectionTitle}>Add a medication</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Blood pressure tablet"
            placeholderTextColor="#999"
            value={newMedName}
            onChangeText={setNewMedName}
          />
          <BigButton
            label="Add medication"
            variant="primary"
            loading={addingMed}
            onPress={addMedication}
            height={56}
          />
        </View>

        <Text style={styles.sectionTitle}>Medication status</Text>

        {loadingData && <Text style={styles.infoText}>Loading...</Text>}

        {!loadingData && meds.length === 0 && (
          <Text style={styles.infoText}>No medications added yet.</Text>
        )}

        {meds.map((med) => (
          <LogCard
            key={med.id}
            medName={med.med_name}
            status={med.status}
            updatedAt={med.updated_at}
          />
        ))}

        <View style={styles.signOutSection}>
          <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: SPACING.xl },
  heading: { fontSize: FONT.title, fontWeight: "800", color: COLORS.text, marginBottom: SPACING.md },
  emergencyBanner: { backgroundColor: COLORS.dangerLight, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 2, borderColor: COLORS.danger },
  emergencyBannerText: { fontSize: FONT.label, color: COLORS.danger, fontWeight: "700" },
  codeCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md },
  codeLabel: { fontSize: FONT.small, color: COLORS.textMuted, fontWeight: "600" },
  codeValue: { fontSize: FONT.small, color: COLORS.primary, marginTop: 4, fontWeight: "700" },
  codeHint: { fontSize: FONT.small, color: COLORS.textMuted, marginTop: SPACING.xs },
  addCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.lg },
  sectionTitle: { fontSize: FONT.heading, fontWeight: "700", color: COLORS.text, marginBottom: SPACING.sm },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm, fontSize: FONT.small, marginBottom: SPACING.sm, backgroundColor: COLORS.white },
  infoText: { fontSize: FONT.small, color: COLORS.textMuted, marginBottom: SPACING.md },
  signOutSection: { marginTop: SPACING.lg, alignItems: "center" },
  signOutButton: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg },
  signOutText: { color: COLORS.danger, fontWeight: "700", fontSize: FONT.small },
});