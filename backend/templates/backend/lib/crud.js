const express = require("express");
const crypto = require("crypto");
const SITE = require("../config/site");
const { createStore } = require("./store");
const { validate } = require("./validate");
const { checkLinks } = require("./links");
const { optionalAuth } = require("../middleware/auth");
const payments = require("./payments");
const notify = require("./notify");
const receipt = require("./receipt");

/**
 * The API for one data type (menu items, orders, bookings…), set up from its
 * model file. Access rules (def.access):
 *   "public" — anyone          "user" — logged-in people, each sees only their own
 *   "admin"  — only the site owner
 *
 * Forms visitors submit (def.submission: orders, bookings, enquiries) also get:
 *   - a reference number (ORD-7K2Q9X) and, if logged in, the customer's ID
 *   - email + WhatsApp alerts to the owner, a confirmation email to the customer
 *   - optional UPI payment: unpaid → verifying (customer entered UTR) → paid
 */

// Never sent to the browser in lists; personal details only to the owner/customer.
const SECRET_FIELDS = ["accessKey"];
const PERSONAL_FIELDS = ["customerEmail", "customerId", "userId", "paymentRef"];
const UTR_RE = /^[A-Za-z0-9]{6,30}$/;

module.exports = function crud(def) {
  const router = express.Router();
  const store = createStore(def);
  const a = def.access;
  const payEnabled = payments.enabledFor(def);

  router.use(optionalAuth);
  const isAdmin = (req) => !SITE.auth || req.user?.role === "admin";
  const allowed = (rule, req) => rule === "public" || (rule === "user" && Boolean(req.user)) || isAdmin(req);
  const deny = (req, res) =>
    res.status(req.user ? 403 : 401).json({ message: req.user ? "Only the site owner can do this" : "Please log in" });
  // Private data (tasks, expenses…): everyone — even the owner — only sees their own.
  const scope = (req) => (def.ownedByUser ? { user: req.user?.id } : {});
  const isMine = (req, item) => Boolean(req.user && item.userId && String(item.userId) === String(req.user.id));

  function clean(item, req, { keepKey = false } = {}) {
    if (!item) return item;
    const out = { ...item };
    if (!keepKey) for (const k of SECRET_FIELDS) delete out[k];
    if (!isAdmin(req) && !isMine(req, item) && !keepKey) for (const k of PERSONAL_FIELDS) delete out[k];
    return out;
  }
  const withPayment = (item) => ({ ...item, payment: payments.paymentInfo(item) });

  // GET /api/<items>?q=search
  router.get("/", async (req, res, next) => {
    try {
      if (!allowed(a.list, req)) return deny(req, res);
      const rows = await store.list(scope(req), { q: req.query.q });
      res.json(rows.map((r) => clean(r, req)));
    } catch (err) {
      next(err);
    }
  });

  if (def.submission) {
    // GET /api/<items>/mine — the logged-in customer's own orders/bookings
    router.get("/mine", async (req, res, next) => {
      try {
        if (!req.user) return res.status(401).json({ message: "Please log in" });
        const rows = await store.list({ userId: req.user.id });
        res.json(rows.map((r) => withPayment(clean(r, req))));
      } catch (err) {
        next(err);
      }
    });

    // GET /api/<items>/track/:id?k=KEY — status page for guests (link in their email)
    router.get("/track/:id", async (req, res, next) => {
      try {
        const item = await store.get(req.params.id);
        if (!item || !req.query.k || item.accessKey !== String(req.query.k)) return res.status(404).json({ message: "Not found" });
        res.json(withPayment(clean(item, req, { keepKey: true })));
      } catch (err) {
        next(err);
      }
    });

    // GET /api/<items>/:id/receipt?k=KEY — the receipt (customer, guest with key, or owner)
    router.get("/:id/receipt", async (req, res, next) => {
      try {
        const item = await store.get(req.params.id);
        const ok = item && (isAdmin(req) || isMine(req, item) || (req.query.k && item.accessKey === String(req.query.k)));
        if (!ok) return res.status(404).json({ message: "Receipt not found" });
        res.json(await receipt.data(def, item));
      } catch (err) {
        next(err);
      }
    });

    // POST /api/<items>/:id/payment { utr, key? } — the customer says they've paid
    router.post("/:id/payment", async (req, res, next) => {
      try {
        const item = await store.get(req.params.id);
        if (!item) return res.status(404).json({ message: `${def.singular} not found` });
        const authorised = isMine(req, item) || (req.body.key && item.accessKey === String(req.body.key));
        if (!authorised) return res.status(403).json({ message: "You can only pay for your own " + def.label.toLowerCase() });
        if (!(item.amount > 0)) return res.status(400).json({ message: "Nothing to pay for this one" });
        if (item.paymentStatus === "paid") return res.status(400).json({ message: "This is already paid" });
        const utr = String(req.body.utr || "").replace(/\s+/g, "");
        if (!UTR_RE.test(utr)) return res.status(400).json({ message: "Enter the UPI transaction ID (UTR / reference number) from your payment app" });

        const updated = await store.update(item._id, { paymentStatus: "verifying", paymentRef: utr, paymentClaimedAt: new Date().toISOString() });
        res.json(withPayment(clean(updated, req, { keepKey: true })));
        notify.paymentClaimed(def, updated);
      } catch (err) {
        next(err);
      }
    });

    // POST /api/<items>/:id/payment-status { status: "paid" | "unpaid" } — owner only
    router.post("/:id/payment-status", async (req, res, next) => {
      try {
        if (!isAdmin(req)) return deny(req, res);
        const status = req.body.status;
        if (!["paid", "unpaid"].includes(status)) return res.status(400).json({ message: "Status must be paid or unpaid" });
        const item = await store.get(req.params.id);
        if (!item) return res.status(404).json({ message: `${def.singular} not found` });
        if (!(item.amount > 0)) return res.status(400).json({ message: "This has no payment" });
        const before = item.paymentStatus; // read before updating (the in-memory store updates in place)
        const updated = await store.update(item._id, { paymentStatus: status, paidAt: status === "paid" ? new Date().toISOString() : "" });
        res.json(withPayment(clean(updated, req)));
        if (before !== status) notify.paymentUpdated(def, updated);
      } catch (err) {
        next(err);
      }
    });
  }

  // GET /api/<items>/:id
  router.get("/:id", async (req, res, next) => {
    try {
      const item = await store.get(req.params.id, scope(req));
      if (!item) return res.status(404).json({ message: `${def.singular} not found` });
      if (!allowed(a.list, req) && !isMine(req, item)) return deny(req, res);
      res.json(def.submission ? withPayment(clean(item, req)) : clean(item, req));
    } catch (err) {
      next(err);
    }
  });

  // POST /api/<items>
  router.post("/", async (req, res, next) => {
    try {
      if (!allowed(a.create, req)) return deny(req, res);
      if (def.loginRequired && !req.user) {
        return res.status(401).json({ message: "Please log in or create an account first" });
      }
      const { value, errors } = validate(def.fields, req.body);
      errors.push(...(await checkLinks(def, value, req.user)));
      if (payEnabled) errors.push(...payments.dateErrors(def, value));
      if (errors.length) return res.status(400).json({ message: errors.join(", "), errors });

      if (def.ownedByUser) value.user = req.user.id;
      if (def.submission) {
        value.reference = await payments.newReference(def);
        value.accessKey = crypto.randomBytes(16).toString("hex");
        const emailField = def.fields.find((f) => f.type === "email" && value[f.name]);
        if (req.user && req.user.role === "customer") {
          Object.assign(value, { userId: req.user.id, customerId: req.user.customerId, customerEmail: req.user.email });
        } else if (emailField) {
          value.customerEmail = String(value[emailField.name]).toLowerCase();
        }
        if (payEnabled) {
          const bill = await payments.priceFor(def, value);
          value.amount = bill.total;
          value.receiptLines = bill.total > 0 ? bill.lines : [];
          value.paymentStatus = value.amount > 0 ? "unpaid" : "none";
        }
      }

      const item = await store.create(value);
      // The person who submitted gets the private key (to view/pay without an account).
      res.status(201).json(def.submission ? withPayment(clean(item, req, { keepKey: true })) : clean(item, req));
      if (def.submission && def.notify && !isAdmin(req)) notify.newSubmission(def, item);
    } catch (err) {
      next(err);
    }
  });

  // PUT /api/<items>/:id
  router.put("/:id", async (req, res, next) => {
    try {
      if (!allowed(a.manage, req)) return deny(req, res);
      const { value, errors } = validate(def.fields, req.body, { partial: true });
      errors.push(...(await checkLinks(def, value, req.user)));
      if (errors.length) return res.status(400).json({ message: errors.join(", "), errors });
      const item = await store.update(req.params.id, value, scope(req));
      if (!item) return res.status(404).json({ message: `${def.singular} not found` });
      res.json(def.submission ? withPayment(clean(item, req)) : clean(item, req));
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/<items>/:id
  router.delete("/:id", async (req, res, next) => {
    try {
      if (!allowed(a.manage, req)) return deny(req, res);
      const ok = await store.remove(req.params.id, scope(req));
      if (!ok) return res.status(404).json({ message: `${def.singular} not found` });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
};
