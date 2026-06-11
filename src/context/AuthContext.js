import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../config/supabaseClient';

// 1. Initialize the Context
const AuthContext = createContext({});

// 2. Create the Provider Component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session on app launch
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      }
      setLoading(false);
    };

    getSession();

    // 3. Set up the Real-Time Auth State Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    // Clean up subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Helper function to pull custom DB profile roles
  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('family_id, role')
        .eq('id', userId)
        .single();

      if (data) setProfile(data);
      if (error) console.error("Error fetching profile:", error.message);
    } catch (err) {
      console.error("Profile fetch exception:", err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// 4. Custom Hook for easy consumption
export const useAuth = () => useContext(AuthContext);