import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
// Import the global authentication state manager
import { AuthProvider, useAuth } from './src/context/AuthContext';

// Import your actual, living UI screen components
import LoginScreen from './src/screens/LoginScreen';
import ElderlyDashboard from './src/screens/Elderly/ElderlyDashboard.js';
import CaregiverDashboard from './src/screens/caregiver/CaregiverDashboard.js';

function RootNavigation() {
  // Pull real-time session tokens and database roles from custom context hook
  const { user, profile, loading } = useAuth();

  // 1. Loading State: Display native spinner while checking session tokens on boot
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  // 2. Unauthenticated Gate: No user session found -> Force sign-in pipeline
  if (!user) {
    return <LoginScreen />;
  }

  // 3. Declarative Router Switches based on checked PostgreSQL profile constraints
  if (profile?.role === 'elderly') {
    return <ElderlyDashboard />;
  }

  if (profile?.role === 'caregiver') {
    return <CaregiverDashboard />;
  }

  // 4. Fallback Safety Gate: Authenticated but profile database row creation is lagging
  return (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color="#4CAF50" />
    </View>
  );
}

export default function App() {
  return (
    // Wrap the entire workspace execution context inside the active state context
    <AuthProvider>
      <RootNavigation />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
});