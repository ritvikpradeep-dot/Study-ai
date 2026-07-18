"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { useSession } from "next-auth/react";

export type InterfaceMode = "mobile" | "desktop";

type InterfaceModeContextValue = {
  mode: InterfaceMode | null;
  setMode: (mode: InterfaceMode) => Promise<void>;
};

const InterfaceModeContext = createContext<InterfaceModeContextValue | null>(null);

export function InterfaceModeProvider({ children }: { children: React.ReactNode }) {
  const { data: session, update } = useSession();

  const setMode = useCallback(
    async (mode: InterfaceMode) => {
      await fetch("/api/user/interface-preference", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interfacePreference: mode.toUpperCase() }),
      });
      await update();
    },
    [update]
  );

  const mode = useMemo<InterfaceMode | null>(() => {
    const pref = session?.user?.interfacePreference;
    if (pref === "MOBILE") return "mobile";
    if (pref === "DESKTOP") return "desktop";
    return null;
  }, [session?.user?.interfacePreference]);

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);

  return <InterfaceModeContext.Provider value={value}>{children}</InterfaceModeContext.Provider>;
}

// Returns null while the user hasn't chosen yet (or session hasn't loaded) —
// callers gate on that to show the choice prompt instead of a layout.
export function useInterfaceMode() {
  const ctx = useContext(InterfaceModeContext);
  if (!ctx) throw new Error("useInterfaceMode must be used within InterfaceModeProvider");
  return ctx;
}
