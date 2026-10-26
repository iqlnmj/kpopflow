"use client";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronRight,
  Clock,
  Copy,
  FileText,
  Film,
  History,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Upload,
  Video,
  ExternalLink,
} from "lucide-react";
import { api, statusName } from "./studio";
import type { ProjectDetail, Scene, Review } from "./types";
import type { Metadata, Frame } from "@/lib/media";
type Props = {
  project: ProjectDetail;
  setProject: (p: ProjectDetail) => void;
  tab: string;
  setTab: (s: string) => void;
  back: () => void;
  notify: (s: string, error?: boolean) => void;
  refreshCards: () => Promise<void>;
};
const date = (d: Date) => new Date(d).toLocaleString("id-ID");
const count = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
export default function Workspace({
  project: p,
  setProject,
  tab,
  setTab,
  back,
  notify,
  refreshCards,
}: Props) {
  const [busy, setBusy] = useState(false),
    [idText, setIdText] = useState(""),
    [enText, setEnText] = useState(""),
    [instruction, setInstruction] = useState(""),
    [language, setLanguage] = useState("id"),
    [historyId, setHistoryId] = useState(""),
    [videoId, setVideoId] = useState(""),
    [oldId, setOldId] = useState("");
  const id = p.scripts.filter((s) => s.language === "id").at(-1),
    en = p.scripts.filter((s) => s.language === "en").at(-1),
    timeline = p.timelines.at(-1),
    latestRevision = p.revisions.at(-1);
  const current = p.revisions.find((r) => r.id === videoId) || latestRevision;
  const locked = !!p.finalRevisionId;
  const idOk = !!p.idApproved && p.idApproved === id?.id,
    enOk =
      idOk &&
      !!p.enApproved &&
      p.enApproved === en?.id &&
      en?.basedOn === p.idApproved;
  const timelineOk = enOk && timeline?.scriptId === p.enApproved;
  const dirty = idText !== (id?.text || "") || enText !== (en?.text || "");
  const jobsActive = p.jobs.some(
    (j) => j.status === "QUEUED" || j.status === "PROCESSING",
  );
  useEffect(() => {
    setIdText(id?.text || "");
  }, [id?.id, id?.text]);
  useEffect(() => {
    setEnText(en?.text || "");
  }, [en?.id, en?.text]);
  useEffect(() => {
    if (!jobsActive) return;
    const t = setInterval(() => {
      void api<ProjectDetail>("projects/" + p.id)
        .then(setProject)
        .catch((e) => notify(e.message, true));
    }, 1800);
    return () => clearInterval(t);
  }, [jobsActive, p.id, setProject, notify]);
  const act = async (action: string, input: Record<string, unknown> = {}) => {
    setBusy(true);
    try {
      setProject(
        await api<ProjectDetail>(`projects/${p.id}/action`, { action, input }),
      );
      await refreshCards();
      notify(
        action === "review" || action === "compare"
          ? "Job masuk antrean. Worker akan memproses."
          : "Perubahan tersimpan.",
      );
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  const disabled = busy || locked;
  const tabs = [
    { id: "topic", name: "Topik & riset", icon: Sparkles, complete: !!id },
    { id: "scripts", name: "Script studio", icon: FileText, complete: enOk },
    { id: "timeline", name: "Editing plan", icon: Film, complete: timelineOk },
    { id: "video", name: "Video & review", icon: Video, complete: locked },
    { id: "history", name: "Aktivitas", icon: History, complete: false },
  ];
  return (
    <div className="workspace">
      <button
        className="back-link"
        onClick={() => {
          if (
            !dirty ||
            confirm(
              "Ada perubahan script yang belum disimpan. Keluar tanpa menyimpan?",
            )
          )
            back();
        }}
      >
        <ArrowLeft size={14} />
        Kembali ke project
      </button>
      <div className="project-header">
        <div>
          <div className="row">
            <span className="eyebrow">
              {p.artist} / {p.category}
            </span>
            {p.demo && <span className="badge amber">DEMO PROJECT</span>}
          </div>
          <h1>{p.title}</h1>
          <div className="row muted small">
            <Clock size={13} />
            {p.targetDuration} detik<span>·</span>Dibuat {date(p.createdAt)}
            <span>·</span>
            {p.revisions.length} revisi video
          </div>
        </div>
        <span className={"badge large " + (locked ? "green" : "purple")}>
          {locked ? <CheckCheck size={14} /> : <span className="dot" />}
          {statusName(p.status)}
        </span>
      </div>
      <div className="workflow-tabs">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            className={tab === t.id ? "active" : ""}
            onClick={() => setTab(t.id)}
          >
            <span className={t.complete ? "step complete" : "step"}>
              {t.complete ? <Check size={13} /> : i + 1}
            </span>
            {t.name}
          </button>
        ))}
      </div>
      {locked && (
        <div className="callout success row between">
          <span>
            <ShieldCheck size={16} /> Final disetujui. Semua artifact dan
            riwayat tersimpan.
          </span>
          <button
            disabled={busy}
            onClick={() => {
              if (
                confirm(
                  "Buka kembali project final untuk revisi? Riwayat approval tetap disimpan.",
                )
              )
                void act("reopen");
            }}
          >
            Buka kembali
          </button>
        </div>
      )}
      <div className="workspace-grid">
        <div className="workspace-main">
          {tab === "topic" && (
            <>
              <section className="panel">
                <div className="section-title">
                  <span className="icon-tile">
                    <Sparkles size={18} />
                  </span>
                  <div>
                    <h2>Fondasi cerita</h2>
                    <p>Satu topik yang jelas. Sumber yang bisa ditelusuri.</p>
                  </div>
                </div>
                <span className="field-label">TOPIK TERPILIH</span>
                <p className="topic-description">{p.topic}</p>
                <div className="callout">
                  Tidak ada web research otomatis di phase 1. Simpan URL secara
                  manual. Menambahkan sumber tidak berarti klaim telah
                  diverifikasi oleh AI.
                </div>
                <button className="primary" onClick={() => setTab("scripts")}>
                  Lanjut ke script studio
                  <ArrowRight size={15} />
                </button>
              </section>
              <section className="panel">
                <div className="section-toolbar">
                  <h2>
                    Sumber & catatan
                    <span className="count">{p.sources.length}</span>
                  </h2>
                  <span className="badge">Manual research</span>
                </div>
                {p.sources.map((s) => (
                  <article className="source" key={s.id}>
                    <div className="row between">
                      <a href={s.url} target="_blank" rel="noopener noreferrer">
                        {s.name}
                        <ExternalLink size={12} />
                      </a>
                      <span
                        className={
                          "badge " +
                          (s.kind === "CONFIRMED" ? "green" : "amber")
                        }
                      >
                        {s.kind}
                      </span>
                    </div>
                    <p>{s.notes}</p>
                    <small className="muted">
                      Publikasi: {s.publishedAt || "Tidak diketahui"} · Diakses{" "}
                      {date(s.accessedAt)}
                      {s.kind === "CONFIRMED" && " · Dikonfirmasi pengguna"}
                    </small>
                  </article>
                ))}
                {!p.sources.length && (
                  <div className="empty-small">
                    <FileText size={26} />
                    <p>Belum ada sumber. Semua klaim berstatus Unverified.</p>
                  </div>
                )}
                <form
                  className="source-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    const form = e.currentTarget;
                    void (async () => {
                      await act("source", Object.fromEntries(f));
                      form.reset();
                    })();
                  }}
                >
                  <h3>Tambahkan sumber</h3>
                  <div className="form-grid">
                    <label>
                      Nama sumber
                      <input
                        name="name"
                        required
                        maxLength={200}
                        placeholder="Contoh: pengumuman resmi agensi"
                        disabled={disabled}
                      />
                    </label>
                    <label>
                      URL sumber
                      <input
                        name="url"
                        type="url"
                        required
                        placeholder="https://…"
                        disabled={disabled}
                      />
                    </label>
                  </div>
                  <div className="form-grid">
                    <label>
                      Status klaim
                      <select name="kind" disabled={disabled}>
                        <option value="UNVERIFIED">Unverified</option>
                        <option value="CONFIRMED">
                          Dikonfirmasi oleh saya
                        </option>
                        <option value="OPINION">Opini</option>
                        <option value="FAN_INTERPRETATION">
                          Interpretasi fans
                        </option>
                      </select>
                    </label>
                    <label>
                      Tanggal publikasi (opsional)
                      <input
                        type="date"
                        name="publishedAt"
                        disabled={disabled}
                      />
                    </label>
                  </div>
                  <label>
                    Catatan fakta / konteks
                    <textarea
                      name="notes"
                      maxLength={6000}
                      rows={2}
                      disabled={disabled}
                    />
                  </label>
                  <button disabled={disabled}>
                    <Plus size={14} />
                    Simpan sumber
                  </button>
                </form>
              </section>
            </>
          )}
          {tab === "scripts" && (
            <>
              <section className="panel">
                <div className="section-toolbar">
                  <div>
                    <span className="eyebrow">01 / DRAFT & APPROVAL</span>
                    <h2>Bangun cerita dalam Bahasa Indonesia.</h2>
                  </div>
                  <span className={"badge " + (idOk ? "green" : "amber")}>
                    {idOk ? "Approved" : "Perlu approval"}
                  </span>
                </div>
                <div className="editor-top">
                  <span>
                    <span className="language-flag">ID</span>Indonesian script{" "}
                    {id?.demo && <b className="demo-inline">DEMO</b>}
                  </span>
                  <small>
                    Versi{" "}
                    {p.scripts.filter((s) => s.language === "id").length || "—"}
                  </small>
                </div>
                <textarea
                  aria-label="Script Indonesia"
                  className="script-editor"
                  value={idText}
                  onChange={(e) => setIdText(e.target.value)}
                  placeholder="Mulai dengan Generate Indonesian Script, atau tulis draft Anda sendiri."
                  disabled={disabled}
                  maxLength={12000}
                />
                <div className="editor-bottom">
                  <span>
                    {count(idText)} kata · ≈{" "}
                    {((count(idText) / 150) * 60).toFixed(1)} detik @150 wpm
                  </span>
                  <span>
                    {idText !== (id?.text || "")
                      ? "Belum disimpan"
                      : "Tersimpan"}
                  </span>
                </div>
                <div className="action-bar">
                  <button
                    disabled={disabled || (!!id && idText !== id.text)}
                    onClick={() => {
                      if (
                        !id ||
                        confirm(
                          "Generate versi baru? Versi lama tetap tersimpan, approval downstream akan dibatalkan.",
                        )
                      )
                        void act("generate-id");
                    }}
                  >
                    <Sparkles size={14} />
                    Generate Indonesian Script
                  </button>
                  <button
                    disabled={
                      disabled ||
                      idText === (id?.text || "") ||
                      idText.trim().length < 10
                    }
                    onClick={() =>
                      void act("save-script", { language: "id", text: idText })
                    }
                  >
                    <Save size={14} />
                    Simpan draft ID
                  </button>
                  <button
                    className="primary"
                    disabled={disabled || !id || idOk || idText !== id.text}
                    onClick={() => void act("approve-id", { scriptId: id?.id })}
                  >
                    <Check size={14} />
                    Approve Indonesian Script
                  </button>
                </div>
              </section>
              <section className="panel">
                <div className="section-toolbar">
                  <div>
                    <span className="eyebrow">02 / ADAPT & APPROVE</span>
                    <h2>Make it sound natural.</h2>
                  </div>
                  <span className={"badge " + (enOk ? "green" : "amber")}>
                    {enOk
                      ? "Approved"
                      : !idOk
                        ? "Menunggu approval ID"
                        : "Perlu approval"}
                  </span>
                </div>
                {en && en.basedOn !== p.idApproved && (
                  <div className="callout warning">
                    Needs Review — English ini dibuat dari versi Indonesia
                    sebelumnya. Versi lama tetap tersedia; generate ulang
                    setelah approval Indonesia.
                  </div>
                )}
                <div className="script-compare">
                  <div>
                    <div className="editor-top">Approved Indonesian</div>
                    <div className="reference-script">
                      {p.scripts.find((s) => s.id === p.idApproved)?.text ||
                        "Setujui script Indonesia terlebih dahulu."}
                    </div>
                  </div>
                  <div>
                    <div className="editor-top">
                      <span>
                        <span className="language-flag">EN</span>American
                        English{" "}
                        {en?.demo && <b className="demo-inline">DEMO</b>}
                      </span>
                    </div>
                    <textarea
                      aria-label="Script English"
                      className="script-editor"
                      value={enText}
                      onChange={(e) => setEnText(e.target.value)}
                      placeholder="Adaptasi English akan muncul di sini."
                      disabled={disabled || !idOk}
                      maxLength={12000}
                    />
                  </div>
                </div>
                <div className="editor-bottom">
                  <span>
                    {count(enText)} words · ≈{" "}
                    {((count(enText) / 150) * 60).toFixed(1)}s @150 wpm
                  </span>
                  <span>
                    {enText !== (en?.text || "")
                      ? "Belum disimpan"
                      : "Tersimpan"}
                  </span>
                </div>
                <div className="action-bar">
                  <button
                    disabled={disabled || !idOk || dirty}
                    onClick={() => {
                      if (
                        !en ||
                        confirm(
                          "Buat versi English baru? Approval English perlu dilakukan kembali.",
                        )
                      )
                        void act("generate-en");
                    }}
                  >
                    <Sparkles size={14} />
                    Generate Final English Script
                  </button>
                  <button
                    disabled={
                      disabled ||
                      !idOk ||
                      enText === (en?.text || "") ||
                      enText.trim().length < 10
                    }
                    onClick={() =>
                      void act("save-script", { language: "en", text: enText })
                    }
                  >
                    <Save size={14} />
                    Simpan draft EN
                  </button>
                  <button
                    disabled={!enText || busy}
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(enText)
                        .then(() => notify("Script disalin."))
                        .catch(() =>
                          notify(
                            "Clipboard tidak tersedia di browser ini.",
                            true,
                          ),
                        )
                    }
                  >
                    <Copy size={14} />
                    Copy
                  </button>
                  <button
                    className="primary"
                    disabled={
                      disabled ||
                      !en ||
                      !idOk ||
                      enOk ||
                      enText !== en.text ||
                      en.basedOn !== p.idApproved
                    }
                    onClick={() => void act("approve-en", { scriptId: en?.id })}
                  >
                    <Check size={14} />
                    Approve Final English Script
                  </button>
                </div>
              </section>
              <section className="panel">
                <h2>Version history</h2>
                <p className="muted">
                  Versi tidak ditimpa. Untuk menggunakannya kembali, salin ke
                  editor lalu simpan sebagai versi baru.
                </p>
                <select
                  aria-label="Version history"
                  value={historyId}
                  onChange={(e) => setHistoryId(e.target.value)}
                >
                  <option value="">Pilih versi sebelumnya…</option>
                  {p.scripts.map((s, i) => (
                    <option key={s.id} value={s.id}>
                      {s.language.toUpperCase()} · #{i + 1} ·{" "}
                      {date(s.createdAt)}
                      {s.demo ? " · DEMO" : ""}
                    </option>
                  ))}
                </select>
                {historyId && (
                  <div className="history-text">
                    {p.scripts.find((s) => s.id === historyId)?.text}
                  </div>
                )}
                {enOk && (
                  <button
                    className="primary"
                    onClick={() => setTab("timeline")}
                  >
                    Lanjut ke editing plan
                    <ArrowRight size={14} />
                  </button>
                )}
              </section>
            </>
          )}
          {tab === "timeline" && (
            <section className="panel">
              <div className="section-toolbar">
                <div>
                  <span className="eyebrow">03 / PLAN YOUR CUT</span>
                  <h2>Editing timeline</h2>
                  <p className="muted">
                    Rencana untuk editor eksternal. Timing adalah estimasi
                    narasi, bukan alignment audio.
                  </p>
                </div>
                <button
                  className="primary"
                  disabled={disabled || !enOk}
                  onClick={() => void act("timeline")}
                >
                  <Sparkles size={14} />
                  {timeline
                    ? "Generate versi baru"
                    : "Generate Editing Timeline"}
                </button>
              </div>
              {!enOk && (
                <div className="callout warning">
                  Setujui versi Indonesia dan English terbaru terlebih dahulu.
                </div>
              )}
              {timeline && (
                <>
                  {!timelineOk && (
                    <div className="callout warning">
                      Needs Review — timeline lama tidak sinkron dengan approval
                      script saat ini.
                    </div>
                  )}
                  <div className="row between">
                    <span className="badge purple">
                      {timeline.demo ? "DEMO · " : ""}
                      {(timeline.scenes as Scene[]).length} scenes
                    </span>
                    <small className="muted">
                      {p.timelines.length} versi tersimpan
                    </small>
                  </div>
                  <div className="timeline-strip">
                    {(timeline.scenes as Scene[]).map((s, i) => (
                      <div
                        key={i}
                        style={{ flex: Math.max(1, s.end - s.start) }}
                      >
                        <small>
                          {s.start.toFixed(1)}–{s.end.toFixed(1)}s
                        </small>
                        <Film size={20} />
                        <strong>{s.purpose}</strong>
                      </div>
                    ))}
                  </div>
                  {(timeline.scenes as Scene[]).map((s, i) => (
                    <article className="scene" key={i}>
                      <div className="scene-index">
                        {String(i + 1).padStart(2, "0")}
                        <small>
                          {s.start.toFixed(1)}s<br />↓<br />
                          {s.end.toFixed(1)}s
                        </small>
                      </div>
                      <div>
                        <span className="eyebrow">{s.purpose}</span>
                        <h3>“{s.voiceover}”</h3>
                        <div className="scene-fields">
                          {[
                            ["Visual", s.visual],
                            ["Footage", s.footage],
                            ["Motion / slow motion", s.motion],
                            ["Text overlay", s.overlay || "—"],
                            ["Subtitle emphasis", s.subtitle],
                            ["Transition", s.transition],
                            ["Sound effect", s.sound],
                          ].map(([k, v]) => (
                            <div key={k}>
                              <small>{k}</small>
                              <p>{v}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </article>
                  ))}
                  <details className="history-detail">
                    <summary>
                      Timeline version history ({p.timelines.length})
                    </summary>
                    {p.timelines.map((t, i) => (
                      <details key={t.id}>
                        <summary>
                          Versi {i + 1} · {date(t.createdAt)}
                          {t.demo ? " · DEMO" : ""}
                        </summary>
                        <pre>{JSON.stringify(t.scenes, null, 2)}</pre>
                      </details>
                    ))}
                  </details>
                  {timelineOk && (
                    <button className="primary" onClick={() => setTab("video")}>
                      Lanjut ke upload & review
                      <ArrowRight size={14} />
                    </button>
                  )}
                </>
              )}
              {!timeline && (
                <div className="empty">
                  <Film size={38} />
                  <h3>Setiap scene punya tujuan.</h3>
                  <p>
                    Setelah English disetujui, generate rencana editing Anda di
                    sini.
                  </p>
                </div>
              )}
            </section>
          )}
          {tab === "video" && (
            <>
              <section className="panel">
                <div className="section-toolbar">
                  <div>
                    <span className="eyebrow">04 / WATCH, REVIEW, REFINE</span>
                    <h2>Video revisions</h2>
                  </div>
                  <span className="badge">{p.revisions.length} revisi</span>
                </div>
                <form
                  className="upload-zone"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget,
                      f = new FormData(form);
                    setBusy(true);
                    void fetch(`/api/projects/${p.id}/upload`, {
                      method: "POST",
                      body: f,
                    })
                      .then(async (r) => {
                        const b = await r.json();
                        if (!r.ok) throw new Error(b.error);
                        setProject(
                          await api<ProjectDetail>("projects/" + p.id),
                        );
                        setVideoId(b.id);
                        notify(
                          "MP4 disimpan. Job ekstraksi frame dan review masuk antrean.",
                        );
                        form.reset();
                        await refreshCards();
                      })
                      .catch((e) => notify(e.message, true))
                      .finally(() => setBusy(false));
                  }}
                >
                  <span className="icon-tile">
                    <Upload size={22} />
                  </span>
                  <h3>
                    {p.revisions.length
                      ? "Upload revised video"
                      : "Upload MP4 for Review"}
                  </h3>
                  <p>MP4 vertikal · maksimal 100 MB · maksimal 120 detik</p>
                  <input
                    aria-label="File MP4"
                    name="file"
                    type="file"
                    accept="video/mp4,.mp4"
                    required
                    disabled={disabled || !timelineOk}
                  />
                  <button
                    className="primary"
                    disabled={disabled || !timelineOk}
                  >
                    {busy ? (
                      <LoaderCircle size={14} className="spin" />
                    ) : (
                      <Upload size={14} />
                    )}
                    Upload & antrekan review
                  </button>
                  {!timelineOk && (
                    <small className="amber">
                      Buat timeline dari script yang telah disetujui untuk
                      mengaktifkan upload.
                    </small>
                  )}
                </form>
                {p.jobs.slice(0, 4).map((j) => (
                  <div
                    className={"job " + (j.status === "FAILED" ? "failed" : "")}
                    key={j.id}
                  >
                    <div className="row">
                      <span>
                        {j.status === "PROCESSING" ? (
                          <LoaderCircle size={16} className="spin" />
                        ) : j.status === "COMPLETED" ? (
                          <Check size={16} />
                        ) : (
                          <Clock size={16} />
                        )}
                      </span>
                      <strong>
                        {j.kind === "review"
                          ? "Video review"
                          : "Revision comparison"}
                      </strong>
                      <span className="badge">
                        {j.status} · {j.progress}%
                      </span>
                    </div>
                    {j.error && (
                      <p role="alert">
                        {j.error} Jalankan ulang tombol Review / Compare di
                        bawah.
                      </p>
                    )}
                  </div>
                ))}
                {current && (
                  <>
                    <div className="row between revision-toolbar">
                      <select
                        aria-label="Video revision"
                        value={current.id}
                        onChange={(e) => setVideoId(e.target.value)}
                      >
                        {p.revisions.map((r) => (
                          <option key={r.id} value={r.id}>
                            Revision {r.number} — {r.filename}
                          </option>
                        ))}
                      </select>
                      <button
                        disabled={disabled || jobsActive || !timelineOk}
                        onClick={() =>
                          void act("review", { revisionId: current.id })
                        }
                      >
                        <RefreshCw size={14} />
                        {current.review ? "Regenerate review" : "Review Video"}
                      </button>
                    </div>
                    <video
                      key={current.id}
                      controls
                      preload="metadata"
                      src={`/api/media/${current.storageKey}/video.mp4`}
                      className="video-player"
                    />
                    <div className="metadata-grid">
                      {Object.entries(current.metadata as unknown as Metadata)
                        .filter(([k]) => k !== "sha256" && k !== "bytes")
                        .map(([k, v]) => (
                          <div key={k}>
                            <small>{k}</small>
                            <strong>
                              {typeof v === "number"
                                ? Number(v.toFixed(2))
                                : String(v ?? "none")}
                            </strong>
                          </div>
                        ))}
                    </div>
                    <div className="frame-grid">
                      {(current.frames as Frame[]).map((f) => (
                        <figure key={f.key}>
                          <img
                            src={`/api/media/${f.key}`}
                            alt={`Frame pada ${f.time} detik`}
                            loading="lazy"
                          />
                          <figcaption>{f.time.toFixed(2)}s</figcaption>
                        </figure>
                      ))}
                    </div>
                  </>
                )}
              </section>
              {current && current.reports.length > 0 && (
                <section className="panel">
                  <details>
                    <summary>
                      Riwayat review & comparison ({current.reports.length})
                    </summary>
                    {current.reports.map((report) => (
                      <details key={report.id} className="history-detail">
                        <summary>
                          {report.kind} · {date(report.createdAt)}
                          {report.demo ? " · DEMO" : ""}
                        </summary>
                        <pre>{JSON.stringify(report.data, null, 2)}</pre>
                      </details>
                    ))}
                  </details>
                </section>
              )}
              {current?.review &&
                (() => {
                  const r = current.review as unknown as Review;
                  const stale =
                    current.contextVersion !==
                    `${p.idApproved}:${p.enApproved}:${timeline?.id}`;
                  return (
                    <section className="panel review-report">
                      <div className="section-toolbar">
                        <div>
                          <span className="eyebrow">
                            EDITORIAL REVIEW · REVISION {current.number}
                          </span>
                          <h2>
                            {current.reviewDemo
                              ? "DEMO — contoh laporan"
                              : "AI video review"}
                          </h2>
                        </div>
                        <div className="score">
                          {current.reviewDemo ? "—" : r.score}
                          <small>/ 10</small>
                        </div>
                      </div>
                      {stale && (
                        <div className="callout warning">
                          Needs Review — konteks produksi telah berubah. Review
                          ulang sebelum final approval.
                        </div>
                      )}
                      <div className="callout">
                        {r.limitations} Skor merupakan penilaian editorial,
                        bukan prediksi viral.
                      </div>
                      <p>{r.summary}</p>
                      <h3>Strengths</h3>
                      {r.strengths.map((s, i) => (
                        <p className="strength" key={i}>
                          <Check size={14} />
                          {s}
                        </p>
                      ))}
                      <h3>Timestamp findings</h3>
                      {r.findings.map((f, i) => (
                        <article className="finding" key={i}>
                          <div className="row between">
                            <span className="time-tag">
                              {f.start.toFixed(1)}–{f.end.toFixed(1)}s
                            </span>
                            <span
                              className={
                                "badge " +
                                (f.severity === "High" ? "pink" : "amber")
                              }
                            >
                              {f.severity} · {f.category}
                            </span>
                          </div>
                          <h3>{f.observation}</h3>
                          <p className="muted">Bukti: {f.evidence}</p>
                          <p>
                            <strong>Rekomendasi:</strong> {f.recommendation}
                          </p>
                          <small className="muted">
                            Confidence: {f.confidence}
                          </small>
                        </article>
                      ))}
                      <div className="callout">
                        Rekomendasi model:{" "}
                        {r.ready
                          ? "Siap ditinjau untuk upload"
                          : "Perlu tinjauan / revisi"}
                        . Approval final hanya dilakukan oleh Anda.
                      </div>
                      <button
                        className="primary"
                        disabled={
                          disabled || !timelineOk || stale || jobsActive
                        }
                        onClick={() => {
                          if (
                            confirm(
                              `Setujui Revision ${current.number} sebagai final?${current.reviewDemo ? " Ini review DEMO, bukan evaluasi AI nyata." : ""} Pastikan Anda sudah menonton video dan meninjau semua temuan.`,
                            )
                          )
                            void act("final", { revisionId: current.id });
                        }}
                      >
                        <ShieldCheck size={15} />
                        Approve Final Video
                      </button>
                    </section>
                  );
                })()}
              {current && p.revisions.length >= 2 && (
                <section className="panel">
                  <div className="section-toolbar">
                    <div>
                      <span className="eyebrow">COMPARE & IMPROVE</span>
                      <h2>Bandingkan revisi</h2>
                    </div>
                  </div>
                  <p className="muted">
                    Pilih revisi sebelumnya (A) untuk dibandingkan dengan
                    Revision {current.number} (B). Kedua video harus sudah
                    direview.
                  </p>
                  <div className="row">
                    <select
                      aria-label="Previous revision"
                      value={oldId}
                      onChange={(e) => setOldId(e.target.value)}
                    >
                      <option value="">Pilih Revision A…</option>
                      {p.revisions
                        .filter((r) => r.number < current.number)
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            Revision {r.number} — {r.filename}
                          </option>
                        ))}
                    </select>
                    <button
                      className="primary"
                      disabled={
                        disabled ||
                        jobsActive ||
                        !current.review ||
                        !p.revisions.find((r) => r.id === oldId)?.review
                      }
                      onClick={() =>
                        void act("compare", {
                          revisionId: current.id,
                          previousId: oldId,
                        })
                      }
                    >
                      Compare With Previous Revision
                    </button>
                  </div>
                  {oldId && p.revisions.find((r) => r.id === oldId) && (
                    <div className="comparison-videos">
                      <div>
                        <small>A · Previous revision</small>
                        <video
                          controls
                          preload="metadata"
                          src={`/api/media/${p.revisions.find((r) => r.id === oldId)?.storageKey}/video.mp4`}
                        />
                      </div>
                      <div>
                        <small>B · Current revision</small>
                        <video
                          controls
                          preload="metadata"
                          src={`/api/media/${current.storageKey}/video.mp4`}
                        />
                      </div>
                    </div>
                  )}
                  {current.comparison && (
                    <div className="comparison-report">
                      <span className="badge purple">
                        {(current.comparison as Record<string, unknown>).demo
                          ? "DEMO · "
                          : ""}
                        Revision{" "}
                        {
                          p.revisions.find((r) => r.id === current.comparedToId)
                            ?.number
                        }{" "}
                        → {current.number}
                      </span>
                      {Object.entries(
                        current.comparison as Record<string, unknown>,
                      )
                        .filter(([k]) => k !== "demo")
                        .map(([k, v]) => (
                          <div key={k}>
                            <h3>{k}</h3>
                            {Array.isArray(v) ? (
                              v.length ? (
                                v.map((s, i) => <p key={i}>• {s}</p>)
                              ) : (
                                <p className="muted">
                                  Tidak ada yang dilaporkan.
                                </p>
                              )
                            ) : (
                              <p>{String(v)}</p>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </section>
              )}
            </>
          )}
          {tab === "history" && (
            <section className="panel">
              <h2>Audit trail</h2>
              <p className="muted">
                Keputusan kreatif, approval, dan operasi produksi yang
                tersimpan.
              </p>
              {p.events.map((e) => (
                <article className="audit-event" key={e.id}>
                  <span className="audit-dot" />
                  <div>
                    <strong>{e.action}</strong>
                    <p>{e.detail}</p>
                    <small className="muted">{date(e.createdAt)}</small>
                  </div>
                </article>
              ))}
            </section>
          )}
        </div>
        <aside className="context-panel">
          <section className="panel assistant">
            <span className="assistant-star">
              <Sparkles size={21} />
            </span>
            <h3>Creative co-pilot</h3>
            <span className="eyebrow">AI ASSISTS. YOU DECIDE.</span>
            <p>
              {tab === "scripts"
                ? "Satu ide utama. Hook yang spesifik. Payoff yang terasa. Jangan tambah klaim tanpa sumber."
                : tab === "video"
                  ? "Lihat ulang 3 detik pertama. Apakah bukti visual langsung terbaca? AI hanya melihat sampled frames, bukan seluruh video atau audio."
                  : tab === "timeline"
                    ? "Berikan tujuan untuk setiap cut. Timeline ini menjadi panduan Anda di CapCut, Premiere, atau editor pilihan."
                    : "Mulai dari angle, bukan asumsi. Cari bukti yang menjelaskan apa yang benar-benar terjadi."}
            </p>
            {tab === "scripts" && (
              <>
                <label>
                  Revisi untuk
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                  >
                    <option value="id">Script Indonesia</option>
                    <option value="en">Script English</option>
                  </select>
                </label>
                <div className="quick-actions">
                  {[
                    "Rewrite Hook Only",
                    "Make It Shorter",
                    "Improve Payoff",
                    "Make It More Natural",
                  ].map((s) => (
                    <button
                      key={s}
                      disabled={
                        disabled ||
                        dirty ||
                        !(language === "id" ? id : en) ||
                        (language === "en" && !idOk)
                      }
                      onClick={() =>
                        void act("revise", { language, instruction: s })
                      }
                    >
                      <Sparkles size={12} />
                      {s}
                    </button>
                  ))}
                </div>
                <label>
                  Instruksi revisi khusus
                  <textarea
                    rows={4}
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    maxLength={2000}
                    placeholder="Pertahankan hook, persingkat bagian tengah…"
                  />
                </label>
                <button
                  className="primary full"
                  disabled={
                    disabled ||
                    dirty ||
                    !instruction.trim() ||
                    !(language === "id" ? id : en) ||
                    (language === "en" && !idOk)
                  }
                  onClick={() => void act("revise", { language, instruction })}
                >
                  <Sparkles size={14} />
                  Terapkan revisi
                </button>
                {dirty && (
                  <small className="amber">
                    Simpan perubahan editor sebelum meminta revisi AI.
                  </small>
                )}
              </>
            )}
            <div className="assistant-note">
              <ShieldCheck size={14} />
              <small>
                Setiap hasil AI perlu evaluasi Anda. Tidak ada auto-approval.
              </small>
            </div>
          </section>
          <section className="panel context-facts">
            <h3>Project context</h3>
            <dl>
              <dt>Target durasi</dt>
              <dd>{p.targetDuration} detik</dd>
              <dt>Sumber tersedia</dt>
              <dd>{p.sources.length} sumber manual</dd>
              <dt>Fakta terkonfirmasi pengguna</dt>
              <dd>{p.sources.filter((s) => s.kind === "CONFIRMED").length}</dd>
              <dt>Revisi script</dt>
              <dd>{p.scripts.length}</dd>
              <dt>Video revisi</dt>
              <dd>{p.revisions.length}</dd>
            </dl>
            <div className="context-checks">
              <span className={idOk ? "ok" : ""}>
                <Check size={13} />
                Indonesian approval
              </span>
              <span className={enOk ? "ok" : ""}>
                <Check size={13} />
                English approval
              </span>
              <span className={timelineOk ? "ok" : ""}>
                <Check size={13} />
                Timeline ready
              </span>
            </div>
          </section>
        </aside>
      </div>
      {busy && (
        <div className="working-indicator" role="status">
          <LoaderCircle size={16} className="spin" />
          Memproses dan menyimpan…
        </div>
      )}
    </div>
  );
}
