import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SITE } from "../config.js";
import { api } from "../api.js";
import { useAuth, permissions } from "../auth.jsx";
import ItemCard from "../components/ItemCard.jsx";
import Icon from "../components/Icon.jsx";
import { prettyPhone } from "../format.js";

function Showcase({ model }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    api
      .list(model.key)
      .then((rows) => setItems(Array.isArray(rows) ? rows.slice(0, 3) : []))
      .catch(() => setItems([]));
  }, [model.key]);

  if (items && items.length === 0) return null;
  return (
    <section className="section">
      <div className="container">
        <div className="section-head reveal">
          <h2>{model.label}</h2>
          <Link to={`/${model.key}`} className="link">See all <Icon name="ArrowRight" size={16} /></Link>
        </div>
        {items === null ? (
          <p className="muted">Loading…</p>
        ) : (
          <div className="grid">
            {items.map((item) => (
              <ItemCard key={item._id} model={model} item={item} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function Home() {
  const auth = useAuth();
  const first = SITE.models.find((m) => permissions(m, auth).view || permissions(m, auth).submit) || SITE.models[0];
  const showcase = SITE.models.filter((m) => m.showOnHome && m.public.list && !m.ownedByUser);
  const forms = SITE.models.filter((m) => m.public.create && !m.public.list && !m.ownedByUser);
  const privateModels = SITE.models.filter((m) => m.ownedByUser);
  const phone = SITE.contact?.phone || SITE.owner?.phone || "";
  const place = SITE.contact?.address || "";

  return (
    <>
      <section className="hero">
        {/* floating glass panes in 3D, nudged by the pointer */}
        <div className="hero-scene" aria-hidden="true">
          <span className="pane p1" />
          <span className="pane p2" />
          <span className="pane p3" />
          <span className="orb" />
        </div>
        <div className="container hero-inner">
          <h1 className="hero-title">
            {SITE.hero.title.split(" ").map((w, i) => (
              <span key={i} className="word" style={{ "--i": i }}>{w} </span>
            ))}
          </h1>
          {SITE.hero.subtitle && <p className="lead">{SITE.hero.subtitle}</p>}
          <div className="actions">
            <Link to={`/${first.key}`} className="btn primary big">{SITE.hero.cta} <Icon name="ArrowRight" size={18} /></Link>
            {forms[0] && first.key !== forms[0].key && (
              <Link to={`/${forms[0].key}`} className="btn glass big">{forms[0].label}</Link>
            )}
          </div>
          {(phone || place) && (
            <div className="hero-contact">
              {phone && <a href={`tel:${phone.replace(/\s+/g, "")}`}><Icon name="Phone" size={16} /> {prettyPhone(phone)}</a>}
              {place && <span><Icon name="MapPin" size={16} /> {place}</span>}
            </div>
          )}
        </div>
      </section>

      {SITE.features.length > 0 && (
        <section className="section">
          <div className="container grid features">
            {SITE.features.map((f, i) => (
              <div key={i} className="card feature reveal" data-tilt="6">
                <div className="feature-icon"><Icon icon={f.icon} words={f.title} size={22} /></div>
                <h3>{f.title}</h3>
                {f.text && <p className="muted">{f.text}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {showcase.map((m) => (
        <Showcase key={m.key} model={m} />
      ))}

      {(forms.length > 0 || privateModels.length > 0) && (
        <section className="section">
          <div className="container grid">
            {[...forms, ...privateModels].map((m) => (
              <Link key={m.key} to={`/${m.key}`} className="card cta-card reveal" data-tilt="6">
                <div className="feature-icon"><Icon icon={m.icon} words={m.name} size={22} /></div>
                <h3>{m.label}</h3>
                <p className="muted">{m.description || (m.ownedByUser ? "Log in to see and manage yours." : "Takes about a minute.")}</p>
                <span className="link">Open <Icon name="ArrowRight" size={16} /></span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {SITE.about && (
        <section className="section">
          <div className="container narrow reveal">
            <h2>About us</h2>
            <p className="lead muted">{SITE.about}</p>
          </div>
        </section>
      )}
    </>
  );
}
