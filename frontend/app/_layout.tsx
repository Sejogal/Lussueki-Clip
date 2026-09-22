import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// Regex simples só pra pegar erros óbvios de digitação (sem @, sem domínio)
// — não tenta validar e-mail de forma exaustiva, isso é trabalho do backend.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthScreen() {
  const router = useRouter();
  const { session, isLoading, signIn, signOut, signUp } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Refs pra permitir pular de campo em campo pelo teclado (botão
  // "Próximo"/"Concluir"), em vez do usuário ter que tocar em cada input.
  const nameInputRef = useRef<TextInput>(null);
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  // Validação local antes de gastar uma chamada de rede — pega os erros
  // mais comuns (campo vazio, e-mail claramente inválido, senha curta)
  // na hora, sem esperar o backend responder.
  const validate = (): string | null => {
    if (isRegistering && !name.trim()) {
      return 'Informe seu nome.';
    }
    if (!email.trim()) {
      return 'Informe seu e-mail.';
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      return 'Informe um e-mail válido.';
    }
    if (!password) {
      return 'Informe sua senha.';
    }
    if (isRegistering && password.length < 8) {
      return 'A senha deve ter ao menos 8 caracteres.';
    }
    return null;
  };

  const submit = async () => {
    const validationError = validate();
    if (validationError) {
      Alert.alert('Verifique os dados', validationError);
      return;
    }

    setSubmitting(true);
    try {
      if (isRegistering) {
        await signUp(name.trim(), email.trim(), password);
      } else {
        await signIn(email.trim(), password);
      }
      router.back();
    } catch (error) {
      Alert.alert('Não foi possível entrar', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color="#e50914" /></View>;
  }

  if (session) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Sua conta</Text>
          <Text style={styles.subtitle}>{session.user.name}</Text>
          <Text style={styles.email}>{session.user.email}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.back()}>
            <Text style={styles.primaryButtonText}>Continuar assistindo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => void signOut()}>
            <Text style={styles.secondaryButtonText}>Sair</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <Text style={styles.title}>{isRegistering ? 'Criar conta' : 'Entrar'}</Text>
            <Text style={styles.subtitle}>Entre para manter seu histórico de reprodução.</Text>

            {isRegistering && (
              <TextInput
                ref={nameInputRef}
                style={styles.input}
                placeholder="Nome"
                placeholderTextColor="#8e8e93"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                returnKeyType="next"
                editable={!submitting}
                onSubmitEditing={() => emailInputRef.current?.focus()}
              />
            )}

            <TextInput
              ref={emailInputRef}
              style={styles.input}
              placeholder="E-mail"
              placeholderTextColor="#8e8e93"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              editable={!submitting}
              onSubmitEditing={() => passwordInputRef.current?.focus()}
            />

            <View style={styles.passwordWrapper}>
              <TextInput
                ref={passwordInputRef}
                style={styles.passwordInput}
                placeholder="Senha"
                placeholderTextColor="#8e8e93"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete={isRegistering ? 'password-new' : 'password'}
                textContentType={isRegistering ? 'newPassword' : 'password'}
                returnKeyType="done"
                editable={!submitting}
                onSubmitEditing={() => void submit()}
              />
              <TouchableOpacity
                style={styles.passwordToggle}
                onPress={() => setShowPassword((value) => !value)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.passwordToggleText}>{showPassword ? 'Ocultar' : 'Mostrar'}</Text>
              </TouchableOpacity>
            </View>

            {isRegistering && <Text style={styles.hint}>A senha deve ter ao menos 8 caracteres.</Text>}

            <TouchableOpacity
              disabled={submitting}
              style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
              onPress={() => void submit()}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>{isRegistering ? 'Criar conta' : 'Entrar'}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              disabled={submitting}
              onPress={() => {
                setIsRegistering((value) => !value);
                setShowPassword(false);
              }}
            >
              <Text style={styles.switchText}>{isRegistering ? 'Já tenho uma conta' : 'Criar uma conta'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backText}>Voltar</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  content: { padding: 24 },
  title: { color: '#fff', fontSize: 30, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: '#b0b0b5', fontSize: 15, lineHeight: 21, marginBottom: 28 },
  email: { color: '#8e8e93', fontSize: 15, marginBottom: 28 },
  input: { color: '#fff', backgroundColor: '#1c1c1e', borderRadius: 10, paddingHorizontal: 14, height: 52, fontSize: 16, marginBottom: 12 },
  passwordWrapper: { position: 'relative', justifyContent: 'center', marginBottom: 12 },
  passwordInput: {
    color: '#fff',
    backgroundColor: '#1c1c1e',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingRight: 72,
    height: 52,
    fontSize: 16,
  },
  passwordToggle: { position: 'absolute', right: 14, height: 52, justifyContent: 'center' },
  passwordToggleText: { color: '#ff6b6b', fontSize: 13, fontWeight: '700' },
  hint: { color: '#8e8e93', fontSize: 12, marginTop: -4, marginBottom: 16 },
  primaryButton: { backgroundColor: '#e50914', borderRadius: 10, minHeight: 52, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  primaryButtonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secondaryButton: { alignItems: 'center', marginTop: 22 },
  secondaryButtonText: { color: '#ff6b6b', fontSize: 15, fontWeight: '700' },
  switchText: { color: '#fff', textAlign: 'center', fontSize: 15, fontWeight: '700', marginTop: 20 },
  backButton: { alignItems: 'center', marginTop: 28 },
  backText: { color: '#8e8e93', fontSize: 14 },
});