import {
  Activity, AlarmClock, ArrowRight, ArrowUpRight, Baby, Backpack, BadgeCheck, Banknote,
  Bath, BedDouble, Bell, Bike, Book, BookOpen, Bookmark, BrickWall,
  Briefcase, Brush, Building2, Cake, CalendarDays, CalendarRange, Camera, Candy,
  Car, CarFront, Carrot, ChartColumn, Check, ChefHat, ChevronLeft, ChevronRight,
  Church, CircleCheck, CirclePause, ClipboardList, Clock, Code2, Coffee, Cog,
  Columns3, CookingPot, Copy, CreditCard, Croissant, Dog, Download, Drama,
  Droplets, Dumbbell, Egg, ExternalLink, Eye, Factory, FileText, Film,
  Filter, Flame, FlaskConical, Flower, Flower2, FolderKanban, FolderOpen, GalleryHorizontal,
  Gem, Gift, Github, Globe, Goal, GraduationCap, Guitar, Hammer,
  Handshake, HardHat, Heart, HeartHandshake, History, Hospital, Hotel, Hourglass,
  House, Image, IndianRupee, Infinity, KeyRound, Landmark, Laptop, Layers,
  LayoutGrid, LayoutTemplate, Leaf, LeafyGreen, Library, LifeBuoy, Lightbulb, Loader2,
  Lock, LockKeyhole, LogIn, LogOut, Luggage, Mail, Map, MapPin,
  Medal, Menu, MessageCircle, Mic, Microscope, Milk, Monitor, Mountain,
  Music, Newspaper, NotebookPen, Package, Paintbrush, Palette, PartyPopper, PawPrint,
  PenLine, Pencil, Phone, Pill, Pin, Plane, Plus, Presentation,
  Printer, QrCode, Receipt, Redo2, RefreshCw, Repeat, Rocket, Ruler,
  Sailboat, Salad, Save, Scale, Scissors, ScrollText, Search, Send,
  Server, Settings, ShieldCheck, Shirt, ShoppingBag, ShoppingBasket, ShoppingCart, ShowerHead,
  Smartphone, Smile, Sofa, Soup, Sparkles, SprayCan, Sprout, SquareParking,
  Star, Stethoscope, Store, Sun, Syringe, Table2, Tag, Target,
  Tent, Ticket, Timer, TrafficCone, Trash2, Trees, TrendingUp, TriangleAlert,
  Trophy, Truck, Undo2, Upload, User, UserCheck, Users, Utensils,
  UtensilsCrossed, Volleyball, Wallet, Wand2, Waves, Wifi, Wrench, X,
  Zap,
  ChevronUp,
  ChevronDown,
  Gamepad2,
  Play,
} from "lucide-react";

const L = { Gamepad2, Play, ChevronDown, ChevronUp, Activity, AlarmClock, ArrowRight, ArrowUpRight, Baby, Backpack, BadgeCheck, Banknote, Bath, BedDouble, Bell, Bike, Book, BookOpen, Bookmark, BrickWall, Briefcase, Brush, Building2, Cake, CalendarDays, CalendarRange, Camera, Candy, Car, CarFront, Carrot, ChartColumn, Check, ChefHat, ChevronLeft, ChevronRight, Church, CircleCheck, CirclePause, ClipboardList, Clock, Code2, Coffee, Cog, Columns3, CookingPot, Copy, CreditCard, Croissant, Dog, Download, Drama, Droplets, Dumbbell, Egg, ExternalLink, Eye, Factory, FileText, Film, Filter, Flame, FlaskConical, Flower, Flower2, FolderKanban, FolderOpen, GalleryHorizontal, Gem, Gift, Github, Globe, Goal, GraduationCap, Guitar, Hammer, Handshake, HardHat, Heart, HeartHandshake, History, Hospital, Hotel, Hourglass, House, Image, IndianRupee, Infinity, KeyRound, Landmark, Laptop, Layers, LayoutGrid, LayoutTemplate, Leaf, LeafyGreen, Library, LifeBuoy, Lightbulb, Loader2, Lock, LockKeyhole, LogIn, LogOut, Luggage, Mail, Map, MapPin, Medal, Menu, MessageCircle, Mic, Microscope, Milk, Monitor, Mountain, Music, Newspaper, NotebookPen, Package, Paintbrush, Palette, PartyPopper, PawPrint, PenLine, Pencil, Phone, Pill, Pin, Plane, Plus, Presentation, Printer, QrCode, Receipt, Redo2, RefreshCw, Repeat, Rocket, Ruler, Sailboat, Salad, Save, Scale, Scissors, ScrollText, Search, Send, Server, Settings, ShieldCheck, Shirt, ShoppingBag, ShoppingBasket, ShoppingCart, ShowerHead, Smartphone, Smile, Sofa, Soup, Sparkles, SprayCan, Sprout, SquareParking, Star, Stethoscope, Store, Sun, Syringe, Table2, Tag, Target, Tent, Ticket, Timer, TrafficCone, Trash2, Trees, TrendingUp, TriangleAlert, Trophy, Truck, Undo2, Upload, User, UserCheck, Users, Utensils, UtensilsCrossed, Volleyball, Wallet, Wand2, Waves, Wifi, Wrench, X, Zap };

/**
 * Line icons for the site. Plans name icons with an emoji (easy for people and
 * the AI to write); here each emoji maps to a matching outline icon, so the
 * site looks consistent on every device. Unknown emoji fall back to a guess
 * from the page's name.
 */
const EMOJI = {
  "🍽️": "UtensilsCrossed", "📅": "CalendarDays", "🍛": "Soup", "🌿": "Leaf", "🛍️": "ShoppingBag", "🧾": "Receipt",
  "🚚": "Truck", "↩️": "Undo2", "🔒": "Lock", "✅": "CircleCheck", "🚦": "TrafficCone", "📰": "Newspaper",
  "💬": "MessageCircle", "✍️": "PenLine", "🏷️": "Tag", "💸": "Banknote", "🗂️": "FolderKanban", "🏋️": "Dumbbell",
  "💳": "CreditCard", "📝": "NotebookPen", "🧑‍🏫": "Presentation", "👩‍🏫": "Presentation", "🕕": "Clock",
  "🩺": "Stethoscope", "💙": "Heart", "📚": "Library", "🎓": "GraduationCap", "🧪": "FlaskConical", "📜": "ScrollText",
  "🛏️": "BedDouble", "🏔️": "Mountain", "🍳": "ChefHat", "📶": "Wifi", "💼": "Briefcase", "✉️": "Mail", "🎨": "Palette",
  "💻": "Laptop", "🚀": "TrendingUp", "🎉": "PartyPopper", "🎟️": "Ticket", "📍": "MapPin", "🔔": "Bell", "🏠": "House",
  "📞": "Phone", "🤝": "Handshake", "📌": "Pin", "📦": "Package", "⚠️": "TriangleAlert", "🏭": "Factory",
  "📖": "BookOpen", "🔖": "Bookmark", "☕": "Coffee", "🍲": "CookingPot", "⏱️": "Timer", "🥕": "Carrot",
  "👩‍🍳": "ChefHat", "👨‍🍳": "ChefHat", "📨": "Send", "⚡": "Zap", "🌍": "Globe", "🛒": "ShoppingCart",
  "🥐": "Croissant", "🎂": "Cake", "🥚": "Egg", "🔥": "Flame", "🛵": "Bike", "🍱": "Utensils", "🥗": "Salad",
  "⏸️": "CirclePause", "🍬": "Candy", "🧈": "Milk", "🎁": "Gift", "🥬": "LeafyGreen", "💊": "Pill", "📄": "FileText",
  "📱": "Smartphone", "🛡️": "ShieldCheck", "🔁": "Repeat", "🛋️": "Sofa", "🪵": "Trees", "🔧": "Wrench", "💍": "Gem",
  "🏅": "Medal", "💎": "Gem", "🔄": "RefreshCw", "💐": "Flower2", "🌹": "Flower", "💌": "Heart", "⏰": "AlarmClock",
  "🌱": "Sprout", "🐄": "Milk", "🧺": "ShoppingBasket", "🪴": "Sprout", "🐾": "PawPrint", "🐶": "Dog", "🧸": "Smile",
  "💇": "Scissors", "🧴": "Droplets", "🧼": "Sparkles", "🦷": "Smile", "🦵": "Activity", "📈": "TrendingUp",
  "🧘": "Sun", "👥": "Users", "💄": "Paintbrush", "📸": "Camera", "🚗": "Car", "💉": "Syringe", "🛁": "Bath",
  "🎵": "Music", "🎶": "Music", "🎸": "Guitar", "🏆": "Trophy", "🎤": "Mic", "💃": "Music", "👶": "Baby", "🎭": "Drama",
  "📋": "ClipboardList", "🛠️": "Hammer", "🎒": "Backpack", "🔬": "Microscope", "💰": "Wallet", "🧽": "SprayCan",
  "🚿": "ShowerHead", "✨": "Sparkles", "🔩": "Cog", "🚛": "Truck", "🧵": "Scissors", "📏": "Ruler", "🧳": "Luggage",
  "🗺️": "Map", "👨‍✈️": "UserCheck", "🚙": "CarFront", "♾️": "Infinity", "🛟": "LifeBuoy", "🏍️": "Bike", "⛑️": "HardHat",
  "🔐": "LockKeyhole", "🏕️": "Tent", "🚣": "Sailboat", "💒": "Church", "🏛️": "Landmark", "🅿️": "SquareParking",
  "⚽": "Goal", "💡": "Lightbulb", "💝": "HeartHandshake", "🏥": "Hospital", "🪔": "Flame", "🎞️": "Film",
  "🖼️": "Image", "🎫": "Ticket", "🏊": "Waves", "🎾": "Volleyball", "⚖️": "Scale", "💯": "BadgeCheck", "🏡": "House",
  "🖌️": "Brush", "🧱": "BrickWall", "🎯": "Target", "🔑": "KeyRound", "⭐": "Star", "📘": "Book", "🗓️": "CalendarRange",
  "📊": "ChartColumn", "🔎": "Search", "🎟": "Ticket", "🏨": "Hotel", "✈️": "Plane", "👕": "Shirt", "🏢": "Building2",
};

// Guess from words when the emoji isn't known (plans written by the AI).
const WORDS = [
  [/order|cart|shop|product|store/i, "ShoppingBag"], [/book|appoint|reserv|slot|schedul/i, "CalendarDays"],
  [/menu|dish|food|meal/i, "UtensilsCrossed"], [/contact|message|enquir|inquir/i, "Mail"], [/event|ticket|regist/i, "Ticket"],
  [/room|stay|hotel/i, "BedDouble"], [/course|class|lesson|batch/i, "GraduationCap"], [/task|todo/i, "ClipboardList"],
  [/expense|payment|donat/i, "Wallet"], [/job|career/i, "Briefcase"], [/post|blog|article|news/i, "Newspaper"],
  [/photo|gallery|portfolio|project/i, "Image"], [/service/i, "Sparkles"], [/review|testimon/i, "Star"],
];

export function iconName(icon, words = "") {
  if (icon && L[icon]) return icon; // already an icon name
  if (icon && EMOJI[icon]) return EMOJI[icon];
  const stripped = icon && EMOJI[String(icon).replace(/️/g, "")];
  if (stripped) return stripped;
  const hit = WORDS.find(([re]) => re.test(words));
  return hit ? hit[1] : "LayoutGrid";
}

export default function Icon({ icon, name, words = "", size = 20, strokeWidth = 1.75, className = "" }) {
  const Comp = L[name || iconName(icon, words)] || L.LayoutGrid;
  return <Comp size={size} strokeWidth={strokeWidth} className={`icon ${className}`.trim()} aria-hidden="true" />;
}

/** Icons offered in the plan editor (stored as their emoji, which the site maps to the line icon). */
export const PICKABLE = ["🛍️", "🛒", "📦", "🧾", "📅", "🗓️", "⏰", "🍽️", "☕", "🍛", "🎂", "🥗", "🏠", "🛏️", "🧳", "🚗", "🏍️", "✈️",
  "💇", "💄", "🩺", "💊", "🦷", "🏋️", "🧘", "🎓", "📚", "🎵", "🎨", "📸", "🎟️", "🏆", "💼", "⚖️", "🔧", "🧽",
  "🐾", "🌱", "💐", "🎁", "💎", "💳", "💰", "📈", "💬", "✉️", "📞", "📍", "⭐", "✨", "🛡️", "🔒"];

export function IconPicker({ value, onChange, label = "Icon" }) {
  return (
    <details className="icon-picker">
      <summary aria-label={`${label}: change`} title={`${label}: change`}><Icon icon={value} size={20} /></summary>
      <div className="icon-grid" role="listbox" aria-label={label}>
        {PICKABLE.map((e) => (
          <button
            type="button"
            key={e}
            role="option"
            aria-selected={iconName(value) === iconName(e)}
            className={iconName(value) === iconName(e) ? "active" : ""}
            onClick={(ev) => {
              onChange(e);
              ev.currentTarget.closest("details").open = false;
            }}
          >
            <Icon icon={e} size={18} />
          </button>
        ))}
      </div>
    </details>
  );
}
