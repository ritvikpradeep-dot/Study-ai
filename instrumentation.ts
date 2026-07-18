export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureDomStubs } = await import("@/lib/dom-polyfills");
    ensureDomStubs();
  }
}
