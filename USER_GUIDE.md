# Blueprint Flow — User & Operations Guide

**Design Collaboration & Site Execution Management Platform**

Blueprint Flow is the single workspace where an architecture firm's design team and on-site execution team coordinate: designs are assigned per floor and per discipline, uploaded with version control, automatically routed to the right site team for approval, and every action is recorded with deadlines and accountability.

---

## 1. The Big Picture — How Work Flows

```
ADMIN                    DESIGNER                  ON-SITE TEAM
  │                         │                          │
  ├─ creates project        │                          │
  ├─ defines floors         │                          │
  ├─ assigns task ─────────▶│                          │
  │   (floor + category     ├─ uploads design (V1) ───▶│  ← routed automatically
  │    + designer +         │                          │     by specialization
  │    deadline)            │                          ├─ reviews within 24h SLA
  │                         │                          │
  │                         │              ┌─ APPROVE ─┤
  │                         │              │  (done ✓) │
  │                         │◀─ REJECT ────┘           │
  │                         │   (voice memo + reason   │
  │                         │    + site photos)        │
  │                         ├─ uploads revision (V2) ─▶│
  │                         │                          ├─ reviews again …
  ▼                         ▼                          ▼
        every step is audit-logged · notified · deadline-tracked
```

A task is **complete** only when the on-site team has approved the latest version.

---

## 2. Signing In

- Open the app URL and sign in with your email and password.
- Accounts are created by an Admin — there is no self-registration.
- Team logins and initial passwords are listed in [`CREDENTIALS.md`](CREDENTIALS.md) (keep that file private). Change your password from the Profile page after first login.

---

## 3. The Three Roles

### 3.1 Admin
Full control. Admins:
- Create **projects** and define their **floor structure** (basements, an optional stilt level, floors above ground, and an optional terrace — with a live building preview).
- Manage **floors** later: add, rename, reorder (drag the building), delete.
- Manage the **team**: create Designers, On-Site Employees and Admins; activate/deactivate accounts.
- Configure **specializations** (Electrical, Plumbing, HVAC…) and the **drawing register** — every drawing type the firm produces, zoned by floor level (Basement / Stilt / Floor / Terrace). When assigning a task, only drawings valid for that floor's zone are offered. Linking a drawing to a specialization drives automatic review routing.
- **Assign tasks**: project + floor + drawing type + any team member (designers, architects, site supervisors, MEP — anyone except admins) + deadline. Tasks stay editable after assignment.
- Monitor everything: dashboard analytics, overdue work, audit trails.

### 3.2 Designer
- Sees **only their own work**: their projects, their tasks.
- Uploads design files against assigned tasks; each upload becomes a new **version** (V1, V2, V3…). Old versions stay accessible to them and to admins.
- When a design is rejected, they receive the reviewer's **written reason, voice memo and site photos**, then upload a revised version — which routes straight back to the reviewer.
- Cannot create projects, change deadlines, or reassign tasks.

### 3.3 On-Site Employee (Electrician, Plumber, HVAC Technician, …)
- Sees **only designs routed to their specialization** that are awaiting review.
- **Approves** a design — the task is complete.
- **Rejects** a design — must give a written reason **and a recorded voice memo** (up to 5 minutes), optionally up to 5 site photos.
- Cannot modify projects, floors, or assignments.

> **Who assigns the on-site reviewer?** Nobody assigns a person directly. Routing is **automatic by specialization**: a design in the "Electrical Design" category goes to *every active on-site user whose specialization is Electrical*. Whoever reviews first decides. A category with no specialization goes to all on-site users. Admin controls this via Team (user specializations) + Settings (category specializations).

---

## 4. Screens & What You Do On Them

### Projects (admin home)
Admins land here after signing in — the platform is **project-first**.
- Admin: all projects (+ New Project button).
- Designer: only projects where they have tasks (counts show *their* tasks).
- On-Site: only projects with designs routed to their team.

Opening a project, an admin gets five tabs:
- **Building** — the interactive elevation. Tapping a floor shows that floor's **full drawing register** with each drawing's state: unassigned ones have an inline *Assign* button; assigned ones show the assignee, deadline, status, an edit (✎) action to reassign/change deadline/delete, and a link to the full task.
- **Analytics** — this project's numbers: totals, pending, approved, rejected, overdue, due today, approval-rate ring, team performance, per-floor progress.
- **Team** — the project's members grouped by department; add or remove people (assignees are added automatically).
- **Revisions** — every upload, revision, approval and rejection in the project (filterable); click any entry to open that task's full history.
- **Settings** — this project's own drawing register: add, rename, re-zone, re-route or delete drawing types without affecting other projects.

Designers and on-site users see the Building view scoped to their own work, and keep their role dashboard:
- **Designer dashboard:** Assigned, Submitted, Approved, Rejected, Overdue.
- **On-Site dashboard:** Pending Reviews, Approvals, Rejections, Expired Reviews.

### Design Tasks / My Tasks / Reviews
The role-scoped task list with filters (All / Assigned / Pending Review / Approved / Rejected), deadlines and live SLA countdowns. Click any row to open the full task page.

### Task Detail Page
The heart of a single piece of work:
- **Design files** — all versions for admin/designer; on-site reviewers see *only the current version under review* (see §6).
- **Upload box** (designer) — drag in PDF, DWG, DXF, PNG, JPG or ZIP, max 50 MB.
- **Review Decision** (on-site, when pending) — Approve, or Reject with reason + voice memo + photos.
- **Review History** — every past decision with comments, playable voice notes and photo thumbnails.
- **Activity** — the immutable audit timeline: assigned, uploaded, approved, rejected, voice note added, SLA expired — with who and when.

### Team (admin)
Create and manage users; set role and specialization; toggle Active/Inactive (inactive users can't sign in and stop receiving routed work).

### Settings (admin)
Manage specializations and design categories, and the category→specialization links that drive routing.

### Profile (all roles)
Your details, avatar upload, password change.

---

## 5. The Review Cycle in Detail

1. **Assignment** — Admin assigns a task. Designer is notified.
2. **Upload (V1)** — Designer uploads. Task becomes *Pending Review*; a **24-hour review SLA timer** starts; the routed on-site team is notified.
3. **Review** — Reviewer opens the design (view or download), then:
   - **Approve** → task is *Approved*. Designer notified. Done.
   - **Reject** → must record a **voice memo** + written reason (+ optional photos). Task becomes *Rejected*; designer notified with all materials.
4. **Revision** — Designer uploads V2. Status becomes *Revision Submitted*; routes back to the reviewer; a fresh 24h SLA starts.
5. Repeat until approved.

**If the reviewer misses the 24h SLA:** the task is flagged, **admins and the routed team are notified automatically** ("Review overdue"), and the breach is written to the audit trail. The countdown turns red on every list.

---

## 6. Key Business Rules

- **Version visibility:** when a design is rejected, that version **disappears for on-site reviewers** — they only ever see the *current* version awaiting their review. Admins and designers always keep the full version history.
- **Rejection requires evidence:** a written reason is mandatory; a voice memo is mandatory whenever the device can record (devices without a microphone may submit with reason only).
- **Approved is final:** an approved task no longer accepts uploads.
- **Audit logs are immutable:** nothing in the Activity trail can be edited or deleted from the app.
- **Deadlines:** designers get a one-time "deadline approaching" notification within 24h of their task deadline; overdue tasks are surfaced on dashboards.

---

## 7. Notifications

The bell in the top bar shows your feed (badge = unread count; refreshes every minute). You're notified about:

| Event | Who gets it |
|---|---|
| Task assigned | The designer |
| Design uploaded / revision submitted | The routed on-site team |
| Design approved / rejected | The designer |
| Review overdue (24h SLA breached) | Admins + the routed team |
| Deadline approaching (< 24h) | The designer |

Click a notification to jump straight to the task. Email and mobile push delivery are planned for a later phase — currently notifications are in-app.

---

## 8. File Formats & Limits

| Type | Formats | Max size |
|---|---|---|
| Design files | PDF, DWG, DXF, PNG, JPG, ZIP | 50 MB |
| Voice memos | recorded in-app (also accepts MP3, AAC, WAV) | ~5 minutes |
| Site photos | PNG, JPG, WEBP, GIF | 10 MB each, 5 per review |

---

## 9. Admin Setup Checklist (new firm / new project)

1. **Settings →** create the specializations your site teams have.
2. **Settings →** create design categories and link each to its specialization.
3. **Team →** create designers; create on-site employees *with the right specialization*.
4. **Projects → New Project →** name, code, client, dates; set floors above ground + basements (floors are generated automatically).
5. **Assign Task →** pick project, floor, category, designer, deadline, priority.
6. Watch the dashboard. The platform handles routing, SLA timers, notifications and the paper trail from here.

---

## 10. Running & Sharing the App (operations)

**Stack:** Next.js 15 (App Router) + PostgreSQL (Prisma) + local-disk file storage (`./storage`). Mobile-responsive web app.

```bash
# first-time setup
npm install
npx prisma db push        # create/update the database schema
npm run db:seed           # optional demo data

# production mode (recommended — fast navigation)
npm run build
npm run start             # serves on http://localhost:3000

# development mode (hot reload, slower page loads)
npm run dev
```

**Sharing a public link (Cloudflare quick tunnel):**

```bash
./tunnel.sh               # restarts the tunnel and prints the shareable URL
```

Quick-tunnel caveats: the URL is random and **changes every time the tunnel restarts**; the link only works while this machine is awake. For a permanent address, use a named Cloudflare tunnel on your own domain, or host on a cloud platform (Node host + managed Postgres).

**Environment:** `.env` holds `DATABASE_URL` (Postgres) and optional `STORAGE_DIR`. Uploaded files live on disk under `storage/` — back this folder up together with the database.

---

## 11. Quick Reference — Task Statuses

| Status | Meaning | Next actor |
|---|---|---|
| **Assigned** | Waiting for the first upload | Designer |
| **Pending Review** | Uploaded; 24h SLA running | On-site team |
| **Rejected** | Sent back with voice memo + reason | Designer |
| **Revision Submitted** | New version uploaded after rejection; SLA restarted | On-site team |
| **Approved** | Signed off — complete | — |
