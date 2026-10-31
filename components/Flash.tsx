export default function Flash({ ok, err, okText, errText }: {
  ok?: string;
  err?: string;
  okText?: Record<string, string>;
  errText?: Record<string, string>;
}) {
  if (ok) return <div className="flash ok">{okText?.[ok] ?? 'Saved.'}</div>;
  if (err) return <div className="flash err">{errText?.[err] ?? err}</div>;
  return null;
}
