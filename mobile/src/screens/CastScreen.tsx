import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '../context/AppContext';
import { buildSnapshot, fetchCastRooms, pushCast, type CastRoom } from '../lib/api';

export default function CastScreen() {
  const { palette, selectedPage, snapshot, mode } = useApp();
  const [rooms, setRooms] = useState<CastRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pushingId, setPushingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchCastRooms();
      setRooms(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  async function onPush(room: CastRoom): Promise<void> {
    if (!selectedPage) {
      Alert.alert('Nothing to push', 'Load a dashboard page first.');
      return;
    }
    setPushingId(room.id);
    try {
      const isDarkMode = mode === 'dark';
      const snap = buildSnapshot(selectedPage, isDarkMode, snapshot?.background ?? '');
      await pushCast(room.id, snap);
      Alert.alert('Pushed', `${selectedPage.name} → ${room.label}`);
    } catch (e) {
      Alert.alert('Push failed', e instanceof Error ? e.message : String(e));
    } finally {
      setPushingId(null);
    }
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.text }]}>Cast</Text>
        <Text style={[styles.sub, { color: palette.textMuted }]}>
          Push the current page to a paired TV
        </Text>
      </View>

      {error ? (
        <View style={[styles.notice, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={{ color: palette.danger }}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={rooms}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={reload} tintColor={palette.accent} />
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={palette.accent} style={{ marginTop: 40 }} />
          ) : (
            <View style={[styles.notice, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={{ color: palette.textMuted, textAlign: 'center' }}>
                No paired TVs. Pair a TV from the web dashboard's Cast popover first
                — its BENTO-XXXX rooms will show up here.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const lastPushed = item.lastPushedAt
            ? new Date(item.lastPushedAt).toLocaleString()
            : 'Never pushed';
          return (
            <View style={[styles.row, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <View style={{ flex: 1 }}>
                <View style={styles.rowTop}>
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: item.tvOnline ? palette.success : palette.textMuted },
                    ]}
                  />
                  <Text style={[styles.label, { color: palette.text }]}>{item.label}</Text>
                </View>
                {item.code ? (
                  <Text style={[styles.meta, { color: palette.accent }]}>{item.code}</Text>
                ) : null}
                <Text style={[styles.meta, { color: palette.textMuted }]}>{lastPushed}</Text>
              </View>
              <Pressable
                onPress={() => onPush(item)}
                disabled={pushingId === item.id || !selectedPage}
                style={({ pressed }) => [
                  styles.pushBtn,
                  {
                    backgroundColor: palette.accent,
                    opacity: pushingId === item.id || !selectedPage ? 0.5 : pressed ? 0.85 : 1,
                  },
                ]}
              >
                {pushingId === item.id ? (
                  <ActivityIndicator color="#001018" />
                ) : (
                  <Text style={styles.pushTxt}>Push</Text>
                )}
              </Pressable>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { padding: 20, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: '800' },
  sub: { marginTop: 4, fontSize: 13 },
  list: { padding: 16, gap: 12 },
  notice: { borderWidth: 1, borderRadius: 12, padding: 16, margin: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 16, fontWeight: '600' },
  meta: { fontSize: 12, marginTop: 4 },
  pushBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  pushTxt: { color: '#001018', fontWeight: '700' },
});
