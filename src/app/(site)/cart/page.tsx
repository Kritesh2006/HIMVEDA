import { redirect } from "next/navigation";

/** The cart lives in a drawer; /cart is kept as a stable URL that goes straight to the order request. */
export default function CartPage() {
  redirect("/checkout");
}
