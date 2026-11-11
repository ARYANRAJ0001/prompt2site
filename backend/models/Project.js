const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["static", "fullstack", "game"], required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    prompt: { type: String, default: "", maxlength: 4000 },
    theme: { type: String, default: "" },

    // static sites
    html: { type: String, default: "" },
    css: { type: String, default: "" },
    js: { type: String, default: "" },

    // full-stack apps
    blueprint: { type: mongoose.Schema.Types.Mixed, default: null },
    planSource: { type: String, default: "" }, // ai | preset | generic | edited | template
    // Earlier versions of the plan (newest last, up to 20), for undo / restore.
    history: {
      type: [{ at: Date, label: String, blueprint: mongoose.Schema.Types.Mixed, _id: false }],
      default: [],
    },

    // Private settings for the deployed app — never sent to GitHub or the browser.
    //   whatsappKey   — the owner's CallMeBot API key (WhatsApp alerts)
    //   adminPassword — the generated app's admin password (shown to the owner)
    secrets: {
      type: {
        whatsappKey: { type: String, default: "" },
        brevoKey: { type: String, default: "" }, // the owner's own Brevo API key (optional)
        gmailPassword: { type: String, default: "" }, // the owner's own Gmail App Password (optional)
        adminPassword: { type: String, default: "" },
        adminPasswordSetAt: { type: String, default: "" },
      },
      default: () => ({}),
      select: false,
    },

    // deployment
    links: {
      live: { type: String, default: "" },
      backend: { type: String, default: "" },
      github: { type: String, default: "" },
    },
    deploy: {
      repo: { type: mongoose.Schema.Types.Mixed, default: null }, // { owner, name, branch }
      netlifySiteId: { type: String, default: "" },
      renderServiceId: { type: String, default: "" },
      deployedAt: { type: Date, default: null },
    },
  },
  { timestamps: true, minimize: false }
);

module.exports = mongoose.model("Project", projectSchema);
