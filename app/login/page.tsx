import { login } from './actions';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="login">
      <div className="card">
        <h1>Shop Admin</h1>
        <div className="muted">Sign in to manage orders</div>
        {sp.error && <div className="flash err" style={{ marginTop: 14, marginBottom: 0 }}>Wrong password</div>}
        <form action={login}>
          <input type="hidden" name="next" value={sp.next ?? '/'} />
          <input type="password" name="password" placeholder="Admin password" autoFocus required />
          <button className="btn primary" type="submit">Sign in</button>
        </form>
      </div>
    </div>
  );
}
