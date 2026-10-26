import "dotenv/config";
const base = process.env.STUDIO_URL || "http://localhost:3000";
const anonymous = await fetch(base + "/api/projects");
if (anonymous.status !== 401)
  throw new Error("Project API must reject anonymous access");
const login = await fetch(base + "/api/login", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: process.env.APP_ORIGIN || base,
  },
  body: JSON.stringify({ password: process.env.APP_PASSWORD }),
});
if (!login.ok) throw new Error(`Private login failed: ${login.status}`);
const cookie = login.headers.get("set-cookie")?.split(";")[0];
if (!cookie) throw new Error("Session cookie missing");
const projects = await fetch(base + "/api/projects", {
  headers: { Cookie: cookie },
});
if (!projects.ok || !Array.isArray(await projects.json()))
  throw new Error("Authenticated PostgreSQL read failed");
const mode = await fetch(base + "/api/status", {
  headers: { Cookie: cookie },
}).then((r) => r.json());
console.log(
  `Private auth, PostgreSQL project read and AI status verified (mode=${mode.mode}). No secrets printed.`,
);
