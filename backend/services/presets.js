/**
 * Ready-made blueprints for common app types. Used only when the AI can't
 * produce a plan, so a "restaurant" prompt still gives a restaurant app.
 */
const f = (name, type = "text", extra = {}) => ({ name, type, ...extra });
const req = { required: true };

const PRESETS = [
  {
    title: "Restaurant",
    keywords: ["restaurant", "resturant", "restraunt", "cafe", "café", "food", "dhaba", "bistro", "pizza", "bakery", "menu", "diner", "hotel food", "canteen"],
    blueprint: {
      name: "Spice Garden",
      tagline: "Fresh, authentic food made with love",
      theme: { primary: "#b91c1c", accent: "#f59e0b", font: "serif" },
      hero: { title: "Taste the tradition", subtitle: "Fresh dishes cooked every day from local ingredients. Dine in, take away, or book a table.", cta: "See the menu" },
      features: [
        { icon: "🍛", title: "Fresh every day", text: "Everything is cooked to order with seasonal ingredients." },
        { icon: "🌿", title: "Veg & non-veg", text: "A wide menu with clear vegetarian options." },
        { icon: "📅", title: "Easy booking", text: "Reserve your table online in under a minute." },
      ],
      auth: true,
      models: [
        { name: "MenuItem", label: "Menu", icon: "🍽️", public: { list: true, create: false }, fields: [f("name", "text", req), f("price", "price", req), f("category", "select", { options: ["Starter", "Main course", "Dessert", "Drinks"] }), f("vegetarian", "boolean"), f("spicy", "boolean"), f("description", "textarea"), f("image", "image")] },
        { name: "Reservation", label: "Book a table", singular: "Reservation", icon: "📅", public: { list: false, create: true }, fields: [f("name", "text", req), f("phone", "phone", req), f("date", "date", req), f("time", "time", req), f("guests", "number", req), f("notes", "textarea")] },
      ],
      sampleData: {
        MenuItem: [
          { name: "Paneer Tikka", price: 249, category: "Starter", vegetarian: true, spicy: true, description: "Cottage cheese marinated in spices and grilled in the tandoor." },
          { name: "Butter Chicken", price: 349, category: "Main course", vegetarian: false, description: "Tender chicken in a rich tomato and butter gravy." },
          { name: "Dal Makhani", price: 229, category: "Main course", vegetarian: true, description: "Black lentils slow-cooked overnight with cream." },
          { name: "Gulab Jamun", price: 119, category: "Dessert", vegetarian: true, description: "Soft milk dumplings in warm rose syrup." },
          { name: "Masala Chai", price: 49, category: "Drinks", vegetarian: true, description: "Spiced tea brewed with milk." },
        ],
      },
      contact: { email: "hello@spicegarden.example", phone: "+91 98765 43210", address: "12 MG Road, Bengaluru" },
    },
  },
  {
    title: "Online store",
    keywords: ["shop", "store", "ecommerce", "e-commerce", "product", "products", "clothing", "fashion", "boutique", "cart", "sell", "marketplace"],
    blueprint: {
      name: "Urban Cart",
      tagline: "Quality products at honest prices",
      theme: { primary: "#0f766e", accent: "#f97316" },
      hero: { title: "Shop what you love", subtitle: "Hand-picked products, fast delivery and easy returns.", cta: "Browse products" },
      features: [
        { icon: "🚚", title: "Fast delivery", text: "Most orders arrive within 3 days." },
        { icon: "↩️", title: "Easy returns", text: "Not happy? Return it within 7 days." },
        { icon: "🔒", title: "Secure orders", text: "Your details are kept safe." },
      ],
      auth: true,
      models: [
        { name: "Product", label: "Products", icon: "🛍️", public: { list: true, create: false }, fields: [f("name", "text", req), f("price", "price", req), f("category", "select", { options: ["Clothing", "Accessories", "Home", "Electronics"] }), f("inStock", "boolean"), f("description", "textarea"), f("image", "image")] },
        { name: "Order", label: "Place an order", singular: "Order", icon: "🧾", public: { list: false, create: true }, fields: [f("customerName", "text", req), f("phone", "phone", req), f("product", "relation", { model: "Product", required: true }), f("quantity", "number", req), f("address", "textarea", req), f("status", "select", { options: ["New", "Packed", "Shipped", "Delivered"] })] },
      ],
      sampleData: {
        Product: [
          { name: "Cotton T-shirt", price: 499, category: "Clothing", inStock: true, description: "Soft 100% cotton, regular fit." },
          { name: "Leather Wallet", price: 899, category: "Accessories", inStock: true, description: "Slim wallet with 6 card slots." },
          { name: "Ceramic Mug", price: 299, category: "Home", inStock: false, description: "350 ml, microwave safe." },
          { name: "Wireless Earbuds", price: 1999, category: "Electronics", inStock: true, description: "20 hours of battery life." },
        ],
      },
    },
  },
  {
    title: "Task manager",
    keywords: ["todo", "to-do", "to do", "task", "tasks", "kanban", "checklist", "planner", "productivity"],
    blueprint: {
      name: "TaskFlow",
      tagline: "Plan your day and get things done",
      theme: { primary: "#4f46e5", accent: "#10b981", font: "rounded" },
      hero: { title: "Get organised", subtitle: "Create tasks, set priorities and track what's done — all in one place.", cta: "Open my tasks" },
      features: [
        { icon: "✅", title: "Simple tasks", text: "Add a task in seconds." },
        { icon: "🚦", title: "Priorities", text: "Focus on what matters most." },
        { icon: "🔒", title: "Private", text: "Only you can see your tasks." },
      ],
      auth: true,
      models: [
        { name: "Task", label: "My tasks", icon: "✅", ownedByUser: true, fields: [f("title", "text", req), f("priority", "select", { options: ["High", "Medium", "Low"] }), f("status", "select", { options: ["To do", "In progress", "Done"] }), f("dueDate", "date"), f("notes", "textarea")] },
      ],
    },
  },
  {
    title: "Blog",
    keywords: ["blog", "article", "articles", "news", "magazine", "post", "posts", "journal", "writing"],
    blueprint: {
      name: "The Daily Note",
      tagline: "Stories, ideas and how-tos",
      theme: { primary: "#1f2937", accent: "#e11d48", font: "serif" },
      hero: { title: "Ideas worth reading", subtitle: "Fresh articles every week on tech, life and creativity.", cta: "Read the blog" },
      features: [
        { icon: "✍️", title: "Thoughtful writing", text: "Long-form posts, no clickbait." },
        { icon: "🏷️", title: "Topics", text: "Find posts by category." },
        { icon: "💬", title: "Get in touch", text: "Send us a message any time." },
      ],
      auth: true,
      models: [
        { name: "Post", label: "Articles", icon: "📰", public: { list: true, create: false }, fields: [f("title", "text", req), f("category", "select", { options: ["Tech", "Life", "Creativity", "Travel"] }), f("author", "text"), f("publishedOn", "date"), f("content", "textarea", req), f("coverImage", "image")] },
        { name: "Message", label: "Contact us", singular: "Message", icon: "💬", public: { list: false, create: true }, fields: [f("name", "text", req), f("email", "email", req), f("message", "textarea", req)] },
      ],
      sampleData: {
        Post: [
          { title: "Getting started with React", category: "Tech", author: "Aryan", publishedOn: "2026-10-12", content: "React makes it easy to build interactive interfaces from small components..." },
          { title: "Morning routines that work", category: "Life", author: "Priya", publishedOn: "2026-10-20", content: "A good morning starts the night before. Here are five habits..." },
          { title: "A weekend in Coorg", category: "Travel", author: "Rahul", publishedOn: "2026-10-28", content: "Coffee estates, waterfalls and misty hills — our two-day guide..." },
        ],
      },
    },
  },
  {
    title: "Expense tracker",
    keywords: ["expense", "expenses", "budget", "finance", "money", "spending", "income", "accounting", "wallet"],
    blueprint: {
      name: "Spendly",
      tagline: "Know where your money goes",
      theme: { primary: "#059669", accent: "#6366f1" },
      hero: { title: "Track every rupee", subtitle: "Log expenses and income in seconds and stay on budget.", cta: "Open my expenses" },
      features: [
        { icon: "💸", title: "Quick entry", text: "Add an expense in two taps." },
        { icon: "🗂️", title: "Categories", text: "Food, travel, bills and more." },
        { icon: "🔒", title: "Private", text: "Your data is only visible to you." },
      ],
      auth: true,
      models: [
        { name: "Expense", label: "Expenses", icon: "💸", ownedByUser: true, fields: [f("title", "text", req), f("amount", "price", req), f("category", "select", { options: ["Food", "Travel", "Bills", "Shopping", "Other"] }), f("date", "date", req), f("type", "select", { options: ["Expense", "Income"] }), f("notes", "textarea")] },
      ],
    },
  },
  {
    title: "Gym / fitness",
    keywords: ["gym", "fitness", "workout", "yoga", "trainer", "exercise", "sports club", "crossfit"],
    blueprint: {
      name: "IronFit Gym",
      tagline: "Stronger every day",
      theme: { primary: "#dc2626", accent: "#111827", mode: "dark" },
      hero: { title: "Train with the best", subtitle: "Modern equipment, expert trainers and classes for every level.", cta: "See classes" },
      features: [
        { icon: "🏋️", title: "Modern equipment", text: "Everything you need under one roof." },
        { icon: "🧑‍🏫", title: "Expert trainers", text: "Certified coaches to guide you." },
        { icon: "🕕", title: "Open early", text: "6 AM to 11 PM, every day." },
      ],
      auth: true,
      models: [
        { name: "FitnessClass", label: "Classes", icon: "🏋️", public: { list: true, create: false }, fields: [f("name", "text", req), f("trainer", "text"), f("day", "select", { options: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] }), f("time", "time"), f("level", "select", { options: ["Beginner", "Intermediate", "Advanced"] }), f("description", "textarea")] },
        { name: "Plan", label: "Membership plans", icon: "💳", public: { list: true, create: false }, fields: [f("name", "text", req), f("price", "price", req), f("durationMonths", "number"), f("benefits", "textarea")] },
        { name: "Enquiry", label: "Join now", singular: "Enquiry", icon: "📝", public: { list: false, create: true }, fields: [f("name", "text", req), f("phone", "phone", req), f("plan", "relation", { model: "Plan" }), f("message", "textarea")] },
      ],
      sampleData: {
        FitnessClass: [
          { name: "Morning HIIT", trainer: "Vikram", day: "Monday", time: "07:00", level: "Intermediate", description: "45 minutes of high-intensity intervals." },
          { name: "Yoga Flow", trainer: "Ananya", day: "Wednesday", time: "18:30", level: "Beginner", description: "Stretch, breathe and relax." },
          { name: "Strength 101", trainer: "Karan", day: "Saturday", time: "09:00", level: "Beginner", description: "Learn the basic lifts safely." },
        ],
        Plan: [
          { name: "Monthly", price: 1499, durationMonths: 1, benefits: "Full gym access" },
          { name: "Quarterly", price: 3999, durationMonths: 3, benefits: "Gym + 2 classes a week" },
          { name: "Yearly", price: 12999, durationMonths: 12, benefits: "Everything + personal plan" },
        ],
      },
    },
  },
  {
    title: "Clinic / appointments",
    keywords: ["clinic", "doctor", "hospital", "dentist", "appointment", "appointments", "patient", "health", "medical", "salon", "spa", "barber"],
    blueprint: {
      name: "CareWell Clinic",
      tagline: "Caring for your family's health",
      theme: { primary: "#0284c7", accent: "#22c55e", font: "rounded" },
      hero: { title: "Your health, our priority", subtitle: "Experienced doctors and easy online appointments.", cta: "Book an appointment" },
      features: [
        { icon: "🩺", title: "Expert doctors", text: "Specialists across departments." },
        { icon: "📅", title: "Online booking", text: "Choose a time that suits you." },
        { icon: "💙", title: "Patient first", text: "Friendly care, clear advice." },
      ],
      auth: true,
      models: [
        { name: "Doctor", label: "Our doctors", icon: "🩺", public: { list: true, create: false }, fields: [f("name", "text", req), f("specialty", "select", { options: ["General", "Pediatrics", "Dental", "Cardiology", "Dermatology"] }), f("experienceYears", "number"), f("availableDays", "text"), f("photo", "image")] },
        { name: "Appointment", label: "Book an appointment", singular: "Appointment", icon: "📅", public: { list: false, create: true }, fields: [f("patientName", "text", req), f("phone", "phone", req), f("doctor", "relation", { model: "Doctor" }), f("date", "date", req), f("time", "time"), f("reason", "textarea")] },
      ],
      sampleData: {
        Doctor: [
          { name: "Dr. Meera Rao", specialty: "General", experienceYears: 12, availableDays: "Mon–Fri" },
          { name: "Dr. Arjun Shah", specialty: "Pediatrics", experienceYears: 8, availableDays: "Mon, Wed, Sat" },
          { name: "Dr. Nisha Kapoor", specialty: "Dental", experienceYears: 10, availableDays: "Tue–Sat" },
        ],
      },
    },
  },
  {
    title: "Courses / school",
    keywords: ["course", "courses", "school", "college", "education", "learning", "tuition", "coaching", "academy", "student", "class"],
    blueprint: {
      name: "BrightPath Academy",
      tagline: "Learn skills that matter",
      theme: { primary: "#7c3aed", accent: "#f59e0b" },
      hero: { title: "Start learning today", subtitle: "Practical courses taught by experienced mentors.", cta: "Explore courses" },
      features: [
        { icon: "🎓", title: "Expert mentors", text: "Learn from people who do the work." },
        { icon: "🧪", title: "Hands-on", text: "Projects in every course." },
        { icon: "📜", title: "Certificates", text: "Get certified on completion." },
      ],
      auth: true,
      models: [
        { name: "Course", label: "Courses", icon: "📚", public: { list: true, create: false }, fields: [f("title", "text", req), f("instructor", "text"), f("level", "select", { options: ["Beginner", "Intermediate", "Advanced"] }), f("durationWeeks", "number"), f("fee", "price"), f("description", "textarea")] },
        { name: "Enrollment", label: "Enroll", singular: "Enrollment", icon: "📝", public: { list: false, create: true }, fields: [f("studentName", "text", req), f("email", "email", req), f("phone", "phone"), f("course", "relation", { model: "Course", required: true }), f("message", "textarea")] },
      ],
      sampleData: {
        Course: [
          { title: "Web Development Bootcamp", instructor: "Aryan Raj", level: "Beginner", durationWeeks: 12, fee: 14999, description: "HTML, CSS, JavaScript, React and Node.js." },
          { title: "Data Analysis with Python", instructor: "Sneha", level: "Intermediate", durationWeeks: 8, fee: 9999, description: "Pandas, charts and real datasets." },
          { title: "UI Design Basics", instructor: "Rohan", level: "Beginner", durationWeeks: 6, fee: 6999, description: "Layout, colour and type with Figma." },
        ],
      },
    },
  },
  {
    title: "Hotel / rooms",
    keywords: ["hotel", "resort", "homestay", "rooms", "room booking", "hostel", "lodge", "airbnb", "stay"],
    blueprint: {
      name: "Hillside Retreat",
      tagline: "Your peaceful stay in the hills",
      theme: { primary: "#166534", accent: "#ca8a04", font: "serif" },
      hero: { title: "Relax in nature", subtitle: "Cosy rooms, mountain views and home-cooked meals.", cta: "View rooms" },
      features: [
        { icon: "🏔️", title: "Mountain views", text: "Wake up to the hills." },
        { icon: "🍳", title: "Breakfast included", text: "Fresh local breakfast every morning." },
        { icon: "📶", title: "Free Wi-Fi", text: "Stay connected if you need to." },
      ],
      auth: true,
      models: [
        { name: "Room", label: "Rooms", icon: "🛏️", public: { list: true, create: false }, fields: [f("name", "text", req), f("pricePerNight", "price", req), f("capacity", "number"), f("type", "select", { options: ["Standard", "Deluxe", "Suite", "Cottage"] }), f("available", "boolean"), f("description", "textarea"), f("image", "image")] },
        { name: "Booking", label: "Book a stay", singular: "Booking", icon: "📅", public: { list: false, create: true }, fields: [f("guestName", "text", req), f("phone", "phone", req), f("room", "relation", { model: "Room" }), f("checkIn", "date", req), f("checkOut", "date", req), f("guests", "number")] },
      ],
      sampleData: {
        Room: [
          { name: "Valley View Room", pricePerNight: 2499, capacity: 2, type: "Standard", available: true, description: "Queen bed with a balcony." },
          { name: "Pine Deluxe", pricePerNight: 3999, capacity: 3, type: "Deluxe", available: true, description: "Spacious room with a sit-out." },
          { name: "Family Cottage", pricePerNight: 6499, capacity: 5, type: "Cottage", available: false, description: "Two bedrooms and a private garden." },
        ],
      },
    },
  },
  {
    title: "Portfolio",
    keywords: ["portfolio", "personal website", "resume", "cv", "freelancer", "photographer", "designer", "developer portfolio"],
    blueprint: {
      name: "Alex Kumar",
      tagline: "Designer & developer",
      theme: { primary: "#111827", accent: "#8b5cf6", mode: "dark" },
      hero: { title: "Hi, I build things for the web", subtitle: "I design and develop fast, friendly websites and apps.", cta: "See my work" },
      features: [
        { icon: "🎨", title: "Design", text: "Clean interfaces people enjoy using." },
        { icon: "💻", title: "Development", text: "React, Node.js and MongoDB." },
        { icon: "🚀", title: "Delivery", text: "On time, every time." },
      ],
      auth: true,
      models: [
        { name: "Project", label: "Projects", icon: "💼", public: { list: true, create: false }, fields: [f("title", "text", req), f("category", "select", { options: ["Web", "Mobile", "Design", "Other"] }), f("year", "number"), f("link", "url"), f("description", "textarea"), f("image", "image")] },
        { name: "Message", label: "Contact me", singular: "Message", icon: "✉️", public: { list: false, create: true }, fields: [f("name", "text", req), f("email", "email", req), f("message", "textarea", req)] },
      ],
      sampleData: {
        Project: [
          { title: "Food delivery app", category: "Mobile", year: 2026, description: "Ordering and live tracking for a local chain." },
          { title: "Clinic booking site", category: "Web", year: 2025, description: "Online appointments for a 4-doctor clinic." },
          { title: "Brand identity", category: "Design", year: 2025, description: "Logo, colours and type for a coffee brand." },
        ],
      },
    },
  },
  {
    title: "Events",
    keywords: ["event", "events", "conference", "meetup", "wedding", "party", "concert", "workshop", "ticket", "tickets"],
    blueprint: {
      name: "EventHub",
      tagline: "Discover and join great events",
      theme: { primary: "#db2777", accent: "#7c3aed" },
      hero: { title: "Don't miss out", subtitle: "Workshops, meetups and shows happening near you.", cta: "See events" },
      features: [
        { icon: "🎟️", title: "Easy registration", text: "Sign up in seconds." },
        { icon: "📍", title: "Near you", text: "Events across the city." },
        { icon: "🔔", title: "Stay updated", text: "New events every week." },
      ],
      auth: true,
      models: [
        { name: "Event", label: "Events", icon: "🎉", layout: "calendar", public: { list: true, create: false }, fields: [f("title", "text", req), f("date", "date", req), f("time", "time"), f("venue", "text"), f("category", "select", { options: ["Workshop", "Meetup", "Music", "Sports"] }), f("ticketPrice", "price"), f("description", "textarea")] },
        { name: "Registration", label: "Register", singular: "Registration", icon: "📝", public: { list: false, create: true }, fields: [f("name", "text", req), f("email", "email", req), f("phone", "phone"), f("event", "relation", { model: "Event", required: true }), f("tickets", "number")] },
      ],
      sampleData: {
        Event: [
          { title: "React Bengaluru Meetup", date: "2026-11-22", time: "17:00", venue: "Koramangala", category: "Meetup", ticketPrice: 0, description: "Talks and networking for React developers." },
          { title: "Pottery Workshop", date: "2026-11-29", time: "11:00", venue: "Indiranagar", category: "Workshop", ticketPrice: 1200, description: "Make your first bowl." },
          { title: "Indie Music Night", date: "2026-12-06", time: "19:30", venue: "HSR Layout", category: "Music", ticketPrice: 499, description: "Three local bands, one stage." },
        ],
      },
    },
  },
  {
    title: "Real estate",
    keywords: ["real estate", "property", "properties", "apartment", "flat", "rent", "house", "builder", "plots"],
    blueprint: {
      name: "HomeKey Realty",
      tagline: "Find a place you'll love",
      theme: { primary: "#1d4ed8", accent: "#f59e0b" },
      hero: { title: "Find your next home", subtitle: "Verified listings to buy or rent across the city.", cta: "Browse properties" },
      features: [
        { icon: "🏠", title: "Verified listings", text: "Every property is checked." },
        { icon: "🤝", title: "No hidden fees", text: "Clear pricing up front." },
        { icon: "📞", title: "Quick callback", text: "Talk to an agent today." },
      ],
      auth: true,
      models: [
        { name: "Property", label: "Properties", icon: "🏠", public: { list: true, create: false }, fields: [f("title", "text", req), f("price", "price", req), f("listing", "select", { options: ["For sale", "For rent"] }), f("bedrooms", "number"), f("location", "text"), f("areaSqft", "number"), f("description", "textarea"), f("image", "image")] },
        { name: "Enquiry", label: "Enquire", singular: "Enquiry", icon: "📞", public: { list: false, create: true }, fields: [f("name", "text", req), f("phone", "phone", req), f("property", "relation", { model: "Property" }), f("message", "textarea")] },
      ],
      sampleData: {
        Property: [
          { title: "2BHK near Metro", price: 7500000, listing: "For sale", bedrooms: 2, location: "Whitefield", areaSqft: 1150, description: "Bright corner flat, 5 min to the metro." },
          { title: "Studio apartment", price: 18000, listing: "For rent", bedrooms: 1, location: "Koramangala", areaSqft: 480, description: "Fully furnished, ideal for one." },
          { title: "3BHK villa", price: 21000000, listing: "For sale", bedrooms: 3, location: "Sarjapur", areaSqft: 2400, description: "Gated community with a garden." },
        ],
      },
    },
  },
  {
    title: "Notes",
    keywords: ["note", "notes", "diary", "notebook", "journal app", "bookmarks"],
    blueprint: {
      name: "NoteNest",
      tagline: "Your thoughts, organised",
      theme: { primary: "#ea580c", accent: "#0ea5e9", font: "rounded" },
      hero: { title: "Write it down", subtitle: "Quick notes you can find again.", cta: "Open my notes" },
      features: [
        { icon: "📝", title: "Fast notes", text: "Capture ideas instantly." },
        { icon: "📌", title: "Pin important ones", text: "Keep key notes on top." },
        { icon: "🔒", title: "Private", text: "Only you can read them." },
      ],
      auth: true,
      models: [{ name: "Note", label: "My notes", icon: "📝", ownedByUser: true, fields: [f("title", "text", req), f("content", "textarea"), f("tag", "select", { options: ["Personal", "Work", "Ideas", "Study"] }), f("pinned", "boolean")] }],
    },
  },
  {
    title: "Inventory",
    keywords: ["inventory", "stock", "warehouse", "supplies", "assets", "pos"],
    blueprint: {
      name: "StockWise",
      tagline: "Always know what's in stock",
      theme: { primary: "#334155", accent: "#22c55e" },
      hero: { title: "Inventory made simple", subtitle: "Track items, quantities and suppliers in one place.", cta: "Open inventory" },
      features: [
        { icon: "📦", title: "Track items", text: "Quantities always up to date." },
        { icon: "⚠️", title: "Low stock", text: "See what needs reordering." },
        { icon: "🏭", title: "Suppliers", text: "Keep supplier details handy." },
      ],
      auth: true,
      models: [
        { name: "InventoryItem", label: "Inventory", icon: "📦", ownedByUser: true, fields: [f("name", "text", req), f("sku", "text"), f("quantity", "number", req), f("price", "price"), f("category", "select", { options: ["Raw material", "Finished goods", "Packaging", "Other"] }), f("supplier", "text")] },
      ],
    },
  },
  {
    title: "Library / books",
    keywords: ["library", "book", "books", "bookstore", "reading"],
    blueprint: {
      name: "Readers' Corner",
      tagline: "A book for every mood",
      theme: { primary: "#92400e", accent: "#0f766e", font: "serif" },
      hero: { title: "Find your next read", subtitle: "Browse our collection and reserve a book.", cta: "Browse books" },
      features: [
        { icon: "📚", title: "Big collection", text: "Fiction, non-fiction and more." },
        { icon: "🔖", title: "Reserve online", text: "Pick up when it suits you." },
        { icon: "☕", title: "Reading room", text: "Quiet space to read." },
      ],
      auth: true,
      models: [
        { name: "Book", label: "Books", icon: "📖", public: { list: true, create: false }, fields: [f("title", "text", req), f("author", "text", req), f("genre", "select", { options: ["Fiction", "Non-fiction", "Science", "Children", "Comics"] }), f("year", "number"), f("available", "boolean"), f("description", "textarea")] },
        { name: "Reservation", label: "Reserve a book", singular: "Reservation", icon: "🔖", public: { list: false, create: true }, fields: [f("name", "text", req), f("phone", "phone", req), f("book", "relation", { model: "Book", required: true }), f("pickupDate", "date")] },
      ],
      sampleData: {
        Book: [
          { title: "The Guide", author: "R. K. Narayan", genre: "Fiction", year: 1958, available: true },
          { title: "Wings of Fire", author: "A. P. J. Abdul Kalam", genre: "Non-fiction", year: 1999, available: true },
          { title: "A Brief History of Time", author: "Stephen Hawking", genre: "Science", year: 1988, available: false },
        ],
      },
    },
  },
  {
    title: "Recipes",
    keywords: ["recipe", "recipes", "cooking", "kitchen", "meal"],
    blueprint: {
      name: "HomeChef",
      tagline: "Easy recipes for every day",
      theme: { primary: "#c2410c", accent: "#65a30d", font: "rounded" },
      hero: { title: "Cook something tasty", subtitle: "Simple recipes with everyday ingredients.", cta: "See recipes" },
      features: [
        { icon: "⏱️", title: "Quick", text: "Most recipes under 30 minutes." },
        { icon: "🥕", title: "Simple ingredients", text: "Things you already have." },
        { icon: "👩‍🍳", title: "Step by step", text: "Clear, easy instructions." },
      ],
      auth: true,
      models: [
        { name: "Recipe", label: "Recipes", icon: "🍲", public: { list: true, create: false }, fields: [f("title", "text", req), f("cuisine", "select", { options: ["Indian", "Italian", "Chinese", "Continental"] }), f("timeMinutes", "number"), f("vegetarian", "boolean"), f("ingredients", "textarea", req), f("steps", "textarea", req), f("image", "image")] },
      ],
      sampleData: {
        Recipe: [
          { title: "Veg Pulao", cuisine: "Indian", timeMinutes: 30, vegetarian: true, ingredients: "Rice, mixed vegetables, whole spices", steps: "Sauté spices, add vegetables and rice, cook with water." },
          { title: "Pasta Arrabbiata", cuisine: "Italian", timeMinutes: 25, vegetarian: true, ingredients: "Penne, tomatoes, garlic, chilli", steps: "Cook pasta, make a spicy tomato sauce, toss together." },
          { title: "Hakka Noodles", cuisine: "Chinese", timeMinutes: 20, vegetarian: true, ingredients: "Noodles, cabbage, carrot, soy sauce", steps: "Boil noodles, stir-fry vegetables, mix with sauces." },
        ],
      },
    },
  },
  {
    title: "Job board",
    keywords: ["job", "jobs", "hiring", "career", "careers", "recruit", "recruitment", "vacancy"],
    blueprint: {
      name: "HireLane",
      tagline: "Find work you'll enjoy",
      theme: { primary: "#2563eb", accent: "#16a34a" },
      hero: { title: "Your next job is here", subtitle: "Fresh openings from companies that are hiring now.", cta: "See jobs" },
      features: [
        { icon: "💼", title: "Real openings", text: "Every listing is verified." },
        { icon: "⚡", title: "Apply fast", text: "One short form." },
        { icon: "🌍", title: "Remote & on-site", text: "Filter by how you like to work." },
      ],
      auth: true,
      models: [
        { name: "Job", label: "Jobs", icon: "💼", public: { list: true, create: false }, fields: [f("title", "text", req), f("company", "text", req), f("location", "text"), f("type", "select", { options: ["Full-time", "Part-time", "Internship", "Remote"] }), f("salary", "text"), f("description", "textarea")] },
        { name: "Application", label: "Apply", singular: "Application", icon: "📨", public: { list: false, create: true }, fields: [f("name", "text", req), f("email", "email", req), f("phone", "phone"), f("job", "relation", { model: "Job", required: true }), f("resumeLink", "url"), f("coverNote", "textarea")] },
      ],
      sampleData: {
        Job: [
          { title: "Frontend Developer", company: "PixelWorks", location: "Bengaluru", type: "Full-time", salary: "₹8–12 LPA", description: "React, TypeScript and a love for good UI." },
          { title: "Backend Intern", company: "CloudNest", location: "Remote", type: "Internship", salary: "₹25k/month", description: "Node.js and MongoDB, 6 months." },
          { title: "UI Designer", company: "Brightside", location: "Pune", type: "Full-time", salary: "₹6–9 LPA", description: "Design web and mobile screens." },
        ],
      },
    },
  },
];

// Categories for the gallery, then the extra templates from presetsMore.js.
const { MORE, CATEGORIES: C } = require("./presetsMore");
const BASE_CATEGORY = {
  Restaurant: C.food, "Online store": C.shop, "Task manager": C.personal, Blog: C.pro, "Expense tracker": C.personal,
  "Gym / fitness": C.health, "Clinic / appointments": C.health, "Courses / school": C.edu, "Hotel / rooms": C.travel,
  Portfolio: C.pro, Events: C.events, "Real estate": C.home, Notes: C.personal, Inventory: C.biz, "Library / books": C.edu,
  Recipes: C.food, "Job board": C.biz,
};
for (const p of PRESETS) p.category = p.category || BASE_CATEGORY[p.title] || C.biz;
PRESETS.push(...MORE);

// Every ready-made site starts in the "Crystal black" look (black glass with
// the template's own accent colours). Owners can switch to light or dark.
for (const p of PRESETS) p.blueprint.theme = { ...(p.blueprint.theme || {}), mode: "crystal" };

function titleFromPrompt(prompt) {
  const cleaned = String(prompt || "")
    .replace(/\b(make|create|build|generate|develop|design|a|an|the|me|for|my|website|web site|site|app|application|web app|full ?stack|please|with|using)\b/gi, " ")
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const t = cleaned.split(" ").slice(0, 4).join(" ");
  return t ? t.replace(/\b\w/g, (c) => c.toUpperCase()) : "My App";
}

function findPreset(prompt) {
  const p = ` ${String(prompt || "").toLowerCase()} `;
  let best = null;
  let bestScore = 0;
  for (const preset of PRESETS) {
    const score = preset.keywords.reduce((s, k) => (p.includes(k) ? s + k.length : s), 0);
    if (score > bestScore) {
      best = preset;
      bestScore = score;
    }
  }
  if (best) return best;

  const title = titleFromPrompt(prompt);
  return {
    title: "Generic",
    generic: true,
    blueprint: {
      name: title,
      tagline: `Welcome to ${title}`,
      hero: { title, subtitle: String(prompt || "").slice(0, 160), cta: "Get started" },
      features: [
        { icon: "⚡", title: "Fast", text: "Quick and easy to use." },
        { icon: "📱", title: "Works everywhere", text: "On phones, tablets and computers." },
        { icon: "🔒", title: "Secure", text: "Your data is safe with us." },
      ],
      auth: true,
      models: [
        { name: "Item", label: "Items", icon: "📄", public: { list: true, create: false }, fields: [f("name", "text", req), f("category", "text"), f("description", "textarea"), f("image", "image")] },
        { name: "Message", label: "Contact", singular: "Message", icon: "✉️", public: { list: false, create: true }, fields: [f("name", "text", req), f("email", "email", req), f("message", "textarea", req)] },
      ],
    },
  };
}

module.exports = { findPreset, PRESETS };
