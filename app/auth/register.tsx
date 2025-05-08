import React, { useState } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, ActivityIndicator, Image, Alert, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome5 } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { THEME } from '@/constants/Theme';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

export default function RegisterScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signUp } = useAuth();

  const handleRegister = async () => {
    // Validation
    if (!username || !email || !password || !passwordConfirm) {
      Alert.alert('Hata', 'Lütfen tüm alanları doldurun.');
      return;
    }

    if (password !== passwordConfirm) {
      Alert.alert('Hata', 'Şifreler eşleşmiyor.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Hata', 'Şifreniz en az 6 karakter uzunluğunda olmalıdır.');
      return;
    }

    // Kullanıcı adının benzersiz olup olmadığını kontrol et
    try {
      const { data: existingUsers, error: usernameError } = await supabase
        .from('users')
        .select('username')
        .eq('username', username)
        .limit(1);

      if (usernameError) throw usernameError;

      if (existingUsers && existingUsers.length > 0) {
        Alert.alert('Hata', 'Bu kullanıcı adı zaten kullanılıyor.');
        return;
      }
    } catch (error) {
      console.error('Kullanıcı adı kontrolü hatası:', error);
      Alert.alert('Hata', 'Kullanıcı kontrolü yapılırken bir sorun oluştu.');
      return;
    }

    setIsLoading(true);
    try {
      // Supabase auth kaydı
      const { error } = await signUp(email, password);
      
      if (error) {
        Alert.alert('Kayıt Hatası', error.message);
        return;
      }
      
      // Profil bilgilerini veritabanına ekle
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        throw userError;
      }
      
      if (userData && userData.user) {
        // Kullanıcı için varsayılan avatar oluştur
        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random&color=fff&size=256`;
        
        // Kullanıcı profilini oluştur
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: userData.user.id,
            username: username,
            email: email,
            avatar: avatarUrl,
            total_points: 0,
            level: 'Yeni Gezgin',
            visited_places: 0,
            created_at: new Date().toISOString()
          });
        
        if (profileError) {
          throw profileError;
        }
        
        // Ensure the profile record is created as well
        await supabase.rpc('get_or_create_user', {
          p_user_id: userData.user.id,
          p_email: email,
          p_username: username
        });
        
        Alert.alert(
          'Kayıt Başarılı', 
          'Hesabınız başarıyla oluşturuldu. Email adresinizi onayladıktan sonra giriş yapabilirsiniz.',
          [{ text: 'Giriş Yap', onPress: () => router.replace('/auth/login') }]
        );
      }
    } catch (error) {
      console.error('Registration error:', error);
      Alert.alert('Kayıt Hatası', 'Bir hata oluştu, lütfen tekrar deneyin.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Image
            source={require('@/assets/images/icon.png')} // Uygulama ikonunuzu buraya ekleyin
            style={styles.logo}
            contentFit="contain" // resizeMode değiştirildi
          />
        </View>
        <ThemedText style={styles.headerTitle}>TravelPoints</ThemedText>
        <ThemedText style={styles.headerSubtitle}>Yeni Hesap Oluştur</ThemedText>
      </View>
      
      <ScrollView 
        style={styles.formContainer}
        contentContainerStyle={styles.formContent}
        showsVerticalScrollIndicator={false}
      >
        <ThemedView style={styles.inputContainer}>
          <FontAwesome5 name="user" size={20} color={THEME.COLORS.gray} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Kullanıcı Adı"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            placeholderTextColor={THEME.COLORS.gray}
          />
        </ThemedView>
        
        <ThemedView style={styles.inputContainer}>
          <FontAwesome5 name="envelope" size={20} color={THEME.COLORS.gray} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="E-posta"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={THEME.COLORS.gray}
          />
        </ThemedView>
        
        <ThemedView style={styles.inputContainer}>
          <FontAwesome5 name="lock" size={20} color={THEME.COLORS.gray} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Şifre"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor={THEME.COLORS.gray}
          />
        </ThemedView>
        
        <ThemedView style={styles.inputContainer}>
          <FontAwesome5 name="lock" size={20} color={THEME.COLORS.gray} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Şifre Tekrar"
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
            secureTextEntry
            placeholderTextColor={THEME.COLORS.gray}
          />
        </ThemedView>
        
        <TouchableOpacity 
          style={styles.button}
          onPress={handleRegister}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <ThemedText style={styles.buttonText}>Kayıt Ol</ThemedText>
          )}
        </TouchableOpacity>
        
        <View style={styles.footer}>
          <ThemedText style={styles.footerText}>Zaten bir hesabınız var mı?</ThemedText>
          <TouchableOpacity onPress={() => router.replace('/auth/login')}>
            <ThemedText style={styles.footerLink}>Giriş Yap</ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.COLORS.background,
  },
  header: {
    backgroundColor: THEME.COLORS.primary,
    paddingTop: 60,
    paddingBottom: 30,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  logoContainer: {
    width: 80,
    height: 80,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  logo: {
    width: 50,
    height: 50,
  },
  headerTitle: {
    color: THEME.COLORS.light,
    fontSize: THEME.SIZES.xxlarge,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  headerSubtitle: {
    color: THEME.COLORS.light,
    fontSize: THEME.SIZES.medium,
    opacity: 0.9,
  },
  formContainer: {
    flex: 1,
  },
  formContent: {
    padding: 20,
    paddingTop: 30,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    marginBottom: 15,
    paddingHorizontal: 15,
    paddingVertical: 5,
    backgroundColor: THEME.COLORS.card,
    ...THEME.SHADOWS.small,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    fontSize: THEME.SIZES.medium,
    color: THEME.COLORS.text,
  },
  button: {
    backgroundColor: THEME.COLORS.primary,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    ...THEME.SHADOWS.small,
  },
  buttonText: {
    color: THEME.COLORS.light,
    fontSize: THEME.SIZES.medium,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    paddingBottom: 20,
  },
  footerText: {
    fontSize: THEME.SIZES.small,
    marginRight: 5,
  },
  footerLink: {
    fontSize: THEME.SIZES.small,
    color: THEME.COLORS.primary,
    fontWeight: 'bold',
  },
});
