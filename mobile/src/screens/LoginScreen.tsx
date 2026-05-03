import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useApp } from '../context/AppContext';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { palette } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const configured = isSupabaseConfigured();

  async function handleEmailSignIn(): Promise<void> {
    if (!supabase) return;
    setError(null);
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle(): Promise<void> {
    if (!supabase) return;
    setError(null);
    setBusy(true);
    try {
      const redirectTo = Linking.createURL('auth-callback');
      const { data, error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (err) throw err;
      if (!data?.url) throw new Error('No OAuth URL returned');
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success' && result.url) {
        // Supabase OAuth can return either:
        //   • a hash with access_token/refresh_token (implicit flow), or
        //   • a query with ?code=... (PKCE flow).
        // Try both so we don't silently no-op.
        const url = new URL(result.url);
        const hashParams = new URLSearchParams(
          url.hash.startsWith('#') ? url.hash.slice(1) : url.hash,
        );
        const access_token = hashParams.get('access_token');
        const refresh_token = hashParams.get('refresh_token');
        const code = url.searchParams.get('code');
        const oauthErr = hashParams.get('error_description') || url.searchParams.get('error_description');
        if (oauthErr) throw new Error(oauthErr);
        if (access_token && refresh_token) {
          const { error: setErr } = await supabase.auth.setSession({ access_token, refresh_token });
          if (setErr) throw setErr;
        } else if (code) {
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exErr) throw exErr;
        } else {
          throw new Error('Sign-in did not return a session. Check your Supabase redirect URL configuration.');
        }
      } else if (result.type !== 'cancel' && result.type !== 'dismiss') {
        throw new Error(`Sign-in failed (${result.type}).`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.root, { backgroundColor: palette.bg }]}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.brand, { color: palette.accent }]}>OpenBento</Text>
        <Text style={[styles.tagline, { color: palette.textMuted }]}>
          Mobile companion
        </Text>

        {!configured ? (
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Setup needed</Text>
            <Text style={[styles.cardBody, { color: palette.textMuted }]}>
              Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY before running. See README.
            </Text>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.label, { color: palette.textMuted }]}>Email</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={palette.textMuted}
              style={[styles.input, { color: palette.text, borderColor: palette.border }]}
            />
            <Text style={[styles.label, { color: palette.textMuted, marginTop: 12 }]}>Password</Text>
            <TextInput
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={palette.textMuted}
              style={[styles.input, { color: palette.text, borderColor: palette.border }]}
            />

            {error ? (
              <Text style={[styles.error, { color: palette.danger }]}>{error}</Text>
            ) : null}

            <Pressable
              onPress={handleEmailSignIn}
              disabled={busy || !email || !password}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: palette.accent, opacity: busy || !email || !password ? 0.5 : pressed ? 0.85 : 1 },
              ]}
            >
              {busy ? <ActivityIndicator color="#001018" /> : <Text style={styles.buttonText}>Sign in</Text>}
            </Pressable>

            <View style={[styles.divider, { backgroundColor: palette.border }]} />

            <Pressable
              onPress={handleGoogle}
              disabled={busy}
              style={({ pressed }) => [
                styles.buttonGhost,
                { borderColor: palette.border, opacity: busy ? 0.5 : pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.buttonGhostText, { color: palette.text }]}>
                Continue with Google
              </Text>
            </Pressable>
          </View>
        )}

        <Text style={[styles.footer, { color: palette.textMuted }]}>
          Read-only mirror of your default dashboard page. Edit layouts on the web.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 24, paddingTop: 80, gap: 16 },
  brand: { fontSize: 36, fontWeight: '800', letterSpacing: 0.5 },
  tagline: { fontSize: 16, marginBottom: 24 },
  card: { borderWidth: 1, borderRadius: 16, padding: 20 },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  cardBody: { fontSize: 14, lineHeight: 20 },
  label: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 6,
    fontSize: 16,
  },
  error: { marginTop: 12, fontSize: 13 },
  button: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: { color: '#001018', fontWeight: '700', fontSize: 16 },
  divider: { height: 1, marginVertical: 16 },
  buttonGhost: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  buttonGhostText: { fontWeight: '600', fontSize: 15 },
  footer: { fontSize: 12, textAlign: 'center', marginTop: 24, paddingHorizontal: 16 },
});
