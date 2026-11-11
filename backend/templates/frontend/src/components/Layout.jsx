import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { SITE } from "../config.js";
import { useAuth, permissions } from "../auth.jsx";
import { DEMO } from "../api.js";
import { saved } from "../payment.js";
import { prettyPhone } from "../format.js";
import Icon from "./Icon.jsx";

export function Navbar() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // Show a page in the menu if the visitor can see or submit to it.
  const links = SITE.models.filter((m) => {
    const p = permissions(m, auth);
    return p.view || p.submit || (m.ownedByUser && !auth.user);
  });

  return (
    <header className="navbar">
      <div className="container">
      <div className="navbar-bar nav-inner">
        <Link to="/" className="brand" onClick={() => setOpen(false)}>
          {SITE.name}
        </Link>
        <button className="menu-toggle" aria-label="Menu" onClick={() => setOpen(!open)}>
          <Icon name={open ? "X" : "Menu"} size={22} />
        </button>
        <nav className={open ? "nav-links open" : "nav-links"} onClick={() => setOpen(false)}>
          <NavLink to="/" end>Home</NavLink>
          {links.map((m) => (
            <NavLink key={m.key} to={`/${m.key}`}>
              {m.label}
            </NavLink>
          ))}
          {auth.isAdmin && (SITE.auth ? auth.user : true) && <NavLink to="/dashboard">Dashboard</NavLink>}
          {SITE.auth && (auth.user || (SITE.models.some((m) => m.submission) && saved.list().length > 0)) && (
            <NavLink to="/account">My account</NavLink>
          )}
          {SITE.auth &&
            (auth.user ? (
              <button
                className="btn ghost small-btn"
                onClick={() => {
                  auth.logout();
                  navigate("/");
                }}
              >
                Log out{auth.isAdmin ? " (admin)" : ""}
              </button>
            ) : (
              <NavLink to="/login" className="btn primary small-btn">Log in</NavLink>
            ))}
        </nav>
      </div>
      </div>
      {DEMO && <div className="demo-banner">Preview: sample data, nothing is saved</div>}
    </header>
  );
}

/** Floating "chat on WhatsApp" button for customers (opens the owner's WhatsApp). */
export function WhatsAppButton() {
  const phone = String(SITE.owner?.phone || SITE.contact?.phone || "").replace(/[^\d]/g, "");
  if (phone.length < 10) return null;
  const text = encodeURIComponent(`Hi ${SITE.name}! `);
  return (
    <a className="wa-float" href={`https://wa.me/${phone}?text=${text}`} target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp">
      <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3Zm0 23.7c-2 0-4-.6-5.7-1.6l-.4-.2-3.9 1 1-3.8-.3-.4A10.7 10.7 0 1 1 16 26.7Zm5.9-8c-.3-.2-1.9-1-2.2-1-.3-.1-.5-.2-.7.2l-1 1.2c-.2.2-.4.2-.7.1a8.8 8.8 0 0 1-4.4-3.8c-.3-.6.3-.5 1-1.7.1-.2 0-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8s1.2 3.2 1.4 3.5c.2.2 2.4 3.7 5.8 5.2 2.2.9 3 .9 4.1.8.7-.1 1.9-.8 2.2-1.6.3-.8.3-1.4.2-1.6l-.6-.3Z"/></svg>
    </a>
  );
}

export function Footer() {
  const c = {
    email: SITE.contact?.email || SITE.owner?.email || "",
    phone: SITE.contact?.phone || SITE.owner?.phone || "",
    address: SITE.contact?.address || "",
  };
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div>
          <strong>{SITE.name}</strong>
          {SITE.tagline && <p>{SITE.tagline}</p>}
        </div>
        {(c.email || c.phone || c.address) && (
          <div className="contact">
            {c.address && <p><Icon name="MapPin" size={16} /> {c.address}</p>}
            {c.phone && <p><Icon name="Phone" size={16} /> <a href={`tel:${c.phone.replace(/\s+/g, "")}`}>{prettyPhone(c.phone)}</a></p>}
            {c.email && <p><Icon name="Mail" size={16} /> <a href={`mailto:${c.email}`}>{c.email}</a></p>}
          </div>
        )}
      </div>
      <p className="container copyright">© {new Date().getFullYear()} {SITE.name}</p>
    </footer>
  );
}
