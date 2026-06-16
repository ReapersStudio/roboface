import React, { useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';

const DESIGN_WIDTH = 800;
const DESIGN_HEIGHT = 480;
const DESIGN_CENTER_X = DESIGN_WIDTH / 2;
const DESIGN_CENTER_Y = DESIGN_HEIGHT / 2;

export default function RobotFacePreview({ reaction, settings }: any) {
  const blinkScale = useSharedValue(1);
  const time = useSharedValue(0);

  // Blinking loop
  useEffect(() => {
    if (reaction?.blink !== false && settings?.preview?.blinking !== false) {
      const interval = setInterval(() => {
        if (Math.random() > 0.3) {
          blinkScale.value = withSequence(
            withTiming(0.1, { duration: 50 }),
            withTiming(1, { duration: 100 })
          );
        }
      }, 4000);
      return () => clearInterval(interval);
    } else {
      blinkScale.value = 1;
    }
  }, [reaction?.blink, settings?.preview?.blinking]);

  // Continuous animation loop driven on the UI thread
  useEffect(() => {
    // Reset time to 0, then start a continuous linear timing function
    // 100,000 seconds is practically infinite for a mobile screen
    time.value = 0;
    time.value = withTiming(100000 * 1000, { duration: 100000 * 1000, easing: Easing.linear });
    return () => cancelAnimation(time);
  }, [reaction?.code]);

  const leftEyeStyle = useAnimatedStyle(() => {
    const t = time.value * Number(settings?.animationSpeed || 1);
    const code = Number(reaction?.code || 0);
    
    let currentX = DESIGN_CENTER_X + Number(reaction?.leftX ?? -80);
    let currentY = DESIGN_CENTER_Y + Number(reaction?.leftY ?? 0);
    let currentAngle = Number(reaction?.leftAngle ?? 0);
    let currentH = Number(reaction?.eyeHeight ?? 120);

    // EXACT MOTION TRANSLATION FROM WEB CANVAS
    if (code === 0) { // Normal
      currentY += Math.sin(t / 600) * 4;
      const cycle = t % 10000;
      if (cycle < 1500) currentX += 25;
      else if (cycle > 4500 && cycle < 6000) currentX -= 25;
    } else if (code === 3) { // Nervous
      currentX += (Math.random() * 6 - 3);
    } else if (code === 6) { // Joyful
      currentY += (-Math.abs(Math.sin(t / 150)) * 25 + 10);
    } else if (code === 8) { // Idea
      currentY += (-30 + Math.sin(t / 300) * 10);
      currentAngle = (Math.sin(t / 200) * 0.1 * 180) / Math.PI;
    } else if (code === 9) { // Side Eye
      currentX += Math.sin(t / 800) * 10;
    } else if (code === 11) { // Happy Walking
      currentY += (-30 + Math.sin(t / 150) * 15);
      currentAngle = ((-0.1 + Math.sin(t / 200) * 0.15) * 180) / Math.PI;
    } else if (code === 12) { // Dancing
      const dt = t / 150;
      currentX += Math.sin(dt) * 40;
      currentY += Math.abs(Math.cos(dt)) * 30 - 15;
      currentAngle = (Math.sin(dt) * 0.3 * 180) / Math.PI;
      currentH = 100 - Math.abs(Math.cos(dt)) * 30;
    }

    const isCurve = reaction?.feature === 'curve';

    return {
      width: Number(reaction?.eyeWidth ?? 130),
      height: isCurve ? 60 : Math.max(4, currentH * blinkScale.value),
      transform: [
        { translateX: currentX - DESIGN_CENTER_X },
        { translateY: currentY - DESIGN_CENTER_Y },
        { rotate: `${currentAngle}deg` },
      ],
      backgroundColor: isCurve ? 'transparent' : (reaction?.color || '#00ffff'),
      borderColor: isCurve ? (reaction?.color || '#00ffff') : 'transparent',
      shadowColor: reaction?.color || '#00ffff',
    };
  });

  const rightEyeStyle = useAnimatedStyle(() => {
    const t = time.value * Number(settings?.animationSpeed || 1);
    const code = Number(reaction?.code || 0);
    
    let currentX = DESIGN_CENTER_X + Number(reaction?.rightX ?? 80);
    let currentY = DESIGN_CENTER_Y + Number(reaction?.rightY ?? 0);
    let currentAngle = Number(reaction?.rightAngle ?? 0);
    let currentH = Number(reaction?.eyeHeight ?? 120);

    // EXACT MOTION TRANSLATION FROM WEB CANVAS
    if (code === 0) { // Normal
      currentY += Math.sin(t / 600) * 4;
      const cycle = t % 10000;
      if (cycle < 1500) currentX += 25;
      else if (cycle > 4500 && cycle < 6000) currentX -= 25;
    } else if (code === 3) { // Nervous
      currentX += (Math.random() * 6 - 3);
    } else if (code === 6) { // Joyful
      currentY += (-Math.abs(Math.sin(t / 150)) * 25 + 10);
    } else if (code === 8) { // Idea
      currentY += (-30 + Math.sin(t / 300) * 10);
      currentAngle = (-Math.sin(t / 200) * 0.1 * 180) / Math.PI; // Right eye inverses angle
    } else if (code === 9) { // Side Eye
      currentX += Math.sin(t / 800) * 10;
    } else if (code === 11) { // Happy Walking
      currentY += (-30 + Math.sin(t / 150) * 15);
      currentAngle = ((-0.1 + Math.sin(t / 200) * 0.15) * 180) / Math.PI;
    } else if (code === 12) { // Dancing
      const dt = t / 150;
      currentX += Math.sin(dt) * 40;
      currentY += Math.abs(Math.cos(dt)) * 30 - 15;
      currentAngle = (Math.sin(dt) * 0.3 * 180) / Math.PI;
      currentH = 100 - Math.abs(Math.cos(dt)) * 30;
    }

    const isCurve = reaction?.feature === 'curve';

    return {
      width: Number(reaction?.eyeWidth ?? 130),
      height: isCurve ? 60 : Math.max(4, currentH * blinkScale.value),
      transform: [
        { translateX: currentX - DESIGN_CENTER_X },
        { translateY: currentY - DESIGN_CENTER_Y },
        { rotate: `${currentAngle}deg` },
      ],
      backgroundColor: isCurve ? 'transparent' : (reaction?.color || '#00ffff'),
      borderColor: isCurve ? (reaction?.color || '#00ffff') : 'transparent',
      shadowColor: reaction?.color || '#00ffff',
    };
  });

  const accessoryStyle = useAnimatedStyle(() => {
    const t = time.value * Number(settings?.animationSpeed || 1);
    
    if (reaction?.feature === 'sweat') {
      const drip = ((t % 1000) / 1000) * 20;
      return { transform: [{ translateY: drip }], opacity: 1 };
    }
    
    if (reaction?.feature === 'zzz') {
      const zTime = t / 500;
      const riseA = (t % 2000) / 20;
      return { 
        transform: [
          { translateX: Math.sin(zTime) * 10 },
          { translateY: -riseA }
        ],
        opacity: 1 - (riseA / 100)
      };
    }

    return { opacity: 0 };
  });

  return (
    <View style={styles.container}>
      <View style={styles.canvas}>
        <Animated.View style={[styles.eye, leftEyeStyle, reaction?.feature === 'curve' && styles.curveEye]} />
        <Animated.View style={[styles.eye, rightEyeStyle, reaction?.feature === 'curve' && styles.curveEye]} />

        {reaction?.feature === 'zzz' && (
          <Animated.Text style={[styles.zzz, accessoryStyle]}>Zzz</Animated.Text>
        )}
        {reaction?.feature === 'sweat' && (
          <Animated.View style={[styles.sweat, accessoryStyle, { left: 80, top: 80 }]} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 800 / 480,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  canvas: {
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    position: 'absolute',
    transform: [{ scale: 0.4 }], 
    justifyContent: 'center',
    alignItems: 'center',
  },
  eye: {
    position: 'absolute',
    borderRadius: 40,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 10,
  },
  curveEye: {
    borderTopWidth: 20,
    borderLeftWidth: 20,
    borderRightWidth: 20,
    borderBottomWidth: 0,
    borderTopLeftRadius: 60,
    borderTopRightRadius: 60,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  zzz: {
    position: 'absolute',
    right: 150,
    top: 150,
    fontSize: 80,
    color: '#fff',
    opacity: 0.6,
  },
  sweat: {
    position: 'absolute',
    width: 30,
    height: 30,
    backgroundColor: '#38bdf8',
    borderRadius: 15,
    opacity: 0.8,
  },
});
