import type { Metadata } from "next";
import { getCurrencyContext } from "@/server/currency/service";
import { Checkout } from "@/components/cart/Checkout";
import s from "@/components/page/page.module.css";

export const metadata: Metadata = { title: "Order request", robots: { index: false } };

export default async function CheckoutPage() {
  const ctx = await getCurrencyContext();
  return (
    <div className={`wrap ${s.page}`}>
      <header className={s.head}>
        <h1 className="h1">Order request</h1>
      </header>
      <Checkout defaultCountry={ctx.country} />
    </div>
  );
}
