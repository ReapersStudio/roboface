import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRoboFaceSync } from '../hooks/useRoboFaceSync';
import { BadgeCheck, Cpu, Download, RefreshCw, Clock, Globe } from 'lucide-react-native';

const APP_VERSION = "2.0.0";

const TIME_FORMAT_OPTIONS = [
  { value: "24h", label: "24-hour (18:30)" },
  { value: "12h", label: "12-hour (6:30 PM)" },
];

export default function SettingsScreen() {
  const state = useRoboFaceSync();
  const { actions, settings, activeDevice, firmware } = state;
  const display = settings.display || {};

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const device = activeDevice || {};
  const latest = firmware?.version || null;
  const running = device.fwVersion || null;
  const status = device.fwStatus || "";
  const progress = Number(device.fwProgress || 0);

  const working = status === "updating" || status === "checking";
  const failed = status === "failed";
  const updateAvailable = Boolean(latest && running && latest !== running);
  const reportedIn = Boolean(running);

  const timeText = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: display.timeFormat === "12h",
  });
  const dateText = now.toLocaleDateString([], {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* APP CARD */}
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>App</Text>
        <View style={styles.updateCard}>
          <View style={styles.updateIcon}>
            <BadgeCheck size={28} color="#10b981" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.updateTitle}>You're up to date</Text>
            <Text style={styles.updateSub}>Version {APP_VERSION}</Text>
          </View>
          <TouchableOpacity style={styles.ghostBtn} activeOpacity={0.7}>
            <Text style={styles.ghostBtnText}>Check for updates</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.microcopy}>
          New reactions and widgets are delivered automatically — no manual update needed.
        </Text>
      </View>

      {/* FIRMWARE CARD */}
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Device firmware</Text>
        <View style={styles.fwCard}>
          <View style={styles.fwIcon}><Cpu size={24} color="#38bdf8" /></View>
          <View style={styles.fwBody}>
            <Text style={styles.fwTitle}>Robot firmware</Text>
            <Text style={styles.fwSub}>Running {running || "—"} · Latest {latest || "—"}</Text>
          </View>
          
          {!reportedIn && <View style={styles.fwBadge}><Text style={styles.fwBadgeText}>Offline</Text></View>}
          {reportedIn && working && <View style={styles.fwBadge}><Text style={styles.fwBadgeText}>Working…</Text></View>}
          {reportedIn && !working && updateAvailable && (
            <TouchableOpacity style={styles.primaryBtn} onPress={() => actions.requestDeviceUpdate()} activeOpacity={0.8}>
              <Download size={16} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.primaryBtnText}>Update to {latest}</Text>
            </TouchableOpacity>
          )}
          {reportedIn && !working && !updateAvailable && (
            <View style={[styles.fwBadge, styles.fwBadgeOk]}>
              <BadgeCheck size={14} color="#34d399" style={{ marginRight: 6 }} />
              <Text style={styles.fwBadgeTextOk}>Up to date</Text>
            </View>
          )}
        </View>

        {working && (
          <View style={styles.fwProgress}>
            <View style={styles.fwBarBg}>
              <View style={[styles.fwBarFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.microcopy}>{status === "checking" ? "Checking for updates…" : `Installing… ${progress}%`}</Text>
          </View>
        )}
        {failed && (
          <Text style={[styles.microcopy, { color: '#fb7185', marginTop: 12 }]}>
            <RefreshCw size={14} color="#fb7185" /> Last update didn't finish — the device will retry automatically.
          </Text>
        )}
        {!reportedIn && (
          <Text style={[styles.microcopy, { marginTop: 12 }]}>
            Waiting for the device to report in — make sure it's powered on and online.
          </Text>
        )}
      </View>

      {/* TIME & DATE */}
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Time & date</Text>
        <View style={styles.stack}>
          <View style={styles.clockPreview}>
            <View style={styles.fwIcon}>
              <Clock size={24} color="#a855f7" />
            </View>
            <View style={{ marginLeft: 16 }}>
              <Text style={styles.clockTime}>{timeText}</Text>
              <Text style={styles.clockDate}>{dateText}</Text>
            </View>
          </View>

          <View style={styles.selectGroup}>
            <Text style={styles.selectLabel}>Time format</Text>
            <View style={styles.radioGroup}>
              {TIME_FORMAT_OPTIONS.map(opt => (
                <TouchableOpacity 
                  key={opt.value} 
                  style={[styles.radioBtn, display.timeFormat === opt.value && styles.radioBtnActive]}
                  activeOpacity={0.8}
                  onPress={() => actions.updateDisplay({ timeFormat: opt.value })}
                >
                  <Text style={[styles.radioText, display.timeFormat === opt.value && styles.radioTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Text style={styles.microcopy}>
            <Globe size={14} color="#71717a" /> Region sets the time zone used for the clock and date widgets on your device.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' },
  content: { padding: 16, gap: 20, paddingBottom: 40 },
  panel: { backgroundColor: '#18181b', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#27272a' },
  sectionTitle: { fontSize: 22, fontWeight: '800', color: '#fafafa', marginBottom: 16 },
  microcopy: { fontSize: 14, color: '#a1a1aa', marginTop: 12, lineHeight: 22 },
  
  updateCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#09090b', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#27272a' },
  updateIcon: { marginRight: 16 },
  updateTitle: { fontSize: 16, fontWeight: '700', color: '#fafafa', marginBottom: 2 },
  updateSub: { fontSize: 14, color: '#a1a1aa' },
  ghostBtn: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#27272a', borderRadius: 10 },
  ghostBtnText: { color: '#fafafa', fontSize: 14, fontWeight: '600' },
  
  fwCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#09090b', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#27272a' },
  fwIcon: { backgroundColor: '#18181b', padding: 12, borderRadius: 12, marginRight: 16, borderWidth: 1, borderColor: '#27272a' },
  fwBody: { flex: 1 },
  fwTitle: { fontSize: 16, fontWeight: '700', color: '#fafafa', marginBottom: 2 },
  fwSub: { fontSize: 14, color: '#a1a1aa' },
  fwBadge: { backgroundColor: '#27272a', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  fwBadgeText: { fontSize: 12, fontWeight: '700', color: '#a1a1aa' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0ea5e9', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  fwBadgeOk: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)', borderWidth: 1 },
  fwBadgeTextOk: { fontSize: 12, fontWeight: '700', color: '#34d399' },
  fwProgress: { marginTop: 20 },
  fwBarBg: { height: 8, backgroundColor: '#27272a', borderRadius: 4, marginBottom: 8, overflow: 'hidden' },
  fwBarFill: { height: '100%', backgroundColor: '#0ea5e9' },
  
  stack: { gap: 20 },
  clockPreview: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#09090b', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#27272a' },
  clockTime: { fontSize: 20, fontWeight: '900', color: '#fafafa', marginBottom: 2, letterSpacing: 1 },
  clockDate: { fontSize: 14, color: '#a1a1aa', fontWeight: '500' },
  
  selectGroup: { marginTop: 8 },
  selectLabel: { fontSize: 15, fontWeight: '600', color: '#fafafa', marginBottom: 12 },
  radioGroup: { flexDirection: 'row', gap: 12 },
  radioBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', backgroundColor: '#09090b', borderRadius: 12, borderWidth: 1, borderColor: '#27272a' },
  radioBtnActive: { backgroundColor: 'rgba(56, 189, 248, 0.05)', borderColor: '#0ea5e9' },
  radioText: { fontSize: 15, color: '#71717a', fontWeight: '600' },
  radioTextActive: { color: '#38bdf8' },
});
