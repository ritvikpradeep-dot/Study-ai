import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const VALID = ["MOBILE", "DESKTOP"] as const;

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const preference = body?.interfacePreference;
  if (!VALID.includes(preference)) {
    return NextResponse.json({ error: "interfacePreference must be MOBILE or DESKTOP." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { interfacePreference: preference },
  });

  return NextResponse.json({ ok: true });
}
