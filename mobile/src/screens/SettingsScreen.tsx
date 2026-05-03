import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '../context/AppContext';
import { REFRESH_OPTIONS, type ThemePreference } from '../types';

export default function SettingsScreen() {
  const {
    palette,
    snapshot,
    settings,
    setPageId,
    setRefreshMinutes,
    setThemePref,
    signOut,
    session,
  } = useApp();

  const pages = snapshot?.pages ?? [];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: palette.text }]}>Settings</Text>

        {/* Page selector */}
        <Section palette={palette} label="Page to mirror">
          {pages.length === 0 ? (
            <Text style={{ color: palette.textMuted }}>No pages loaded yet.</Text>
          ) : (
            <>
              <Choice
                palette={palette}
                label="Default (follow web)"
                active={settings.pageId == null}
                onPress={() => setPageId(null)}
              />
              {pages.map((p) => (
                <Choice
                  key={p.id}
                  palette={palette}
                  label={`${p.name}${p.isDefault ? ' ★' : ''}`}
                  active={settings.pageId === p.id}
                  onPress={() => setPageId(p.id)}
                />
              ))}
            </>
          )}
        </Section>

        {/* Refresh interval */}
        <Section palette={palette} label="Refresh interval">
          {REFRESH_OPTIONS.map((m) => (
            <Choice
              key={m}
              palette={palette}
              label={`Every ${m} ${m === 1 ? 'minute' : 'minutes'}`}
              active={settings.refreshMinutes === m}
              onPress={() => setRefreshMinutes(m)}
            />
          ))}
        </Section>

        {/* Theme */}
        <Section palette={palette} label="Theme">
          {(['auto', 'dark', 'light'] as ThemePreference[]).map((t) => (
            <Choice
              key={t}
              palette={palette}
              label={t === 'auto' ? 'Auto (match system)' : t === 'dark' ? 'Dark' : 'Light'}
              active={settings.themePref === t}
              onPress={() => setThemePref(t)}
            />
          ))}
        </Section>

        {/* Account */}
        <Section palette={palette} label="Account">
          <Text style={[styles.meta, { color: palette.textMuted }]}>
            Signed in as {session?.user?.email ?? 'unknown'}
          </Text>
          <Pressable
            onPress={signOut}
            style={({ pressed }) => [
              styles.signOut,
              { borderColor: palette.danger, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={{ color: palette.danger, fontWeight: '700' }}>Sign out</Text>
          </Pressable>
        </Section>

        <Text style={[styles.footer, { color: palette.textMuted }]}>
          OpenBento Mobile · v0.1.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  label,
  palette,
  children,
}: {
  label: string;
  palette: ReturnType<typeof useApp>['palette'];
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <Text style={[styles.sectionLabel, { color: palette.textMuted }]}>{label}</Text>
      {children}
    </View>
  );
}

function Choice({
  label,
  active,
  onPress,
  palette,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  palette: ReturnType<typeof useApp>['palette'];
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        {
          backgroundColor: active ? palette.accentSoft : 'transparent',
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text style={[styles.choiceText, { color: active ? palette.accent : palette.text, fontWeight: active ? '700' : '500' }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 4, paddingHorizontal: 4 },
  section: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 4 },
  sectionLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  choice: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  choiceText: { fontSize: 15 },
  meta: { fontSize: 13, marginBottom: 12, paddingHorizontal: 4 },
  signOut: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  footer: { fontSize: 12, textAlign: 'center', marginTop: 20 },
});
