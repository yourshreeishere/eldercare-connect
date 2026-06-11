import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// Replace these strings with your actual Supabase dashboard keys!
const supabaseUrl = 'https://qlppjmgjzrpvnvcajhqn.supabase.co'; 
const supabaseAnonKey = 'sb_publishable_Kj2SvLeabJWqoyts90UO_w_zUH_ppPu';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);