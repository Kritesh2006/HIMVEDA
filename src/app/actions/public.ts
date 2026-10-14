"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { createOrderRequest, OrderError } from "@/server/orders/service";

const contactInput = z.object({
  name: z.string().trim().min(2, "Please tell us your name").max(120),
  email: z.string().trim().email("Please enter a valid email").max(200),
  topic: z.enum(["order", "wholesale", "producer", "partnership", "other"]).default("other"),
  message: z.string().trim().min(10, "A few more words, please").max(4000),
  website: z.string().max(0).optional(), // honeypot
  startedAt: z.coerce.number().optional(),
});

export type FormState = { ok: boolean; errors?: Record<string, string>; message?: string };

export async function submitContact(_: FormState, form: FormData): Promise<FormState> {
  const parsed = contactInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;
    if (errors.website) return { ok: true }; // bot: pretend success, store nothing
    return { ok: false, errors };
  }
  if (parsed.data.startedAt && Date.now() - parsed.data.startedAt < 2500) return { ok: true }; // filled too fast to be human
  await db.insert(schema.contactMessages).values({
    name: parsed.data.name,
    email: parsed.data.email,
    topic: parsed.data.topic,
    message: parsed.data.message,
  });
  return { ok: true };
}

/** Creates the order request and redirects to its confirmation page (only errors return). */
export async function placeOrderRequest(input: unknown): Promise<{ ok: false; error: string; field?: Record<string, string> }> {
  let number: string;
  try {
    const created = await createOrderRequest(input);
    number = created.number;
    const jar = await cookies();
    jar.set(`hv_order_${number}`, created.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30, secure: process.env.NODE_ENV === "production" });
  } catch (e) {
    if (e instanceof z.ZodError) {
      const field: Record<string, string> = {};
      for (const i of e.issues) field[String(i.path[0])] ??= i.message;
      return { ok: false, error: "Please check the highlighted fields.", field };
    }
    if (e instanceof OrderError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "The order request could not be sent. Please try again." };
  }
  redirect(`/orders/${number}?new=1`);
}
