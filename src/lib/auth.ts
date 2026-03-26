import { cookies } from "next/headers";

export async function requireSession() {
  const session = (await cookies()).get("kitchen-session");
  if (!session) {
    throw new Error("Unauthorized");
  }

  return session.value;
}
