import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getEditorSession } from "@/server/auth/session";
import { AccessForm } from "@/components/studio/AccessForm";

export const metadata: Metadata = { title: "Authorized access", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function OwnerPage() {
  if (await getEditorSession()) redirect("/studio");
  return <AccessForm />;
}
