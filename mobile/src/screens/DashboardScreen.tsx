import React from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '../context/AppContext';
import { rendererFor } from '../renderers';

export default function DashboardScreen() {
  const { selectedPage, snapshot, loading, error, refresh, palette } = useApp();

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.brand, { color: palette.accent }]}>OpenBento</Text>
        <Text style={[styles.pageName, { color: palette.textMuted }]}>
          {selectedPage ? selectedPage.name : '—'}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={palette.accent} />
        }
      >
        {error ? (
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.errTitle, { color: palette.danger }]}>Couldn't load dashboard</Text>
            <Text style={[styles.errBody, { color: palette.textMuted }]}>{error}</Text>
          </View>
        ) : null}

        {!snapshot && loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={palette.accent} />
          </View>
        ) : null}

        {selectedPage && selectedPage.widgets.length === 0 ? (
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.empty, { color: palette.textMuted }]}>
              This page has no widgets. Add some on the web dashboard.
            </Text>
          </View>
        ) : null}

        {selectedPage?.widgets.map((w) => {
          const Renderer = rendererFor(w.type);
          return (
            <View
              key={w.id}
              style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
            >
              <Renderer widget={w} palette={palette} />
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  brand: { fontSize: 22, fontWeight: '800', letterSpacing: 0.5 },
  pageName: { fontSize: 14 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16 },
  errTitle: { fontWeight: '700', fontSize: 15, marginBottom: 4 },
  errBody: { fontSize: 13 },
  empty: { fontSize: 14, textAlign: 'center' },
  loading: { paddingVertical: 40, alignItems: 'center' },
});
