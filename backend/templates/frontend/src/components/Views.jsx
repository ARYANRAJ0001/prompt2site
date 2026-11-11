import { useMemo, useState } from "react";
import ItemCard from "./ItemCard.jsx";
import { formatValue } from "../format.js";
import { useLinkTitles } from "../lookup.js";
import { STATUS } from "../payment.js";
import Icon from "./Icon.jsx";

/** Which layouts make sense for a model (based on its fields). */
export function availableLayouts(model) {
  const list = [["cards", "Cards", "LayoutGrid"], ["table", "Table", "Table2"]];
  if (model.fields.some((f) => f.type === "image")) list.push(["gallery", "Gallery", "GalleryHorizontal"]);
  if (model.fields.some((f) => f.type === "date")) list.push(["calendar", "Calendar", "CalendarDays"]);
  if (model.fields.some((f) => f.type === "select")) list.push(["board", "Board", "Columns3"]);
  return list;
}

function useDisplay(model) {
  const linkTitle = useLinkTitles(model);
  return (field, item) => {
    const v = item[field.name];
    if (v === undefined || v === null || v === "") return "";
    if (field.type === "relation") return linkTitle[field.name](v);
    if (field.type === "boolean") return v ? "✓" : "";
    return formatValue(field, v);
  };
}

function Actions({ item, onEdit, onDelete }) {
  if (!onEdit && !onDelete) return null;
  return (
    <div className="actions small">
      {onEdit && <button className="btn ghost" onClick={() => onEdit(item)}>Edit</button>}
      {onDelete && <button className="btn danger" onClick={() => onDelete(item)}>Delete</button>}
    </div>
  );
}

// ------------------------------------------------------------------ cards

export function CardsView({ model, items, onEdit, onDelete }) {
  return (
    <div className="grid">
      {items.map((item) => (
        <ItemCard key={item._id} model={model} item={item} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ table

function PaymentCell({ item, onPayment }) {
  if (!(item.amount > 0)) return <span className="muted">—</span>;
  const st = STATUS[item.paymentStatus] || STATUS.unpaid;
  return (
    <div className="pay-cell">
      <b>{formatValue({ type: "price" }, item.amount)}</b> <span className={st.className}>{st.label}</span>
      {item.paymentRef && <div className="muted small">UTR {item.paymentRef}</div>}
      {onPayment && item.paymentStatus !== "paid" && (
        <button className="btn small-btn primary" onClick={() => onPayment(item, "paid")}>Mark paid</button>
      )}
      {onPayment && item.paymentStatus === "verifying" && (
        <button className="btn small-btn ghost" onClick={() => onPayment(item, "unpaid")}>Not received yet</button>
      )}
      {onPayment && item.paymentStatus === "paid" && (
        <button className="btn small-btn ghost" onClick={() => onPayment(item, "unpaid")}>Mark unpaid</button>
      )}
    </div>
  );
}

export function TableView({ model, items, onEdit, onDelete, onPayment }) {
  const show = useDisplay(model);
  const columns = model.fields.filter((f) => !["textarea", "image"].includes(f.type)).slice(0, model.submission ? 5 : 7);
  const hasPay = model.submission && items.some((i) => i.amount > 0);
  const hasCustomer = model.submission && items.some((i) => i.customerId || i.customerEmail);
  return (
    <div className="table-wrap card">
      <table className="data-table">
        <thead>
          <tr>
            {model.submission && <th>Ref</th>}
            {columns.map((f) => <th key={f.name}>{f.label}</th>)}
            {hasCustomer && <th>Customer</th>}
            {hasPay && <th>Payment</th>}
            <th>Added</th>
            {(onEdit || onDelete) && <th />}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item._id}>
              {model.submission && <td data-label="Ref" className="ref">{item.reference} <a href={`#/receipt/${model.key}/${item._id}`} title="Receipt" className="icon-link" aria-label={`Receipt ${item.reference}`}><Icon name="Receipt" size={16} /></a></td>}
              {columns.map((f) => (
                <td key={f.name} data-label={f.label} className={f.type === "price" ? "num" : ""}>
                  {f.type === "url" && item[f.name] ? <a href={item[f.name]} target="_blank" rel="noopener noreferrer">Link</a> : show(f, item)}
                </td>
              ))}
              {hasCustomer && <td data-label="Customer" className="small">{item.customerId || "Guest"}{item.customerEmail ? <div className="muted">{item.customerEmail}</div> : null}</td>}
              {hasPay && <td data-label="Payment"><PaymentCell item={item} onPayment={onPayment} /></td>}
              <td data-label="Added" className="muted">{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}</td>
              {(onEdit || onDelete) && <td><Actions item={item} onEdit={onEdit} onDelete={onDelete} /></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------- gallery

export function GalleryView({ model, items, onEdit, onDelete }) {
  const show = useDisplay(model);
  const imageField = model.fields.find((f) => f.type === "image");
  const sub = model.fields.find((f) => f.name === (model.priceField || model.subtitleField));
  return (
    <div className="gallery">
      {items.map((item) => (
        <figure key={item._id} className="tile reveal" data-tilt="6">
          {item[imageField.name] ? (
            <img src={item[imageField.name]} alt={String(item[model.titleField] || "")} loading="lazy" />
          ) : (
            <div className="tile-placeholder" aria-hidden="true">{String(item[model.titleField] || "?").slice(0, 1)}</div>
          )}
          <figcaption>
            <strong>{String(item[model.titleField] ?? "")}</strong>
            {sub && show(sub, item) && <span>{show(sub, item)}</span>}
          </figcaption>
          <Actions item={item} onEdit={onEdit} onDelete={onDelete} />
        </figure>
      ))}
    </div>
  );
}

// --------------------------------------------------------------- calendar

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function CalendarView({ model, items, onEdit }) {
  const dateField = model.fields.find((f) => f.type === "date");
  const timeField = model.fields.find((f) => f.type === "time");
  const today = ymd(new Date());

  // Start on the month of the next upcoming item (or this month).
  const firstUpcoming = items.map((i) => i[dateField.name]).filter((d) => d && d >= today).sort()[0];
  const [month, setMonth] = useState(() => {
    const d = firstUpcoming ? new Date(`${firstUpcoming}T00:00:00`) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const byDay = useMemo(() => {
    const map = {};
    for (const item of items) {
      const d = item[dateField.name];
      if (d) (map[d] ||= []).push(item);
    }
    for (const list of Object.values(map)) list.sort((a, b) => String(a[timeField?.name] || "").localeCompare(String(b[timeField?.name] || "")));
    return map;
  }, [items, dateField, timeField]);

  const start = new Date(month);
  start.setDate(1 - ((month.getDay() + 6) % 7)); // weeks start on Monday
  const cells = [...Array(42)].map((_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const undated = items.filter((i) => !i[dateField.name]);

  return (
    <div className="calendar card">
      <div className="cal-head">
        <button className="btn ghost small-btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month">‹</button>
        <h3>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h3>
        <button className="btn ghost small-btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month">›</button>
      </div>
      <div className="cal-grid">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="cal-dow">{d}</div>)}
        {cells.map((d) => {
          const key = ymd(d);
          const list = byDay[key] || [];
          return (
            <div key={key} className={`cal-cell${d.getMonth() !== month.getMonth() ? " other" : ""}${key === today ? " today" : ""}`}>
              <span className="cal-num">{d.getDate()}</span>
              {list.slice(0, 3).map((item) => (
                <button key={item._id} className="cal-item" onClick={() => onEdit?.(item)} title={String(item[model.titleField] ?? "")} disabled={!onEdit}>
                  {timeField && item[timeField.name] ? `${item[timeField.name]} ` : ""}
                  {String(item[model.titleField] ?? "")}
                </button>
              ))}
              {list.length > 3 && <span className="muted small">+{list.length - 3} more</span>}
            </div>
          );
        })}
      </div>
      {/* On phones the grid is too small for titles, so list this month's items too. */}
      <ul className="cal-agenda">
        {cells
          .filter((d) => d.getMonth() === month.getMonth() && byDay[ymd(d)])
          .flatMap((d) =>
            byDay[ymd(d)].map((item) => (
              <li key={item._id}>
                <button className="cal-agenda-item" onClick={() => onEdit?.(item)} disabled={!onEdit}>
                  <span className="cal-agenda-date">{d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</span>
                  <span>
                    {timeField && item[timeField.name] ? `${item[timeField.name]} · ` : ""}
                    <strong>{String(item[model.titleField] ?? "")}</strong>
                  </span>
                </button>
              </li>
            ))
          )}
      </ul>
      {undated.length > 0 && <p className="muted small">{undated.length} item(s) without a date are shown in the other views.</p>}
    </div>
  );
}

// ------------------------------------------------------------------ board

export function BoardView({ model, items, onEdit, onDelete, onMove }) {
  const groupField =
    model.fields.find((f) => f.type === "select" && /status|stage|state|progress/i.test(f.name)) || model.fields.find((f) => f.type === "select");
  const columns = [...groupField.options, ...(items.some((i) => !groupField.options.includes(i[groupField.name])) ? [""] : [])];
  return (
    <div className="board">
      {columns.map((col) => {
        const list = items.filter((i) => (col ? i[groupField.name] === col : !groupField.options.includes(i[groupField.name])));
        return (
          <section key={col || "none"} className="board-col">
            <h3>{col || "No " + groupField.label.toLowerCase()} <span className="count">{list.length}</span></h3>
            {list.map((item) => (
              <div key={item._id} className="board-card">
                <ItemCard model={model} item={item} onEdit={onEdit} onDelete={onDelete} hide={[groupField.name]} />
                {onMove && (
                  <select aria-label={`Move to another ${groupField.label.toLowerCase()}`} value={item[groupField.name] || ""} onChange={(e) => onMove(item, { [groupField.name]: e.target.value })}>
                    {groupField.options.map((o) => <option key={o} value={o}>Move to {o}</option>)}
                  </select>
                )}
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}

export const VIEWS = { cards: CardsView, table: TableView, gallery: GalleryView, calendar: CalendarView, board: BoardView };
