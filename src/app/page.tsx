import { redirect } from "next/navigation";
import { session } from "@/lib/auth";
import Studio from "@/components/studio";
export const dynamic = "force-dynamic";
export default async function Page() {
  if (!(await session())) redirect("/login");
  return <Studio />;
}
