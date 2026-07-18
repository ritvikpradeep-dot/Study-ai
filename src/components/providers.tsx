"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { ToastProvider } from "@/components/ui/toast";
import { InterfaceModeProvider } from "@/lib/interface-mode";
import { InterfaceModeGate } from "@/components/interface-choice-prompt";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <ToastProvider>
          <InterfaceModeProvider>
            <InterfaceModeGate>{children}</InterfaceModeGate>
          </InterfaceModeProvider>
        </ToastProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
