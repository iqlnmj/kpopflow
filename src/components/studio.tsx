"use client";
import { useEffect, useState, useCallback } from "react";
import {
  LayoutDashboard,
  FolderOpen,
  Sparkles,
  FileText,
  Film,
  Video,
  Settings,
  ChevronRight,
  Plus,
  Search,
  ArrowUpRight,
  ArrowRight,
  Clapperboard,
  Check,
  Clock,
  LogOut,
  LayoutGrid,
  List,
  Columns3,
  X,
  LoaderCircle,
  ShieldCheck,
  Activity,
} from "lucide-react";
import type { ProjectCard, ProjectDetail, Topic } from "./types";
import Workspace from "./workspace";
const cats = [
  "Visual mystery",
  "Idol micro-story",
  "Unexpected moment",
  "Music commentary",
  "Behind-the-scenes",
  "Other",
];
const statusName = (s: string) =>
  ({
    TOPIC_SELECTED: "Topik dipilih",
    INDONESIAN_DRAFT: "Draft Indonesia",
    INDONESIAN_APPROVED: "Indonesia disetujui",
    ENGLISH_DRAFT: "Draft English",
    ENGLISH_APPROVED: "English disetujui",
    EDITING_PLAN_READY: "Siap editing",
    VIDEO_REVIEW_PENDING: "Menunggu review",
    VIDEO_REVIEWED: "Sudah direview",
    REVISION_REQUESTED: "Perlu revisi",
    FINAL_APPROVED: "Final approved",
  })[s] || s;
export { statusName };
export async function api<T = unknown>(
  url: string,
  body?: unknown,
): Promise<T> {
  const r = await fetch(
    "/api/" + url,
    body === undefined
      ? { cache: "no-store" }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const data = await r.json();
  if (r.status === 401) {
    window.location.href = "/login";
    throw new Error("Sesi berakhir.");
  }
  if (!r.ok) throw new Error(data.error || "Permintaan gagal");
  return data;
}
export default function Studio() {
  const [page, setPage] = useState("Dashboard"),
    [projects, setProjects] = useState<ProjectCard[]>([]),
    [selected, setSelected] = useState<ProjectDetail | null>(null),
    [tab, setTab] = useState("topic"),
    [search, setSearch] = useState(""),
    [view, setView] = useState("grid"),
    [modal, setModal] = useState(false),
    [prefill, setPrefill] = useState<Record<string, unknown>>({}),
    [topics, setTopics] = useState<Topic[]>([]),
    [custom, setCustom] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState<{ text: string; error: boolean } | null>(
      null,
    ),
    [config, setConfig] = useState({
      mode: "loading",
      configured: false,
      model: "",
    });
  const notify = useCallback((text: string, error = false) => {
    setNotice({ text, error });
  }, []);
  const reload = useCallback(async () => {
    setProjects(await api<ProjectCard[]>("projects"));
  }, []);
  useEffect(() => {
    void Promise.all([
      reload(),
      api<typeof config>("status").then(setConfig),
      api<Topic[]>("topics").then(setTopics),
    ]).catch((e) => notify(e.message, true));
  }, [reload, notify]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6500);
    return () => clearTimeout(t);
  }, [notice]);
  const open = async (id: string, t = "topic") => {
    try {
      setSelected(await api<ProjectDetail>("projects/" + id));
      setTab(t);
      setPage("Projects");
    } catch (e) {
      notify((e as Error).message, true);
    }
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  const nav = (name: string) => {
    setPage(name);
    setSelected(null);
    setSearch("");
  };
  const create = (data: Record<string, unknown> = {}) => {
    setPrefill(data);
    setModal(true);
  };
  const filtered = projects.filter((p) =>
    (p.title + " " + p.artist).toLowerCase().includes(search.toLowerCase()),
  );
  const done = projects.filter((p) => p.status === "FINAL_APPROVED").length;
  const review = projects.filter(
    (p) => p.status.startsWith("VIDEO") || p.status === "REVISION_REQUESTED",
  ).length;
  const editing = projects.filter((p) =>
    ["EDITING_PLAN_READY", "ENGLISH_APPROVED"].includes(p.status),
  ).length;
  const scripts = projects.length - done - review - editing;
  const navItems = [
    { label: "Dashboard", icon: LayoutDashboard },
    { label: "Projects", icon: FolderOpen },
    { label: "Discover Topics", icon: Sparkles },
    { label: "Script Studio", icon: FileText },
    { label: "Editing Studio", icon: Film },
    { label: "Video Reviews", icon: Video },
  ];
  const card = (p: ProjectCard, i: number) => (
    <button
      key={p.id}
      className={"project-card cover-" + (i % 4)}
      onClick={() =>
        void open(
          p.id,
          page === "Video Reviews"
            ? "video"
            : page === "Editing Studio"
              ? "timeline"
              : page === "Script Studio"
                ? "scripts"
                : "topic",
        )
      }
    >
      <div className="card-art">
        <div className="art-line" />
        <span className="art-word">{p.artist.split("/")[0].trim()}</span>
        <span className="art-mark">K / {String(i + 1).padStart(2, "0")}</span>
        <span className="art-category">{p.category.toUpperCase()}</span>
        {p.demo && <span className="demo-label">DEMO</span>}
        <span className="art-duration">{p.targetDuration}s</span>
      </div>
      <div className="card-body">
        <div className="card-meta">
          <span>{p.artist}</span>
          <ArrowUpRight size={15} />
        </div>
        <h3>{p.title}</h3>
        <span
          className={
            "badge " +
            (p.status === "FINAL_APPROVED"
              ? "green"
              : p.status.startsWith("VIDEO")
                ? "amber"
                : "purple")
          }
        >
          {p.status === "FINAL_APPROVED" ? (
            <Check size={11} />
          ) : (
            <span className="dot" />
          )}
          {statusName(p.status)}
        </span>
        <div className="card-bottom">
          <span>
            <FileText size={12} />
            {p._count.scripts} versi script
          </span>
          <span>
            <Video size={12} />
            {p._count.revisions} video
          </span>
        </div>
        <div className="card-date">
          Dibuat {new Date(p.createdAt).toLocaleDateString("id-ID")} ·
          Diperbarui {new Date(p.updatedAt).toLocaleDateString("id-ID")}
        </div>
      </div>
    </button>
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <span className="logo">
            <Clapperboard size={21} />
          </span>
          <span>
            K-Shorts<small>STUDIO</small>
          </span>
        </a>
        <div className="workspace-switch">
          <span className="avatar">K</span>
          <div>
            Creator workspace<small>Private studio</small>
          </div>
          <ShieldCheck size={15} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {navItems.map((n) => (
            <button
              key={n.label}
              onClick={() => nav(n.label)}
              className={page === n.label ? "active" : ""}
            >
              <n.icon size={18} />
              {n.label}
              {n.label === "Projects" && (
                <span className="nav-count">{projects.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="nav-bottom">
          <div className="studio-note">
            <span className="tiny-star">✦</span>
            <strong>Ide Anda. Kendali Anda.</strong>
            <p>
              AI sebagai partner kreatif.
              <br />
              Anda yang memberi lampu hijau.
            </p>
            <span className="badge green">
              <span className="dot" />
              Human-in-the-loop
            </span>
          </div>
          <button
            className={
              page === "Settings" ? "nav-settings active" : "nav-settings"
            }
            onClick={() => nav("Settings")}
          >
            <Settings size={18} />
            Pengaturan
          </button>
          <div className="profile">
            <span className="avatar">CR</span>
            <div>
              Creator<small>Private account</small>
            </div>
            <button
              aria-label="Keluar"
              onClick={() =>
                void run(async () => {
                  await api("logout", {});
                  window.location.href = "/login";
                })
              }
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace
            <ChevronRight size={13} />
            <span>{selected ? "Project workspace" : page}</span>
          </div>
          <div className="topbar-right">
            <span className={"mode " + (config.mode === "demo" ? "" : "live")}>
              <span className="dot" />
              {config.mode === "demo"
                ? "DEMO MODE"
                : config.mode === "live"
                  ? "LIVE AI"
                  : "AI BELUM SIAP"}
            </span>
            <span className="private-label">
              <ShieldCheck size={13} />
              Private workspace
            </span>
          </div>
        </header>
        <main className="main-content">
          {selected ? (
            <Workspace
              project={selected}
              setProject={setSelected}
              tab={tab}
              setTab={setTab}
              back={() => {
                setSelected(null);
                void reload();
              }}
              notify={notify}
              refreshCards={reload}
            />
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">
                    {page === "Dashboard"
                      ? "YOUR CREATIVE HQ"
                      : "K-SHORTS STUDIO"}
                  </span>
                  <h1>
                    {page === "Dashboard"
                      ? "Let’s make something worth watching."
                      : page === "Discover Topics"
                        ? "Temukan cerita berikutnya."
                        : page === "Settings"
                          ? "Pengaturan studio."
                          : page === "Projects"
                            ? "Semua project."
                            : page === "Script Studio"
                              ? "Dari ide menjadi narasi."
                              : page === "Editing Studio"
                                ? "Setiap detik punya cerita."
                                : "Review. Refine. Repeat."}
                  </h1>
                  <p>
                    {page === "Dashboard"
                      ? "Selamat datang kembali. Cerita K-Pop berikutnya dimulai di sini."
                      : page === "Discover Topics"
                        ? "Cari sudut cerita yang spesifik, periksa sumbernya, lalu mulai berkarya."
                        : page === "Settings"
                          ? "Konfigurasi privat dan kemampuan yang tersedia di phase 1."
                          : "Pilih project untuk melanjutkan produksi dari tahap terakhir."}
                  </p>
                </div>
                {page !== "Settings" && (
                  <button className="primary" onClick={() => create()}>
                    <Plus size={16} />
                    Project baru
                  </button>
                )}
              </div>
              {page === "Dashboard" && (
                <>
                  <section className="stats-grid">
                    {[
                      {
                        label: "Total project",
                        value: projects.length,
                        sub: "Semua cerita Anda",
                        icon: FolderOpen,
                        color: "purple",
                      },
                      {
                        label: "Dalam penulisan",
                        value: scripts,
                        sub: "Ide & script development",
                        icon: FileText,
                        color: "blue",
                      },
                      {
                        label: "Dalam editing",
                        value: editing,
                        sub: "Siap masuk ruang editing",
                        icon: Film,
                        color: "amber",
                      },
                      {
                        label: "Menunggu / dalam review",
                        value: review,
                        sub: "Waktunya menyempurnakan",
                        icon: Video,
                        color: "pink",
                      },
                      {
                        label: "Selesai",
                        value: done,
                        sub: "Final approved",
                        icon: Check,
                        color: "green",
                      },
                    ].map((s) => (
                      <div className="stat" key={s.label}>
                        <div className="stat-top">
                          {s.label}
                          <span className={"stat-icon " + s.color}>
                            <s.icon size={16} />
                          </span>
                        </div>
                        <strong>{String(s.value).padStart(2, "0")}</strong>
                        <small>{s.sub}</small>
                      </div>
                    ))}
                  </section>
                  <section className="creative-banner">
                    <div>
                      <span className="eyebrow">
                        <Sparkles size={13} /> FROM IDEA TO FINAL CUT
                      </span>
                      <h2>Satu ruang untuk seluruh proses kreatif.</h2>
                      <p>
                        Temukan angle, tulis cerita, dan sempurnakan video.
                        <br />
                        AI mendampingi setiap langkah. Approval tetap di tangan
                        Anda.
                      </p>
                      <button onClick={() => nav("Discover Topics")}>
                        Eksplorasi ide baru <ArrowRight size={15} />
                      </button>
                    </div>
                    <div className="banner-visual">
                      <div className="orbit o1" />
                      <div className="orbit o2" />
                      <div className="floating-label f1">
                        <Sparkles size={16} />A fresh idea
                      </div>
                      <div className="play-square">
                        <Clapperboard size={49} strokeWidth={1.2} />
                      </div>
                      <div className="floating-label f2">
                        <Check size={14} />
                        Ready for the spotlight
                      </div>
                      <span className="spark s1">✦</span>
                      <span className="spark s2">✧</span>
                    </div>
                  </section>
                  <div className="production-strip">
                    <span className="eyebrow">PRODUCTION FLOW</span>
                    {[
                      "Topic",
                      "Script ID",
                      "Script EN",
                      "Editing",
                      "Video review",
                      "Final",
                    ].map((s, i) => (
                      <span key={s}>
                        <b>{String(i + 1).padStart(2, "0")}</b>
                        {s}
                        {i < 5 && <ChevronRight size={13} />}
                      </span>
                    ))}
                  </div>
                </>
              )}
              {page === "Discover Topics" ? (
                <>
                  <section className="panel discovery">
                    <div className="section-title">
                      <span className="icon-tile">
                        <Sparkles size={20} />
                      </span>
                      <div>
                        <h2>Sebuah ide bisa jadi cerita besar.</h2>
                        <p>
                          Kembangkan topik Anda menjadi beberapa storytelling
                          angle.
                        </p>
                      </div>
                    </div>
                    <label>
                      Ide atau topik awal
                      <textarea
                        value={custom}
                        onChange={(e) => setCustom(e.target.value)}
                        maxLength={3000}
                        placeholder="Contoh: Apakah K-Pop mulai kembali ke lagu yang lebih panjang?"
                        rows={3}
                      />
                    </label>
                    <div className="row between">
                      <small className="muted">
                        Tanpa web research. Semua klaim perlu verifikasi manual.
                      </small>
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            const rows = await api<Topic[]>("topics", {
                              topic: custom,
                            });
                            setTopics((v) => [...rows, ...v]);
                            notify(
                              "Angle baru disimpan. Periksa fakta sebelum dipakai.",
                            );
                          })
                        }
                      >
                        {busy ? (
                          <LoaderCircle className="spin" size={15} />
                        ) : (
                          <Sparkles size={15} />
                        )}
                        Generate K-Pop Content Ideas
                      </button>
                    </div>
                  </section>
                  <div className="topic-grid">
                    {topics
                      .filter((t) => t.disposition !== "REJECTED")
                      .map((t) => {
                        const d = t.data as Record<string, string>;
                        return (
                          <article className="panel topic-card" key={t.id}>
                            <div className="row between">
                              <span className="badge purple">{d.category}</span>
                              {t.demo && (
                                <span className="badge amber">DEMO</span>
                              )}
                            </div>
                            <h2>{d.title}</h2>
                            <p>{d.summary}</p>
                            <blockquote>“{d.hook}”</blockquote>
                            <details>
                              <summary>Lihat detail angle</summary>
                              {[
                                "angle",
                                "visualRequirements",
                                "risks",
                                "confidence",
                                "distinctiveness",
                              ].map((k) => (
                                <p key={k}>
                                  <strong>{k}:</strong> {d[k]}
                                </p>
                              ))}
                            </details>
                            <div className="row wrap">
                              <button
                                className="primary"
                                disabled={busy}
                                onClick={() =>
                                  create({
                                    title: d.title,
                                    artist: d.idolOrGroup,
                                    category: d.category,
                                    topic: d.summary + " " + d.angle,
                                    targetDuration: Number(d.durationEstimate),
                                    candidateId: t.id,
                                  })
                                }
                              >
                                Gunakan topik
                                <ArrowRight size={14} />
                              </button>
                              <button
                                disabled={busy || t.disposition === "SAVED"}
                                onClick={() =>
                                  void run(async () => {
                                    await api("topics/" + t.id, {
                                      disposition: "SAVED",
                                    });
                                    setTopics(await api<Topic[]>("topics"));
                                    notify("Topik disimpan.");
                                  })
                                }
                              >
                                {t.disposition === "SAVED"
                                  ? "Tersimpan"
                                  : "Simpan"}
                              </button>
                              <button
                                disabled={busy}
                                onClick={() => {
                                  if (
                                    confirm(
                                      "Tolak ide ini? Ide akan disembunyikan dari daftar.",
                                    )
                                  )
                                    void run(async () => {
                                      await api("topics/" + t.id, {
                                        disposition: "REJECTED",
                                      });
                                      setTopics(await api<Topic[]>("topics"));
                                    });
                                }}
                              >
                                Tolak
                              </button>
                              <button
                                disabled={busy}
                                onClick={() => {
                                  setCustom(d.title);
                                  window.scrollTo({
                                    top: 0,
                                    behavior: "smooth",
                                  });
                                }}
                              >
                                Ubah angle
                              </button>
                            </div>
                          </article>
                        );
                      })}
                  </div>
                </>
              ) : page === "Settings" ? (
                <div className="settings-grid">
                  <section className="panel">
                    <h2>Konfigurasi AI</h2>
                    <p className="muted">
                      Kredensial dikelola di environment server, tidak melalui
                      browser.
                    </p>
                    <dl>
                      <dt>Mode saat ini</dt>
                      <dd>{config.mode.toUpperCase()}</dd>
                      <dt>Model</dt>
                      <dd>{config.model}</dd>
                      <dt>API tersedia</dt>
                      <dd>
                        {config.configured
                          ? "Ya / mode demo aktif"
                          : "Belum dikonfigurasi"}
                      </dd>
                    </dl>
                    <div className="callout">
                      Untuk AI nyata, set AI_MODE=live dan OPENAI_API_KEY di
                      server lalu restart web dan worker. DEMO menghasilkan
                      fixture berlabel, bukan analisis AI.
                    </div>
                  </section>
                  <section className="panel">
                    <h2>Creator defaults · Phase 1</h2>
                    <dl>
                      {[
                        ["Niche", "K-Pop"],
                        ["Bahasa draft", "Indonesia"],
                        ["Narasi final", "American English"],
                        ["Audience", "Global"],
                        ["Orientasi", "9:16 / portrait"],
                        ["Target durasi", "35 detik; dapat diatur per project"],
                        ["Estimasi narasi", "150 kata / menit"],
                        ["Prinsip", "Tanpa rumor, tanpa auto-approval"],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <dt>{k}</dt>
                          <dd>{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="muted">
                      TTS, analytics, dan pengaturan prompt lanjutan berada di
                      luar phase 1.
                    </p>
                  </section>
                </div>
              ) : (
                <>
                  <div className="section-toolbar">
                    <div>
                      <h2>
                        {page === "Dashboard"
                          ? "Project terbaru"
                          : "Project library"}
                        <span className="count">{projects.length}</span>
                      </h2>
                      <p className="muted">
                        {page === "Dashboard"
                          ? `${projects.reduce((s, p) => s + p._count.revisions, 0)} video diunggah · Lanjutkan cerita yang sedang Anda bangun.`
                          : "Seluruh versi dan keputusan kreatif tersimpan di setiap project."}
                      </p>
                    </div>
                    <div className="row">
                      <div className="search">
                        <Search size={15} />
                        <input
                          aria-label="Cari project"
                          placeholder="Cari project…"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </div>
                      <div className="segmented">
                        {[
                          { id: "grid", icon: LayoutGrid },
                          { id: "list", icon: List },
                          { id: "kanban", icon: Columns3 },
                        ].map((v) => (
                          <button
                            key={v.id}
                            aria-label={"Tampilan " + v.id}
                            className={view === v.id ? "selected" : ""}
                            onClick={() => setView(v.id)}
                          >
                            <v.icon size={16} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {view === "kanban" ? (
                    <div className="kanban">
                      {[
                        [
                          "Topik & script",
                          filtered.filter(
                            (p) =>
                              ![
                                "EDITING_PLAN_READY",
                                "ENGLISH_APPROVED",
                                "VIDEO_REVIEW_PENDING",
                                "VIDEO_REVIEWED",
                                "REVISION_REQUESTED",
                                "FINAL_APPROVED",
                              ].includes(p.status),
                          ),
                        ],
                        [
                          "Editing",
                          filtered.filter((p) =>
                            ["EDITING_PLAN_READY", "ENGLISH_APPROVED"].includes(
                              p.status,
                            ),
                          ),
                        ],
                        [
                          "Review",
                          filtered.filter(
                            (p) =>
                              p.status.startsWith("VIDEO") ||
                              p.status === "REVISION_REQUESTED",
                          ),
                        ],
                        [
                          "Selesai",
                          filtered.filter((p) => p.status === "FINAL_APPROVED"),
                        ],
                      ].map(([name, items]) => (
                        <section className="kanban-column" key={name as string}>
                          <h3>
                            <span className="dot" />
                            {name as string}
                            <small>{(items as ProjectCard[]).length}</small>
                          </h3>
                          {(items as ProjectCard[]).map(card)}
                        </section>
                      ))}
                    </div>
                  ) : view === "list" ? (
                    <div className="panel list-view">
                      {filtered.map((p) => (
                        <button key={p.id} onClick={() => void open(p.id)}>
                          <span className="list-art">
                            <Clapperboard size={20} />
                          </span>
                          <span>
                            <strong>{p.title}</strong>
                            <small>
                              {p.artist} · {p.targetDuration}s
                            </small>
                          </span>
                          <span className="badge purple">
                            {statusName(p.status)}
                          </span>
                          <ArrowUpRight size={16} />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="project-grid">
                      {filtered.map(card)}
                      <button
                        className="new-project-card"
                        onClick={() => create()}
                      >
                        <span>
                          <Plus size={24} />
                        </span>
                        <h3>Mulai cerita baru</h3>
                        <p>Ide berikutnya layak diceritakan.</p>
                        <small>
                          Create New Shorts Project <ArrowRight size={13} />
                        </small>
                      </button>
                    </div>
                  )}
                  {projects.length === 0 && (
                    <p className="muted">
                      Belum ada project. Buat project sendiri atau jalankan seed
                      DEMO sesuai README.
                    </p>
                  )}
                  <footer className="page-footer">
                    <span>
                      <ShieldCheck size={13} />
                      Private by design. Your stories stay yours.
                    </span>
                    <span>K-SHORTS STUDIO · PHASE 1</span>
                  </footer>
                </>
              )}
            </>
          )}
        </main>
      </div>
      {notice && (
        <div
          role={notice.error ? "alert" : "status"}
          className={"toast " + (notice.error ? "toast-error" : "")}
        >
          <span>{notice.error ? "!" : "✓"}</span>
          {notice.text}
          <button onClick={() => setNotice(null)} aria-label="Tutup notifikasi">
            <X size={15} />
          </button>
        </div>
      )}
      {modal && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-project-title"
          >
            <button
              className="modal-close"
              disabled={busy}
              onClick={() => setModal(false)}
              aria-label="Tutup"
            >
              <X size={20} />
            </button>
            <span className="icon-tile">
              <Clapperboard />
            </span>
            <h2 id="new-project-title">Cerita berikutnya dimulai di sini.</h2>
            <p className="muted">
              Tetapkan topik. Anda bisa menyempurnakan script setelahnya.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void run(async () => {
                  const p = await api<{ id: string }>("projects", {
                    title: f.get("title"),
                    artist: f.get("artist"),
                    category: f.get("category"),
                    topic: f.get("topic"),
                    targetDuration: Number(f.get("duration")),
                  });
                  if (prefill.candidateId)
                    await api("topics/" + prefill.candidateId, {
                      disposition: "USED",
                    });
                  setModal(false);
                  await reload();
                  await open(p.id);
                  notify(
                    "Project dibuat. Mulai dengan sumber dan script Indonesia.",
                  );
                });
              }}
            >
              <label>
                Judul project
                <input
                  name="title"
                  required
                  minLength={3}
                  maxLength={160}
                  defaultValue={String(prefill.title || "")}
                  placeholder="Judul Shorts Anda"
                />
              </label>
              <div className="form-grid">
                <label>
                  Idol / grup
                  <input
                    name="artist"
                    required
                    maxLength={100}
                    defaultValue={String(prefill.artist || "")}
                    placeholder="Contoh: IVE / Yujin"
                  />
                </label>
                <label>
                  Kategori
                  <select
                    name="category"
                    defaultValue={String(prefill.category || cats[0])}
                  >
                    {cats.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Topik & storytelling angle
                <textarea
                  name="topic"
                  required
                  minLength={10}
                  maxLength={6000}
                  rows={4}
                  defaultValue={String(prefill.topic || "")}
                  placeholder="Apa yang ingin Anda ceritakan? Klaim yang belum punya sumber perlu diverifikasi."
                />
              </label>
              <label>
                Target durasi (detik)
                <input
                  name="duration"
                  type="number"
                  min={15}
                  max={120}
                  required
                  defaultValue={Number(prefill.targetDuration) || 35}
                />
              </label>
              <div className="row between">
                <small className="muted">
                  Tidak ada tahap yang otomatis disetujui.
                </small>
                <button className="primary" disabled={busy}>
                  {busy ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <Plus size={16} />
                  )}
                  Buat project
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
