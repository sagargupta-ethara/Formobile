// Runs once when the Next.js server boots (Node runtime only). Seeds the
// database with the team + master register when it is empty, so a fresh
// production deploy has working logins without any manual step.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensureSeeded } = await import("./lib/bootstrap");
  await ensureSeeded();
  const { scheduleBackups } = await import("./lib/backup");
  scheduleBackups();
}
