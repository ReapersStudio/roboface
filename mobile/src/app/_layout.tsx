import { Tabs } from 'expo-router';
import { Settings, Cpu, Smile, Activity, Home } from 'lucide-react-native';
import { View, StyleSheet } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { 
          backgroundColor: '#09090b',
          shadowColor: 'transparent', // Remove border on iOS
          elevation: 0, // Remove border on Android
        },
        headerTitleStyle: {
          color: '#f4f4f5',
          fontWeight: '700',
          fontSize: 20,
        },
        headerTintColor: '#38bdf8',
        tabBarStyle: {
          backgroundColor: '#09090b',
          borderTopWidth: 1,
          borderTopColor: '#27272a',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#38bdf8',
        tabBarInactiveTintColor: '#52525b',
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIcon : styles.inactiveIcon}>
              <Home size={24} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="reactions"
        options={{
          title: 'Reactions',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIcon : styles.inactiveIcon}>
              <Smile size={24} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIcon : styles.inactiveIcon}>
              <Settings size={24} color={color} />
            </View>
          ),
        }}
      />
      
      {/* Hidden Screens */}
      <Tabs.Screen name="devices" options={{ href: null }} />
      <Tabs.Screen name="editor" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  activeIcon: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    padding: 8,
    borderRadius: 12,
  },
  inactiveIcon: {
    padding: 8,
  }
});
