import { getUsers } from "@/server/ops/admin";
import { getEditorSession } from "@/server/auth/session";
import { RevokeButton, UserForm } from "@/components/studio/forms";
import { fmtDate } from "@/lib/format";
import st from "@/components/studio/studio.module.css";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  const [{ users, sessions }, me] = await Promise.all([getUsers(), getEditorSession()]);
  return (
    <>
      <div className={st.pageHead}>
        <div>
          <h1>Users</h1>
          <p>
            Each access code belongs to one editor, so every change in the audit log is attributed. Codes are stored only as salted hashes; to change a code, run
            <code> npm run admin:register</code> privately on the server.
          </p>
        </div>
      </div>
      <section className={st.panel}>
        <div className={st.panelHead}>
          <h2>Editors</h2>
        </div>
        <table className={st.table}>
          <thead>
            <tr>
              <th scope="col">Code slot</th>
              <th scope="col">Last sign-in</th>
              <th scope="col">Name, role and access</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  {u.credentials.map((c) => c.label).join(", ") || "—"}
                  {u.id === me?.userId ? <span className={st.muted}> (you)</span> : null}
                </td>
                <td>{u.credentials[0]?.lastUsedAt ? fmtDate(u.credentials[0].lastUsedAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Never"}</td>
                <td>
                  <UserForm user={u} isSelf={u.id === me?.userId} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className={st.panel}>
        <div className={st.panelHead}>
          <h2>Active sessions</h2>
          <p>Sessions end after 2 hours idle or 12 hours at most.</p>
        </div>
        <table className={st.table}>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td>
                  {s.credential?.label ?? "—"}
                  {s.id === me?.sessionId ? <span className={st.muted}> (this session)</span> : null}
                </td>
                <td className={st.wrap}>{s.userAgent ?? "—"}</td>
                <td>Last active {fmtDate(s.lastSeenAt, { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}</td>
                <td>{s.id !== me?.sessionId ? <RevokeButton sessionId={s.id} /> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
