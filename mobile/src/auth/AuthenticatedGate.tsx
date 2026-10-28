import { useEffect, useState, type ReactNode } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { authMessage, type AuthUser } from "@inout/identity";
import { getAuth } from "./composition";
import { theme as t } from "../theme";
export function AuthenticatedGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [notice, setNotice] = useState("Restaurando seu acesso…");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => getAuth().currentUser())
      .then((value) => {
        if (!active) return;
        if (!value?.emailConfirmed) {
          router.replace("/entrar");
          return;
        }
        setUser(value);
        setNotice("");
      })
      .catch((error) => {
        if (active) {
          setUser(null);
          setNotice(authMessage(error));
        }
      });
    return () => {
      active = false;
    };
  }, [revision]);
  useEffect(() => {
    try {
      const unsubscribe = getAuth().subscribe(() => {
        setUser(null);
        setRevision((value) => value + 1);
      });
      return unsubscribe;
    } catch {
      return;
    }
  }, []);
  if (!user)
    return (
      <View style={s.wait}>
        <Text accessibilityLiveRegion="polite" style={s.text}>
          {notice}
        </Text>
        <Pressable
          accessibilityRole="button"
          style={s.action}
          onPress={() => router.replace("/entrar")}
        >
          <Text style={s.text}>Ir para entrar</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={s.action}
          onPress={() => setRevision((value) => value + 1)}
        >
          <Text style={s.text}>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  return <View style={s.root}>{children}</View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: t.cream },
  wait: {
    flex: 1,
    backgroundColor: t.cream,
    padding: 24,
    justifyContent: "center",
  },
  text: { fontFamily: t.sans, fontSize: 13, color: t.ink },
  action: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
});
