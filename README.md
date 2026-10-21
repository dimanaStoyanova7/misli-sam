# Мисли сам ("Think for Yourself")

A Bulgarian-language web app for teachers. A teacher logs in once with their school's code, uploads an assignment (PDF, photo, or pasted text), adds context (grade, subject, home/class, grading time), and gets:

1. An **AI-vulnerability score** (1–10) for the original assignment
2. **3–6 suggestions**, each explaining what to change, **what problem it solves**, an example wording, its impact, and its extra-work cost
3. **Accept/reject** for each suggestion, then one combined, rewritten assignment
4. A **before → after score** and **export** to Word (.docx) or PDF (via print)

Built with Next.js on Vercel, a Neon Postgres database, and the Anthropic API (Claude reads PDFs and photos directly, so there's no separate OCR step).

---

## How access works

- You create a **school** on the admin page (`/admin`). Each school gets its own **code**.
- A teacher enters the school code, then creates a **personal profile** with their name and a 4–6 digit **PIN**. On a new device they enter the code, name and PIN again. They stay logged in on each device for **30 days**, renewed while they keep using it.
- Five wrong PINs lock the profile for 15 minutes. A forgotten PIN is reset from `/admin` (click the number of teachers for a school); the teacher then logs in with a new PIN of their choice.
- Every analysis is saved automatically to the teacher's **„Моите задачи“**, private to them. They can reopen it (new version and export, or choose different suggestions without a new analysis) or delete it.
- From `/admin` you can set a **monthly limit** of analyses per school, **stop** a school's access (its teachers are logged out on their next action), give it a **new code** (logs everyone out, useful if a code leaks), or delete it.
- The admin page also shows usage per school and per teacher: analyses this month and in total, saved assignments, last login, and active sessions.

---

## Setup on Vercel

### Environment variables (Vercel → Settings → Environment Variables)

| Name | Required | What it is |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Your key from [console.anthropic.com](https://console.anthropic.com) → API Keys. Never put it in the code. |
| `DATABASE_URL` | Yes | Added automatically when you connect Neon (below). |
| `ADMIN_PASSWORD` | Yes | Password for the `/admin` page. Choose a strong one. |
| `ANTHROPIC_MODEL` | No | Defaults to `claude-sonnet-5-5`. |

After changing a variable, redeploy: **Deployments → ⋯ on the latest → Redeploy**.

### Database (Neon)
1. Vercel project → **Storage** → **Create Database** → **Neon** → region **Frankfurt (eu-central-1)** → Free plan → **Create**.
2. Connect it to the `misli-sam` project (all environments). This adds `DATABASE_URL`.
3. Nothing else: the tables are created automatically the first time the app uses the database.

The app runs its server functions in Frankfurt (`vercel.json`), next to the database and close to Bulgaria.

### First use
1. Open `https://<your-site>/admin`, enter `ADMIN_PASSWORD`, and create a school.
2. Copy its code, open the main page, and log in with it.

**Spending limit:** in the Anthropic Console, set a monthly spend limit so costs can never surprise you.

---

## Limits to know
- PDFs up to about 3 MB (Vercel's upload limit). Phone photos are shrunk automatically in the browser.
- Each analysis takes about 20–40 seconds.
- A login is per device and browser. A new device asks for the code once.

## Run locally (for developers)
```bash
npm install
cp .env.example .env.local
# For a quick local test with no real database and no AI costs:
#   DATABASE_URL=pglite:memory  MOCK_AI=1  ADMIN_PASSWORD=test
npm run dev                  # http://localhost:3000
```

## Project structure
```
app/page.js                    the teacher app (login + 3 steps)
app/admin/page.js              admin page: schools, codes, limits, usage
app/globals.css                design
app/api/login|logout|me        school code + name/PIN login, http-only session cookie
app/api/assignments            the teacher's saved assignments (list, open, delete)
app/api/admin/teachers         admin: teachers per school, PIN reset, delete
app/History.js                 „Моите задачи“ page
app/Board.js                   results: suggestions next to the part they refer to
app/api/analyze/route.js       reads the file + scores + suggestions
app/api/finalize/route.js      builds the final assignment from chosen suggestions
app/api/admin/schools/route.js admin API (protected by ADMIN_PASSWORD)
lib/ai.js                      prompts, output format, Anthropic call
lib/auth.js                    sessions, codes, PINs, limits, usage
lib/assignments.js             saving and loading assignments
lib/db.js                      database connection + automatic table setup
lib/mock.js                    sample AI answers for MOCK_AI=1
lib/client.js                  image compression, Word export
```

To change how suggestions are written, edit the `SYSTEM` prompt in `lib/ai.js`.

## Next steps (planned)
- Eval test set for the AI output
- "What a student would get from ChatGPT" preview
- Oral check questions
