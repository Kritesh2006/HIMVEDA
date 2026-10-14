import Link from "next/link";
import { ProductEditor } from "@/components/studio/ProductEditor";
import { editorOptions } from "../options";
import st from "@/components/studio/studio.module.css";

export const metadata = { title: "Add product" };

export default async function NewProduct() {
  const o = await editorOptions();
  return (
    <>
      <div className={st.pageHead}>
        <div>
          <Link href="/studio/products" className="small">
            Products
          </Link>
          <h1>Add product</h1>
          <p>Start with a name, one size and its NPR price. Everything else can be added later.</p>
        </div>
      </div>
      <ProductEditor product={null} initial={null} {...o} />
    </>
  );
}
