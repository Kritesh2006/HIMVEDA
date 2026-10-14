import { listFarmers } from "@/server/ops/agri";
import { FarmerDialog } from "@/components/studio/forms";
import { fmtKg } from "@/lib/format";
import st from "@/components/studio/studio.module.css";

export const metadata = { title: "Farmers" };

export default async function FarmersPage() {
  const farmers = await listFarmers();
  return (
    <>
      <div className={st.pageHead}>
        <div>
          <h1>Farmers</h1>
          <p>Registered producers. Names, phone numbers and exact locations stay private unless a producer agrees to a public name.</p>
        </div>
        <div className={st.pageActions}>
          <FarmerDialog />
        </div>
      </div>
      <div className={st.panel}>
        {farmers.length ? (
          <div className={st.tableWrap}>
            <table className={st.table}>
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Producer</th>
                  <th scope="col">District</th>
                  <th scope="col">Farm</th>
                  <th scope="col" className={st.num}>
                    Delivered
                  </th>
                  <th scope="col">Public name</th>
                  <th scope="col">
                    <span className="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {farmers.map((f) => {
                  const farm = f.farms[0];
                  return (
                    <tr key={f.id}>
                      <td className="code">{f.code}</td>
                      <td>
                        <strong>{f.fullName}</strong>
                        {f.isDemo ? (
                          <>
                            {" "}
                            <span className="tag tag-sample">Sample</span>
                          </>
                        ) : null}
                        {f.cooperative ? <div className={st.muted}>{f.cooperative}</div> : null}
                      </td>
                      <td>
                        {f.district}
                        {f.municipality ? <span className={st.muted}>, {f.municipality}</span> : null}
                      </td>
                      <td>{farm ? `${farm.name}${farm.altitudeM ? ` · ${farm.altitudeM} m` : ""}` : "—"}</td>
                      <td className={st.num}>{fmtKg(f.receipts.reduce((s, r) => s + r.netGrams, 0) / 1000)}</td>
                      <td>{f.publishConsent && f.publicName ? f.publicName : <span className={st.muted}>Private</span>}</td>
                      <td>
                        <FarmerDialog
                          label="Edit"
                          farmer={{ ...f, farm: farm ? { name: farm.name, altitudeM: farm.altitudeM, approxLat: farm.approxLat, approxLng: farm.approxLng, crops: farm.crops } : null }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={st.empty}>No producers registered yet. Register one to start recording deliveries.</p>
        )}
      </div>
    </>
  );
}
