import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../../contexts/AuthContext'
import type { StackScreenProps } from '@react-navigation/stack'
import type { RootStackParamList } from '../../navigation/RootNavigator'

type Props = StackScreenProps<RootStackParamList, 'Login'>

export default function LoginScreen({ navigation }: Props) {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Veuillez remplir tous les champs.')
      return
    }
    setError('')
    setIsLoading(true)
    try {
      await login({ email: email.trim().toLowerCase(), password })
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Email ou mot de passe incorrect.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.bg}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Card */}
          <View style={styles.card}>
            {/* Back Button */}
            <TouchableOpacity 
              style={styles.backTopBtn} 
              onPress={() => navigation.navigate('Landing')}
            >
              <Text style={styles.backTopText}>← Retour</Text>
            </TouchableOpacity>

            {/* Logo */}
            <View style={styles.logoBox}>
              <Text style={styles.logoIcon}>🍽️</Text>
            </View>

            {/* Title */}
            <Text style={styles.title}>Connexion</Text>
            <Text style={styles.subtitle}>Accédez à votre espace RestauApp</Text>

            {/* Error */}
            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠ {error}</Text>
              </View>
            )}

            {/* Email field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>EMAIL</Text>
              <View style={styles.inputRow}>
                <Text style={styles.inputIcon}>✉</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="votre@email.com"
                  placeholderTextColor="#475569"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Password field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>MOT DE PASSE</Text>
              <View style={styles.inputRow}>
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#475569"
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(v => !v)}
                  style={styles.eyeBtn}
                >
                  <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Login button */}
            <TouchableOpacity
              style={[styles.btn, isLoading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Se connecter</Text>
              }
            </TouchableOpacity>

            {/* Forgot password */}
            <TouchableOpacity
              style={styles.forgotBtn}
              onPress={() => navigation.navigate('ForgotPassword')}
            >
              <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
            </TouchableOpacity>

            {/* Register link */}
            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Pas encore de compte ? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.footerLink}>S'inscrire</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: '#09090f',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    paddingVertical: 40,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#151821',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 10,
  },

  // Logo
  logoBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#c2410c',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  logoIcon: {
    fontSize: 26,
    color: '#fff',
  },
  backTopBtn: {
    position: 'absolute',
    top: 16,
    left: 16,
    padding: 8,
  },
  backTopText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
  },

  // Header
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#f1f5f9',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 24,
    textAlign: 'center',
  },

  // Error
  errorBox: {
    width: '100%',
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
  },

  // Fields
  fieldGroup: {
    width: '100%',
    marginBottom: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e2333',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 48,
  },
  inputIcon: {
    fontSize: 15,
    color: '#64748b',
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#f1f5f9',
    fontSize: 14,
    height: '100%',
  },
  eyeBtn: {
    padding: 6,
    marginLeft: 4,
  },
  eyeIcon: {
    fontSize: 16,
  },

  // Button
  btn: {
    width: '100%',
    backgroundColor: '#f97316',
    borderRadius: 10,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },

  // Footer
  forgotBtn: {
    marginTop: 14,
    marginBottom: 16,
  },
  forgotText: {
    color: '#f97316',
    fontSize: 13,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  footerLink: {
    color: '#f97316',
    fontSize: 13,
    fontWeight: '700',
  },
})
