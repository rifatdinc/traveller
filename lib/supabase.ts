import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Supabase projesi oluşturduğunuzda almış olduğunuz anahtarlar
// Bu değerleri bir .env dosyasına taşımayı düşünebilirsiniz
const supabaseUrl = 'https://awmpexifuqiieiprygyh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3bXBleGlmdXFpaWVpcHJ5Z3loIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ5NjYyMjUsImV4cCI6MjA2MDU0MjIyNX0.6QYclsl-1lvMghiFjTJkEvvr1N2kCMzNCRgILZ02x1s';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
