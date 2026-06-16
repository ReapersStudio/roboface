import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Switch, TextInput } from 'react-native';
import { useRoboFaceSync } from '../hooks/useRoboFaceSync';
import RobotFacePreview from '../components/RobotFacePreview';
import WidgetSlide from '../components/WidgetSlide';
import { ChevronUp, ChevronDown, X, Send, Check, Plus, Clock, Calendar, CloudSun, Quote } from 'lucide-react-native';

const { width } = Dimensions.get('window');
// Screen padding (32) + Panel padding (32) + Panel border (2) + Grid gap (16) = 82. Using 90 for safety against pixel rounding.
const CARD_WIDTH = Math.floor((width - 90) / 2);

const WIDGETS = [
  { key: "time", label: "Time", description: "Show the current time on the display", Icon: Clock },
  { key: "date", label: "Date", description: "Show today's date on the display", Icon: Calendar },
  { key: "weather", label: "Weather", description: "Show local weather for your region", Icon: CloudSun },
  { key: "quote", label: "Quotes", description: "Cycle short quotes on the display", Icon: Quote },
];
const WIDGET_BY_KEY: any = Object.fromEntries(WIDGETS.map((w) => [w.key, w]));

export default function ReactionsScreen() {
  const state = useRoboFaceSync();
  const { actions, settings, preview, selectionItems, orderedReactions, reactions } = state;

  const display = settings.display || {};
  const playingLabel = preview.reaction
    ? preview.reaction.name
    : preview.item?.t === "w"
      ? `${WIDGET_BY_KEY[preview.item.key]?.label || "Widget"} widget`
      : "Flow preview";

  const items = (selectionItems || []).filter((it: any) =>
    it.t === "r" ? Boolean(reactions[it.id]) : Boolean(WIDGET_BY_KEY[it.key])
  );

  const reactionIdsInUse = items.filter((it: any) => it.t === "r").map((it: any) => it.id);
  const widgetKeysInUse = items.filter((it: any) => it.t === "w").map((it: any) => it.key);
  const weatherInUse = widgetKeysInUse.includes("weather");
  const curSlide = items.length > 1 ? (preview.index ?? -1) : -1;

  const commit = (next: any) => actions.setSelectionItems(next);
  const move = (index: number, dir: number) => {
    const next = [...items];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    commit(next);
  };
  const removeAt = (index: number) => commit(items.filter((_, i) => i !== index));
  const addReaction = (id: string) => {
    if (reactionIdsInUse.includes(id)) return;
    commit([...items, { t: "r", id }]);
  };
  const toggleWidget = (key: string, on: boolean) => {
    if (on) {
      if (widgetKeysInUse.includes(key)) return;
      commit([...items, { t: "w", key }]);
    } else {
      commit(items.filter((it: any) => !(it.t === "w" && it.key === key)));
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      
      {/* LIVE PREVIEW */}
      <View style={styles.panel}>
        <View style={styles.canvasHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>{playingLabel}</Text>
            <Text style={styles.microcopy}>
              <Text style={{ color: preview.synced ? '#34d399' : '#94a3b8' }}>
                {preview.synced ? "● Synced" : "● Local"}
              </Text>
              {"  ·  "}
              {items.length > 1 ? `${items.length} slides` : "Add items"}
            </Text>
          </View>
          <View style={[styles.liveBadge, preview.synced ? styles.liveBadgeActive : {}]}>
            <Text style={[styles.liveBadgeText, preview.synced ? { color: '#064e3b' } : {}]}>
              {preview.synced ? "SYNCED" : "PLAYING"}
            </Text>
          </View>
        </View>
        <View style={styles.previewWrapper}>
          {preview.item?.t === "w" && !preview.reaction ? (
            <WidgetSlide wid={preview.item.key} settings={settings} />
          ) : (
            <RobotFacePreview reaction={preview.reaction || state.currentReaction} settings={settings} />
          )}
        </View>
      </View>

      {/* IN USE */}
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>In use</Text>
        <Text style={styles.microcopy}>Active sequence playing on your device.</Text>

        <View style={styles.inUseList}>
          {items.length === 0 && <Text style={styles.emptyNote}>Nothing selected. Add reactions below.</Text>}
          {items.map((item: any, index: number) => {
            const isReaction = item.t === "r";
            const reaction = isReaction ? reactions[item.id] : null;
            const widget = !isReaction ? WIDGET_BY_KEY[item.key] : null;
            const active = index === curSlide;

            return (
              <View key={isReaction ? `r-${item.id}` : `w-${item.key}`} style={[styles.inUseRow, active && styles.inUseRowActive]}>
                <Text style={styles.orderNum}>{index + 1}</Text>
                
                <TouchableOpacity style={styles.inUseMain} activeOpacity={0.7} onPress={() => actions.requestJump(index)}>
                  {isReaction ? (
                    <View style={styles.inUseMainInner}>
                      <View style={styles.codeBadge}>
                        <Text style={styles.codeText}>{reaction.code}</Text>
                      </View>
                      <View>
                        <Text style={styles.inUseTitle}>{reaction.name}</Text>
                        <Text style={styles.inUseSub}>{active ? "On device" : reaction.mood}</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.inUseMainInner}>
                      <View style={styles.codeBadge}>
                        {widget?.Icon && <widget.Icon size={14} color="#38bdf8" />}
                      </View>
                      <View>
                        <Text style={styles.inUseTitle}>{widget?.label}</Text>
                        <Text style={styles.inUseSub}>{active ? "On device" : "widget"}</Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>

                <View style={styles.ordStack}>
                  <TouchableOpacity onPress={() => move(index, -1)} disabled={index === 0} style={styles.ordBtn}>
                    <ChevronUp size={20} color={index === 0 ? "#27272a" : "#71717a"} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => move(index, 1)} disabled={index === items.length - 1} style={styles.ordBtn}>
                    <ChevronDown size={20} color={index === items.length - 1 ? "#27272a" : "#71717a"} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => removeAt(index)} style={styles.removeBtn}>
                  <X size={20} color="#71717a" />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </View>

      {/* REACTION GALLERY */}
      <View style={[styles.panel, { padding: 16 }]}>
        <Text style={[styles.sectionTitle, { marginLeft: 8 }]}>Reaction gallery</Text>
        <Text style={[styles.microcopy, { marginLeft: 8, marginBottom: 20 }]}>Browse and add reactions to your sequence.</Text>

        <View style={styles.grid}>
          {orderedReactions.map((reaction: any) => {
            const added = reactionIdsInUse.includes(reaction.id);
            return (
              <View key={reaction.id} style={styles.card}>
                <View style={styles.previewContainer}>
                  <View style={styles.previewScaler}>
                    <RobotFacePreview reaction={reaction} settings={{ ...settings, preview: { blinking: false, breathing: false } }} />
                  </View>
                </View>
                <View style={styles.titleRow}>
                  <View style={styles.codeBadge}>
                    <Text style={styles.codeText}>{reaction.code}</Text>
                  </View>
                  <Text style={styles.reactionName} numberOfLines={1}>{reaction.name}</Text>
                </View>
                <View style={styles.actionRow}>
                  <TouchableOpacity 
                    style={[styles.actionBtn, styles.useBtn]}
                    activeOpacity={0.7}
                    onPress={() => {
                      const idx = items.findIndex((it: any) => it.t === "r" && it.id === reaction.id);
                      if (idx >= 0) actions.requestJump(idx);
                      else addReaction(reaction.id);
                    }}
                  >
                    <Send size={14} color="#38bdf8" style={{ marginRight: 6 }} />
                    <Text style={styles.useBtnText}>Use</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.actionBtn, added ? styles.ghostBtn : styles.primaryBtn]}
                    activeOpacity={added ? 1 : 0.7}
                    onPress={() => addReaction(reaction.id)}
                    disabled={added}
                  >
                    {added ? (
                      <>
                        <Check size={14} color="#71717a" style={{ marginRight: 6 }} />
                        <Text style={styles.ghostBtnText}>Added</Text>
                      </>
                    ) : (
                      <>
                        <Plus size={14} color="#fff" style={{ marginRight: 6 }} />
                        <Text style={styles.primaryBtnText}>Add</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* WIDGETS */}
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Widgets</Text>
        <Text style={styles.microcopy}>Enable widgets to display real-time data.</Text>

        <View style={styles.stack}>
          {WIDGETS.map(({ key, label, description, Icon }) => {
            const checked = widgetKeysInUse.includes(key);
            return (
              <View key={key} style={styles.widgetRow}>
                <View style={styles.widgetIconBg}><Icon size={20} color="#38bdf8" /></View>
                <View style={{ flex: 1, marginHorizontal: 16 }}>
                  <Text style={styles.widgetLabel}>{label}</Text>
                  <Text style={styles.widgetDesc}>{description}</Text>
                </View>
                <Switch 
                  value={checked}
                  onValueChange={(on) => toggleWidget(key, on)}
                  trackColor={{ false: '#27272a', true: '#0ea5e9' }}
                  thumbColor="#fafafa"
                />
              </View>
            );
          })}
          {weatherInUse && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Weather location</Text>
              <TextInput 
                style={styles.input}
                value={display.weatherLocation}
                onChangeText={(val) => actions.updateDisplay({ weatherLocation: val })}
                placeholder="City, e.g. Chennai"
                placeholderTextColor="#52525b"
              />
            </View>
          )}
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' },
  content: { padding: 16, gap: 20, paddingBottom: 40 },
  panel: { backgroundColor: '#18181b', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#27272a' },
  canvasHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  sectionTitle: { fontSize: 22, fontWeight: '800', color: '#fafafa', marginBottom: 4 },
  microcopy: { fontSize: 14, color: '#a1a1aa', marginBottom: 16 },
  liveBadge: { backgroundColor: '#27272a', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  liveBadgeActive: { backgroundColor: '#34d399' },
  liveBadgeText: { fontSize: 10, fontWeight: '800', color: '#a1a1aa', letterSpacing: 1 },
  previewWrapper: { width: '100%', aspectRatio: 800/480, backgroundColor: '#000', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#27272a' },
  
  inUseList: { gap: 12 },
  emptyNote: { fontSize: 15, color: '#71717a', fontStyle: 'italic', paddingVertical: 12 },
  inUseRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#09090b', borderWidth: 1, borderColor: '#27272a', borderRadius: 16, padding: 12 },
  inUseRowActive: { borderColor: '#0ea5e9', backgroundColor: 'rgba(14, 165, 233, 0.05)' },
  orderNum: { fontSize: 16, fontWeight: '900', color: '#52525b', width: 28, textAlign: 'center' },
  inUseMain: { flex: 1, marginLeft: 8 },
  inUseMainInner: { flexDirection: 'row', alignItems: 'center' },
  inUseTitle: { fontSize: 16, fontWeight: '700', color: '#fafafa', marginBottom: 2 },
  inUseSub: { fontSize: 13, color: '#a1a1aa' },
  ordStack: { justifyContent: 'center', alignItems: 'center', marginHorizontal: 8 },
  ordBtn: { padding: 4 },
  removeBtn: { padding: 8, backgroundColor: '#18181b', borderRadius: 10, borderWidth: 1, borderColor: '#27272a' },
  
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  card: { backgroundColor: '#09090b', borderRadius: 20, borderWidth: 1, borderColor: '#27272a', width: CARD_WIDTH, padding: 12 },
  previewContainer: { backgroundColor: '#000', borderRadius: 12, overflow: 'hidden', height: CARD_WIDTH * 0.6, marginBottom: 16, borderWidth: 1, borderColor: '#27272a', justifyContent: 'center', alignItems: 'center' },
  previewScaler: { width: '100%', height: '100%', transform: [{ scale: 1.0 }] },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  codeBadge: { backgroundColor: 'rgba(56, 189, 248, 0.1)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginRight: 10 },
  codeText: { color: '#38bdf8', fontSize: 13, fontWeight: '800' },
  reactionName: { color: '#fafafa', fontSize: 15, fontWeight: '700', flex: 1 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10 },
  useBtn: { backgroundColor: 'rgba(56, 189, 248, 0.1)' },
  primaryBtn: { backgroundColor: '#0ea5e9' },
  ghostBtn: { backgroundColor: '#27272a' },
  useBtnText: { color: '#38bdf8', fontSize: 13, fontWeight: '700' },
  primaryBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  ghostBtnText: { color: '#a1a1aa', fontSize: 13, fontWeight: '700' },
  
  stack: { gap: 16 },
  widgetRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#27272a' },
  widgetIconBg: { backgroundColor: 'rgba(56, 189, 248, 0.1)', padding: 12, borderRadius: 12 },
  widgetLabel: { fontSize: 16, fontWeight: '700', color: '#fafafa', marginBottom: 2 },
  widgetDesc: { fontSize: 13, color: '#a1a1aa' },
  inputGroup: { marginTop: 12 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#a1a1aa', marginBottom: 8 },
  input: { backgroundColor: '#09090b', borderWidth: 1, borderColor: '#27272a', borderRadius: 12, padding: 16, color: '#fafafa', fontSize: 16 },
});
