// The "How it works" guide: each step points (with an arrow) at a real spot on the real screen.
// Where the arrow goes comes from guideSpots.json (made from the screenshots in public/guide).
import spots from "./guideSpots.json";

const S = [
  {
    id: "fullstack",
    label: "Full-stack app",
    icon: "Layers",
    intro: "A real app with logins, orders, bookings, payments and an admin panel.",
    steps: [
      { img: "fs-1", title: "Pick a template", label: "Swipe and pick a template", text: "Swipe, scroll or search the ready-made apps, then press Use. Or skip this and describe your business." },
      { img: "fs-2", title: "Or describe your business", label: "Type one line here", text: "Say what you sell or offer. We plan the pages, forms and prices for you." },
      { img: "fs-3", title: "Add your details", label: "Your email and phone", text: "Orders, bookings and payments come straight to you. Add a UPI ID to take payments." },
      { img: "fs-4", title: "Edit with a live preview", label: "The preview updates as you type", text: "Change pages, colours, photos and prices, or ask the AI in plain words." },
      { img: "fs-5", title: "Deploy", label: "Press Deploy for a live link", text: "You get a public link and your admin login by email. Redeploy any time to update the same link." },
    ],
  },
  {
    id: "static",
    label: "Static website",
    icon: "FileText",
    intro: "A fast, simple website that shows who you are and how to reach you.",
    steps: [
      { img: "st-1", title: "Describe the site", label: "Describe your website", text: "Write a line or two about the business or person the site is for." },
      { img: "st-2", title: "Choose a style", label: "Pick a look", text: "Choose a style. You can also add a reference image or a project name." },
      { img: "st-3", title: "Check the preview", label: "Your site appears here", text: "Look it over, then edit the HTML, CSS and JS if you want to change anything." },
      { img: "st-4", title: "Deploy", label: "Press Deploy", text: "Get a public link in under a minute. Download the files if you prefer to host it yourself." },
    ],
  },
  {
    id: "game",
    label: "3D game",
    icon: "Gamepad2",
    intro: "A 3D game with player accounts and a leaderboard, from a template or a prompt.",
    steps: [
      { img: "gm-1", title: "Pick a game", label: "Pick a game to start from", text: "27 templates: racers, runners, shooters, mazes, quizzes and more. Select one to try it live." },
      { img: "gm-2", title: "Or describe it", label: "Describe your game", text: "Write the idea, for example \"a neon car race at night\". The AI builds it for you." },
      { img: "gm-3", title: "Make it yours", label: "Change the world, colours, difficulty", text: "Edit the name, world, colours, lives, speed, quiz questions or memory cards." },
      { img: "gm-4", title: "Play it right here", label: "Press Play to test it in 3D", text: "The preview is the real game. It updates as you edit." },
      { img: "gm-5", title: "Deploy", label: "Press Deploy for players", text: "Players sign up, play and compete on your leaderboard. Redeploying keeps their scores." },
    ],
  },
  {
    id: "projects",
    label: "My projects",
    icon: "FolderOpen",
    intro: "Everything you've built, with its live links.",
    steps: [
      { img: "pr-1", title: "Everything is saved", label: "Each project is a card", text: "Apps, websites and games you've made are listed here, newest first." },
      { img: "pr-2", title: "Open and keep editing", label: "Open it", text: "Open a project to edit it. Press Redeploy and your live link updates." },
      { img: "pr-3", title: "Your live links", label: "Website, backend and code", text: "Open your live site, its backend, or the code on GitHub." },
      { img: "pr-4", title: "Delete or take offline", label: "Delete a project", text: "When you delete, you choose whether to take the live site offline too." },
    ],
  },
];

export const GUIDE = S.map((sec) => ({ ...sec, go: sec.id, steps: sec.steps.map((st) => ({ ...st, spot: spots[st.img] || null })) }));
