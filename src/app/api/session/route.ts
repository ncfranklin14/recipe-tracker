import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const displayName = String(formData.get("displayName") ?? "Cook").trim() || "Cook";
  const cookieStore = await cookies();

  cookieStore.set("kitchen-session", displayName, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  return NextResponse.redirect(new URL("/", request.url));
}
