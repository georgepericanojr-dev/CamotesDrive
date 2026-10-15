import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  useWindowDimensions,
  type ViewProps,
} from "react-native";
import { useFocusEffect } from "expo-router";

const ReducedMotion = createContext(true);

export function MotionProvider({ children }: { children: ReactNode }) {
  // Start without motion until the device/browser preference is known.
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (value) => {
        changed = true;
        if (active) setReduced(value);
      },
    );
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active && !changed) setReduced(value);
      })
      .catch(() => {});
    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);
  return (
    <ReducedMotion.Provider value={reduced}>{children}</ReducedMotion.Provider>
  );
}

export const useReducedMotion = () => useContext(ReducedMotion);

// Web's native-stack fallback does not animate route changes. Animate only the
// content there, leaving navigation controls stable. Also used by modal panels.
export function MotionView({
  children,
  enabled = true,
  active = true,
  transitionKey,
  style,
}: {
  children: ReactNode;
  enabled?: boolean;
  active?: boolean;
  transitionKey?: string;
  style?: ViewProps["style"];
}) {
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  // Mobile browsers use only opacity; native screens use the stack fade.
  const mobile = width < 1000;
  const animate = enabled && !reduced && Platform.OS === "web";
  const [progress] = useState(() => new Animated.Value(1));
  useFocusEffect(
    useCallback(() => {
      // Section changes are navigation even when the Expo route stays the same.
      void transitionKey;
      progress.stopAnimation();
      if (!animate || !active) {
        progress.setValue(1);
        return;
      }
      progress.setValue(0);
      const animation = Animated.timing(progress, {
        toValue: 1,
        duration: mobile ? 180 : 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: Platform.OS !== "web",
        isInteraction: false,
      });
      animation.start();
      return () => {
        animation.stop();
        progress.setValue(1);
      };
      // transitionKey replays the entrance for admin sections within one route.
    }, [active, animate, mobile, progress, transitionKey]),
  );
  const distance = animate && !mobile ? 12 : 0;
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: animate && mobile ? progress : 1,
          transform:
            animate && !mobile
              ? [
                  {
                    translateX: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [distance, 0],
                    }),
                  },
                ]
              : undefined,
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
