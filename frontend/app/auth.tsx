import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from '@/contexts/FavoritesContext';
import MainBottomNav from '@/components/MainBottomNav';
import { AuthUser, getProfile, getWatchHistory, HistoryItem } from '@/services/auth';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
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

const PLAN_LABELS: Record<NonNullable<AuthUser['plan']>, string> = {
  free: 'Plano gratuito',
  premium: 'Premium',
  super_premium: 'Super Premium',
};

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Não disponível';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Não disponível';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default function AuthScreen() {
  const router = useRouter();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const { session, isLoading, signIn, signOut, signUp } = useAuth();
  const { favorites } = useFavorites();
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [profile, setProfile] = useState<AuthUser | null>(session?.user ?? null);
  const [watchHistory, setWatchHistory] = useState<HistoryItem[]>([]);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountLoadFailed, setAccountLoadFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      setWatchHistory([]);
      return;
    }

    let cancelled = false;
    setProfile(session.user);
    setAccountLoading(true);
    setAccountLoadFailed(false);

    Promise.allSettled([
      getProfile(session.accessToken),
      getWatchHistory(session.accessToken),
    ]).then(([profileResult, historyResult]) => {
      if (cancelled) return;
      let failed = false;
      if (profileResult.status === 'fulfilled') {
        setProfile(profileResult.value);
      } else {
        failed = true;
      }
      if (historyResult.status === 'fulfilled') {
        setWatchHistory(historyResult.value);
      } else {
        failed = true;
        setWatchHistory([]);
      }
      setAccountLoadFailed(failed);
    }).finally(() => {
      if (!cancelled) setAccountLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [session, retryCount]);

  const submit = async () => {
    setSubmitting(true);
    try {
      if (isRegistering) {
        await signUp(name, email, password);
      } else {
        await signIn(email, password);
      }
      if (redirect === '/iptv') {
        router.replace('/iptv');
      } else {
        router.back();
      }
    } catch (error) {
      Alert.alert('Não foi possível entrar', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color="#e50914" /></View>
      ) : session ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.pageHeader}>
            <Text style={styles.eyebrow}>PERFIL</Text>
            <Text style={styles.pageTitle}>Minha conta</Text>
            <Text style={styles.pageSubtitle}>Seus dados e sua atividade no Lussueki Clip.</Text>
          </View>

          <View style={styles.profilePanel}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{getInitials(profile?.name ?? session.user.name)}</Text></View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName} numberOfLines={1}>{profile?.name ?? session.user.name}</Text>
              <Text style={styles.profileEmail} numberOfLines={1}>{profile?.email ?? session.user.email}</Text>
              <View style={styles.planBadge}>
                <Ionicons name="sparkles-outline" size={13} color="#ff777d" />
                <Text style={styles.planText}>{PLAN_LABELS[profile?.plan ?? session.user.plan ?? 'free']}</Text>
              </View>
            </View>
          </View>

          {accountLoadFailed && (
            <TouchableOpacity style={styles.syncNotice} onPress={() => setRetryCount((count) => count + 1)}>
              <Ionicons name="refresh-outline" size={17} color="#ff777d" />
              <Text style={styles.syncNoticeText}>Alguns dados não foram atualizados. Toque para tentar novamente.</Text>
            </TouchableOpacity>
          )}

          <View style={styles.statsPanel}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{favorites.length}</Text>
              <Text style={styles.statLabel}>Favoritos</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{accountLoading && watchHistory.length === 0 ? '...' : watchHistory.length}</Text>
              <Text style={styles.statLabel}>Títulos vistos</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile?.login_count ?? session.user.login_count}</Text>
              <Text style={styles.statLabel}>Acessos</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Acesso rápido</Text>
            <TouchableOpacity style={styles.actionRow} onPress={() => router.push('/favoritos')}>
              <View style={[styles.actionIcon, styles.favoriteIcon]}><Ionicons name="heart" size={18} color="#ff777d" /></View>
              <View style={styles.actionTextGroup}>
                <Text style={styles.actionTitle}>Meus favoritos</Text>
                <Text style={styles.actionSubtitle}>{favorites.length} títulos salvos</Text>
              </View>
              <Ionicons name="chevron-forward" size={19} color="#77777d" />
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeadingRow}>
              <Text style={styles.sectionTitle}>Atividade recente</Text>
              <Text style={styles.sectionCount}>{watchHistory.length}</Text>
            </View>
            {watchHistory.length > 0 ? watchHistory.slice(0, 5).map((item) => (
              <TouchableOpacity
                key={item.content_key}
                style={styles.historyRow}
                onPress={() => router.push({
                  pathname: '/player',
                  params: {
                    streamUrl: item.source_url,
                    title: item.title,
                    categoryKey: item.category ?? '',
                    positionSeconds: String(item.position_seconds ?? 0),
                  },
                })}
              >
                <View style={styles.playIcon}><Ionicons name="play" size={14} color="#fff" /></View>
                <View style={styles.historyInfo}>
                  <Text style={styles.historyTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.historyMeta}>{item.category || 'Reprodução'} · {formatDate(item.last_watched_at)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#77777d" />
              </TouchableOpacity>
            )) : (
              <View style={styles.emptyHistory}>
                <Ionicons name="film-outline" size={22} color="#77777d" />
                <Text style={styles.emptyHistoryText}>{accountLoading ? 'Carregando seu histórico...' : 'Suas reproduções recentes aparecerão aqui.'}</Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dados da conta</Text>
            <View style={styles.detailRow}>
              <Ionicons name="mail-outline" size={18} color="#96969d" />
              <Text style={styles.detailLabel}>E-mail</Text>
              <Text style={styles.detailValue} numberOfLines={1}>{profile?.email ?? session.user.email}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={18} color="#96969d" />
              <Text style={styles.detailLabel}>Membro desde</Text>
              <Text style={styles.detailValue}>{formatDate(profile?.created_at ?? session.user.created_at)}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.signOutButton}
            onPress={() => Alert.alert('Sair da conta', 'Deseja encerrar sua sessão neste dispositivo?', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Sair', style: 'destructive', onPress: () => void signOut() },
            ])}
          >
            <Ionicons name="log-out-outline" size={18} color="#ff777d" />
            <Text style={styles.signOutText}>Sair da conta</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.guestContent} keyboardShouldPersistTaps="handled">
            <View style={styles.guestMark}><Ionicons name="person-outline" size={26} color="#ff777d" /></View>
            <Text style={styles.eyebrow}>SUA CONTA</Text>
            <Text style={styles.pageTitle}>{isRegistering ? 'Criar conta' : 'Entrar'}</Text>
            <Text style={styles.pageSubtitle}>Acesse seus favoritos e continue de onde parou.</Text>
            {isRegistering && (
              <TextInput style={styles.input} placeholder="Nome" placeholderTextColor="#8e8e93" value={name} onChangeText={setName} autoCapitalize="words" />
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
          </ScrollView>
        </KeyboardAvoidingView>
      )}
      <MainBottomNav active="account" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#09090b' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 30 },
  pageHeader: { marginBottom: 20 },
  eyebrow: { color: '#ff777d', fontSize: 11, fontWeight: '800', marginBottom: 6 },
  pageTitle: { color: '#fff', fontSize: 29, fontWeight: '800' },
  pageSubtitle: { color: '#a1a1a8', fontSize: 14, lineHeight: 20, marginTop: 5 },
  profilePanel: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#151517', borderWidth: 1, borderColor: '#2a2a2e', borderRadius: 12, padding: 16 },
  avatar: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: '#302023', borderWidth: 1, borderColor: '#613136' },
  avatarText: { color: '#ff858a', fontSize: 20, fontWeight: '800' },
  profileInfo: { flex: 1, minWidth: 0, marginLeft: 14 },
  profileName: { color: '#fff', fontSize: 17, fontWeight: '700' },
  profileEmail: { color: '#a1a1a8', fontSize: 13, marginTop: 3 },
  planBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, backgroundColor: '#2a1c1e', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 4, marginTop: 9 },
  planText: { color: '#ff9a9e', fontSize: 11, fontWeight: '700' },
  syncNotice: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 12, padding: 11, borderRadius: 8, backgroundColor: '#201719' },
  syncNoticeText: { flex: 1, color: '#d4b6b8', fontSize: 12, lineHeight: 17 },
  statsPanel: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#151517', borderRadius: 10, paddingVertical: 16, marginTop: 14 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { color: '#fff', fontSize: 20, fontWeight: '800' },
  statLabel: { color: '#96969d', fontSize: 11, marginTop: 4 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 34, backgroundColor: '#3a3a3e' },
  section: { marginTop: 25 },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 11 },
  sectionCount: { color: '#96969d', fontSize: 12, marginBottom: 11 },
  actionRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#151517', borderRadius: 9, padding: 13, minHeight: 66 },
  actionIcon: { width: 38, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  favoriteIcon: { backgroundColor: '#302023' },
  actionTextGroup: { flex: 1, marginLeft: 12 },
  actionTitle: { color: '#f5f5f6', fontSize: 14, fontWeight: '700' },
  actionSubtitle: { color: '#96969d', fontSize: 12, marginTop: 3 },
  historyRow: { flexDirection: 'row', alignItems: 'center', minHeight: 66, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2a2a2e' },
  playIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#29292d' },
  historyInfo: { flex: 1, minWidth: 0, marginHorizontal: 11 },
  historyTitle: { color: '#f5f5f6', fontSize: 14, fontWeight: '600' },
  historyMeta: { color: '#96969d', fontSize: 11, marginTop: 4 },
  emptyHistory: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#151517', borderRadius: 9, padding: 14 },
  emptyHistoryText: { flex: 1, color: '#96969d', fontSize: 13, lineHeight: 18 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#29292d' },
  detailLabel: { color: '#96969d', fontSize: 13 },
  detailValue: { flex: 1, color: '#e7e7e9', fontSize: 13, textAlign: 'right' },
  signOutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, marginTop: 25, borderWidth: 1, borderColor: '#47282b', borderRadius: 8 },
  signOutText: { color: '#ff858a', fontSize: 14, fontWeight: '700' },
  guestContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingTop: 28, paddingBottom: 32 },
  guestMark: { width: 54, height: 54, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#302023', marginBottom: 25 },
  input: { color: '#fff', backgroundColor: '#171719', borderWidth: 1, borderColor: '#303034', borderRadius: 8, paddingHorizontal: 14, height: 52, fontSize: 15, marginTop: 12 },
  hint: { color: '#96969d', fontSize: 12, marginTop: 8 },
  primaryButton: { backgroundColor: '#d91620', borderRadius: 8, minHeight: 52, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  switchText: { color: '#f1f1f2', textAlign: 'center', fontSize: 14, fontWeight: '700', marginTop: 20, padding: 8 },
});
