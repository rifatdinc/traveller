import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  Image, 
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Animated,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome5 } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedText } from '@/components/ThemedText';
import { THEME } from '@/constants/Theme';
import { useAuth } from '@/hooks/useAuth';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [secureTextEntry, setSecureTextEntry] = useState(true);
  const { signIn, user } = useAuth();
  
  // Animasyon değerleri
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const logoScale = useRef(new Animated.Value(1)).current;

  // Eğer kullanıcı zaten giriş yapmışsa ana sayfaya yönlendir
  useEffect(() => {
    if (user) {
      router.replace('/(tabs)');
    }
  }, [user]);

  // Sayfa yüklendiğinde animasyon başlat
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      })
    ]).start();

    // Klavye olayları için dinleyiciler
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        Animated.timing(logoScale, {
          toValue: 0.8,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    );

    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Hata', 'E-posta ve şifre gereklidir.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        let errorMessage = error.message;
        
        // Kullanıcı dostu hata mesajları
        if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Geçersiz e-posta veya şifre.';
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = 'E-posta adresinizi onaylamanız gerekiyor. Lütfen e-postanızı kontrol edin.';
        }
        
        Alert.alert('Giriş Hatası', errorMessage);
      } else {
        // Başarılı giriş, ana ekrana yönlendir
        router.replace('/(tabs)');
      }
    } catch (error) {
      Alert.alert('Bir hata oluştu', 'Lütfen tekrar deneyin.');
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    if (!email) {
      Alert.alert('Hata', 'Şifre sıfırlama e-postası almak için e-posta adresinizi girin.');
      return;
    }
    // Şifre sıfırlama işlemi
    Alert.alert(
      'Şifre Sıfırlama', 
      `${email} adresine şifre sıfırlama bağlantısı gönderilecek.`,
      [
        { 
          text: 'İptal', 
          style: 'cancel' 
        },
        { 
          text: 'Gönder', 
          onPress: async () => {
            try {
              setIsLoading(true);
              const { error } = await useAuth().resetPassword(email);
              if (error) {
                Alert.alert('Hata', error.message);
              } else {
                Alert.alert(
                  'E-posta Gönderildi', 
                  'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.'
                );
              }
            } catch (error) {
              Alert.alert('Hata', 'Bir şeyler yanlış gitti. Lütfen tekrar deneyin.');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const toggleSecureTextEntry = () => {
    setSecureTextEntry(!secureTextEntry);
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.container}
      >
        <StatusBar style="light" />
        
        <LinearGradient
          colors={[THEME.COLORS.primary, '#0055a3']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBackground}
        />

        <View style={styles.overlay}>
          <Animated.View 
            style={[
              styles.logoContainer, 
              { 
                opacity: fadeAnim,
                transform: [
                  { translateY: slideAnim },
                  { scale: logoScale }
                ] 
              }
            ]}
          >
            <Image
              source={require('@/assets/images/icon.png')} // Uygulama ikonunuzu buraya ekleyin
              style={styles.logo}
              contentFit="contain" // resizeMode değiştirildi
            />
            <ThemedText style={styles.appTitle}>TravelPoints</ThemedText>
            <ThemedText style={styles.appSlogan}>Yeni yerler keşfet, anılar biriktir</ThemedText>
          </Animated.View>
          
          <Animated.View 
            style={[
              styles.formCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <ThemedText style={styles.formTitle}>Giriş Yap</ThemedText>
            
            <View style={styles.inputWrapper}>
              <View style={styles.inputContainer}>
                <FontAwesome5 name="envelope" size={20} color={THEME.COLORS.primary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="E-posta"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor={THEME.COLORS.gray}
                />
              </View>
            </View>
            
            <View style={styles.inputWrapper}>
              <View style={styles.inputContainer}>
                <FontAwesome5 name="lock" size={20} color={THEME.COLORS.primary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Şifre"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={secureTextEntry}
                  placeholderTextColor={THEME.COLORS.gray}
                />
                <TouchableOpacity onPress={toggleSecureTextEntry} style={styles.eyeIcon}>
                  <FontAwesome5 
                    name={secureTextEntry ? "eye" : "eye-slash"} 
                    size={18} 
                    color={THEME.COLORS.gray} 
                  />
                </TouchableOpacity>
              </View>
            </View>
            
            <TouchableOpacity 
              style={styles.forgotPassword} 
              onPress={handleForgotPassword}
            >
              <ThemedText style={styles.forgotPasswordText}>Şifremi Unuttum?</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.loginButton}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <FontAwesome5 name="sign-in-alt" size={18} color="#FFFFFF" style={styles.buttonIcon} />
                  <ThemedText style={styles.buttonText}>Giriş Yap</ThemedText>
                </>
              )}
            </TouchableOpacity>
            
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <ThemedText style={styles.dividerText}>veya</ThemedText>
              <View style={styles.dividerLine} />
            </View>
            
            <View style={styles.socialButtonsContainer}>
              <TouchableOpacity 
                style={[styles.socialButton, { backgroundColor: '#4267B2' }]}
                activeOpacity={0.8}
              >
                <FontAwesome5 name="facebook-f" size={18} color="#FFFFFF" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.socialButton, { backgroundColor: '#DB4437' }]}
                activeOpacity={0.8}
              >
                <FontAwesome5 name="google" size={18} color="#FFFFFF" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.socialButton, { backgroundColor: '#000000' }]}
                activeOpacity={0.8}
              >
                <FontAwesome5 name="apple" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.footer}>
              <ThemedText style={styles.footerText}>Hesabınız yok mu?</ThemedText>
              <TouchableOpacity onPress={() => router.replace('/auth/register')}>
                <ThemedText style={styles.footerLink}>Kayıt Ol</ThemedText>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: height * 0.5,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 10,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 5,
  },
  appSlogan: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  formCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: THEME.COLORS.text,
  },
  inputWrapper: {
    marginBottom: 15,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 16,
    color: THEME.COLORS.text,
  },
  eyeIcon: {
    padding: 10,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: THEME.COLORS.primary,
    fontSize: 14,
  },
  loginButton: {
    backgroundColor: THEME.COLORS.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: THEME.COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  buttonIcon: {
    marginRight: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  dividerText: {
    marginHorizontal: 10,
    color: THEME.COLORS.gray,
    fontSize: 14,
  },
  socialButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  socialButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: THEME.COLORS.gray,
    marginRight: 5,
  },
  footerLink: {
    fontSize: 14,
    color: THEME.COLORS.primary,
    fontWeight: 'bold',
  },
});
