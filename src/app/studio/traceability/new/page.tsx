import Link from "next/link";
import { asc, eq, ne } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { BatchForm } from "@/components/studio/BatchForm";
import st from "@/components/studio/studio.module.css";

export const metadata = { title: "Form a batch" };

export default async function NewBatch() {
  const [receipts, centers, products] = await Promise.all([
    db.query.collectionReceipts.findMany({
      where: eq(schema.collectionReceipts.status, "procured"),
      with: { batchLinks: true, procurement: true, farmer: { columns: { code: true } }, collectionCenter: { columns: { code: true } } },
    }),
    db.select({ id: schema.collectionCenters.id, code: schema.collectionCenters.code, name: schema.collectionCenters.name }).from(schema.collectionCenters).orderBy(asc(schema.collectionCenters.code)),
    db.select({ id: schema.products.id, name: schema.products.name }).from(schema.products).where(ne(schema.products.status, "archived")).orderBy(asc(schema.products.name)),
  ]);
  const open = receipts.filter((r) => !r.batchLinks.length && r.procurement);
  return (
    <>
      <div className={st.pageHead}>
        <div>
          <Link href="/studio/traceability" className="small">
            Traceability
          </Link>
          <h1>Form a batch</h1>
          <p>Combine procured deliveries from one centre into a numbered batch. The trace page stays hidden until you publish it.</p>
        </div>
      </div>
      <div className={st.panel}>
        <BatchForm
          receipts={open.map((r) => ({ id: r.id, receiptNo: r.receiptNo, commodity: r.commodity, centerId: r.collectionCenterId, centerCode: r.collectionCenter.code, farmer: r.farmer.code, acceptedKg: (r.procurement?.acceptedGrams ?? 0) / 1000 }))}
          centers={centers.map((c) => ({ id: c.id, label: `${c.code} · ${c.name}` }))}
          products={products.map((p) => ({ id: p.id, label: p.name }))}
        />
      </div>
    </>
  );
}
