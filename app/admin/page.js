"use client";

import { useEffect, useState } from "react";

export default function Admin() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [schools, setSchools] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ name: "", code: "", monthlyLimit: "" });
  const [busy, setBusy] = useState(false);

  // Keep the admin password only for this browser tab.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("misli-sam-admin");
      if (saved) {
        setPassword(saved);
        load(saved);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function api(method, body, pw = password, qs = "") {
    const res = await fetch(`/api/admin/schools${qs}`, {
      method,
      headers: { "Content-Type": "application/json", "x-admin-password": pw },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      setAuthed(false);
      try {
        sessionStorage.removeItem("misli-sam-admin");
      } catch {}
    }
    if (!res.ok) throw new Error(data.error || "Грешка.");
    if (data.schools) setSchools(data.schools);
    return data;
  }

  async function load(pw = password) {
    setError("");
    try {
      await api("GET", null, pw);
      setAuthed(true);
      try {
        sessionStorage.setItem("misli-sam-admin", pw);
      } catch {}
    } catch (e) {
      setError(e.message);
    }
  }

  async function run(fn, msg) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const data = await fn();
      if (msg) setNotice(typeof msg === "function" ? msg(data) : msg);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function create(e) {
    e.preventDefault();
    run(async () => {
      const data = await api("POST", form);
      setForm({ name: "", code: "", monthlyLimit: "" });
      return data;
    }, (d) => `Училището е създадено. Код: ${d.code}`);
  }

  function editLimit(s) {
    const v = window.prompt(`Месечен лимит на анализи за „${s.name}“ (празно = без лимит):`, s.monthly_limit ?? "");
    if (v === null) return;
    run(() => api("PATCH", { id: s.id, monthlyLimit: v.trim() }), "Лимитът е обновен.");
  }

  function newCode(s) {
    if (!window.confirm(`Нов код за „${s.name}“? Старият спира да работи и всички учители ще трябва да влязат отново.`)) return;
    run(() => api("PATCH", { id: s.id, newCode: true }), "Създаден е нов код.");
  }

  function toggle(s) {
    const msg = s.active
      ? `Спиране на достъпа за „${s.name}“? Всички учители ще бъдат изведени веднага.`
      : `Възстановяване на достъпа за „${s.name}“?`;
    if (!window.confirm(msg)) return;
    run(() => api("PATCH", { id: s.id, active: !s.active }), s.active ? "Достъпът е спрян." : "Достъпът е възстановен.");
  }

  function remove(s) {
    if (!window.confirm(`Изтриване на „${s.name}“ заедно с цялата му статистика? Това не може да се отмени.`)) return;
    run(() => api("DELETE", null, password, `?id=${s.id}`), "Училището е изтрито.");
  }

  function copy(code) {
    navigator.clipboard?.writeText(code).then(() => setNotice(`Кодът ${code} е копиран.`)).catch(() => {});
  }

  if (!authed) {
    return (
      <div className="shell">
        <section className="card login">
          <h1>Администрация</h1>
          <p className="lead">Въведете администраторската парола (ADMIN_PASSWORD от Vercel).</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              load();
            }}
          >
            <label>
              Парола
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
            </label>
            {error && <p className="error">{error}</p>}
            <button className="primary big" type="submit">Вход</button>
          </form>
        </section>
      </div>
    );
  }

  const totalMonth = schools.reduce((n, s) => n + s.analyses_month, 0);

  return (
    <div className="shell admin" style={{ maxWidth: 1080 }}>
      <header className="top">
        <div className="brand">
          <span className="mark">М</span>
          <div>
            <strong>Мисли сам · Администрация</strong>
            <small>{schools.length} училища · {totalMonth} анализа този месец</small>
          </div>
        </div>
        <a className="link" href="/">← Към приложението</a>
      </header>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Ново училище</h2>
        <form className="new-school" onSubmit={create}>
          <label>
            Име
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="СУ „Христо Ботев“, Павликени" required />
          </label>
          <label>
            Код <span className="optional">(празно = автоматичен)</span>
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="автоматичен" />
          </label>
          <label>
            Лимит / месец <span className="optional">(по избор)</span>
            <input type="number" min="0" value={form.monthlyLimit} onChange={(e) => setForm({ ...form, monthlyLimit: e.target.value })} placeholder="без лимит" />
          </label>
          <button className="primary" type="submit" disabled={busy}>Създай</button>
        </form>
        {notice && <p className="notice">{notice}</p>}
        {error && <p className="error">{error}</p>}
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Училища</h2>
        {schools.length === 0 ? (
          <p className="hint">Все още няма училища. Създайте първото по-горе.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Училище</th>
                  <th>Код</th>
                  <th>Статус</th>
                  <th>Анализи (месец)</th>
                  <th>Общо</th>
                  <th>Учители</th>
                  <th>Активни сесии</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {schools.map((s) => (
                  <tr key={s.id} className={s.active ? "" : "row-off"}>
                    <td><strong>{s.name}</strong></td>
                    <td>
                      <code>{s.code}</code>{" "}
                      <button className="link" onClick={() => copy(s.code)}>копирай</button>
                    </td>
                    <td><span className={`badge ${s.active ? "on" : "off"}`}>{s.active ? "активно" : "спряно"}</span></td>
                    <td>
                      {s.analyses_month}
                      {s.monthly_limit != null ? ` / ${s.monthly_limit}` : ""}
                    </td>
                    <td>{s.analyses_total}</td>
                    <td>{s.teachers}</td>
                    <td>{s.sessions}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="ghost small" onClick={() => editLimit(s)} disabled={busy}>Лимит</button>{" "}
                      <button className="ghost small" onClick={() => newCode(s)} disabled={busy}>Нов код</button>{" "}
                      <button className="ghost small" onClick={() => toggle(s)} disabled={busy}>{s.active ? "Спри" : "Пусни"}</button>{" "}
                      <button className="ghost small" onClick={() => remove(s)} disabled={busy}>Изтрий</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint" style={{ marginTop: 14 }}>„Учители“ брои само тези, които са въвели име при вход.</p>
      </section>
    </div>
  );
}
