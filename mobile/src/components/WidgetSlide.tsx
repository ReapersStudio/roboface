import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CloudSun } from 'lucide-react-native';

const QUOTES = [
  "Stay curious.",
  "Beep boop, hello!",
  "Keep building.",
  "One step at a time.",
  "Powered by good vibes.",
];

export default function WidgetSlide({ wid, settings }: any) {
  const [now, setNow] = useState(new Date());
  
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const fmt12 = settings?.display?.timeFormat === "12h";

  if (wid === "time") {
    return (
      <View style={styles.container}>
        <Text style={styles.timeText}>
          {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: fmt12 })}
        </Text>
      </View>
    );
  }
  
  if (wid === "date") {
    return (
      <View style={styles.container}>
        <Text style={styles.dateBig}>
          {now.toLocaleDateString([], { day: "2-digit" })}
        </Text>
        <Text style={styles.dateSub}>
          {now.toLocaleDateString([], { month: "short", weekday: "long" })}
        </Text>
      </View>
    );
  }
  
  if (wid === "quote") {
    const q = QUOTES[Math.floor(now.getTime() / 4000) % QUOTES.length];
    return (
      <View style={styles.container}>
        <Text style={styles.quoteText}>"{q}"</Text>
      </View>
    );
  }
  
  // Weather fallback
  return (
    <View style={styles.container}>
      <CloudSun size={48} color="#38bdf8" style={{ marginBottom: 16 }} />
      <Text style={styles.dateSub}>Weather —</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    width: '100%',
    aspectRatio: 800 / 480,
  },
  timeText: {
    fontSize: 56,
    fontWeight: '900',
    color: '#38bdf8',
    letterSpacing: 2,
  },
  dateBig: {
    fontSize: 56,
    fontWeight: '900',
    color: '#fafafa',
  },
  dateSub: {
    fontSize: 24,
    fontWeight: '600',
    color: '#38bdf8',
    marginTop: 8,
  },
  quoteText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#a855f7',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
