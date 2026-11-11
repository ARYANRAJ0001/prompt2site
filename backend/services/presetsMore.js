/**
 * More ready-made templates, built from a few common shapes:
 *   shop      — a catalogue + an order form (pays: item price × quantity)
 *   booking   — services + a booking form (pays: service price [× people] [× days])
 *   tickets   — events + registration (pays: ticket price × tickets)
 *   enquiry   — listings + an enquiry form (no payment)
 *   donation  — causes + a donation form (pays: the amount the donor types)
 *   tracker   — private records each user manages for themselves
 */
const f = (name, type = "text", extra = {}) => ({ name, type, ...extra });
const R = { required: true };
const lc = (s) => s[0].toLowerCase() + s.slice(1);
const contactFields = (nameField = "name") => [f(nameField, "text", R), f("phone", "phone", R), f("email", "email")];

function base(t, models, sampleData) {
  return {
    title: t.title,
    category: t.category,
    keywords: t.keywords,
    blueprint: {
      name: t.name,
      tagline: t.tagline,
      theme: t.theme,
      hero: t.hero,
      features: t.features,
      auth: true,
      acceptPayments: models.some((m) => m.payment?.enabled),
      models,
      sampleData,
      ...(t.about ? { about: t.about } : {}),
    },
  };
}

function shop(t) {
  const item = t.item;
  const order = t.order || {};
  return base(
    t,
    [
      { name: item.name, label: item.label, icon: item.icon, layout: item.layout, public: { list: true, create: false }, fields: item.fields },
      {
        name: order.name || "Order",
        label: order.label || "Order now",
        singular: "Order",
        icon: order.icon || "🛒",
        public: { list: false, create: true },
        payment: { enabled: true },
        fields: [
          ...contactFields("customerName"),
          f(lc(item.name), "relation", { model: item.name, required: true }),
          f("quantity", "number", R),
          ...(order.delivery === false ? [] : [f(order.addressLabel ? "address" : "deliveryAddress", "textarea", R)]),
          ...(order.extra || []),
          f("notes", "textarea"),
          f("status", "select", { options: order.statuses || ["New", "Confirmed", "Out for delivery", "Delivered", "Cancelled"] }),
        ],
      },
    ],
    { [item.name]: t.samples }
  );
}

function booking(t) {
  const svc = t.service;
  const b = t.booking || {};
  const dates = b.range ? [f(b.range[0], "date", R), f(b.range[1], "date", R)] : [f(b.dateName || "date", "date", R), ...(b.noTime ? [] : [f("time", "time", R)])];
  return base(
    t,
    [
      { name: svc.name, label: svc.label, icon: svc.icon, layout: svc.layout, public: { list: true, create: false }, fields: svc.fields },
      {
        name: b.name || "Booking",
        label: b.label || "Book now",
        singular: b.singular || "Booking",
        icon: b.icon || "📅",
        public: { list: false, create: true },
        payment: { enabled: b.pay !== false },
        fields: [
          ...contactFields(b.nameField || "name"),
          f(lc(svc.name), "relation", { model: svc.name, required: true }),
          ...dates,
          ...(b.people ? [f(b.people, "number", R)] : []),
          ...(b.extra || []),
          f("notes", "textarea"),
          f("status", "select", { options: b.statuses || ["New", "Confirmed", "Completed", "Cancelled"] }),
        ],
      },
    ],
    { [svc.name]: t.samples }
  );
}

function tickets(t) {
  const ev = t.event;
  return base(
    t,
    [
      { name: ev.name || "Event", label: ev.label || "Events", icon: ev.icon || "🎟️", layout: "calendar", public: { list: true, create: false }, fields: ev.fields },
      {
        name: "Registration",
        label: t.registerLabel || "Register",
        singular: "Registration",
        icon: "📝",
        public: { list: false, create: true },
        payment: { enabled: true },
        fields: [...contactFields(), f(lc(ev.name || "Event"), "relation", { model: ev.name || "Event", required: true }), f("tickets", "number", R), ...(t.extra || [])],
      },
    ],
    { [ev.name || "Event"]: t.samples }
  );
}

function enquiry(t) {
  const l = t.listing;
  const e = t.enquiry || {};
  return base(
    t,
    [
      { name: l.name, label: l.label, icon: l.icon, layout: l.layout, public: { list: true, create: false }, fields: l.fields },
      {
        name: e.name || "Enquiry",
        label: e.label || "Enquire",
        singular: e.singular || "Enquiry",
        icon: e.icon || "💬",
        public: { list: false, create: true },
        fields: [...contactFields(), ...(e.link === false ? [] : [f(lc(l.name), "relation", { model: l.name })]), ...(e.extra || []), f("message", "textarea", R)],
      },
    ],
    { [l.name]: t.samples }
  );
}

function donation(t) {
  return base(
    t,
    [
      { name: "Cause", label: t.causesLabel || "Our causes", icon: "🤝", public: { list: true, create: false }, fields: [f("title", "text", R), f("goal", "price"), f("category", "select", { options: t.categories }), f("description", "textarea"), f("image", "image")] },
      {
        name: "Donation",
        label: t.donateLabel || "Donate",
        singular: "Donation",
        icon: "💝",
        public: { list: false, create: true },
        payment: { enabled: true, from: "field" },
        fields: [...contactFields(), f("cause", "relation", { model: "Cause" }), f("amount", "price", R), f("panNumber", "text", { label: "PAN (for 80G receipt)" }), f("message", "textarea")],
      },
    ],
    { Cause: t.samples }
  );
}

function tracker(t) {
  return base(t, t.models.map((m) => ({ ...m, ownedByUser: true })), {});
}

const T = {
  food: "Food & drink",
  shop: "Shops",
  health: "Health & beauty",
  edu: "Education",
  home: "Home & local services",
  travel: "Travel & stay",
  events: "Events & community",
  pro: "Professional services",
  personal: "Personal tools",
  biz: "Business tools",
};

const MORE = [
  // ---------------------------------------------------------- food & drink
  shop({
    title: "Café & coffee", category: T.food, keywords: ["cafe", "coffee", "tea house", "chai", "espresso", "barista"],
    name: "Brew & Bloom", tagline: "Fresh coffee, cosy corners", theme: { primary: "#6f4e37", accent: "#e9b872", font: "serif" },
    hero: { title: "Your daily cup, done right", subtitle: "Single-origin coffee, fresh bakes and a quiet place to work. Order ahead and skip the queue.", cta: "See the menu" },
    features: [{ icon: "☕", title: "Freshly roasted", text: "Beans roasted every week." }, { icon: "🥐", title: "Baked in-house", text: "Croissants and cakes every morning." }, { icon: "📶", title: "Work-friendly", text: "Fast Wi-Fi and plenty of plugs." }],
    item: { name: "MenuItem", label: "Menu", icon: "☕", fields: [f("name", "text", R), f("price", "price", R), f("category", "select", { options: ["Hot coffee", "Cold coffee", "Tea", "Bakes", "Snacks"] }), f("vegetarian", "boolean"), f("description", "textarea"), f("image", "image")] },
    order: { label: "Order ahead", delivery: false, extra: [f("pickupTime", "time", R)], statuses: ["New", "Preparing", "Ready for pickup", "Collected", "Cancelled"] },
    samples: [
      { name: "Cappuccino", price: 180, category: "Hot coffee", vegetarian: true, description: "Double shot with silky milk foam." },
      { name: "Cold Brew", price: 220, category: "Cold coffee", vegetarian: true, description: "Steeped for 16 hours, smooth and strong." },
      { name: "Masala Chai", price: 90, category: "Tea", vegetarian: true, description: "Spiced tea brewed with milk." },
      { name: "Butter Croissant", price: 140, category: "Bakes", vegetarian: true, description: "Flaky, baked this morning." },
    ],
  }),
  shop({
    title: "Bakery & cakes", category: T.food, keywords: ["bakery", "cake", "cakes", "pastry", "patisserie", "cupcake", "birthday cake"],
    name: "Sugar & Crumb", tagline: "Cakes baked with love", theme: { primary: "#be185d", accent: "#fbcfe8", font: "rounded" },
    hero: { title: "Cakes for every celebration", subtitle: "Custom birthday cakes, cupcakes and fresh bread. Order online, collect or get it delivered.", cta: "Browse cakes" },
    features: [{ icon: "🎂", title: "Custom cakes", text: "Any flavour, any message." }, { icon: "🥚", title: "Eggless options", text: "Most cakes available eggless." }, { icon: "🚚", title: "Same-day delivery", text: "Order before 2 PM." }],
    item: { name: "Cake", label: "Cakes & bakes", icon: "🎂", layout: "gallery", fields: [f("name", "text", R), f("price", "price", R), f("category", "select", { options: ["Birthday cakes", "Cupcakes", "Pastries", "Breads", "Cookies"] }), f("eggless", "boolean"), f("weightKg", "number", { label: "Weight (kg)" }), f("description", "textarea"), f("image", "image")] },
    order: { extra: [f("deliveryDate", "date", R), f("messageOnCake", "text")] },
    samples: [
      { name: "Chocolate Truffle Cake", price: 650, category: "Birthday cakes", eggless: true, weightKg: 1, description: "Rich dark chocolate layers with ganache." },
      { name: "Red Velvet Cupcakes (6)", price: 360, category: "Cupcakes", eggless: false, description: "With cream cheese frosting." },
      { name: "Black Forest Pastry", price: 90, category: "Pastries", eggless: true, description: "Cherries, cream and chocolate." },
      { name: "Whole Wheat Bread", price: 70, category: "Breads", eggless: true, description: "Soft, baked fresh every morning." },
    ],
  }),
  shop({
    title: "Cloud kitchen / food delivery", category: T.food, keywords: ["cloud kitchen", "food delivery", "home food", "biryani", "takeaway", "home chef"],
    name: "Biryani Box", tagline: "Hot biryani, delivered", theme: { primary: "#c2410c", accent: "#fde047" },
    hero: { title: "Dum biryani at your door", subtitle: "Slow-cooked biryanis and kebabs, packed hot and delivered in 40 minutes.", cta: "Order now" },
    features: [{ icon: "🔥", title: "Slow-cooked", text: "Sealed dum, the traditional way." }, { icon: "🛵", title: "40-minute delivery", text: "Within 5 km of our kitchen." }, { icon: "📦", title: "Spill-proof packs", text: "Arrives hot and tidy." }],
    item: { name: "Dish", label: "Menu", icon: "🍛", fields: [f("name", "text", R), f("price", "price", R), f("category", "select", { options: ["Biryani", "Kebabs", "Curries", "Sides", "Desserts"] }), f("vegetarian", "boolean"), f("serves", "number"), f("description", "textarea"), f("image", "image")] },
    samples: [
      { name: "Chicken Dum Biryani", price: 299, category: "Biryani", vegetarian: false, serves: 1, description: "Hyderabadi style with raita and salan." },
      { name: "Paneer Biryani", price: 259, category: "Biryani", vegetarian: true, serves: 1, description: "Fragrant rice with spiced paneer." },
      { name: "Chicken Seekh Kebab", price: 229, category: "Kebabs", vegetarian: false, serves: 2, description: "Six pieces, char-grilled." },
      { name: "Double Ka Meetha", price: 99, category: "Desserts", vegetarian: true, serves: 1, description: "Bread pudding with saffron." },
    ],
  }),
  booking({
    title: "Tiffin / meal subscription", category: T.food, keywords: ["tiffin", "dabba", "meal plan", "meal subscription", "home cooked", "lunch box", "mess"],
    name: "Ghar Ka Khana", tagline: "Home-cooked meals, every day", theme: { primary: "#15803d", accent: "#facc15", font: "rounded" },
    hero: { title: "Healthy home food, delivered daily", subtitle: "Fresh veg and non-veg tiffins for students and office-goers. Monthly plans, no contracts.", cta: "See plans" },
    features: [{ icon: "🍱", title: "Fresh daily", text: "Cooked every morning, never frozen." }, { icon: "🥗", title: "Balanced meals", text: "Dal, sabzi, roti, rice and salad." }, { icon: "⏸️", title: "Pause anytime", text: "Going home? Pause your plan." }],
    service: { name: "MealPlan", label: "Meal plans", icon: "🍱", fields: [f("name", "text", R), f("price", "price", R), f("type", "select", { options: ["Veg", "Non-veg", "Jain"] }), f("mealsPerDay", "number"), f("durationDays", "number"), f("description", "textarea")] },
    booking: { name: "Subscription", label: "Subscribe", singular: "Subscription", dateName: "startDate", noTime: true, extra: [f("deliveryAddress", "textarea", R), f("mealTime", "select", { options: ["Lunch", "Dinner", "Lunch + dinner"] })], statuses: ["New", "Active", "Paused", "Ended"] },
    samples: [
      { name: "Veg Monthly (Lunch)", price: 2800, type: "Veg", mealsPerDay: 1, durationDays: 30, description: "4 rotis, rice, dal, sabzi and salad." },
      { name: "Non-veg Monthly (Lunch)", price: 3600, type: "Non-veg", mealsPerDay: 1, durationDays: 30, description: "Chicken or egg curry 4 days a week." },
      { name: "Veg Weekly Trial", price: 750, type: "Veg", mealsPerDay: 1, durationDays: 7, description: "Try us for a week." },
    ],
  }),
  enquiry({
    title: "Catering service", category: T.food, keywords: ["catering", "caterer", "party food", "wedding food", "buffet", "event food"],
    name: "Royal Feast Caterers", tagline: "Food that makes the party", theme: { primary: "#9a3412", accent: "#fbbf24", font: "serif" },
    hero: { title: "Catering for every occasion", subtitle: "Weddings, birthdays and office parties — from 50 to 2,000 guests.", cta: "See packages" },
    features: [{ icon: "🍽️", title: "Custom menus", text: "North Indian, South Indian, Chinese and more." }, { icon: "👨‍🍳", title: "Live counters", text: "Dosa, chaat and pasta stations." }, { icon: "🧾", title: "Clear pricing", text: "Per-plate prices, no surprises." }],
    listing: { name: "Package", label: "Packages", icon: "🍽️", fields: [f("name", "text", R), f("pricePerPlate", "price", R), f("type", "select", { options: ["Veg", "Non-veg", "Mixed"] }), f("minimumGuests", "number"), f("includes", "textarea")] },
    enquiry: { label: "Get a quote", extra: [f("eventDate", "date", R), f("guests", "number", R), f("venue", "text")] },
    samples: [
      { name: "Classic Veg", pricePerPlate: 450, type: "Veg", minimumGuests: 100, includes: "2 starters, 4 mains, rice, breads, 2 desserts" },
      { name: "Grand Non-veg", pricePerPlate: 750, type: "Non-veg", minimumGuests: 100, includes: "4 starters, 6 mains, biryani, live counter, 3 desserts" },
      { name: "Office Lunch Box", pricePerPlate: 220, type: "Mixed", minimumGuests: 30, includes: "Packed meal with dessert" },
    ],
  }),
  shop({
    title: "Sweet shop", category: T.food, keywords: ["sweets", "mithai", "sweet shop", "namkeen", "halwai", "laddoo"],
    name: "Mithas Sweets", tagline: "Pure ghee sweets since 1985", theme: { primary: "#b45309", accent: "#f59e0b", font: "serif" },
    hero: { title: "Celebrate with Mithas", subtitle: "Fresh mithai, dry-fruit boxes and namkeen. Festive gift boxes delivered across the city.", cta: "Shop sweets" },
    features: [{ icon: "🧈", title: "Pure desi ghee", text: "No vanaspati, ever." }, { icon: "🎁", title: "Gift boxes", text: "Custom boxes for festivals and weddings." }, { icon: "🚚", title: "City-wide delivery", text: "Free above ₹999." }],
    item: { name: "Sweet", label: "Sweets", icon: "🍬", fields: [f("name", "text", R), f("price", "price", R), f("unit", "select", { options: ["500 g", "1 kg", "Box of 12", "Box of 24"] }), f("category", "select", { options: ["Milk sweets", "Dry fruit", "Bengali", "Namkeen", "Gift boxes"] }), f("description", "textarea"), f("image", "image")] },
    samples: [
      { name: "Kaju Katli", price: 550, unit: "500 g", category: "Dry fruit", description: "Silver-leaf cashew fudge." },
      { name: "Rasgulla", price: 280, unit: "1 kg", category: "Bengali", description: "Soft and spongy, in light syrup." },
      { name: "Motichoor Laddoo", price: 320, unit: "500 g", category: "Milk sweets", description: "Made with pure ghee." },
      { name: "Diwali Gift Box", price: 999, unit: "Box of 24", category: "Gift boxes", description: "Assorted sweets in a festive box." },
    ],
  }),

  // ---------------------------------------------------------------- shops
  shop({
    title: "Grocery store", category: T.shop, keywords: ["grocery", "kirana", "supermarket", "vegetables", "fruits", "provision store", "daily needs"],
    name: "FreshCart Groceries", tagline: "Daily needs, delivered", theme: { primary: "#16a34a", accent: "#facc15" },
    hero: { title: "Groceries at your door in 30 minutes", subtitle: "Fresh vegetables, fruits, staples and household items from your neighbourhood store.", cta: "Start shopping" },
    features: [{ icon: "🥬", title: "Farm fresh", text: "Vegetables delivered every morning." }, { icon: "💸", title: "Fair prices", text: "Same as in the store." }, { icon: "🛵", title: "Fast delivery", text: "Within 3 km in 30 minutes." }],
    item: { name: "Product", label: "Products", icon: "🛒", fields: [f("name", "text", R), f("price", "price", R), f("unit", "text"), f("category", "select", { options: ["Vegetables", "Fruits", "Staples", "Dairy", "Snacks", "Household"] }), f("inStock", "boolean"), f("image", "image")] },
    samples: [
      { name: "Tomatoes", price: 40, unit: "1 kg", category: "Vegetables", inStock: true },
      { name: "Bananas", price: 60, unit: "1 dozen", category: "Fruits", inStock: true },
      { name: "Basmati Rice", price: 180, unit: "1 kg", category: "Staples", inStock: true },
      { name: "Toned Milk", price: 54, unit: "1 litre", category: "Dairy", inStock: true },
      { name: "Dishwash Liquid", price: 99, unit: "500 ml", category: "Household", inStock: false },
    ],
  }),
  shop({
    title: "Pharmacy / medical store", category: T.shop, keywords: ["pharmacy", "medical store", "chemist", "medicines", "drug store", "medicine delivery"],
    name: "CarePlus Pharmacy", tagline: "Genuine medicines, delivered", theme: { primary: "#0891b2", accent: "#22c55e" },
    hero: { title: "Medicines delivered to your home", subtitle: "Genuine medicines and health products. Upload your prescription when you order.", cta: "Browse products" },
    features: [{ icon: "✅", title: "100% genuine", text: "Sourced from licensed distributors." }, { icon: "📄", title: "Prescription upload", text: "Add a photo of your prescription." }, { icon: "🚚", title: "Same-day delivery", text: "Order before 6 PM." }],
    item: { name: "Product", label: "Products", icon: "💊", fields: [f("name", "text", R), f("price", "price", R), f("category", "select", { options: ["Medicines", "Wellness", "Baby care", "Personal care", "Devices"] }), f("prescriptionNeeded", "boolean"), f("description", "textarea"), f("image", "image")] },
    order: { extra: [f("prescriptionPhoto", "image")] },
    samples: [
      { name: "Paracetamol 650 mg (15 tablets)", price: 32, category: "Medicines", prescriptionNeeded: false, description: "For fever and mild pain." },
      { name: "Vitamin D3 60K (4 capsules)", price: 120, category: "Wellness", prescriptionNeeded: true, description: "Weekly supplement." },
      { name: "Digital Thermometer", price: 249, category: "Devices", prescriptionNeeded: false, description: "Reads in 10 seconds." },
      { name: "Baby Diapers (M, 40)", price: 699, category: "Baby care", prescriptionNeeded: false, description: "Soft and leak-proof." },
    ],
  }),
  shop({
    title: "Electronics store", category: T.shop, keywords: ["electronics", "mobile shop", "gadgets", "laptop", "headphones", "computer store"],
    name: "VoltHub Electronics", tagline: "Gadgets at honest prices", theme: { primary: "#1d4ed8", accent: "#06b6d4", mode: "crystal" },
    hero: { title: "The latest gadgets, the best prices", subtitle: "Phones, laptops, audio and accessories with official warranty.", cta: "Shop now" },
    features: [{ icon: "🛡️", title: "Official warranty", text: "Every product is brand-new and sealed." }, { icon: "🔁", title: "7-day replacement", text: "If anything is wrong." }, { icon: "💳", title: "Pay by UPI", text: "Quick and secure." }],
    item: { name: "Product", label: "Products", icon: "📱", fields: [f("name", "text", R), f("price", "price", R), f("brand", "text"), f("category", "select", { options: ["Phones", "Laptops", "Audio", "Accessories", "Smart home"] }), f("inStock", "boolean"), f("warrantyMonths", "number"), f("description", "textarea"), f("image", "image")] },
    samples: [
      { name: "Wireless Earbuds Pro", price: 2999, brand: "Sonix", category: "Audio", inStock: true, warrantyMonths: 12, description: "ANC, 30-hour battery." },
      { name: "65W Fast Charger", price: 1299, brand: "Volt", category: "Accessories", inStock: true, warrantyMonths: 6, description: "USB-C, charges laptops too." },
      { name: "Smart Plug", price: 899, brand: "HomeIQ", category: "Smart home", inStock: true, warrantyMonths: 12, description: "Works with Alexa and Google." },
    ],
  }),
  shop({
    title: "Furniture store", category: T.shop, keywords: ["furniture", "sofa", "bed", "wardrobe", "home decor", "interiors shop"],
    name: "Teak & Tone", tagline: "Furniture made to last", theme: { primary: "#78350f", accent: "#a3e635", font: "serif" },
    hero: { title: "Solid wood furniture for every room", subtitle: "Sofas, beds, dining sets and storage — handcrafted and delivered with free assembly.", cta: "Browse furniture" },
    features: [{ icon: "🪵", title: "Solid wood", text: "Sheesham and teak, no particle board." }, { icon: "🔧", title: "Free assembly", text: "Our team sets it up at home." }, { icon: "🛡️", title: "5-year warranty", text: "On frames and joints." }],
    item: { name: "Product", label: "Furniture", icon: "🛋️", layout: "gallery", fields: [f("name", "text", R), f("price", "price", R), f("room", "select", { options: ["Living room", "Bedroom", "Dining", "Study", "Outdoor"] }), f("material", "text"), f("dimensions", "text"), f("description", "textarea"), f("image", "image")] },
    samples: [
      { name: "3-Seater Sofa", price: 32999, room: "Living room", material: "Sheesham + fabric", dimensions: "210 × 85 × 80 cm", description: "Deep seats, removable covers." },
      { name: "Queen Bed with Storage", price: 27999, room: "Bedroom", material: "Teak", dimensions: "160 × 200 cm", description: "Hydraulic storage underneath." },
      { name: "4-Seater Dining Set", price: 21999, room: "Dining", material: "Sheesham", dimensions: "120 × 75 cm table", description: "Table with four cushioned chairs." },
    ],
  }),
  shop({
    title: "Jewellery store", category: T.shop, keywords: ["jewellery", "jewelry", "gold", "silver", "jeweller", "earrings", "necklace"],
    name: "Swarna Jewels", tagline: "Hallmarked, handcrafted", theme: { primary: "#a16207", accent: "#fde68a", font: "serif", mode: "crystal" },
    hero: { title: "Jewellery for every moment", subtitle: "BIS-hallmarked gold and silver jewellery, made by master craftsmen.", cta: "View collection" },
    features: [{ icon: "🏅", title: "BIS hallmarked", text: "Certified purity on every piece." }, { icon: "💎", title: "Handcrafted", text: "Traditional and modern designs." }, { icon: "🔄", title: "Lifetime exchange", text: "At current gold rates." }],
    item: { name: "Piece", label: "Collection", icon: "💍", layout: "gallery", fields: [f("name", "text", R), f("price", "price", R), f("metal", "select", { options: ["Gold 22K", "Gold 18K", "Silver", "Diamond"] }), f("category", "select", { options: ["Rings", "Earrings", "Necklaces", "Bangles", "Pendants"] }), f("weightGrams", "number"), f("description", "textarea"), f("image", "image")] },
    samples: [
      { name: "Floral Gold Earrings", price: 24500, metal: "Gold 22K", category: "Earrings", weightGrams: 3.5, description: "Lightweight daily wear." },
      { name: "Silver Anklets (pair)", price: 3200, metal: "Silver", category: "Bangles", weightGrams: 40, description: "Traditional ghungroo design." },
      { name: "Solitaire Ring", price: 68000, metal: "Diamond", category: "Rings", weightGrams: 2.8, description: "0.3 ct, 18K gold band." },
    ],
  }),
  shop({
    title: "Florist", category: T.shop, keywords: ["florist", "flowers", "bouquet", "flower shop", "roses"],
    name: "Petal Post", tagline: "Fresh flowers, delivered today", theme: { primary: "#db2777", accent: "#86efac", font: "rounded" },
    hero: { title: "Say it with flowers", subtitle: "Hand-tied bouquets for birthdays, anniversaries and just because. Same-day delivery.", cta: "Shop bouquets" },
    features: [{ icon: "🌹", title: "Fresh every morning", text: "Straight from the flower market." }, { icon: "💌", title: "Free message card", text: "Write a note with every order." }, { icon: "⏰", title: "Same-day delivery", text: "Order before 4 PM." }],
    item: { name: "Bouquet", label: "Bouquets", icon: "💐", layout: "gallery", fields: [f("name", "text", R), f("price", "price", R), f("occasion", "select", { options: ["Birthday", "Anniversary", "Love", "Sympathy", "Congratulations"] }), f("stems", "number"), f("description", "textarea"), f("image", "image")] },
    order: { extra: [f("deliveryDate", "date", R), f("cardMessage", "text")] },
    samples: [
      { name: "12 Red Roses", price: 799, occasion: "Love", stems: 12, description: "Classic red roses, hand-tied." },
      { name: "Sunshine Mix", price: 999, occasion: "Birthday", stems: 15, description: "Sunflowers, gerberas and daisies." },
      { name: "White Lily Bouquet", price: 1199, occasion: "Sympathy", stems: 8, description: "Elegant white lilies." },
    ],
  }),
  shop({
    title: "Bookstore", category: T.shop, keywords: ["bookstore", "book shop", "buy books", "novels", "second hand books"],
    name: "Chapter One Books", tagline: "Stories for every reader", theme: { primary: "#1e3a8a", accent: "#f59e0b", font: "serif" },
    hero: { title: "Find your next favourite book", subtitle: "New releases, classics and children's books — delivered across India.", cta: "Browse books" },
    features: [{ icon: "📚", title: "Huge selection", text: "Fiction, non-fiction, exam prep." }, { icon: "🏷️", title: "Fair prices", text: "Up to 30% off MRP." }, { icon: "📦", title: "Safe packing", text: "Books arrive in perfect condition." }],
    item: { name: "Book", label: "Books", icon: "📖", fields: [f("title", "text", R), f("price", "price", R), f("author", "text", R), f("genre", "select", { options: ["Fiction", "Non-fiction", "Children", "Exam prep", "Comics"] }), f("language", "select", { options: ["English", "Hindi", "Tamil", "Bengali", "Marathi"] }), f("inStock", "boolean"), f("image", "image")] },
    samples: [
      { title: "The God of Small Things", price: 399, author: "Arundhati Roy", genre: "Fiction", language: "English", inStock: true },
      { title: "Wings of Fire", price: 299, author: "A. P. J. Abdul Kalam", genre: "Non-fiction", language: "English", inStock: true },
      { title: "Panchatantra Stories", price: 199, author: "Vishnu Sharma", genre: "Children", language: "Hindi", inStock: true },
    ],
  }),
  shop({
    title: "Gift shop", category: T.shop, keywords: ["gift shop", "gifts", "personalised gifts", "hampers", "return gifts"],
    name: "WrapJoy Gifts", tagline: "Gifts that make them smile", theme: { primary: "#7c3aed", accent: "#f472b6", font: "rounded" },
    hero: { title: "Thoughtful gifts, beautifully wrapped", subtitle: "Personalised mugs, hampers and return gifts for every occasion.", cta: "Shop gifts" },
    features: [{ icon: "🎁", title: "Free gift wrap", text: "On every order." }, { icon: "✍️", title: "Personalised", text: "Names, photos and messages." }, { icon: "🚚", title: "Pan-India delivery", text: "In 3–5 days." }],
    item: { name: "Gift", label: "Gifts", icon: "🎁", layout: "gallery", fields: [f("name", "text", R), f("price", "price", R), f("occasion", "select", { options: ["Birthday", "Anniversary", "Wedding", "Corporate", "Festive"] }), f("personalised", "boolean"), f("description", "textarea"), f("image", "image")] },
    order: { extra: [f("personalisationText", "text")] },
    samples: [
      { name: "Photo Mug", price: 349, occasion: "Birthday", personalised: true, description: "Your photo on a ceramic mug." },
      { name: "Chocolate Hamper", price: 1499, occasion: "Festive", personalised: false, description: "Assorted chocolates in a wicker basket." },
      { name: "Engraved Pen Set", price: 899, occasion: "Corporate", personalised: true, description: "Metal pen with name engraving." },
    ],
  }),
  shop({
    title: "Organic farm produce", category: T.shop, keywords: ["organic", "farm", "farmer", "milk delivery", "dairy farm", "natural", "honey"],
    name: "Green Acres Farm", tagline: "From our farm to your table", theme: { primary: "#3f6212", accent: "#fbbf24" },
    hero: { title: "Organic food, straight from the farm", subtitle: "Chemical-free vegetables, A2 milk, honey and cold-pressed oils.", cta: "Shop produce" },
    features: [{ icon: "🌱", title: "Certified organic", text: "No pesticides, no shortcuts." }, { icon: "🐄", title: "A2 desi milk", text: "From our own Gir cows." }, { icon: "🧺", title: "Weekly baskets", text: "Seasonal produce every week." }],
    item: { name: "Product", label: "Produce", icon: "🥕", fields: [f("name", "text", R), f("price", "price", R), f("unit", "text"), f("category", "select", { options: ["Vegetables", "Fruits", "Dairy", "Grains", "Oils & honey"] }), f("inStock", "boolean"), f("description", "textarea"), f("image", "image")] },
    samples: [
      { name: "A2 Cow Milk", price: 90, unit: "1 litre", category: "Dairy", inStock: true, description: "Delivered fresh every morning." },
      { name: "Seasonal Veg Basket", price: 499, unit: "5 kg", category: "Vegetables", inStock: true, description: "8–10 seasonal vegetables." },
      { name: "Raw Forest Honey", price: 450, unit: "500 g", category: "Oils & honey", inStock: true, description: "Unprocessed and unheated." },
    ],
  }),
  shop({
    title: "Plant nursery", category: T.shop, keywords: ["plants", "nursery", "garden", "indoor plants", "succulents", "gardening"],
    name: "Leafy Corner", tagline: "Plants that make home happier", theme: { primary: "#15803d", accent: "#a3e635", font: "rounded" },
    hero: { title: "Bring nature home", subtitle: "Indoor plants, planters and gardening supplies, delivered with care tips.", cta: "Shop plants" },
    features: [{ icon: "🪴", title: "Healthy plants", text: "Grown in our own nursery." }, { icon: "📦", title: "Safe delivery", text: "Packed so nothing breaks." }, { icon: "💬", title: "Plant help", text: "Ask us anything on WhatsApp." }],
    item: { name: "Plant", label: "Plants", icon: "🪴", layout: "gallery", fields: [f("name", "text", R), f("price", "price", R), f("category", "select", { options: ["Indoor", "Outdoor", "Succulents", "Flowering", "Planters"] }), f("light", "select", { options: ["Low light", "Bright indirect", "Full sun"] }), f("petFriendly", "boolean"), f("description", "textarea"), f("image", "image")] },
    samples: [
      { name: "Money Plant", price: 249, category: "Indoor", light: "Low light", petFriendly: false, description: "Easy to grow, perfect for beginners." },
      { name: "Snake Plant", price: 399, category: "Indoor", light: "Low light", petFriendly: false, description: "Purifies air, needs little water." },
      { name: "Succulent Trio", price: 499, category: "Succulents", light: "Bright indirect", petFriendly: true, description: "Three succulents in ceramic pots." },
    ],
  }),
  shop({
    title: "Pet shop", category: T.shop, keywords: ["pet shop", "pet food", "dog food", "cat", "pets", "pet supplies"],
    name: "Paws & Whiskers", tagline: "Everything your pet needs", theme: { primary: "#ea580c", accent: "#0ea5e9", font: "rounded" },
    hero: { title: "Happy pets, happy homes", subtitle: "Food, toys, beds and grooming supplies for dogs and cats.", cta: "Shop now" },
    features: [{ icon: "🐶", title: "Top brands", text: "Royal Canin, Pedigree, Whiskas and more." }, { icon: "🧸", title: "Toys & beds", text: "Comfy beds and durable toys." }, { icon: "🚚", title: "Free delivery", text: "On orders above ₹999." }],
    item: { name: "Product", label: "Products", icon: "🐾", fields: [f("name", "text", R), f("price", "price", R), f("pet", "select", { options: ["Dog", "Cat", "Bird", "Fish", "All pets"] }), f("category", "select", { options: ["Food", "Toys", "Beds", "Grooming", "Health"] }), f("inStock", "boolean"), f("image", "image")] },
    samples: [
      { name: "Adult Dog Food 3 kg", price: 1299, pet: "Dog", category: "Food", inStock: true },
      { name: "Cat Scratching Post", price: 899, pet: "Cat", category: "Toys", inStock: true },
      { name: "Soft Pet Bed (M)", price: 1499, pet: "All pets", category: "Beds", inStock: true },
    ],
  }),

  // ------------------------------------------------------ health & beauty
  booking({
    title: "Salon & spa", category: T.health, keywords: ["salon", "spa", "beauty parlour", "parlor", "haircut", "barber", "facial", "massage", "nails"],
    name: "Glow Studio", tagline: "Look good, feel great", theme: { primary: "#be185d", accent: "#f9a8d4", font: "serif" },
    hero: { title: "Your time to shine", subtitle: "Haircuts, colour, facials and spa treatments by trained experts. Book online in a minute.", cta: "See services" },
    features: [{ icon: "💇", title: "Expert stylists", text: "Trained in the latest trends." }, { icon: "🧴", title: "Premium products", text: "L'Oréal, O3+ and more." }, { icon: "🧼", title: "Hygienic", text: "Sanitised tools for every client." }],
    service: { name: "Service", label: "Services", icon: "💇", fields: [f("name", "text", R), f("price", "price", R), f("category", "select", { options: ["Hair", "Skin", "Nails", "Spa", "Bridal"] }), f("durationMinutes", "number"), f("description", "textarea")] },
    booking: { name: "Appointment", label: "Book an appointment", singular: "Appointment" },
    samples: [
      { name: "Haircut & Styling", price: 499, category: "Hair", durationMinutes: 45, description: "Wash, cut and blow-dry." },
      { name: "Gold Facial", price: 1499, category: "Skin", durationMinutes: 60, description: "Brightening facial with massage." },
      { name: "Gel Manicure", price: 799, category: "Nails", durationMinutes: 45, description: "Long-lasting gel polish." },
      { name: "Full Body Massage", price: 2199, category: "Spa", durationMinutes: 75, description: "Relaxing aromatherapy massage." },
    ],
  }),
  booking({
    title: "Dentist", category: T.health, keywords: ["dentist", "dental", "teeth", "orthodontist", "dental clinic", "braces"],
    name: "SmileCare Dental", tagline: "Gentle care for healthy smiles", theme: { primary: "#0284c7", accent: "#5eead4", font: "rounded" },
    hero: { title: "Healthy teeth, confident smile", subtitle: "Check-ups, cleaning, fillings, braces and implants — pain-free and affordable.", cta: "See treatments" },
    features: [{ icon: "🦷", title: "Pain-free", text: "Modern, gentle techniques." }, { icon: "🧪", title: "Sterilised", text: "Hospital-grade sterilisation." }, { icon: "📅", title: "Evening slots", text: "Open till 9 PM." }],
    service: { name: "Treatment", label: "Treatments", icon: "🦷", fields: [f("name", "text", R), f("price", "price", R), f("durationMinutes", "number"), f("description", "textarea")] },
    booking: { name: "Appointment", label: "Book an appointment", singular: "Appointment", nameField: "patientName", extra: [f("age", "number")] },
    samples: [
      { name: "Consultation & Check-up", price: 300, durationMinutes: 20, description: "Full examination with advice." },
      { name: "Teeth Cleaning", price: 1200, durationMinutes: 40, description: "Scaling and polishing." },
      { name: "Tooth Filling", price: 1500, durationMinutes: 45, description: "Tooth-coloured composite filling." },
    ],
  }),
  booking({
    title: "Diagnostic lab", category: T.health, keywords: ["diagnostic", "lab test", "pathology", "blood test", "health checkup", "laboratory"],
    name: "TrueTest Diagnostics", tagline: "Accurate reports, fast", theme: { primary: "#dc2626", accent: "#0ea5e9" },
    hero: { title: "Lab tests with free home collection", subtitle: "NABL-accredited lab. Book a test and our technician will collect the sample at home.", cta: "Book a test" },
    features: [{ icon: "🏠", title: "Home collection", text: "Free above ₹500." }, { icon: "⏱️", title: "Reports in 24 hours", text: "On email and WhatsApp." }, { icon: "🏅", title: "NABL accredited", text: "Accurate, reliable results." }],
    service: { name: "LabTest", label: "Tests & packages", icon: "🧪", fields: [f("name", "text", R), f("price", "price", R), f("category", "select", { options: ["Blood tests", "Health packages", "Diabetes", "Thyroid", "Vitamins"] }), f("fastingRequired", "boolean"), f("reportHours", "number"), f("includes", "textarea")] },
    booking: { name: "TestBooking", label: "Book a test", singular: "Test booking", nameField: "patientName", extra: [f("age", "number", R), f("collectionAddress", "textarea", R)] },
    samples: [
      { name: "Complete Blood Count", price: 299, category: "Blood tests", fastingRequired: false, reportHours: 12, includes: "Haemoglobin, WBC, platelets and more" },
      { name: "Full Body Check-up", price: 1999, category: "Health packages", fastingRequired: true, reportHours: 24, includes: "80 tests: liver, kidney, lipid, thyroid, sugar" },
      { name: "HbA1c", price: 450, category: "Diabetes", fastingRequired: false, reportHours: 12, includes: "3-month average blood sugar" },
    ],
  }),
  booking({
    title: "Physiotherapy", category: T.health, keywords: ["physiotherapy", "physio", "back pain", "rehab", "sports injury", "chiropractor"],
    name: "MoveWell Physio", tagline: "Move without pain", theme: { primary: "#0d9488", accent: "#fbbf24" },
    hero: { title: "Expert physiotherapy at clinic or home", subtitle: "Back pain, knee pain, sports injuries and post-surgery rehab.", cta: "See sessions" },
    features: [{ icon: "🦵", title: "Personal plans", text: "Exercises made for you." }, { icon: "🏠", title: "Home visits", text: "For those who can't travel." }, { icon: "📈", title: "Track progress", text: "Measurable improvement every week." }],
    service: { name: "TherapySession", label: "Sessions", icon: "🦵", fields: [f("name", "text", R), f("price", "price", R), f("location", "select", { options: ["At clinic", "Home visit", "Online"] }), f("durationMinutes", "number"), f("description", "textarea")] },
    booking: { name: "Appointment", label: "Book a session", singular: "Appointment", nameField: "patientName", extra: [f("problem", "text", R)] },
    samples: [
      { name: "First Assessment", price: 600, location: "At clinic", durationMinutes: 45, description: "Detailed check and treatment plan." },
      { name: "Therapy Session", price: 800, location: "At clinic", durationMinutes: 45, description: "Manual therapy and exercises." },
      { name: "Home Visit Session", price: 1200, location: "Home visit", durationMinutes: 45, description: "Treatment at your home." },
    ],
  }),
  booking({
    title: "Yoga studio", category: T.health, keywords: ["yoga", "meditation", "pilates", "yoga classes", "wellness studio"],
    name: "Prana Yoga", tagline: "Breathe. Stretch. Grow.", theme: { primary: "#7c3aed", accent: "#fcd34d", font: "serif" },
    hero: { title: "Find your balance", subtitle: "Small-group yoga, meditation and pranayama classes for all levels.", cta: "See classes" },
    features: [{ icon: "🧘", title: "Certified teachers", text: "RYT-500 trained instructors." }, { icon: "👥", title: "Small batches", text: "Maximum 12 students." }, { icon: "💻", title: "Online too", text: "Join live from home." }],
    service: { name: "YogaClass", label: "Classes", icon: "🧘", fields: [f("name", "text", R), f("price", "price", R), f("level", "select", { options: ["Beginner", "Intermediate", "Advanced", "All levels"] }), f("schedule", "text"), f("mode", "select", { options: ["Studio", "Online"] }), f("description", "textarea")] },
    booking: { name: "Booking", label: "Join a class", dateName: "startDate", noTime: true, people: "members" },
    samples: [
      { name: "Morning Hatha (monthly)", price: 2500, level: "All levels", schedule: "Mon–Fri, 6:30 AM", mode: "Studio", description: "Gentle start to your day." },
      { name: "Power Vinyasa (monthly)", price: 3000, level: "Intermediate", schedule: "Tue, Thu, Sat, 7 PM", mode: "Studio", description: "Dynamic flow for strength." },
      { name: "Online Meditation (monthly)", price: 1200, level: "Beginner", schedule: "Daily, 9 PM", mode: "Online", description: "20 minutes of guided calm." },
    ],
  }),
  booking({
    title: "Makeup artist", category: T.health, keywords: ["makeup artist", "bridal makeup", "mua", "mehendi", "henna", "hair and makeup"],
    name: "Glam by Riya", tagline: "Bridal & party makeup", theme: { primary: "#9d174d", accent: "#fbcfe8", font: "serif" },
    hero: { title: "Look your best on your big day", subtitle: "HD and airbrush bridal makeup, party looks and mehendi. I travel to your venue.", cta: "See packages" },
    features: [{ icon: "💄", title: "Premium products", text: "MAC, Huda Beauty, Bobbi Brown." }, { icon: "📸", title: "Camera-ready", text: "HD and airbrush finishes." }, { icon: "🚗", title: "At your venue", text: "Across the city." }],
    service: { name: "MakeupPackage", label: "Packages", icon: "💄", layout: "gallery", fields: [f("name", "text", R), f("price", "price", R), f("type", "select", { options: ["Bridal", "Engagement", "Party", "Mehendi"] }), f("includes", "textarea"), f("image", "image")] },
    booking: { label: "Book a date", extra: [f("venue", "text", R)] },
    samples: [
      { name: "HD Bridal Makeup", price: 18000, type: "Bridal", includes: "Makeup, hairstyle, draping, lashes" },
      { name: "Party Makeup", price: 3500, type: "Party", includes: "Makeup and simple hairstyle" },
      { name: "Bridal Mehendi", price: 6000, type: "Mehendi", includes: "Full hands and feet, organic henna" },
    ],
  }),
  booking({
    title: "Veterinary clinic", category: T.health, keywords: ["vet", "veterinary", "pet clinic", "animal hospital", "pet doctor", "pet grooming"],
    name: "Happy Tails Vet Clinic", tagline: "Caring for your best friend", theme: { primary: "#0f766e", accent: "#fb923c", font: "rounded" },
    hero: { title: "Expert care for your pets", subtitle: "Check-ups, vaccinations, grooming and surgery for dogs and cats.", cta: "See services" },
    features: [{ icon: "🩺", title: "Experienced vets", text: "15+ years caring for pets." }, { icon: "💉", title: "Vaccinations", text: "Full schedules for puppies and kittens." }, { icon: "🛁", title: "Grooming", text: "Bath, trim and nail clipping." }],
    service: { name: "Service", label: "Services", icon: "🐾", fields: [f("name", "text", R), f("price", "price", R), f("category", "select", { options: ["Consultation", "Vaccination", "Grooming", "Surgery", "Dental"] }), f("description", "textarea")] },
    booking: { name: "Appointment", label: "Book a visit", singular: "Appointment", nameField: "ownerName", extra: [f("petName", "text", R), f("petType", "select", { options: ["Dog", "Cat", "Bird", "Other"] })] },
    samples: [
      { name: "General Check-up", price: 500, category: "Consultation", description: "Full health check for your pet." },
      { name: "Rabies Vaccination", price: 450, category: "Vaccination", description: "Includes certificate." },
      { name: "Full Grooming", price: 1200, category: "Grooming", description: "Bath, haircut, nails and ears." },
    ],
  }),

  // ------------------------------------------------------------ education
  booking({
    title: "Tuition / coaching centre", category: T.edu, keywords: ["tuition", "coaching", "classes", "jee", "neet", "board exam", "tutor", "tutoring"],
    name: "Bright Minds Coaching", tagline: "Results that speak", theme: { primary: "#1d4ed8", accent: "#f59e0b" },
    hero: { title: "Score higher with expert teachers", subtitle: "Small batches for classes 6–12, JEE and NEET. Weekly tests and doubt sessions.", cta: "See batches" },
    features: [{ icon: "👩‍🏫", title: "Expert faculty", text: "10+ years of teaching experience." }, { icon: "📝", title: "Weekly tests", text: "Track progress every week." }, { icon: "📱", title: "Parent updates", text: "Reports on WhatsApp." }],
    service: { name: "Batch", label: "Batches", icon: "📚", fields: [f("name", "text", R), f("price", "price", R, { label: "Fee" }), f("grade", "select", { options: ["Class 6–8", "Class 9–10", "Class 11–12", "JEE", "NEET"] }), f("subject", "text"), f("timing", "text"), f("seatsLeft", "number"), f("description", "textarea")] },
    booking: { name: "Admission", label: "Enroll", singular: "Admission", nameField: "studentName", dateName: "startDate", noTime: true, extra: [f("parentPhone", "phone"), f("school", "text")] },
    samples: [
      { name: "Class 10 Maths & Science", price: 3000, grade: "Class 9–10", subject: "Maths, Science", timing: "Mon–Fri, 5–7 PM", seatsLeft: 8, description: "Monthly fee, CBSE and ICSE." },
      { name: "JEE Foundation", price: 6000, grade: "JEE", subject: "PCM", timing: "Mon–Sat, 4–7 PM", seatsLeft: 5, description: "Monthly fee, 2-year programme." },
      { name: "NEET Biology Crash Course", price: 9000, grade: "NEET", subject: "Biology", timing: "Daily, 8–11 AM", seatsLeft: 12, description: "6-week intensive course." },
    ],
  }),
  booking({
    title: "Music classes", category: T.edu, keywords: ["music classes", "guitar", "piano", "singing", "keyboard", "tabla", "music school"],
    name: "Sargam Music Academy", tagline: "Learn to play, love to play", theme: { primary: "#6d28d9", accent: "#f43f5e", mode: "dark" },
    hero: { title: "Music lessons for all ages", subtitle: "Guitar, keyboard, vocals and tabla — studio or online, beginners welcome.", cta: "See courses" },
    features: [{ icon: "🎸", title: "Many instruments", text: "Guitar, keys, drums, vocals, tabla." }, { icon: "🏆", title: "Trinity exams", text: "Graded exam preparation." }, { icon: "🎤", title: "Yearly concert", text: "Perform on a real stage." }],
    service: { name: "MusicCourse", label: "Courses", icon: "🎵", fields: [f("name", "text", R), f("price", "price", R, { label: "Monthly fee" }), f("instrument", "select", { options: ["Guitar", "Keyboard", "Vocals", "Drums", "Tabla"] }), f("level", "select", { options: ["Beginner", "Intermediate", "Advanced"] }), f("classesPerWeek", "number"), f("description", "textarea")] },
    booking: { name: "Enrollment", label: "Book a class", singular: "Enrollment", nameField: "studentName", dateName: "startDate", noTime: true, extra: [f("age", "number")] },
    samples: [
      { name: "Guitar for Beginners", price: 2500, instrument: "Guitar", level: "Beginner", classesPerWeek: 2, description: "Chords, strumming and your first songs." },
      { name: "Hindustani Vocals", price: 3000, instrument: "Vocals", level: "Beginner", classesPerWeek: 2, description: "Swar, raag and bhajans." },
      { name: "Keyboard Grade 1–3", price: 2800, instrument: "Keyboard", level: "Intermediate", classesPerWeek: 2, description: "Trinity exam preparation." },
    ],
  }),
  booking({
    title: "Dance academy", category: T.edu, keywords: ["dance", "dance classes", "bharatanatyam", "kathak", "hip hop", "zumba", "salsa"],
    name: "Rhythm Dance Studio", tagline: "Dance like no one's watching", theme: { primary: "#e11d48", accent: "#facc15" },
    hero: { title: "Dance classes for every style", subtitle: "Bollywood, hip-hop, Kathak, Bharatanatyam and Zumba for kids and adults.", cta: "See classes" },
    features: [{ icon: "💃", title: "Many styles", text: "Classical to contemporary." }, { icon: "👶", title: "Kids' batches", text: "From age 5." }, { icon: "🎭", title: "Stage shows", text: "Perform twice a year." }],
    service: { name: "DanceClass", label: "Classes", icon: "💃", fields: [f("name", "text", R), f("price", "price", R, { label: "Monthly fee" }), f("style", "select", { options: ["Bollywood", "Hip-hop", "Kathak", "Bharatanatyam", "Zumba"] }), f("ageGroup", "select", { options: ["Kids", "Teens", "Adults"] }), f("timing", "text")] },
    booking: { name: "Enrollment", label: "Join a class", singular: "Enrollment", nameField: "studentName", dateName: "startDate", noTime: true, extra: [f("age", "number")] },
    samples: [
      { name: "Bollywood for Kids", price: 1800, style: "Bollywood", ageGroup: "Kids", timing: "Sat & Sun, 10 AM" },
      { name: "Hip-hop Crew", price: 2200, style: "Hip-hop", ageGroup: "Teens", timing: "Tue & Thu, 6 PM" },
      { name: "Morning Zumba", price: 1500, style: "Zumba", ageGroup: "Adults", timing: "Mon–Fri, 7 AM" },
    ],
  }),
  booking({
    title: "Driving school", category: T.edu, keywords: ["driving school", "driving lessons", "learn driving", "car driving", "licence"],
    name: "SafeWheels Driving School", tagline: "Drive with confidence", theme: { primary: "#ca8a04", accent: "#1f2937" },
    hero: { title: "Learn to drive, safely", subtitle: "Certified instructors, dual-control cars and help with your driving licence.", cta: "See courses" },
    features: [{ icon: "🚗", title: "Dual-control cars", text: "Safe for beginners." }, { icon: "📋", title: "Licence help", text: "We guide you through the RTO test." }, { icon: "🏠", title: "Home pickup", text: "We pick you up for every lesson." }],
    service: { name: "DrivingCourse", label: "Courses", icon: "🚗", fields: [f("name", "text", R), f("price", "price", R), f("vehicle", "select", { options: ["Car (manual)", "Car (automatic)", "Two-wheeler"] }), f("sessions", "number"), f("description", "textarea")] },
    booking: { name: "Enrollment", label: "Book lessons", singular: "Enrollment", nameField: "studentName", dateName: "startDate", extra: [f("pickupAddress", "textarea")] },
    samples: [
      { name: "Beginner Car Course", price: 5500, vehicle: "Car (manual)", sessions: 15, description: "15 one-hour lessons and test practice." },
      { name: "Automatic Car Course", price: 6500, vehicle: "Car (automatic)", sessions: 12, description: "Easy learning on an automatic car." },
      { name: "Scooter Course", price: 2500, vehicle: "Two-wheeler", sessions: 8, description: "Balance, traffic rules and practice." },
    ],
  }),
  tickets({
    title: "Workshops & webinars", category: T.edu, keywords: ["workshop", "webinar", "masterclass", "bootcamp", "seminar", "training"],
    name: "SkillSprint Workshops", tagline: "Learn something new this weekend", theme: { primary: "#4f46e5", accent: "#22d3ee" },
    hero: { title: "Hands-on workshops by experts", subtitle: "Weekend workshops on design, coding, photography and more. Online and in person.", cta: "See workshops" },
    features: [{ icon: "🧑‍🏫", title: "Industry experts", text: "Learn from people who do it." }, { icon: "🛠️", title: "Hands-on", text: "Build something in every session." }, { icon: "📜", title: "Certificate", text: "For every participant." }],
    event: { name: "Workshop", label: "Workshops", icon: "🛠️", fields: [f("title", "text", R), f("date", "date", R), f("time", "time"), f("price", "price", R, { label: "Ticket price" }), f("mode", "select", { options: ["Online", "In person"] }), f("seats", "number"), f("description", "textarea")] },
    registerLabel: "Book a seat",
    samples: [
      { title: "Figma for Beginners", date: "2026-11-22", time: "10:00", price: 999, mode: "Online", seats: 50, description: "Design your first app screen in 3 hours." },
      { title: "Street Photography Walk", date: "2026-11-29", time: "07:00", price: 1499, mode: "In person", seats: 15, description: "Old city photo walk with a pro." },
      { title: "Python in a Day", date: "2026-12-06", time: "10:00", price: 1999, mode: "Online", seats: 40, description: "From zero to your first script." },
    ],
  }),
  booking({
    title: "Kids' summer camp", category: T.edu, keywords: ["summer camp", "kids camp", "holiday camp", "activity centre", "daycare", "play school", "preschool"],
    name: "Little Explorers Camp", tagline: "Fun, friends and discovery", theme: { primary: "#f97316", accent: "#22c55e", font: "rounded" },
    hero: { title: "The best summer your kids will have", subtitle: "Art, science, sports and theatre for ages 4–12. Safe, supervised and full of fun.", cta: "See programmes" },
    features: [{ icon: "🎨", title: "Creative activities", text: "Art, craft and theatre." }, { icon: "🔬", title: "Science fun", text: "Experiments kids love." }, { icon: "🛡️", title: "Safe & supervised", text: "Trained staff, CCTV, first aid." }],
    service: { name: "Programme", label: "Programmes", icon: "🎒", fields: [f("name", "text", R), f("price", "price", R), f("ageGroup", "select", { options: ["4–6 years", "7–9 years", "10–12 years"] }), f("weeks", "number"), f("timing", "text"), f("description", "textarea")] },
    booking: { name: "Registration", label: "Register your child", singular: "Registration", nameField: "parentName", dateName: "startDate", noTime: true, extra: [f("childName", "text", R), f("childAge", "number", R), f("allergies", "text")] },
    samples: [
      { name: "Mini Makers", price: 4500, ageGroup: "4–6 years", weeks: 2, timing: "9 AM – 1 PM", description: "Art, music and storytelling." },
      { name: "Young Scientists", price: 6000, ageGroup: "7–9 years", weeks: 3, timing: "9 AM – 2 PM", description: "Experiments, robotics and nature walks." },
      { name: "Sports Stars", price: 5500, ageGroup: "10–12 years", weeks: 3, timing: "7 – 11 AM", description: "Football, swimming and athletics." },
    ],
  }),

  // ------------------------------------------------ home & local services
  booking({
    title: "Home services (plumber, electrician)", category: T.home, keywords: ["plumber", "electrician", "carpenter", "handyman", "home repair", "home services", "ac repair", "appliance repair"],
    name: "FixIt Home Services", tagline: "Repairs done right, on time", theme: { primary: "#2563eb", accent: "#f59e0b" },
    hero: { title: "Trusted experts at your door", subtitle: "Plumbing, electrical, carpentry and AC repair. Verified technicians, fixed prices.", cta: "See services" },
    features: [{ icon: "🔧", title: "Verified pros", text: "Background-checked technicians." }, { icon: "💰", title: "Fixed prices", text: "Know the price before we start." }, { icon: "🛡️", title: "30-day warranty", text: "On all repairs." }],
    service: { name: "Service", label: "Services", icon: "🔧", fields: [f("name", "text", R), f("price", "price", R, { label: "Visit charge" }), f("category", "select", { options: ["Plumbing", "Electrical", "Carpentry", "AC & appliances", "Painting"] }), f("description", "textarea")] },
    booking: { label: "Book a technician", extra: [f("address", "textarea", R), f("problem", "text", R)] },
    samples: [
      { name: "Tap / Leak Repair", price: 249, category: "Plumbing", description: "Fix dripping taps and small leaks." },
      { name: "Fan / Switch Repair", price: 199, category: "Electrical", description: "Fans, switches, sockets and wiring." },
      { name: "AC Service", price: 599, category: "AC & appliances", description: "Deep cleaning and gas check." },
      { name: "Door / Furniture Repair", price: 299, category: "Carpentry", description: "Hinges, locks, drawers." },
    ],
  }),
  booking({
    title: "Cleaning service", category: T.home, keywords: ["cleaning", "house cleaning", "deep cleaning", "maid", "housekeeping", "sofa cleaning"],
    name: "Sparkle Clean", tagline: "A spotless home, every time", theme: { primary: "#0891b2", accent: "#a3e635", font: "rounded" },
    hero: { title: "Professional home cleaning", subtitle: "Deep cleaning, kitchen and bathroom cleaning, sofa and carpet shampooing.", cta: "See packages" },
    features: [{ icon: "🧽", title: "Trained staff", text: "Uniformed and verified." }, { icon: "🧴", title: "Safe products", text: "Child- and pet-safe chemicals." }, { icon: "⏱️", title: "On time", text: "Or your next clean is free." }],
    service: { name: "CleaningPackage", label: "Packages", icon: "🧽", fields: [f("name", "text", R), f("price", "price", R), f("homeSize", "select", { options: ["1 BHK", "2 BHK", "3 BHK", "Villa", "Any"] }), f("hours", "number"), f("description", "textarea")] },
    booking: { label: "Book a cleaning", extra: [f("address", "textarea", R)] },
    samples: [
      { name: "2 BHK Deep Cleaning", price: 3999, homeSize: "2 BHK", hours: 6, description: "Every room, kitchen and bathrooms." },
      { name: "Bathroom Cleaning (2)", price: 899, homeSize: "Any", hours: 2, description: "Tiles, fittings and descaling." },
      { name: "Sofa Shampoo (5 seats)", price: 1299, homeSize: "Any", hours: 2, description: "Deep foam cleaning and drying." },
    ],
  }),
  shop({
    title: "Laundry & dry cleaning", category: T.home, keywords: ["laundry", "dry cleaning", "ironing", "wash and fold", "dhobi"],
    name: "FreshFold Laundry", tagline: "Clean clothes, zero effort", theme: { primary: "#2563eb", accent: "#38bdf8" },
    hero: { title: "Laundry picked up and delivered", subtitle: "Wash & fold, dry cleaning and steam ironing. Free pickup, 48-hour delivery.", cta: "See prices" },
    features: [{ icon: "🚚", title: "Free pickup", text: "From your doorstep." }, { icon: "🧺", title: "Gentle care", text: "Sorted by colour and fabric." }, { icon: "⏰", title: "48-hour delivery", text: "Express in 24 hours." }],
    item: { name: "LaundryService", label: "Services & prices", icon: "🧺", fields: [f("name", "text", R), f("price", "price", R), f("unit", "select", { options: ["Per kg", "Per piece", "Per pair"] }), f("category", "select", { options: ["Wash & fold", "Dry cleaning", "Ironing", "Shoes", "Curtains"] }), f("description", "textarea")] },
    order: { label: "Book a pickup", addressLabel: true, extra: [f("pickupDate", "date", R)], statuses: ["New", "Picked up", "In process", "Delivered", "Cancelled"] },
    samples: [
      { name: "Wash & Fold", price: 89, unit: "Per kg", category: "Wash & fold", description: "Everyday clothes, washed and folded." },
      { name: "Shirt Dry Clean", price: 99, unit: "Per piece", category: "Dry cleaning", description: "Pressed and on a hanger." },
      { name: "Steam Ironing", price: 15, unit: "Per piece", category: "Ironing", description: "Crisp, wrinkle-free." },
      { name: "Shoe Cleaning", price: 399, unit: "Per pair", category: "Shoes", description: "Sneakers cleaned and deodorised." },
    ],
  }),
  booking({
    title: "Car wash & detailing", category: T.home, keywords: ["car wash", "detailing", "car cleaning", "ceramic coating", "bike wash", "car spa"],
    name: "ShineOn Car Spa", tagline: "Make it shine again", theme: { primary: "#0f172a", accent: "#38bdf8", mode: "dark" },
    hero: { title: "Showroom shine for your car", subtitle: "Foam wash, interior cleaning, polishing and ceramic coating — at our studio or your doorstep.", cta: "See packages" },
    features: [{ icon: "🚿", title: "Foam wash", text: "Gentle on paint." }, { icon: "✨", title: "Ceramic coating", text: "Protection for years." }, { icon: "🏠", title: "Doorstep service", text: "We come to you." }],
    service: { name: "WashPackage", label: "Packages", icon: "🚗", fields: [f("name", "text", R), f("price", "price", R), f("vehicle", "select", { options: ["Hatchback", "Sedan", "SUV", "Bike"] }), f("durationMinutes", "number"), f("description", "textarea")] },
    booking: { extra: [f("carModel", "text", R), f("location", "select", { options: ["At studio", "At my home"] })] },
    samples: [
      { name: "Foam Wash", price: 499, vehicle: "Sedan", durationMinutes: 45, description: "Exterior foam wash and tyre shine." },
      { name: "Interior Deep Clean", price: 1499, vehicle: "SUV", durationMinutes: 120, description: "Vacuum, shampoo and dashboard care." },
      { name: "Bike Wash & Polish", price: 299, vehicle: "Bike", durationMinutes: 30, description: "Wash, polish and chain lube." },
    ],
  }),
  booking({
    title: "Mobile & laptop repair", category: T.home, keywords: ["mobile repair", "phone repair", "laptop repair", "screen replacement", "computer repair"],
    name: "QuickFix Repairs", tagline: "Fixed in hours, not days", theme: { primary: "#4f46e5", accent: "#10b981" },
    hero: { title: "Phone or laptop broken? We'll fix it", subtitle: "Screen, battery, charging port and software repairs with genuine parts and warranty.", cta: "See repairs" },
    features: [{ icon: "⚡", title: "Same-day repairs", text: "Most repairs in 2 hours." }, { icon: "🔩", title: "Genuine parts", text: "With 3-month warranty." }, { icon: "🛵", title: "Free pickup", text: "Within 5 km." }],
    service: { name: "Repair", label: "Repairs", icon: "🔧", fields: [f("name", "text", R), f("price", "price", R, { label: "Starting price" }), f("device", "select", { options: ["Phone", "Laptop", "Tablet", "Smartwatch"] }), f("hours", "number", { label: "Time (hours)" }), f("description", "textarea")] },
    booking: { name: "RepairRequest", label: "Book a repair", singular: "Repair request", extra: [f("deviceModel", "text", R), f("problem", "textarea", R)], statuses: ["New", "Received", "Repairing", "Ready", "Delivered"] },
    samples: [
      { name: "Phone Screen Replacement", price: 1999, device: "Phone", hours: 2, description: "Original-quality display." },
      { name: "Phone Battery Replacement", price: 999, device: "Phone", hours: 1, description: "New battery with warranty." },
      { name: "Laptop Keyboard Replacement", price: 2499, device: "Laptop", hours: 4, description: "Most brands and models." },
    ],
  }),
  enquiry({
    title: "Packers & movers", category: T.home, keywords: ["packers", "movers", "relocation", "shifting", "house shifting", "transport"],
    name: "SafeShift Movers", tagline: "Moving made stress-free", theme: { primary: "#b91c1c", accent: "#fbbf24" },
    hero: { title: "Shift your home without the stress", subtitle: "Packing, loading, transport and unpacking — within the city or across India.", cta: "See services" },
    features: [{ icon: "📦", title: "Careful packing", text: "Bubble wrap and sturdy boxes." }, { icon: "🚛", title: "Own trucks", text: "GPS-tracked vehicles." }, { icon: "🛡️", title: "Insured", text: "Transit insurance available." }],
    listing: { name: "MoveService", label: "Services", icon: "🚛", fields: [f("name", "text", R), f("price", "price", { label: "Starting price" }), f("type", "select", { options: ["Within city", "Intercity", "Office", "Vehicle"] }), f("description", "textarea")] },
    enquiry: { label: "Get a quote", extra: [f("movingFrom", "text", R), f("movingTo", "text", R), f("movingDate", "date", R), f("homeSize", "select", { options: ["1 RK", "1 BHK", "2 BHK", "3 BHK", "Villa"] })] },
    samples: [
      { name: "Local Home Shifting", price: 6000, type: "Within city", description: "1 BHK starting price, packing included." },
      { name: "Intercity Relocation", price: 18000, type: "Intercity", description: "Door-to-door with insurance option." },
      { name: "Car Transport", price: 9000, type: "Vehicle", description: "Closed carrier, all major cities." },
    ],
  }),
  booking({
    title: "Tailor & alterations", category: T.home, keywords: ["tailor", "stitching", "alteration", "blouse stitching", "boutique tailoring"],
    name: "Stitch Perfect", tagline: "Made to fit you", theme: { primary: "#7e22ce", accent: "#f472b6", font: "serif" },
    hero: { title: "Perfect fit, every time", subtitle: "Blouses, kurtas, suits and alterations stitched to your measurements.", cta: "See services" },
    features: [{ icon: "🧵", title: "Expert tailors", text: "20+ years of experience." }, { icon: "📏", title: "Home measurement", text: "We come to you." }, { icon: "⏱️", title: "On-time delivery", text: "Express stitching available." }],
    service: { name: "StitchingService", label: "Services", icon: "🧵", fields: [f("name", "text", R), f("price", "price", R), f("category", "select", { options: ["Women", "Men", "Kids", "Alterations"] }), f("days", "number", { label: "Ready in (days)" }), f("description", "textarea")] },
    booking: { name: "Order", label: "Book stitching", singular: "Order", dateName: "measurementDate", extra: [f("address", "textarea")], statuses: ["New", "Measured", "Stitching", "Ready", "Delivered"] },
    samples: [
      { name: "Blouse Stitching", price: 650, category: "Women", days: 5, description: "Lined blouse with your design." },
      { name: "Kurta Pyjama", price: 900, category: "Men", days: 7, description: "Cotton or silk, custom fit." },
      { name: "Trouser Alteration", price: 150, category: "Alterations", days: 2, description: "Length and waist adjustment." },
    ],
  }),

  // -------------------------------------------------------- travel & stay
  booking({
    title: "Tour packages / travel agency", category: T.travel, keywords: ["travel agency", "tour", "tours", "holiday package", "trip", "trek", "travel"],
    name: "Wanderlust Trips", tagline: "Trips you'll never forget", theme: { primary: "#0369a1", accent: "#fb923c" },
    hero: { title: "Explore India with us", subtitle: "Handpicked tours to Himachal, Kerala, Rajasthan and Goa — stays, travel and guides included.", cta: "See tours" },
    features: [{ icon: "🗺️", title: "All-inclusive", text: "Stay, meals, travel and sightseeing." }, { icon: "👨‍✈️", title: "Local guides", text: "Who know every hidden spot." }, { icon: "🧾", title: "No hidden costs", text: "One clear price." }],
    service: { name: "Tour", label: "Tours", icon: "🧳", layout: "gallery", fields: [f("name", "text", R), f("price", "price", R, { label: "Price per person" }), f("destination", "text", R), f("nights", "number"), f("category", "select", { options: ["Mountains", "Beaches", "Heritage", "Wildlife", "Pilgrimage"] }), f("includes", "textarea"), f("image", "image")] },
    booking: { dateName: "travelDate", noTime: true, people: "travellers" },
    samples: [
      { name: "Manali & Solang Valley", price: 14999, destination: "Himachal Pradesh", nights: 5, category: "Mountains", includes: "Volvo travel, hotel, breakfast & dinner, sightseeing" },
      { name: "Kerala Backwaters", price: 18999, destination: "Kerala", nights: 6, category: "Beaches", includes: "Houseboat night, Munnar, Alleppey, transfers" },
      { name: "Royal Rajasthan", price: 21999, destination: "Rajasthan", nights: 7, category: "Heritage", includes: "Jaipur, Jodhpur, Udaipur, heritage hotels" },
    ],
  }),
  booking({
    title: "Car rental", category: T.travel, keywords: ["car rental", "rent a car", "self drive", "cab", "taxi", "car hire"],
    name: "DriveEasy Rentals", tagline: "Self-drive cars by the day", theme: { primary: "#1e293b", accent: "#facc15", mode: "dark" },
    hero: { title: "Rent a car, drive anywhere", subtitle: "Clean, sanitised self-drive cars with unlimited km. Pick up from your nearest hub.", cta: "See cars" },
    features: [{ icon: "🚙", title: "Well-kept cars", text: "Serviced and sanitised." }, { icon: "♾️", title: "Unlimited km", text: "On all daily plans." }, { icon: "🛟", title: "24/7 support", text: "Roadside help anytime." }],
    service: { name: "Car", label: "Cars", icon: "🚙", layout: "gallery", fields: [f("name", "text", R), f("price", "price", R, { label: "Price per day" }), f("type", "select", { options: ["Hatchback", "Sedan", "SUV", "Luxury"] }), f("seats", "number"), f("transmission", "select", { options: ["Manual", "Automatic"] }), f("fuel", "select", { options: ["Petrol", "Diesel", "CNG", "Electric"] }), f("image", "image")] },
    booking: { range: ["pickupDate", "returnDate"], extra: [f("drivingLicenceNumber", "text", R), f("pickupLocation", "text")] },
    samples: [
      { name: "Maruti Swift", price: 1800, type: "Hatchback", seats: 5, transmission: "Manual", fuel: "Petrol" },
      { name: "Hyundai Creta", price: 3200, type: "SUV", seats: 5, transmission: "Automatic", fuel: "Diesel" },
      { name: "Toyota Innova", price: 4200, type: "SUV", seats: 7, transmission: "Manual", fuel: "Diesel" },
    ],
  }),
  booking({
    title: "Bike rental", category: T.travel, keywords: ["bike rental", "scooter rental", "rent a bike", "royal enfield rental", "two wheeler rental"],
    name: "RideOn Bike Rentals", tagline: "Explore on two wheels", theme: { primary: "#ea580c", accent: "#0f172a" },
    hero: { title: "Rent a bike for your trip", subtitle: "Scooters, Royal Enfields and adventure bikes with helmets included.", cta: "See bikes" },
    features: [{ icon: "🏍️", title: "Well-maintained", text: "Serviced after every trip." }, { icon: "⛑️", title: "Helmets included", text: "Two helmets with every bike." }, { icon: "🗺️", title: "Trip tips", text: "Best routes from locals." }],
    service: { name: "Bike", label: "Bikes", icon: "🏍️", layout: "gallery", fields: [f("name", "text", R), f("price", "price", R, { label: "Price per day" }), f("type", "select", { options: ["Scooter", "Cruiser", "Adventure", "Electric"] }), f("engineCc", "number"), f("image", "image")] },
    booking: { range: ["pickupDate", "returnDate"], extra: [f("drivingLicenceNumber", "text", R)] },
    samples: [
      { name: "Honda Activa", price: 400, type: "Scooter", engineCc: 110 },
      { name: "Royal Enfield Classic 350", price: 1100, type: "Cruiser", engineCc: 350 },
      { name: "Royal Enfield Himalayan", price: 1600, type: "Adventure", engineCc: 411 },
    ],
  }),
  enquiry({
    title: "PG / hostel", category: T.travel, keywords: ["pg", "paying guest", "hostel", "co-living", "rooms for rent", "student housing"],
    name: "NestStay PG", tagline: "A home away from home", theme: { primary: "#0d9488", accent: "#f97316", font: "rounded" },
    hero: { title: "Comfortable PG rooms with meals", subtitle: "Furnished rooms near colleges and offices — Wi-Fi, meals, laundry and security.", cta: "See rooms" },
    features: [{ icon: "🛏️", title: "Fully furnished", text: "Bed, wardrobe, desk and AC." }, { icon: "🍲", title: "3 meals a day", text: "Home-style food." }, { icon: "🔐", title: "Safe & secure", text: "CCTV and biometric entry." }],
    listing: { name: "Room", label: "Rooms", icon: "🛏️", layout: "gallery", fields: [f("name", "text", R), f("price", "price", R, { label: "Rent per month" }), f("sharing", "select", { options: ["Single", "Double sharing", "Triple sharing"] }), f("forWhom", "select", { options: ["Boys", "Girls", "Co-living"] }), f("available", "boolean"), f("amenities", "textarea"), f("image", "image")] },
    enquiry: { label: "Book a visit", extra: [f("moveInDate", "date")] },
    samples: [
      { name: "Single AC Room", price: 14000, sharing: "Single", forWhom: "Co-living", available: true, amenities: "AC, attached bath, meals, Wi-Fi" },
      { name: "Double Sharing", price: 9000, sharing: "Double sharing", forWhom: "Girls", available: true, amenities: "Meals, Wi-Fi, laundry" },
      { name: "Triple Sharing", price: 7000, sharing: "Triple sharing", forWhom: "Boys", available: false, amenities: "Meals, Wi-Fi" },
    ],
  }),
  booking({
    title: "Campsite / resort", category: T.travel, keywords: ["camping", "campsite", "glamping", "resort", "farmstay", "staycation", "villa rental"],
    name: "Riverside Camps", tagline: "Sleep under the stars", theme: { primary: "#166534", accent: "#fb923c", font: "serif" },
    hero: { title: "Camping by the river", subtitle: "Tents and cottages with bonfire, BBQ, rafting and stargazing — 3 hours from the city.", cta: "See stays" },
    features: [{ icon: "🏕️", title: "Riverside tents", text: "Comfortable beds and clean washrooms." }, { icon: "🔥", title: "Bonfire & BBQ", text: "Every evening." }, { icon: "🚣", title: "Adventure", text: "Rafting, kayaking and treks." }],
    service: { name: "Stay", label: "Stays", icon: "🏕️", layout: "gallery", fields: [f("name", "text", R), f("price", "price", R, { label: "Price per night" }), f("type", "select", { options: ["Tent", "Cottage", "Treehouse"] }), f("capacity", "number"), f("includes", "textarea"), f("image", "image")] },
    booking: { range: ["checkIn", "checkOut"], extra: [f("guests", "number", R)] },
    samples: [
      { name: "Swiss Tent (2 people)", price: 3500, type: "Tent", capacity: 2, includes: "Dinner, breakfast, bonfire" },
      { name: "Family Cottage", price: 7500, type: "Cottage", capacity: 4, includes: "All meals, bonfire, BBQ" },
      { name: "Treehouse", price: 6000, type: "Treehouse", capacity: 2, includes: "Breakfast, river view" },
    ],
  }),

  // ---------------------------------------------------- events & community
  enquiry({
    title: "Wedding planner", category: T.events, keywords: ["wedding planner", "wedding", "event planner", "decor", "shaadi", "event management"],
    name: "Shubh Vivah Planners", tagline: "Your dream wedding, planned", theme: { primary: "#9f1239", accent: "#fbbf24", font: "serif" },
    hero: { title: "Weddings planned with love", subtitle: "Venues, decor, catering, photography and entertainment — one team for everything.", cta: "See packages" },
    features: [{ icon: "💐", title: "Stunning decor", text: "Themes made just for you." }, { icon: "📋", title: "Stress-free", text: "We handle every vendor." }, { icon: "💸", title: "On budget", text: "Clear costs from day one." }],
    listing: { name: "WeddingPackage", label: "Packages", icon: "💒", layout: "gallery", fields: [f("name", "text", R), f("price", "price", { label: "Starting price" }), f("guests", "number"), f("includes", "textarea"), f("image", "image")] },
    enquiry: { label: "Plan my wedding", extra: [f("weddingDate", "date"), f("city", "text", R), f("budget", "select", { options: ["Under ₹5 lakh", "₹5–15 lakh", "₹15–30 lakh", "Above ₹30 lakh"] })] },
    samples: [
      { name: "Intimate Wedding", price: 350000, guests: 100, includes: "Venue, decor, catering, photography" },
      { name: "Grand Wedding", price: 1500000, guests: 500, includes: "3 functions, decor, catering, DJ, photo & video" },
      { name: "Destination Wedding", price: 2500000, guests: 150, includes: "Resort, travel, all functions, planning" },
    ],
  }),
  booking({
    title: "Banquet hall / venue", category: T.events, keywords: ["banquet", "venue", "party hall", "marriage hall", "event venue", "conference hall"],
    name: "Grand Orchid Banquets", tagline: "The perfect venue for every celebration", theme: { primary: "#7c2d12", accent: "#facc15", font: "serif" },
    hero: { title: "Celebrate in style", subtitle: "Elegant halls for weddings, receptions, birthdays and corporate events — 50 to 1,000 guests.", cta: "See halls" },
    features: [{ icon: "🏛️", title: "Beautiful halls", text: "AC halls and open lawns." }, { icon: "🍽️", title: "In-house catering", text: "Or bring your own caterer." }, { icon: "🅿️", title: "Ample parking", text: "Space for 200 cars." }],
    service: { name: "Hall", label: "Halls", icon: "🏛️", layout: "gallery", fields: [f("name", "text", R), f("price", "price", R, { label: "Booking amount per day" }), f("capacity", "number"), f("type", "select", { options: ["AC hall", "Lawn", "Rooftop", "Conference room"] }), f("description", "textarea"), f("image", "image")] },
    booking: { dateName: "eventDate", noTime: true, extra: [f("eventType", "select", { options: ["Wedding", "Reception", "Birthday", "Corporate", "Other"] }), f("guests", "number", R)] },
    samples: [
      { name: "Orchid Grand Hall", price: 150000, capacity: 800, type: "AC hall", description: "Chandeliers, stage and bridal room." },
      { name: "Garden Lawn", price: 90000, capacity: 1000, type: "Lawn", description: "Open-air lawn with fairy lights." },
      { name: "Boardroom", price: 12000, capacity: 40, type: "Conference room", description: "Projector, Wi-Fi and coffee." },
    ],
  }),
  booking({
    title: "Sports turf booking", category: T.events, keywords: ["turf", "box cricket", "football turf", "badminton court", "sports court", "court booking", "playground"],
    name: "Kickoff Arena", tagline: "Book. Play. Repeat.", theme: { primary: "#15803d", accent: "#facc15", mode: "dark" },
    hero: { title: "Book your game in seconds", subtitle: "Floodlit football and box-cricket turfs, badminton courts — open 6 AM to midnight.", cta: "See courts" },
    features: [{ icon: "⚽", title: "FIFA-grade turf", text: "Soft, safe artificial grass." }, { icon: "💡", title: "Floodlights", text: "Play late into the night." }, { icon: "🚿", title: "Changing rooms", text: "With showers." }],
    service: { name: "Court", label: "Courts", icon: "⚽", fields: [f("name", "text", R), f("price", "price", R, { label: "Price per hour" }), f("sport", "select", { options: ["Football", "Box cricket", "Badminton", "Pickleball", "Basketball"] }), f("players", "number"), f("description", "textarea")] },
    booking: { name: "Slot", label: "Book a slot", singular: "Slot booking", people: "hours", extra: [f("teamName", "text")] },
    samples: [
      { name: "5-a-side Football Turf", price: 1500, sport: "Football", players: 10, description: "Floodlit, with goal posts and bibs." },
      { name: "Box Cricket Arena", price: 1200, sport: "Box cricket", players: 16, description: "Netted, with bowling machine on request." },
      { name: "Badminton Court 1", price: 500, sport: "Badminton", players: 4, description: "Wooden floor, shuttles available." },
    ],
  }),
  donation({
    title: "NGO / charity donations", category: T.events, keywords: ["ngo", "charity", "donation", "donate", "fundraising", "nonprofit", "trust", "foundation"],
    name: "Hope Foundation", tagline: "Together we can change lives", theme: { primary: "#0f766e", accent: "#f59e0b" },
    hero: { title: "Every rupee makes a difference", subtitle: "We support children's education, healthcare and women's livelihoods in rural India.", cta: "Donate now" },
    features: [{ icon: "📚", title: "Education", text: "1,200 children in school this year." }, { icon: "🏥", title: "Healthcare", text: "Free health camps every month." }, { icon: "🧾", title: "80G tax benefit", text: "Receipts for every donation." }],
    categories: ["Education", "Health", "Women", "Environment", "Relief"],
    samples: [
      { title: "Send a Child to School", goal: 500000, category: "Education", description: "Books, uniforms and fees for a year: ₹6,000 per child." },
      { title: "Village Health Camps", goal: 300000, category: "Health", description: "Free check-ups and medicines in 20 villages." },
      { title: "Flood Relief Kits", goal: 200000, category: "Relief", description: "Food, water and hygiene kits for families." },
    ],
  }),
  donation({
    title: "Temple / religious donations", category: T.events, keywords: ["temple", "mandir", "church", "mosque", "gurudwara", "puja", "seva", "religious"],
    name: "Shri Ganesh Mandir Trust", tagline: "Serving devotees since 1952", theme: { primary: "#c2410c", accent: "#facc15", font: "serif" },
    hero: { title: "Offer your seva", subtitle: "Donate for annadanam, temple upkeep and festivals. Receive prasad and blessings.", cta: "Offer seva" },
    features: [{ icon: "🪔", title: "Daily aarti", text: "6 AM and 7 PM every day." }, { icon: "🍛", title: "Annadanam", text: "Free meals for 500 devotees daily." }, { icon: "🧾", title: "80G receipts", text: "For all donations." }],
    causesLabel: "Seva & donations", donateLabel: "Offer seva", categories: ["Annadanam", "Temple upkeep", "Festivals", "Puja", "Education"],
    samples: [
      { title: "Annadanam (feed 100 devotees)", goal: 100000, category: "Annadanam", description: "Sponsor a day's prasad meal." },
      { title: "Ganesh Chaturthi Utsav", goal: 500000, category: "Festivals", description: "Decoration, pooja and cultural programmes." },
      { title: "Abhishekam Seva", goal: 50000, category: "Puja", description: "Special abhishekam on your behalf." },
    ],
  }),
  tickets({
    title: "College fest / hackathon", category: T.events, keywords: ["college fest", "hackathon", "techfest", "cultural fest", "competition", "fest registration", "symposium"],
    name: "TechNova 2026", tagline: "Code. Create. Compete.", theme: { primary: "#7c3aed", accent: "#22d3ee", mode: "dark" },
    hero: { title: "The biggest student fest of the year", subtitle: "Hackathons, coding contests, robotics and cultural nights. ₹5 lakh in prizes.", cta: "See events" },
    features: [{ icon: "💻", title: "36-hour hackathon", text: "Build with mentors from top startups." }, { icon: "🏆", title: "₹5 lakh prizes", text: "Across 20 competitions." }, { icon: "🎶", title: "Pro-nights", text: "Live music every evening." }],
    event: { name: "Competition", label: "Events", icon: "🏆", fields: [f("title", "text", R), f("date", "date", R), f("time", "time"), f("price", "price", R, { label: "Entry fee" }), f("category", "select", { options: ["Tech", "Cultural", "Sports", "Gaming"] }), f("teamSize", "text"), f("prize", "text"), f("description", "textarea")] },
    extra: [f("college", "text", R), f("teamName", "text")],
    samples: [
      { title: "36-hour Hackathon", date: "2026-12-12", time: "09:00", price: 500, category: "Tech", teamSize: "2–4", prize: "₹1,00,000", description: "Build anything. Food and Wi-Fi on us." },
      { title: "Battle of Bands", date: "2026-12-13", time: "18:00", price: 1000, category: "Cultural", teamSize: "4–8", prize: "₹50,000", description: "20 minutes on the main stage." },
      { title: "BGMI Tournament", date: "2026-12-14", time: "11:00", price: 400, category: "Gaming", teamSize: "4", prize: "₹30,000", description: "Squad matches, finals on the big screen." },
    ],
  }),
  booking({
    title: "Photography studio", category: T.events, keywords: ["photography", "photographer", "photo studio", "pre wedding shoot", "baby photoshoot", "videography"],
    name: "Frame & Light Studio", tagline: "Moments, beautifully captured", theme: { primary: "#111827", accent: "#f59e0b", mode: "crystal" },
    hero: { title: "Photos you'll treasure forever", subtitle: "Weddings, pre-wedding, maternity, baby and product shoots by award-winning photographers.", cta: "See packages" },
    features: [{ icon: "📸", title: "Award-winning", text: "Featured in WedMeGood." }, { icon: "🎞️", title: "Fast delivery", text: "Edited photos in 7 days." }, { icon: "🖼️", title: "Albums & prints", text: "Premium photo books." }],
    service: { name: "ShootPackage", label: "Packages", icon: "📸", layout: "gallery", fields: [f("name", "text", R), f("price", "price", R), f("type", "select", { options: ["Wedding", "Pre-wedding", "Maternity & baby", "Portrait", "Product"] }), f("hours", "number"), f("includes", "textarea"), f("image", "image")] },
    booking: { name: "Booking", label: "Book a shoot", dateName: "shootDate", extra: [f("location", "text")] },
    samples: [
      { name: "Pre-wedding Shoot", price: 25000, type: "Pre-wedding", hours: 6, includes: "2 locations, 60 edited photos, 1-min reel" },
      { name: "Newborn Baby Shoot", price: 8000, type: "Maternity & baby", hours: 3, includes: "Props, 25 edited photos" },
      { name: "Product Shoot (20 items)", price: 6000, type: "Product", hours: 4, includes: "White background, 40 edited photos" },
    ],
  }),
  booking({
    title: "Club / gym membership", category: T.events, keywords: ["club", "membership", "sports club", "swimming pool", "society", "community club", "association"],
    name: "Lakeside Club", tagline: "Sports, leisure and community", theme: { primary: "#1e40af", accent: "#22c55e" },
    hero: { title: "Become a member", subtitle: "Swimming, tennis, gym, library and events for the whole family.", cta: "See memberships" },
    features: [{ icon: "🏊", title: "Olympic pool", text: "Coaching for all ages." }, { icon: "🎾", title: "Courts", text: "Tennis, squash and badminton." }, { icon: "🎉", title: "Member events", text: "Every weekend." }],
    service: { name: "Membership", label: "Memberships", icon: "🎫", fields: [f("name", "text", R), f("price", "price", R), f("duration", "select", { options: ["Monthly", "Quarterly", "Yearly", "Lifetime"] }), f("members", "number", { label: "Family members covered" }), f("benefits", "textarea")] },
    booking: { name: "Application", label: "Join the club", singular: "Membership application", dateName: "startDate", noTime: true, pay: true, extra: [f("address", "textarea")] },
    samples: [
      { name: "Individual Monthly", price: 2500, duration: "Monthly", members: 1, benefits: "Pool, gym and courts" },
      { name: "Family Yearly", price: 45000, duration: "Yearly", members: 4, benefits: "All facilities, events and guest passes" },
      { name: "Student Quarterly", price: 5000, duration: "Quarterly", members: 1, benefits: "Pool and gym (ID required)" },
    ],
  }),

  // --------------------------------------------------- professional services
  booking({
    title: "Lawyer / legal consultation", category: T.pro, keywords: ["lawyer", "advocate", "legal", "law firm", "legal advice", "notary"],
    name: "Sharma & Associates", tagline: "Clear legal advice you can trust", theme: { primary: "#1e3a8a", accent: "#b45309", font: "serif" },
    hero: { title: "Legal help, made simple", subtitle: "Property, family, consumer and business law. Book a consultation in person or on video.", cta: "Book a consultation" },
    features: [{ icon: "⚖️", title: "20+ years", text: "Experienced advocates." }, { icon: "🔒", title: "Confidential", text: "Your matter stays private." }, { icon: "💻", title: "Video calls", text: "Consult from anywhere." }],
    service: { name: "Consultation", label: "Practice areas", icon: "⚖️", fields: [f("name", "text", R), f("price", "price", R, { label: "Consultation fee" }), f("mode", "select", { options: ["In office", "Video call", "Phone"] }), f("durationMinutes", "number"), f("description", "textarea")] },
    booking: { name: "Appointment", label: "Book a consultation", singular: "Appointment", extra: [f("caseSummary", "textarea", R)] },
    samples: [
      { name: "Property & Real Estate", price: 2000, mode: "In office", durationMinutes: 45, description: "Sale deeds, disputes, RERA, rent agreements." },
      { name: "Family Law", price: 2500, mode: "Video call", durationMinutes: 45, description: "Divorce, custody, maintenance." },
      { name: "Consumer Complaints", price: 1500, mode: "Phone", durationMinutes: 30, description: "Refunds, defects, service issues." },
    ],
  }),
  booking({
    title: "CA / tax filing", category: T.pro, keywords: ["ca", "chartered accountant", "tax filing", "itr", "gst", "accounting", "bookkeeping", "tax consultant"],
    name: "TaxEase Consultants", tagline: "Taxes done right, on time", theme: { primary: "#047857", accent: "#2563eb" },
    hero: { title: "Income tax & GST, sorted", subtitle: "ITR filing, GST registration and returns, company registration and bookkeeping.", cta: "See services" },
    features: [{ icon: "🧾", title: "Expert CAs", text: "Qualified chartered accountants." }, { icon: "⏰", title: "Never miss a deadline", text: "Reminders on WhatsApp." }, { icon: "💯", title: "Maximum refund", text: "We find every deduction." }],
    service: { name: "TaxService", label: "Services", icon: "🧾", fields: [f("name", "text", R), f("price", "price", R), f("category", "select", { options: ["Income tax", "GST", "Company", "Bookkeeping", "Audit"] }), f("description", "textarea")] },
    booking: { name: "Request", label: "Get started", singular: "Service request", dateName: "preferredDate", noTime: true, extra: [f("panNumber", "text")] },
    samples: [
      { name: "ITR Filing — Salaried", price: 999, category: "Income tax", description: "Form 16, deductions and e-verification." },
      { name: "GST Registration", price: 1999, category: "GST", description: "Documents, application and certificate." },
      { name: "Monthly GST Returns", price: 1499, category: "GST", description: "GSTR-1 and GSTR-3B every month." },
    ],
  }),
  enquiry({
    title: "Interior designer", category: T.pro, keywords: ["interior design", "interior designer", "home interiors", "modular kitchen", "renovation", "architect"],
    name: "Studio Habitat Interiors", tagline: "Spaces that feel like you", theme: { primary: "#57534e", accent: "#d97706", font: "serif" },
    hero: { title: "Beautiful homes, designed for living", subtitle: "Complete home interiors, modular kitchens and renovations — with 3D designs before we build.", cta: "See our work" },
    features: [{ icon: "🖌️", title: "3D designs", text: "See it before we build it." }, { icon: "🧱", title: "End-to-end", text: "Design, materials and execution." }, { icon: "🛡️", title: "10-year warranty", text: "On modular work." }],
    listing: { name: "Project", label: "Our work", icon: "🏡", layout: "gallery", fields: [f("title", "text", R), f("type", "select", { options: ["Full home", "Kitchen", "Bedroom", "Office", "Retail"] }), f("city", "text"), f("budget", "price", { label: "Approx. budget" }), f("description", "textarea"), f("image", "image")] },
    enquiry: { label: "Get a free consultation", link: false, extra: [f("propertyType", "select", { options: ["1 BHK", "2 BHK", "3 BHK", "Villa", "Office"] }), f("city", "text", R)] },
    samples: [
      { title: "Modern 3 BHK, Whitefield", type: "Full home", city: "Bengaluru", budget: 1200000, description: "Warm wood, open kitchen, clever storage." },
      { title: "Compact Kitchen Makeover", type: "Kitchen", city: "Pune", budget: 350000, description: "L-shaped modular kitchen with tall units." },
      { title: "Startup Office", type: "Office", city: "Hyderabad", budget: 2500000, description: "40 seats, meeting pods and café." },
    ],
  }),
  enquiry({
    title: "Digital marketing agency", category: T.pro, keywords: ["agency", "digital marketing", "seo", "social media marketing", "branding", "web design agency", "advertising"],
    name: "Pixel Pulse Agency", tagline: "Grow your business online", theme: { primary: "#6d28d9", accent: "#f43f5e" },
    hero: { title: "More customers, from the internet", subtitle: "Websites, SEO, social media and Google Ads for small businesses.", cta: "See services" },
    features: [{ icon: "📈", title: "Real results", text: "We report leads, not likes." }, { icon: "🎯", title: "Local SEO", text: "Show up on Google Maps." }, { icon: "📱", title: "Social media", text: "Content that people share." }],
    listing: { name: "Service", label: "Services", icon: "📈", fields: [f("name", "text", R), f("price", "price", { label: "Starting price / month" }), f("category", "select", { options: ["Website", "SEO", "Social media", "Ads", "Branding"] }), f("description", "textarea")] },
    enquiry: { label: "Get a proposal", extra: [f("businessName", "text", R), f("website", "url"), f("monthlyBudget", "select", { options: ["Under ₹10,000", "₹10,000–30,000", "₹30,000–1 lakh", "Above ₹1 lakh"] })] },
    samples: [
      { name: "Business Website", price: 15000, category: "Website", description: "5-page responsive website with contact form." },
      { name: "Local SEO", price: 8000, category: "SEO", description: "Google Business profile and local rankings." },
      { name: "Instagram Management", price: 12000, category: "Social media", description: "12 posts and 8 reels a month." },
    ],
  }),
  booking({
    title: "Coworking space", category: T.pro, keywords: ["coworking", "co-working", "office space", "hot desk", "meeting room", "shared office"],
    name: "HiveWork Spaces", tagline: "Work better, together", theme: { primary: "#ca8a04", accent: "#1f2937" },
    hero: { title: "Your desk is ready", subtitle: "Hot desks, dedicated desks and meeting rooms with fast Wi-Fi, coffee and 24/7 access.", cta: "See plans" },
    features: [{ icon: "⚡", title: "Fast Wi-Fi", text: "300 Mbps with backup." }, { icon: "☕", title: "Unlimited coffee", text: "And tea, all day." }, { icon: "🔑", title: "24/7 access", text: "Work when you want." }],
    service: { name: "Workspace", label: "Plans", icon: "💼", fields: [f("name", "text", R), f("price", "price", R, { label: "Price per day" }), f("type", "select", { options: ["Hot desk", "Dedicated desk", "Private cabin", "Meeting room"] }), f("seats", "number"), f("description", "textarea")] },
    booking: { range: ["startDate", "endDate"], extra: [f("company", "text")] },
    samples: [
      { name: "Hot Desk Day Pass", price: 399, type: "Hot desk", seats: 1, description: "Any free desk, 9 AM – 9 PM." },
      { name: "Dedicated Desk", price: 650, type: "Dedicated desk", seats: 1, description: "Your own desk and locker." },
      { name: "4-Person Cabin", price: 2800, type: "Private cabin", seats: 4, description: "Lockable cabin with whiteboard." },
    ],
  }),
  shop({
    title: "Freelancer services", category: T.pro, keywords: ["freelancer", "freelance", "logo design", "video editing", "content writing", "gig", "services marketplace"],
    name: "Aarav Creates", tagline: "Design & video for creators and brands", theme: { primary: "#0f172a", accent: "#a855f7", mode: "crystal" },
    hero: { title: "Logos, thumbnails and videos that stand out", subtitle: "Fixed-price creative services with fast turnaround. Order a package and get started today.", cta: "See packages" },
    features: [{ icon: "🎨", title: "Original work", text: "No templates, ever." }, { icon: "⚡", title: "Fast delivery", text: "Most work in 2–4 days." }, { icon: "🔁", title: "Free revisions", text: "Until you're happy." }],
    item: { name: "Package", label: "Packages", icon: "🎨", fields: [f("name", "text", R), f("price", "price", R), f("category", "select", { options: ["Logo", "Thumbnails", "Video editing", "Social posts", "Website"] }), f("deliveryDays", "number"), f("revisions", "number"), f("description", "textarea"), f("image", "image")] },
    order: { delivery: false, extra: [f("brief", "textarea", R), f("referenceLink", "url")], statuses: ["New", "In progress", "Review", "Delivered", "Cancelled"] },
    samples: [
      { name: "Logo Design", price: 2999, category: "Logo", deliveryDays: 3, revisions: 3, description: "3 concepts, final files in all formats." },
      { name: "YouTube Thumbnails (5)", price: 1499, category: "Thumbnails", deliveryDays: 2, revisions: 2, description: "Click-worthy thumbnails for 5 videos." },
      { name: "Reel Editing (4 reels)", price: 3499, category: "Video editing", deliveryDays: 4, revisions: 2, description: "Captions, music and transitions." },
    ],
  }),

  // ---------------------------------------------------------- personal tools
  tracker({
    title: "Habit tracker", category: T.personal, keywords: ["habit", "habits", "streak", "daily routine", "self improvement"],
    name: "HabitLoop", tagline: "Small steps, every day", theme: { primary: "#16a34a", accent: "#f97316", font: "rounded" },
    hero: { title: "Build habits that stick", subtitle: "Track your daily habits and keep your streaks going.", cta: "Open my habits" },
    features: [{ icon: "✅", title: "Daily check-ins", text: "One tap to log a habit." }, { icon: "🔥", title: "Streaks", text: "Watch your progress grow." }, { icon: "🔒", title: "Private", text: "Only you can see it." }],
    models: [{ name: "HabitLog", label: "My habit log", icon: "✅", layout: "calendar", fields: [f("habit", "select", { options: ["Exercise", "Read", "Meditate", "Drink water", "Sleep by 11", "No sugar"], required: true }), f("date", "date", R), f("done", "boolean"), f("minutes", "number"), f("note", "text")] }],
  }),
  tracker({
    title: "Workout log", category: T.personal, keywords: ["workout", "fitness tracker", "exercise log", "gym log", "weight tracker", "running log"],
    name: "LiftLog", tagline: "Track every rep", theme: { primary: "#dc2626", accent: "#111827", mode: "dark" },
    hero: { title: "Log workouts, see progress", subtitle: "Record exercises, sets, weights and runs — and beat last week.", cta: "Open my log" },
    features: [{ icon: "🏋️", title: "Every set", text: "Weight, reps and notes." }, { icon: "📅", title: "Calendar view", text: "See your consistency." }, { icon: "🔒", title: "Private", text: "Only you can see it." }],
    models: [{ name: "Workout", label: "My workouts", icon: "🏋️", layout: "table", fields: [f("exercise", "text", R), f("type", "select", { options: ["Strength", "Cardio", "Yoga", "Sports"] }), f("date", "date", R), f("sets", "number"), f("reps", "number"), f("weightKg", "number"), f("durationMinutes", "number"), f("notes", "text")] }],
  }),
  tracker({
    title: "Reading list", category: T.personal, keywords: ["reading list", "books i read", "goodreads", "book tracker", "watchlist", "movie list"],
    name: "Shelfie", tagline: "Every book you love, in one place", theme: { primary: "#92400e", accent: "#0d9488", font: "serif" },
    hero: { title: "Your personal bookshelf", subtitle: "Keep track of what you're reading, what you've finished and what's next.", cta: "Open my shelf" },
    features: [{ icon: "📚", title: "Want to read", text: "Never forget a recommendation." }, { icon: "⭐", title: "Ratings & notes", text: "Remember what you thought." }, { icon: "🔒", title: "Private", text: "Only you can see it." }],
    models: [{ name: "Book", label: "My books", icon: "📚", layout: "board", fields: [f("title", "text", R), f("author", "text"), f("status", "select", { options: ["Want to read", "Reading", "Finished"] }), f("rating", "number"), f("finishedOn", "date"), f("notes", "textarea")] }],
  }),
  tracker({
    title: "Study planner", category: T.personal, keywords: ["study planner", "exam prep", "homework", "assignments", "student planner", "syllabus"],
    name: "StudyPal", tagline: "Plan smarter, score better", theme: { primary: "#4f46e5", accent: "#fbbf24", font: "rounded" },
    hero: { title: "Stay on top of your studies", subtitle: "Plan topics, track assignments and never miss an exam date.", cta: "Open my planner" },
    features: [{ icon: "🗓️", title: "Exam dates", text: "See everything on a calendar." }, { icon: "📊", title: "Track progress", text: "To do, doing, done." }, { icon: "🔒", title: "Private", text: "Only you can see it." }],
    models: [{ name: "StudyTask", label: "My study plan", icon: "📘", layout: "board", fields: [f("topic", "text", R), f("subject", "select", { options: ["Maths", "Physics", "Chemistry", "Biology", "English", "Other"] }), f("type", "select", { options: ["Revision", "Assignment", "Exam", "Practice test"] }), f("status", "select", { options: ["To do", "In progress", "Done"] }), f("dueDate", "date"), f("notes", "textarea")] }],
  }),

  // ---------------------------------------------------------- business tools
  tracker({
    title: "CRM / leads tracker", category: T.biz, keywords: ["crm", "leads", "sales pipeline", "customers list", "follow up", "prospects"],
    name: "LeadFlow CRM", tagline: "Never lose a lead again", theme: { primary: "#2563eb", accent: "#16a34a" },
    hero: { title: "Your sales pipeline, simplified", subtitle: "Track leads, follow-ups and deals from first call to closed.", cta: "Open my leads" },
    features: [{ icon: "🎯", title: "Pipeline board", text: "Drag leads through each stage." }, { icon: "⏰", title: "Follow-ups", text: "See who to call today." }, { icon: "🔒", title: "Private", text: "Only your team account sees it." }],
    models: [{ name: "Lead", label: "Leads", icon: "🎯", layout: "board", fields: [f("name", "text", R), f("company", "text"), f("phone", "phone"), f("email", "email"), f("stage", "select", { options: ["New", "Contacted", "Meeting", "Proposal", "Won", "Lost"] }), f("dealValue", "price"), f("followUpDate", "date"), f("notes", "textarea")] }],
  }),
  {
    title: "Customer support desk", category: T.biz, keywords: ["support", "helpdesk", "help desk", "ticket", "complaint", "service request", "customer service"],
    blueprint: {
      name: "HelpPoint Support", tagline: "We're here to help", theme: { primary: "#0e7490", accent: "#f59e0b" },
      hero: { title: "How can we help?", subtitle: "Browse answers to common questions or raise a support ticket — we reply within a day.", cta: "Raise a ticket" },
      features: [{ icon: "⚡", title: "Fast replies", text: "Within 24 hours." }, { icon: "🔎", title: "Track your ticket", text: "Updates by email." }, { icon: "📚", title: "Help articles", text: "Answers to common questions." }],
      auth: true,
      models: [
        { name: "Article", label: "Help articles", icon: "📚", public: { list: true, create: false }, fields: [f("title", "text", R), f("category", "select", { options: ["Orders", "Payments", "Account", "Technical", "Other"] }), f("answer", "textarea", R)] },
        { name: "Ticket", label: "Raise a ticket", singular: "Ticket", icon: "🎫", public: { list: false, create: true }, layout: "board", fields: [f("name", "text", R), f("email", "email", R), f("phone", "phone"), f("category", "select", { options: ["Orders", "Payments", "Account", "Technical", "Other"] }), f("subject", "text", R), f("description", "textarea", R), f("screenshot", "image"), f("status", "select", { options: ["Open", "In progress", "Waiting on customer", "Resolved"] }), f("priority", "select", { options: ["Low", "Normal", "High", "Urgent"] })] },
      ],
      sampleData: {
        Article: [
          { title: "How do I track my order?", category: "Orders", answer: "Open My account and click on your order to see its status." },
          { title: "My payment failed but money was deducted", category: "Payments", answer: "Failed payments are refunded by your bank in 3–5 working days." },
          { title: "How do I reset my password?", category: "Account", answer: "Click 'Forgot password' on the login page and follow the email." },
        ],
      },
    },
  },
];

module.exports = { MORE, CATEGORIES: T };
