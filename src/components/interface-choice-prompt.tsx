"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Smartphone, Monitor, Sparkles } from "lucide-react";
import { useInterfaceMode, type InterfaceMode } from "@/lib/interface-mode";
import { Button } from "@/components/ui/button";

// Gates the app behind a one-time Mobile/Desktop choice for signed-in users
// who haven't picked yet. Checks session.user.id directly rather than
// NextAuth's `status`: the deactivated/invalid-token session callback
// returns a non-null-but-userless session, which NextAuth's client still
// reports as status "authenticated" — that would otherwise fire this gate
// for logged-out visitors on every public page.
export function InterfaceModeGate({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const { mode } = useInterfaceMode();

  if (session?.user?.id && mode === null) {
    return <InterfaceChoicePrompt />;
  }
  return <>{children}</>;
}

function InterfaceChoicePrompt() {
  const { setMode } = useInterfaceMode();
  const [selected, setSelected] = useState<InterfaceMode>("desktop");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelected(window.innerWidth < 768 ? "mobile" : "desktop");
  }, []);

  const confirm = async () => {
    setSaving(true);
    await setMode(selected);
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <Sparkles size={28} className="mx-auto mb-3 text-accent" />
        <h1 className="text-2xl font-semibold tracking-tight">How will you use StudyAI?</h1>
        <p className="mt-2 text-sm opacity-70">
          Pick the layout that fits how you&apos;ll mostly use it. You can switch anytime from the
          appearance menu.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {(
            [
              { mode: "mobile" as const, label: "Mobile", Icon: Smartphone },
              { mode: "desktop" as const, label: "Desktop", Icon: Monitor },
            ]
          ).map(({ mode, label, Icon }) => (
            <button
              key={mode}
              onClick={() => setSelected(mode)}
              className={`glass flex min-h-[44px] flex-col items-center gap-2 rounded-2xl p-6 transition ${
                selected === mode ? "ring-2 ring-accent" : "opacity-70 hover:opacity-100"
              }`}
            >
              <Icon size={28} />
              <span className="font-medium">{label}</span>
            </button>
          ))}
        </div>

        <Button
          variant="primary"
          size="lg"
          className="mt-6 min-h-[44px] w-full"
          onClick={confirm}
          disabled={saving}
        >
          Confirm
        </Button>
      </div>
    </div>
  );
}
