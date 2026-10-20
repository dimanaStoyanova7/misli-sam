# Мисли сам ("Think for Yourself")

A Bulgarian-language web app for teachers. A teacher uploads an assignment (PDF, photo, or pasted text), adds context (grade, subject, home/class, grading time), and gets:

1. An **AI-vulnerability score** (1–10) for the original assignment
2. **3–6 suggestions**, each explaining what to change, **what problem it solves**, an example wording, its impact, and its extra-work cost
3. **Accept/reject** for each suggestion, then one combined, rewritten assignment
4. A **before → after score** and **export** to Word (.docx) or PDF (via print)

Built with Next.js, deployed on Vercel, using the Anthropic API (Claude reads PDFs and photos directly, so there's no separate OCR step).

---

## Deploy to Vercel (about 10 minutes, no coding)

### 1. Put the code on GitHub
1. Create a free account at [github.com](https://github.com) if you don't have one.
2. Click **New repository** → name it `misli-sam` → **Private** → **Create repository**.
3. On the empty repo page, click **uploading an existing file**.
4. Unzip this project and drag **all the files and folders inside it** into the page (`app`, `lib`, `package.json`, etc.). Then click **Commit changes**.

### 2. Connect Vercel
1. Go to [vercel.com](https://vercel.com) → sign up **with your GitHub account**.
2. Click **Add New → Project** → choose the `misli-sam` repo → **Import**.
3. Before clicking Deploy, open **Environment Variables** and add:

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | your key from [console.anthropic.com](https://console.anthropic.com) → API Keys |
| `ACCESS_CODE` | any password you choose, e.g. `uchitel2026` (recommended while testing) |

4. Click **Deploy**. After a minute you get a link like `misli-sam.vercel.app`.

### 3. Test it
Open the link, upload an assignment, and enter your access code when asked (the browser remembers it).

---

## Settings

| Variable | Required | What it does |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key. Never put it in the code. |
| `ACCESS_CODE` | No | If set, only people with the code can use the app, so strangers can't spend your tokens. Remove it when you're ready to go public. |
| `ANTHROPIC_MODEL` | No | Defaults to `claude-sonnet-5-5`. Change it to use a different Claude model. |

After changing a variable in Vercel, go to **Deployments → ⋯ → Redeploy** for it to take effect.

**Spending limit:** in the Anthropic Console, set a monthly spend limit under Billing/Limits so a test can never cost more than you expect.

---

## Limits to know
- PDFs up to about 3 MB (Vercel's upload limit). Phone photos are shrunk automatically in the browser.
- Each analysis takes about 20–40 seconds.
- No logins or saved history yet. Each visit starts fresh.

## Run locally (optional, for developers)
```bash
npm install
cp .env.example .env.local   # then add your key
npm run dev                  # http://localhost:3000
```

## Project structure
```
app/page.js              the whole interface (3 steps)
app/globals.css          design
app/api/analyze/route.js reads the file + scores + suggestions
app/api/finalize/route.js builds the final assignment from chosen suggestions
lib/ai.js                prompts, output format, Anthropic call
lib/client.js            image compression, Word export
```

To change how suggestions are written, edit the `SYSTEM` prompt in `lib/ai.js`.

## Next steps (planned)
- "What a student would get from ChatGPT" preview
- Oral check questions
- Logins, saved history, and a free monthly limit (this is where Railway or a database comes in)
