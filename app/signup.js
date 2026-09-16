import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter, Link } from "expo-router";
import { supabase } from "../lib/supabase";

export default function SignupScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState(null);
  const [familyCode, setFamilyCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSignup() {
    if (!email || !password) {
      Alert.alert("Missing info", "Please enter an email and password.");
      return;
    }
    if (!selectedRole) {
      Alert.alert("Missing info", "Please select Caregiver or Elderly User.");
      return;
    }
    if (selectedRole === "elderly" && !familyCode.trim()) {
      Alert.alert("Missing info", "Please enter the family code your caregiver gave you.");
      return;
    }

    setSubmitting(true);

    let resolvedFamilyId = null;

    if (selectedRole === "elderly") {
      const { data: familyRow, error: familyLookupError } = await supabase
        .from("families")
        .select("id")
        .eq("id", familyCode.trim())
        .single();

      if (familyLookupError || !familyRow) {
        setSubmitting(false);
        Alert.alert(
          "Invalid family code",
          "We couldn't find a family with that code. Please check it and try again."
        );
        return;
      }
      resolvedFamilyId = familyRow.id;
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password,
    });

    if (error) {
      setSubmitting(false);
      Alert.alert("Signup failed", error.message);
      return;
    }

    const newUserId = data.user.id;

    if (selectedRole === "caregiver") {
      const { data: newFamily, error: createFamilyError } = await supabase
        .from("families")
        .insert({ name: `${email.trim()}'s Family` })
        .select("id")
        .single();

      if (createFamilyError) {
        setSubmitting(false);
        Alert.alert("Account created, but family setup failed", createFamilyError.message);
        return;
      }
      resolvedFamilyId = newFamily.id;
    }

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: newUserId,
      role: selectedRole,
      family_id: resolvedFamilyId,
    });

    setSubmitting(false);

    if (profileError) {
      Alert.alert("Account created, but profile setup failed", profileError.message);
      return;
    }

    Alert.alert(
      "Success",
      "Account created. Please check your email to confirm your account, then log in."
    );
    router.replace("/login");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Create Account</Text>

      <Text style={styles.label}>I am a:</Text>
      <View style={styles.roleRow}>
        <TouchableOpacity
          style={[styles.roleButton, selectedRole === "caregiver" && styles.roleButtonSelected]}
          onPress={() => setSelectedRole("caregiver")}
        >
          <Text style={[styles.roleButtonText, selectedRole === "caregiver" && styles.roleButtonTextSelected]}>
            Caregiver
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.roleButton, selectedRole === "elderly" && styles.roleButtonSelected]}
          onPress={() => setSelectedRole("elderly")}
        >
          <Text style={[styles.roleButtonText, selectedRole === "elderly" && styles.roleButtonTextSelected]}>
            Elderly User
          </Text>
        </TouchableOpacity>
      </View>

      {selectedRole === "elderly" && (
        <TextInput
          style={styles.input}
          placeholder="Family code (from your caregiver)"
          placeholderTextColor="#999"
          autoCapitalize="none"
          value={familyCode}
          onChangeText={setFamilyCode}
        />
      )}

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#999"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#999"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity style={styles.submitButton} onPress={handleSignup} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitButtonText}>Sign Up</Text>}
      </TouchableOpacity>

      <Link href="/login" style={styles.linkText}>
        Already have an account? Log in
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", paddingHorizontal: 24, backgroundColor: "#ffffff" },
  heading: { fontSize: 26, fontWeight: "bold", color: "#1a1a1a", marginBottom: 24, textAlign: "center" },
  label: { fontSize: 16, color: "#333333", marginBottom: 8 },
  roleRow: { flexDirection: "row", marginBottom: 20, gap: 12 },
  roleButton: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 2, borderColor: "#cccccc", alignItems: "center" },
  roleButtonSelected: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  roleButtonText: { fontSize: 15, fontWeight: "600", color: "#666666" },
  roleButtonTextSelected: { color: "#2563eb" },
  input: { borderWidth: 1, borderColor: "#cccccc", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, marginBottom: 14, color: "#1a1a1a" },
  submitButton: { backgroundColor: "#2563eb", borderRadius: 10, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  submitButtonText: { color: "#ffffff", fontSize: 16, fontWeight: "bold" },
  linkText: { marginTop: 20, textAlign: "center", color: "#2563eb", fontSize: 14 },
});