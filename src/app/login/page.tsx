"use client";
import { useState } from "react";
import { ArrowRight, Clapperboard, LockKeyhole, Sparkles } from "lucide-react";
export default function Login() {
  const [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="login">
      <div className="login-art">
        <div className="brand">
          <span className="logo">
            <Clapperboard size={23} />
          </span>
          K-Shorts<span className="muted">Studio</span>
        </div>
        <div>
          <span className="eyebrow">YOUR NEXT GREAT SHORT STARTS HERE</span>
          <h1>
            Ide kecil.
            <br />
            Cerita yang
            <br />
            <em>berkesan.</em>
          </h1>
          <p>
            Ruang produksi pribadi untuk mengubah momen K-Pop menjadi cerita.
            Dari ide pertama sampai final cut.
          </p>
          <div className="login-stages">
            IDEA <span>→</span> SCRIPT <span>→</span> EDIT <span>→</span> REVIEW
          </div>
        </div>
        <small>BUILT FOR CREATORS. GUIDED BY YOU.</small>
      </div>
      <div className="login-form">
        <div className="login-box">
          <span className="icon-tile">
            <LockKeyhole />
          </span>
          <h2>Selamat datang kembali.</h2>
          <p className="muted">Masuk ke studio privat Anda.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                const r = await fetch("/api/login", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ password }),
                });
                const b = await r.json();
                if (!r.ok) throw new Error(b.error);
                window.location.href = "/";
              } catch (e) {
                setError(e instanceof Error ? e.message : "Login gagal");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Password studio
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Masukkan password privat"
              />
            </label>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button className="primary full" disabled={busy}>
              {busy ? "Memeriksa…" : "Masuk ke studio"}
              <ArrowRight size={16} />
            </button>
          </form>
          <small className="muted login-note">
            <Sparkles size={14} /> AI membantu. Keputusan kreatif tetap milik
            Anda.
          </small>
        </div>
      </div>
    </main>
  );
}
