/**
 * End-to-end test of the code generator: for every built-in app type,
 * generate the project, build its frontend with Vite, start its backend
 * (in-memory database) and exercise the API, including permissions.
 *
 *   npm test               all app types
 *   npm test -- restaurant  only types whose title matches
 *   SKIP_BUILD=1 npm test   backend checks only (no Vite build)
 *   TEST_MONGO_URI=mongodb+srv://... npm test   use a real MongoDB (a test database
 *                                               is created per app type and dropped)
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { PRESETS } = require("../services/presets");
const { normalizeBlueprint } = require("../services/blueprint");
const { generateProject } = require("../services/generator");
const { buildFrontend, run, cleanEnv } = require("../services/build");

const only = process.argv[2] ? process.argv[2].toLowerCase() : "";
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "p2s-test-"));
let failures = 0;

// A local mail server that captures the notification emails.
const { SMTPServer } = require("smtp-server");
const mails = [];
const smtp = new SMTPServer({
  authOptional: true,
  allowInsecureAuth: true,
  disabledCommands: ["STARTTLS"],
  onAuth: (auth, session, cb) => cb(null, { user: auth.username }),
  onData(stream, session, cb) {
    let raw = "";
    stream.on("data", (c) => (raw += c));
    stream.on("end", () => {
      mails.push({ to: session.envelope.rcptTo.map((r) => r.address), raw });
      cb();
    });
  },
});
const SMTP_PORT = 2526;

function check(cond, msg) {
  if (!cond) {
    failures++;
    console.log(`    ❌ ${msg}`);
  } else if (process.env.SHOW_ALL) {
    console.log(`    ✅ ${msg}`);
  }
  return cond;
}

async function http(base, method, url, body, token) {
  const res = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {}
  return { status: res.status, data };
}

function sampleFor(field, n = 1) {
  return {
    text: `Test ${field.label} ${n}`, textarea: "Some longer text", number: 3, price: 499, boolean: true,
    date: "2026-12-01", time: "18:30", select: field.options?.[0], email: `t${n}@example.com`, phone: "+91 90000 00000",
    url: "https://example.com", image: "https://example.com/a.jpg",
  }[field.type];
}
const recordBase = (model, n, links = {}) =>
  Object.fromEntries(
    model.fields
      .map((f) => [f.name, f.type === "relation" ? links[f.model] : f.name === model.payment?.end ? "2026-12-04" : sampleFor(f, n)])
      .filter(([, v]) => v !== undefined)
  );

// Emails arrive quoted-printable encoded; decode so we can search them.
function decodeMail(raw) {
  const soft = raw.replace(/=\r?\n/g, "");
  return Buffer.from(soft.replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))), "latin1").toString("utf8");
}
async function waitFor(list, from, pred, ms = 4000) {
  for (let t = 0; t < ms; t += 50) {
    const hit = list.slice(from).find(pred);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}
const mailTo = (addr, text) => (m) => m.to.includes(addr) && (!text || decodeMail(m.raw).includes(text));
const codeIn = (m) => (decodeMail(m.raw).match(/Code:\s*(\d{6})/) || [])[1];

// A fake CallMeBot that records WhatsApp messages.
const whatsapps = [];
const WA_PORT = 2527;
const waServer = require("http").createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  whatsapps.push({ phone: u.searchParams.get("phone"), text: u.searchParams.get("text"), apikey: u.searchParams.get("apikey") });
  res.end("Message queued. You will receive it in a few seconds.");
});

const OWNER = { email: "owner@example.com", phone: "+919876543210", upiId: "testshop@okicici", payeeName: "Test Shop" };
const ADMIN_PASSWORD = "AdminPass123";

let backendModules = null;
async function backendNodeModules(pkg) {
  if (backendModules) return backendModules;
  const dir = path.join(WORK, "backend-base");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "b", private: true, dependencies: pkg.dependencies }));
  await run("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"], { cwd: dir, env: cleanEnv(), timeoutMs: 400000 });
  return (backendModules = path.join(dir, "node_modules"));
}

async function startBackend(files, port) {
  const dir = path.join(WORK, `be-${port}`);
  for (const [p, c] of Object.entries(files)) {
    if (!p.startsWith("backend/")) continue;
    const t = path.join(dir, p.slice(8));
    fs.mkdirSync(path.dirname(t), { recursive: true });
    fs.writeFileSync(t, c);
  }
  fs.symlinkSync(await backendNodeModules(JSON.parse(files["backend/package.json"])), path.join(dir, "node_modules"), "junction");
  const env = {
    PATH: process.env.PATH, PORT: String(port), JWT_SECRET: "test-secret",
    SMTP_HOST: "127.0.0.1", SMTP_PORT: String(SMTP_PORT), SMTP_SECURE: "false", SMTP_USER: "app@test.local", SMTP_PASS: "x",
    ADMIN_PASSWORD, WHATSAPP_APIKEY: "wa-test-key", CALLMEBOT_URL: `http://127.0.0.1:${WA_PORT}/wa`, APP_URL: "https://shop.example",
  };
  if (process.env.TEST_MONGO_URI) {
    const [base, query] = process.env.TEST_MONGO_URI.split("?");
    env.MONGO_URI = `${base.replace(/^(mongodb(?:\+srv)?:\/\/[^/]+).*$/, "$1")}/p2s_test_${port}${query ? "?" + query : ""}`;
  }
  const child = spawn(process.execPath, ["server.js"], { cwd: dir, env });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 200));
    try {
      if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) {
        global.backendLog = () => log;
        return { child, log: () => log };
      }
    } catch {}
  }
  child.kill();
  throw new Error("backend didn't start:\n" + log);
}

async function signupCustomer(base, name, email, password = "custpass123") {
  const from = mails.length;
  const r = await http(base, "POST", "/api/auth/register", { name, email, password, phone: "+91 90000 12345" });
  if (r.status !== 202 || !r.data.needsVerification) return { error: `signup ${r.status} ${JSON.stringify(r.data)}` };
  const mail = await waitFor(mails, from, mailTo(email, "verification code"));
  const code = mail && codeIn(mail);
  if (!code) return { error: "no verification email" };
  const wrong = await http(base, "POST", "/api/auth/verify", { email, code: code === "111111" ? "222222" : "111111" });
  const v = await http(base, "POST", "/api/auth/verify", { email, code });
  return { token: v.data?.token, user: v.data?.user, wrongStatus: wrong.status };
}

async function testApi(bp, base) {
  const h = await http(base, "GET", "/api/health");
  check(h.data?.status === "ok", "health check");
  const expectDb = process.env.TEST_MONGO_URI ? "mongodb" : "memory";
  check(h.data?.database === expectDb, `uses the ${expectDb} database (got ${h.data?.database})`);

  let admin = null;
  let customer = null;
  let customerUser = null;
  let other = null;
  if (bp.auth) {
    // --- the owner's admin account comes from ADMIN_EMAIL/ADMIN_PASSWORD; nobody can sign up as admin
    const a = await http(base, "POST", "/api/auth/login", { email: OWNER.email, password: ADMIN_PASSWORD });
    check(a.status === 200 && a.data.user.role === "admin", `owner logs in as admin (${a.status})`);
    admin = a.data?.token;
    const steal = await http(base, "POST", "/api/auth/register", { name: "Hacker", email: OWNER.email, password: "hacker12345" });
    check(steal.status === 400, "nobody can sign up with the owner's email");
    check((await http(base, "POST", "/api/auth/login", { email: OWNER.email, password: "wrong-pass" })).status === 401, "wrong admin password rejected");

    // --- customers verify their email and get a customer ID
    const c = await signupCustomer(base, "Asha", "asha@example.com");
    check(!c.error, `customer signup + email code (${c.error || ""})`);
    check(c.wrongStatus === 400, "wrong verification code rejected");
    customer = c.token;
    customerUser = c.user;
    check(/^CUS-[A-Z2-9]{6}$/.test(customerUser?.customerId || "") && customerUser.role === "customer", `customer gets an ID (${customerUser?.customerId})`);
    const o = await signupCustomer(base, "Bala", "bala@example.com");
    other = o.token;
    check(o.user && o.user.customerId !== customerUser?.customerId, "each customer gets a unique ID");
    check((await http(base, "POST", "/api/auth/register", { name: "Asha2", email: "asha@example.com", password: "custpass123", phone: "9000012345" })).status === 400, "duplicate email rejected");
    const weak = await http(base, "POST", "/api/auth/register", { name: "W", email: "weak@example.com", password: "short" });
    check(weak.status === 400, "short passwords rejected");
    if (bp.requireLogin) {
      const noPhone = await http(base, "POST", "/api/auth/register", { name: "N", email: "nophone@example.com", password: "custpass123" });
      check(noPhone.status === 400 && /mobile/i.test(noPhone.data.message), "sign-up needs a mobile number when login is required");
    }

    // unverified customers can't log in until they confirm
    await http(base, "POST", "/api/auth/register", { name: "Late", email: "late@example.com", password: "custpass123", phone: "9000012345" });
    const late = await http(base, "POST", "/api/auth/login", { email: "late@example.com", password: "custpass123" });
    check(late.status === 403 && late.data.needsVerification, "unverified customer must confirm email first");

    // forgot / reset password
    let from = mails.length;
    await http(base, "POST", "/api/auth/forgot", { email: "asha@example.com" });
    const resetMail = await waitFor(mails, from, mailTo("asha@example.com", "Reset"));
    const reset = await http(base, "POST", "/api/auth/reset", { email: "asha@example.com", code: resetMail && codeIn(resetMail), password: "newpass12345" });
    check(reset.status === 200 && reset.data.token, "password reset with emailed code");
    check((await http(base, "POST", "/api/auth/login", { email: "asha@example.com", password: "newpass12345" })).status === 200, "login with the new password");

    // brute force protection
    let lastStatus = 0;
    for (let i = 0; i < 9; i++) lastStatus = (await http(base, "POST", "/api/auth/login", { email: "bala@example.com", password: "nope-nope" })).status;
    check(lastStatus === 429, `too many wrong passwords → locked out (${lastStatus})`);

    const me = await http(base, "GET", "/api/auth/me", null, customer);
    check(me.data?.user?.customerId === customerUser?.customerId, "/me shows the customer ID");
  }

  // ids of one item per model, for linked fields
  const links = {};
  for (const m of bp.models) {
    const rows = (await http(base, "GET", `/api/${m.key}`, null, admin)).data;
    if (Array.isArray(rows) && rows[0]) links[m.name] = rows[0]._id;
  }

  for (const m of bp.models) {
    const url = `/api/${m.key}`;
    const seeded = m.submission ? 0 : (bp.sampleData[m.name] || []).length;
    const record = (mm, n) => recordBase(mm, n, links);

    if (m.ownedByUser) {
      check((await http(base, "GET", url)).status === 401, `${m.name}: visitors can't list private data`);
      const c = await http(base, "POST", url, record(m, 1), customer);
      check(c.status === 201, `${m.name}: customer creates own record (${c.status} ${JSON.stringify(c.data)})`);
      check((await http(base, "GET", url, null, customer)).data?.length === 1, `${m.name}: customer sees own record`);
      check((await http(base, "GET", url, null, other)).data?.length === 0, `${m.name}: other users can't see it`);
      check((await http(base, "DELETE", `${url}/${c.data?._id}`, null, other)).status === 404, `${m.name}: other users can't delete it`);
      const upd = await http(base, "PUT", `${url}/${c.data?._id}`, { [m.titleField]: "Changed" }, customer);
      check(upd.data?.[m.titleField] === "Changed", `${m.name}: owner of the record can edit (${upd.status} ${JSON.stringify(upd.data).slice(0, 200)})`);
      continue;
    }

    // Listing
    const list = await http(base, "GET", url);
    if (!bp.auth || m.public.list) {
      check(list.status === 200 && list.data.length === seeded, `${m.name}: public list with ${seeded} items (got ${list.data?.length})`);
    } else {
      check(list.status === 401, `${m.name}: visitors can't list (${list.status})`);
      check((await http(base, "GET", url, null, admin)).status === 200, `${m.name}: admin can list`);
      check((await http(base, "GET", url, null, customer)).status === 403, `${m.name}: customers can't list everything`);
    }

    // Creating
    if (m.submission) {
      const pay = m.payment?.enabled && bp.acceptPayments;
      const expected = async (rec) => {
        const p = m.payment;
        if (p.from === "fixed") return p.fixed;
        if (p.from === "field") return Number(rec[p.field]);
        const target = bp.models.find((t) => t.name === m.fields.find((f) => f.name === p.link).model);
        const price = (await http(base, "GET", `/api/${target.key}/${rec[p.link]}`, null, admin)).data[target.priceField];
        return price * (p.quantity ? Number(rec[p.quantity]) : 1) * (p.start && p.end ? 3 : 1);
      };

      // a guest (not logged in)
      let fromMail = mails.length;
      let fromWa = whatsapps.length;
      const guestRec = record(m, 2);
      const guest = await http(base, "POST", url, guestRec);
      if (m.loginRequired) {
        check(guest.status === 401, `${m.name}: guests must log in first (${guest.status})`);
      } else {
        check(guest.status === 201, `${m.name}: guests can submit (${guest.status} ${JSON.stringify(guest.data)})`);
        check(new RegExp(`^[A-Z]{3}-[A-Z2-9]{6}$`).test(guest.data?.reference || ""), `${m.name}: reference number (${guest.data?.reference})`);
        check(typeof guest.data?.accessKey === "string" && guest.data.accessKey.length === 32, `${m.name}: guest gets a private tracking key`);
        if (m.notify) {
          const ownerMail = await waitFor(mails, fromMail, mailTo(OWNER.email, guest.data?.reference));
          check(ownerMail, `${m.name}: owner emailed`);
          const wa = await waitFor(whatsapps, fromWa, (w) => w.text.includes(guest.data?.reference));
          check(wa && wa.phone === OWNER.phone && wa.apikey === "wa-test-key", `${m.name}: owner gets a WhatsApp alert`);
          const rel = m.fields.find((f) => f.type === "relation" && links[f.model]);
          if (rel && ownerMail) {
            const target = bp.models.find((t) => t.name === rel.model);
            const title = (await http(base, "GET", `/api/${target.key}/${links[rel.model]}`, null, admin)).data[target.titleField];
            check(decodeMail(ownerMail.raw).includes(String(title)), `${m.name}: alert shows the linked ${rel.label} by name`);
          }
          const emailField = m.fields.find((f) => f.type === "email");
          if (emailField) check(await waitFor(mails, fromMail, mailTo(guestRec[emailField.name], "received")), `${m.name}: guest gets a confirmation email`);
        }
        const track = await http(base, "GET", `${url}/track/${guest.data?._id}?k=${guest.data?.accessKey}`);
        check(track.status === 200 && track.data.reference === guest.data?.reference, `${m.name}: guest can track with the key`);
        check((await http(base, "GET", `${url}/track/${guest.data?._id}?k=wrong`)).status === 404, `${m.name}: wrong key can't track`);
        check((await http(base, "GET", `${url}/${guest.data?._id}/receipt?k=${guest.data?.accessKey}`)).status === 200 && (await http(base, "GET", `${url}/${guest.data?._id}/receipt?k=nope`)).status === 404, `${m.name}: guest opens the receipt with the key only`);
        if (pay) {
          check(guest.data?.amount === (await expected(guestRec)) && guest.data.paymentStatus === "unpaid", `${m.name}: amount worked out on the server (${guest.data?.amount})`);
          check(guest.data?.payment?.upiLink?.startsWith(`upi://pay?pa=${OWNER.upiId}`) && guest.data.payment.upiLink.includes(`am=${guest.data.amount.toFixed(2)}`), `${m.name}: UPI link with the amount`);
          const gp = await http(base, "POST", `${url}/${guest.data?._id}/payment`, { utr: "412345678901", key: guest.data?.accessKey });
          check(gp.status === 200 && gp.data.paymentStatus === "verifying", `${m.name}: guest can submit a payment with the key`);
        }
      }

      // a logged-in customer
      if (bp.auth) {
        fromMail = mails.length;
        fromWa = whatsapps.length;
        const rec = record(m, 3);
        if (pay && m.payment.from === "field") rec[m.payment.field] = 777;
        const mine = await http(base, "POST", url, { ...rec, ...(pay ? { amount: 1, paymentStatus: "paid" } : {}) }, customer);
        check(mine.status === 201 && mine.data.customerId === customerUser.customerId && mine.data.customerEmail === "asha@example.com", `${m.name}: order linked to the customer ID (${mine.status})`);
        const myList = await http(base, "GET", `${url}/mine`, null, customer);
        check(myList.data?.length === 1 && myList.data[0].reference === mine.data.reference, `${m.name}: customer sees it in My account`);
        check((await http(base, "GET", `${url}/mine`, null, other)).data?.length === 0, `${m.name}: other customers can't see it`);
        check((await http(base, "GET", `${url}/${mine.data._id}`, null, customer)).status === 200, `${m.name}: customer can open their own`);
        check((await http(base, "GET", `${url}/${mine.data._id}`, null, other)).status === 403, `${m.name}: other customers can't open it`);
        if (m.notify) {
          const rm = await waitFor(mails, fromMail, mailTo("asha@example.com", mine.data.reference));
          check(rm && /receipt/i.test(decodeMail(rm.raw)), `${m.name}: customer gets a receipt email`);
          const wa = await waitFor(whatsapps, fromWa, (w) => w.text.includes(mine.data.reference));
          check(wa && wa.text.includes(customerUser.customerId), `${m.name}: WhatsApp alert includes the customer ID`);
        }

        if (pay) {
          check(mine.data.amount === (await expected(rec)) && mine.data.paymentStatus === "unpaid", `${m.name}: customer can't set their own price or status (${mine.data.amount}, ${mine.data.paymentStatus})`);
          const id = mine.data._id;
          check((await http(base, "POST", `${url}/${id}/payment`, { utr: "998877665544" }, other)).status === 403, `${m.name}: can't pay for someone else's`);
          check((await http(base, "POST", `${url}/${id}/payment`, { utr: "12" }, customer)).status === 400, `${m.name}: invalid UTR rejected`);
          fromMail = mails.length;
          fromWa = whatsapps.length;
          const claim = await http(base, "POST", `${url}/${id}/payment`, { utr: "998877665544" }, customer);
          check(claim.status === 200 && claim.data.paymentStatus === "verifying" && claim.data.paymentRef === "998877665544", `${m.name}: customer submits UTR → verifying`);
          check(await waitFor(mails, fromMail, mailTo(OWNER.email, "998877665544")), `${m.name}: owner emailed to check the payment`);
          check(await waitFor(whatsapps, fromWa, (w) => w.text.includes("998877665544")), `${m.name}: owner WhatsApp'd to check the payment`);
          check((await http(base, "POST", `${url}/${id}/payment-status`, { status: "paid" }, customer)).status === 403, `${m.name}: customers can't mark paid`);
          fromMail = mails.length;
          const paid = await http(base, "POST", `${url}/${id}/payment-status`, { status: "paid" }, admin);
          check(paid.status === 200 && paid.data.paymentStatus === "paid" && paid.data.paidAt, `${m.name}: owner marks it paid`);
          const got = await waitFor(mails, fromMail, mailTo("asha@example.com", "has confirmed your payment"));
          check(got, `${m.name}: customer emailed "Payment received"`);
          const gotText = got ? decodeMail(got.raw) : "";
          check(gotText.includes("Payment receipt") && gotText.includes(mine.data.reference) && gotText.includes("998877665544") && gotText.includes(mine.data.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })), `${m.name}: paid receipt email has the number, amount and UTR`);
          const rc = await http(base, "GET", `${url}/${id}/receipt`, null, customer);
          const sum = (rc.data?.lines || []).reduce((t, l) => t + l.total, 0);
          check(rc.status === 200 && rc.data.number === mine.data.reference && rc.data.status === "paid" && Math.abs(sum - mine.data.amount) < 0.01 && rc.data.billedTo.customerId === customerUser.customerId, `${m.name}: receipt page data (lines add up to ${sum})`);
          check((await http(base, "GET", `${url}/${id}/receipt`, null, other)).status === 404 && (await http(base, "GET", `${url}/${id}/receipt`)).status === 404, `${m.name}: nobody else can see the receipt`);
          check((await http(base, "GET", `${url}/${id}/receipt`, null, admin)).status === 200, `${m.name}: owner can see the receipt`);
          check((await http(base, "POST", `${url}/${id}/payment`, { utr: "111122223333" }, customer)).status === 400, `${m.name}: can't re-submit a paid order`);
          const st = await http(base, "GET", "/api/stats", null, admin);
          const s = st.data.models.find((x) => x.key === m.key);
          check(s.pay && s.pay.received === mine.data.amount, `${m.name}: dashboard shows money received (${s.pay?.received})`);
          if (m.payment.start && m.payment.end) {
            const bad = await http(base, "POST", url, { ...rec, [m.payment.end]: "2026-11-20" }, customer);
            check(bad.status === 400, `${m.name}: end date before start date rejected`);
          }
        }
      }
    } else {
      const visitorCreate = await http(base, "POST", url, record(m, 2));
      if (!bp.auth || m.public.create) check(visitorCreate.status === 201, `${m.name}: visitors can add`);
      else check(visitorCreate.status === 401, `${m.name}: visitors can't create`);
      if (bp.auth && !m.public.create) check((await http(base, "POST", url, record(m, 2), customer)).status === 403, `${m.name}: customers can't create`);
    }

    const created = await http(base, "POST", url, record(m, 3), admin);
    check(created.status === 201, `${m.name}: admin creates (${created.status} ${JSON.stringify(created.data)})`);
    const id = created.data?._id;

    // Validation
    const required = m.fields.find((f) => f.required);
    if (required) {
      const invalid = await http(base, "POST", url, { ...record(m, 4), [required.name]: "" }, admin);
      check(invalid.status === 400, `${m.name}: missing ${required.name} rejected`);
    }
    const relation = m.fields.find((f) => f.type === "relation");
    if (relation) {
      const badLink = await http(base, "POST", url, { ...record(m, 6), [relation.name]: "aaaaaaaaaaaaaaaaaaaaaaaa" }, admin);
      check(badLink.status === 400, `${m.name}: link to a missing ${relation.name} rejected (${badLink.status})`);
    }
    const select = m.fields.find((f) => f.type === "select");
    if (select) {
      const badSelect = await http(base, "POST", url, { ...record(m, 5), [select.name]: "Not an option" }, admin);
      check(badSelect.status === 400, `${m.name}: invalid ${select.name} rejected`);
    }

    // Search, get, update, delete
    const title = m.fields.find((f) => f.name === m.titleField);
    if (title && ["text", "textarea"].includes(title.type)) {
      const found = await http(base, "GET", `${url}?q=${encodeURIComponent("Test")}`, null, admin);
      check(found.data?.length >= 1, `${m.name}: search works`);
    }
    check((await http(base, "GET", `${url}/${id}`, null, admin)).status === 200, `${m.name}: get by id`);
    if (bp.auth) {
      check((await http(base, "DELETE", `${url}/${id}`)).status === 401, `${m.name}: visitors can't delete`);
      check((await http(base, "DELETE", `${url}/${id}`, null, customer)).status === 403, `${m.name}: customers can't delete`);
      check((await http(base, "PUT", `${url}/${id}`, { [m.titleField]: "x" }, customer)).status === 403, `${m.name}: customers can't edit`);
    }
    const upd = await http(base, "PUT", `${url}/${id}`, { [m.titleField]: title?.type === "email" ? "new@example.com" : "Updated" }, admin);
    check(upd.status === 200, `${m.name}: admin edits (${upd.status} ${JSON.stringify(upd.data)})`);
    check((await http(base, "DELETE", `${url}/${id}`, null, admin)).status === 200, `${m.name}: admin deletes`);
    check((await http(base, "GET", `${url}/${id}`, null, admin)).status === 404, `${m.name}: deleted item is gone`);
  }

  // Admin dashboard numbers
  const stats = await http(base, "GET", "/api/stats", null, admin);
  check(stats.status === 200 && stats.data.models.length === bp.models.length, "stats for every model");
  check(stats.data?.models.every((s) => s.last14.length === 14 && typeof s.today === "number"), "stats have 14-day history");
  if (bp.auth) {
    check((await http(base, "GET", "/api/stats")).status === 401, "stats need login");
    check((await http(base, "GET", "/api/stats", null, customer)).status === 403, "stats are admin-only");
  }

  // Image upload (stored in the database without Cloudinary)
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const up = await http(base, "POST", "/api/upload", { image: png }, admin);
  check(up.status === 200 && up.data.url === png, "image upload");
  check((await http(base, "POST", "/api/upload", { image: "data:text/html;base64,PGgxPg==" }, admin)).status === 400, "non-image upload rejected");
  const imageModel = bp.models.find((m) => !m.ownedByUser && m.fields.some((f) => f.type === "image"));
  if (imageModel) {
    const f = imageModel.fields.find((x) => x.type === "image");
    const c = await http(base, "POST", `/api/${imageModel.key}`, { ...recordBase(imageModel, 7, links), [f.name]: png }, admin);
    check(c.status === 201 && c.data[f.name] === png, `${imageModel.name}: saves an uploaded image`);
  }
}

smtp.on("error", () => {}); // a backend stopped mid-email

(async () => {
  await new Promise((r) => smtp.listen(SMTP_PORT, "127.0.0.1", r));
  await new Promise((r) => waServer.listen(WA_PORT, "127.0.0.1", r));
  const presets = PRESETS.filter((p) => !only || p.title.toLowerCase().includes(only));
  let port = 5600;
  for (const [i, preset] of presets.entries()) {
    const t0 = Date.now();
    // Every app gets a contact form, the owner's details and UPI payments;
    // every third one also requires customers to log in before ordering.
    const bp = normalizeBlueprint(
      { ...preset.blueprint, contactForm: true, owner: OWNER, acceptPayments: true, requireLogin: i % 3 === 2 },
      preset.title
    );
    const files = generateProject(bp);
    const before = failures;

    if (!process.env.SKIP_BUILD) try {
      const { dir, distDir } = await buildFrontend(files, { apiUrl: "http://localhost:5000" });
      check(fs.readFileSync(path.join(distDir, "index.html"), "utf8").includes("<div id=\"root\">"), "frontend built");
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (e) {
      check(false, `frontend build: ${e.message}\n${e.details || ""}`);
    }

    let backend;
    try {
      backend = await startBackend(files, ++port);
      await testApi(bp, `http://127.0.0.1:${port}`);
    } catch (e) {
      check(false, `backend: ${e.message}`);
    } finally {
      if (backend && process.env.TEST_MONGO_URI) {
        // Drop the test database.
        const mongoose = require(path.join(await backendNodeModules({}), "mongoose"));
        const uri = `${process.env.TEST_MONGO_URI.split("?")[0].replace(/^(mongodb(?:\+srv)?:\/\/[^/]+).*$/, "$1")}/p2s_test_${port}`;
        await mongoose.connect(uri).then(() => mongoose.connection.dropDatabase()).catch(() => {}).finally(() => mongoose.disconnect());
      }
      backend?.child.kill();
    }
    console.log(`${failures === before ? "✅" : "❌"} ${preset.title.padEnd(22)} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
  fs.rmSync(WORK, { recursive: true, force: true });
  smtp.close();
  waServer.close();
  console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
})();
