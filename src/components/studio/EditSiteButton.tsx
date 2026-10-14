"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setEditMode } from "@/app/actions/edit";

export function EditSiteButton({ path = "/", className = "btn btn-small" }: { path?: string; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      onClick={() =>
        start(async () => {
          await setEditMode(true);
          router.push(path);
        })
      }
    >
      {pending ? "Opening…" : "Edit website"}
    </button>
  );
}
