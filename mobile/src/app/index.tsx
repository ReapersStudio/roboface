import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { useRoboFaceSync } from '../hooks/useRoboFaceSync';
import RobotFacePreview from '../components/RobotFacePreview';
import WidgetSlide from '../components/WidgetSlide';
import { Sparkles, ArrowRight, Smile, Wifi, WifiOff } from 'lucide-react-native';
import { router } from 'expo-router';

const WIDGET_NAMES: any = { time: "Time", date: "Date", weather: "Weather", quote: "Quote" };
const { width } = Dimensions.get('window');

export default function WelcomeScreen() {
  const state = useRoboFaceSync();
  const deviceOnline = Boolean(state.activeDevice?.connected || state.activeDevice?.online);
  const firebaseLive = state.realtimeMode === "firebase" && state.firebaseConnected;
  const preview = state.preview || {};
  
  const playingLabel = preview.reaction
    ? preview.reaction.name
    : preview.item?.t === "w"
      ? `${WIDGET_NAMES[preview.item.key] || "Widget"} widget`
      : state.currentReaction?.name || "None";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      
      {/* HERO SECTION */}
      <View style={styles.heroCard}>
        <View style={styles.heroGlow} />
        <View style={styles.kickerRow}>
          <Sparkles size={16} color="#38bdf8" />
          <Text style={styles.kickerText}>WELCOME TO ROBOFACE</Text>
        </View>
        <Text style={styles.heroTitle}>Bring your robot{"\n"}face to life</Text>
        <Text style={styles.heroSubText}>
          Pick a reaction and it shows on your ESP32 display instantly. Add widgets like time,
          date, weather and quotes — all from one place.
        </Text>

        <View style={styles.actionsRow}>
          <TouchableOpacity 
            style={styles.primaryBtn} 
            activeOpacity={0.8}
            onPress={() => router.push('/reactions')}
          >
            <Smile size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.primaryBtnText}>Browse reactions</Text>
            <ArrowRight size={18} color="#fff" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.secondaryBtn} 
            activeOpacity={0.8}
            onPress={() => router.push('/settings')}
          >
            <Text style={styles.secondaryBtnText}>Settings</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <View style={styles.statusRow}>
          <View style={[styles.statusChip, deviceOnline ? styles.chipGood : styles.chipBad]}>
            <View style={[styles.pulseDot, { backgroundColor: deviceOnline ? '#10b981' : '#f43f5e' }]} />
            <Text style={[styles.statusChipText, { color: deviceOnline ? '#34d399' : '#fb7185' }]}>
              Device {deviceOnline ? "online" : "offline"}
            </Text>
          </View>
          <View style={styles.statusChip}>
            {firebaseLive ? <Wifi size={14} color="#60a5fa" /> : <WifiOff size={14} color="#fbbf24" />}
            <Text style={[styles.statusChipText, { color: firebaseLive ? '#60a5fa' : '#fbbf24' }]}>
              {firebaseLive ? "Firebase live" : "Local demo"}
            </Text>
          </View>
        </View>
      </View>

      {/* LIVE PREVIEW SECTION */}
      <View style={styles.previewCard}>
        <View style={styles.previewHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Flow Preview</Text>
            <Text style={styles.microcopy}>
              <Text style={{ color: preview.synced ? '#34d399' : '#94a3b8' }}>
                {preview.synced ? "● In sync with device" : "● Playing locally"}
              </Text>
              {"  ·  "}{playingLabel}
            </Text>
          </View>
          <View style={[styles.liveBadge, preview.synced ? styles.liveBadgeActive : {}]}>
            <Text style={[styles.liveBadgeText, preview.synced ? { color: '#064e3b' } : {}]}>
              {preview.synced ? "SYNCED" : "PLAYING"}
            </Text>
          </View>
        </View>
        
        <View style={styles.previewContainer}>
          {preview.item?.t === "w" && !preview.reaction ? (
            <WidgetSlide wid={preview.item.key} settings={state.settings} />
          ) : (
            <RobotFacePreview 
              reaction={preview.reaction || state.currentReaction} 
              settings={state.settings} 
            />
          )}
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b', // zinc-950
  },
  content: {
    padding: 16,
    gap: 20,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: '#18181b', // zinc-900
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(56, 189, 248, 0.15)', // Sky blue glow
    blurRadius: 50,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  kickerText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#38bdf8', // sky-400
    marginLeft: 8,
    letterSpacing: 1.5,
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: '900',
    color: '#fafafa', // zinc-50
    lineHeight: 40,
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  heroSubText: {
    fontSize: 16,
    color: '#a1a1aa', // zinc-400
    lineHeight: 24,
    marginBottom: 32,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0ea5e9', // sky-500
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#0ea5e9',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#27272a', // zinc-800
  },
  secondaryBtnText: {
    color: '#fafafa',
    fontWeight: '700',
    fontSize: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#27272a',
    marginVertical: 20,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#09090b',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272a',
    gap: 8,
  },
  chipGood: {
    borderColor: 'rgba(16, 185, 129, 0.3)', // emerald
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  chipBad: {
    borderColor: 'rgba(244, 63, 94, 0.3)', // rose
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
  },
  statusChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#a1a1aa',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  
  previewCard: {
    backgroundColor: '#18181b', // zinc-900
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fafafa',
    marginBottom: 4,
  },
  microcopy: {
    fontSize: 14,
    color: '#a1a1aa',
    fontWeight: '500',
  },
  liveBadge: {
    backgroundColor: '#27272a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  liveBadgeActive: {
    backgroundColor: '#34d399', // emerald-400
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#a1a1aa',
    letterSpacing: 1,
  },
  previewContainer: {
    width: '100%',
    aspectRatio: 800/480,
    backgroundColor: '#000',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#27272a',
  },
});
