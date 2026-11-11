

# Prompt2Site

Deployed Link:=https://prompt2site-1-jjzg.onrender.com

Describe a website or app in plain English. Prompt2Site gives you the code, a live preview, and a deployed site.

- **Full-stack apps**: React + Vite frontend, Node.js + Express + MongoDB backend, login with an admin role, deployed to Netlify + Render + GitHub.
- **Static websites**: one-page HTML/CSS/JS sites, deployed to Netlify.

### What generated apps can do

- **Customers register before ordering** (on by default, can be switched off): name, email, mobile and password; the email is confirmed with a 6-digit code when Gmail is set up. Guests can still use "Contact us".
- **The owner is the only admin**: the owner's email + a generated password become the admin login. Everyone who signs up is a customer with an ID like `CUS-7K2Q9X` (email-code verification and "Forgot password" when Gmail is set up). Logins are rate-limited.
- **Email + WhatsApp alerts**: every order, booking or enquiry is emailed to the owner (Gmail) and sent on WhatsApp (free, via CallMeBot).
- **Reference numbers & tracking**: each order gets a number like `ORD-7K2Q9X`; guests get a private tracking link, customers see everything under **My account**.
- **UPI payments**: the owner adds their UPI ID (and optionally their shop's QR). Customers see the amount (worked out on the server), a QR code and a "Pay with GPay / PhonePe / Paytm" button, then enter the UTR. The owner gets an alert and marks it **Paid** / **Unpaid**; the customer sees the status. UPI can't confirm payments to a website automatically, so the owner checks their bank app first.
- **Contact us form**: switch it on in the plan editor.
- **Photo uploads**: photos are shrunk in the browser and stored in the database, or on Cloudinary if configured.
- **Linked data**: a booking links to a real room, an appointment to a doctor, an order to a product.
- **Layouts**: cards, table, photo gallery, calendar and board (columns like To do / In progress / Done).
- **Admin dashboard**: totals, a 14-day chart and the latest submissions.

### Builder features

- **Live preview beside the editor**: the site updates within a second as you change the plan, colours, text, fields or business details. On the start screen, click any template to see it live before using it. (One preview page is built once on the server and receives your plan by `postMessage`, so nothing is rebuilt per change.)
- **Design**: generated sites use frosted-glass panels over a slow, brand-coloured background, Google Fonts matched to the plan's font style, and consistent line icons (lucide) instead of emoji. Motion respects "reduce motion".
- **Templates**: 79 ready-made apps in 10 categories (food, shops, health & beauty, education, home services, travel, events, professional services, personal and business tools), with search. No AI needed.
- **Your business details** step: email, mobile, WhatsApp key (stored only on the server and in the app's Render settings — never in GitHub), UPI ID / QR, and "customers must log in to order". A **Send me a test alert** button checks email + WhatsApp.
- **Admin login** shown after deploy (and emailed), with **Reset password**.
- **Chat editing**: type "add a delivery address field to orders" or "dark mode". It works even if the AI is down, for simple commands.
- **Undo and Redo** (Ctrl+Z), plus **Versions** to restore earlier plans.
- **Take offline**: deletes the live site, backend and GitHub repo in one click.
- **Daily limits** per user, and **your own OpenRouter key** in ⚙️ Settings.

## 3D game builder

Open the **3D game** tab. Describe a game ("a neon car race at night") or pick one of 27 templates, edit it
(name, colours, world, difficulty, lives, quiz questions, memory cards), play it live in the preview and press
**Deploy**. The live game has player accounts (username + password) and an all-time / weekly leaderboard.

- 11 three.js engines: runner, racer, flyer, stack, helix, maze, penalty, shooter, snake, quiz, memory.
- Deploys like a full-stack app: GitHub repo, Netlify website, and a small Render backend for accounts and scores
  (needs `GITHUB_TOKEN`, `NETLIFY_TOKEN`, `RENDER_API_KEY`, `RENDER_OWNER_ID`; the AI prompt needs `OPENROUTER_API_KEY`,
  and falls back to a closest-match template without it).
- Scores are checked on the server (a run must exist and the score must be possible for the time played).
- Games never receive this server's email or other secrets. Add `GENERATED_APPS_MONGO_URI` (or `MONGO_URI`) so scores survive restarts.
- Code: `backend/services/games/` (library, validation, AI), `backend/templates/game/` (the game and its backend), `backend/routes/games.js`.

## How full-stack generation works

```
Your prompt ──► ① AI planner ──► small JSON "blueprint" (name, colours, pages, data fields, sample data)
                     │  (free models are fine: the plan is short, and it's checked and repaired)
                     │  (if the AI fails, a built-in plan for that kind of app is used)
                     ▼
               ② Plan editor  ── you can change names, colours, fields and who can see what
                     ▼
               ③ Code generator (no AI) ── tested templates → complete project (~38 files)
                     ▼
         Preview (sample data)   ·   Download zip   ·   Deploy: GitHub → Render → Netlify
```

The AI never writes the code, so the code always builds and runs. Built-in plans: restaurant, online store, task manager, blog, expense tracker, gym, clinic, courses, hotel, portfolio, events, real estate, notes, inventory, library, recipes and job board.

## Run it locally (Mac)

Keep the project in a normal folder like `~/Desktop/prompt2site`, not in Downloads.

**1. Backend** (Terminal window 1)

```bash
cd ~/Desktop/prompt2site/backend
cp .env.example .env
open -e .env          # fill in MONGO_URI, JWT_SECRET, OPENROUTER_API_KEY (and the deploy keys if you have them)
npm install
npm run dev
```

You should see `✅ Prompt2Site API running on http://localhost:1256` and `✅ MongoDB connected`.

**2. Frontend** (Terminal window 2)

```bash
cd ~/Desktop/prompt2site/frontend
cp .env.example .env.local
npm install
npm run dev
```

Your browser opens http://localhost:5173. Sign up, and you're in.

The **first preview** takes 1–2 minutes because it installs the website packages once. After that, previews take a few seconds.

## Settings (`backend/.env`)

| Key | Needed for | Where to get it |
| --- | --- | --- |
| `MONGO_URI` | everything | MongoDB Atlas → Connect → Drivers |
| `JWT_SECRET` | everything | any long random text |
| `OPENROUTER_API_KEY` | AI | openrouter.ai → Keys (free models work) |
| `GITHUB_TOKEN` | deploy | GitHub → Settings → Developer settings → Tokens (classic) → tick `repo` |
| `NETLIFY_TOKEN` | deploy | Netlify → User settings → Applications → New access token |
| `RENDER_API_KEY` | full-stack deploy | Render → Account settings → API keys |
| `RENDER_OWNER_ID` | full-stack deploy | Render → Workspace settings (starts with `tea-`) |
| `GMAIL_USER` | email alerts | the Gmail address that sends the alerts |
| `GMAIL_APP_PASSWORD` | email alerts | see "Set up Gmail" below |
| `CLOUDINARY_URL` | optional | cloudinary.com → Dashboard → API environment variable |
| `LIMIT_AI_PER_DAY`, `LIMIT_PREVIEWS_PER_DAY`, `LIMIT_DEPLOYS_PER_DAY` | optional | daily limits per user (defaults 40 / 60 / 15) |
| `FRONTEND_URL` | deployed builder | your builder's Netlify URL, so it may call the API |
| `GENERATED_APPS_MONGO_URI` | optional | a separate database for generated apps (otherwise `MONGO_URI` is used, one database per app) |
| `NETLIFY_SITE_ID`, `NETLIFY_FULLSTACK_SITE_ID` | optional | reuse one Netlify site if you hit the free site limit |
| `RENDER_REGION` | optional | `singapore` (default), `oregon`, `frankfurt`, `ohio`, `virginia` |

Without the deploy keys you can still generate, preview, edit and download.

## Set up Gmail for email alerts

1. Turn on **2-Step Verification**: Google Account → Security.
2. Open **App passwords** (search for it in your Google Account), create one named "Prompt2Site", and copy the 16-letter password.
3. In `backend/.env`, set `GMAIL_USER=you@gmail.com` and `GMAIL_APP_PASSWORD=abcd efgh ijkl mnop`.
4. Restart the backend. In **Your business details**, check your email (and optionally "Send alerts to"), then deploy.

Each deployed app gets these settings automatically. On a redeploy, changes such as a new notification email are updated too. Gmail allows about 500 emails a day.

## Email from deployed sites (Brevo)

Render's free plan **blocks outgoing SMTP** (Gmail), so deployed sites send email through Brevo's API over HTTPS instead (free, 300 emails a day):

1. Sign up at brevo.com → **SMTP & API → API keys → Generate a new API key**.
2. **Senders, domains & dedicated IPs → Senders → Add a sender** with your Gmail address, then click the link Brevo emails you.
3. In `backend/.env`: `BREVO_API_KEY=xkeysib-…` and `EMAIL_FROM=` that verified address. Restart and **Redeploy**.

If a site can't send email at all, customers can still sign up and log in; their email just isn't confirmed with a code.

## WhatsApp alerts (CallMeBot)

Each site owner does this once, from their own phone:

1. Save **+34 621 331 709** in your contacts.
2. Send it this WhatsApp message: `I allow callmebot to send me messages`
3. It replies with an API key. Paste it in **Your business details → WhatsApp alerts**, then deploy.

CallMeBot is a free third-party service meant for personal alerts; for high volumes use the official WhatsApp Business API.

## Deploy Prompt2Site itself

**Backend → Render**

1. Create a new **Web Service** from this repo.
2. Set **Root directory** to `backend`, **Build** to `npm install` and **Start** to `npm start`.
3. Add every key from `.env`, plus `FRONTEND_URL`.

**Frontend → Netlify**

1. Set **Base directory** to `frontend`, **Build** to `npm run build` and **Publish** to `frontend/dist`.
2. Add the environment variable `VITE_API_URL`, set to your Render backend URL.

## Tests

```bash
cd backend
npm test                                    # all 79 app types: build, run, API, permissions, orders, payments, email + WhatsApp alerts, uploads, stats
SKIP_BUILD=1 npm test                       # the same without building each frontend (faster)
TEST_MONGO_URI=mongodb+srv://... npm test   # the same against a real MongoDB
```

## Folder structure

```
backend/
  server.js                 API server
  routes/                   auth, projects, static, fullstack
  services/ai.js            OpenRouter client (free models first, retries)
  services/blueprint.js     AI planner + plan checking/repair
  services/presets.js       built-in plans used when the AI fails
  services/generator/       blueprint → generated backend code
  templates/frontend/       generated frontend (React pages and components)
  services/build.js         Vite builds (packages installed once, reused)
  services/deploy/          GitHub, Render, Netlify
  services/staticGenerator.js  static websites
  test/run-tests.js         generator test suite
frontend/
  src/components/           builder screens: plan editor, preview, code viewer, projects
```

## Good to know

- In a generated app, the **owner** (the email in "Your business details") is the only **admin**; the password is shown after the first deploy and emailed to the owner. The admin adds and edits content (menu items, products and so on) and sees all orders. Visitors can view public pages and submit forms (bookings, orders, enquiries). Private data (tasks, expenses, notes) is visible only to its owner.
- On Render's **free plan**, a backend sleeps after 15 minutes without visitors. The first visit after that takes about 50 seconds while it wakes up.
- Generated apps suit **data apps**: listings, bookings, catalogues and trackers. A game or a chat app needs custom code.
