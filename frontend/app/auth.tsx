import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function AuthScreen() {
  const router = useRouter();
  const { session, isLoading, signIn, signOut, signUp } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      if (isRegistering) {
        await signUp(name, email, password);
      } else {
        await signIn(email, password);
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
      <View style={styles.content}>
        <Text style={styles.title}>{isRegistering ? 'Criar conta' : 'Entrar'}</Text>
        <Text style={styles.subtitle}>Entre para manter seu histórico de reprodução.</Text>
        {isRegistering && (
          <TextInput
            style={styles.input}
            placeholder="Nome"
            placeholderTextColor="#8e8e93"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        )}
        <TextInput
          style={styles.input}
          placeholder="E-mail"
          placeholderTextColor="#8e8e93"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Senha"
          placeholderTextColor="#8e8e93"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />
        {isRegistering && <Text style={styles.hint}>A senha deve ter ao menos 8 caracteres.</Text>}
        <TouchableOpacity disabled={submitting} style={styles.primaryButton} onPress={() => void submit()}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{isRegistering ? 'Criar conta' : 'Entrar'}</Text>}
        </TouchableOpacity>
        <TouchableOpacity disabled={submitting} onPress={() => setIsRegistering((value) => !value)}>
          <Text style={styles.switchText}>{isRegistering ? 'Já tenho uma conta' : 'Criar uma conta'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  content: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { color: '#fff', fontSize: 30, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: '#b0b0b5', fontSize: 15, lineHeight: 21, marginBottom: 28 },
  email: { color: '#8e8e93', fontSize: 15, marginBottom: 28 },
  input: { color: '#fff', backgroundColor: '#1c1c1e', borderRadius: 10, paddingHorizontal: 14, height: 52, fontSize: 16, marginBottom: 12 },
  hint: { color: '#8e8e93', fontSize: 12, marginTop: -4, marginBottom: 16 },
  primaryButton: { backgroundColor: '#e50914', borderRadius: 10, minHeight: 52, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secondaryButton: { alignItems: 'center', marginTop: 22 },
  secondaryButtonText: { color: '#ff6b6b', fontSize: 15, fontWeight: '700' },
  switchText: { color: '#fff', textAlign: 'center', fontSize: 15, fontWeight: '700', marginTop: 20 },
  backButton: { alignItems: 'center', marginTop: 28 },
  backText: { color: '#8e8e93', fontSize: 14 },
});
