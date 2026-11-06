import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(user.role === "PATIENT" ? "/portal" : "/dashboard");
}
