import { formatValue } from "../format.js";
import { useLinkTitles } from "../lookup.js";
import Icon from "./Icon.jsx";

export default function ItemCard({ model, item, onEdit, onDelete, hide = [] }) {
  const linkTitle = useLinkTitles(model);
  const title = item[model.titleField];
  const subtitleField = model.fields.find((f) => f.name === model.subtitleField);
  const priceField = model.fields.find((f) => f.name === model.priceField);
  const image = model.imageField && item[model.imageField];
  const flags = model.fields.filter((f) => f.type === "boolean" && item[f.name]);
  const details = model.fields.filter(
    (f) =>
      ![model.titleField, model.subtitleField, model.priceField, model.imageField, ...hide].includes(f.name) &&
      f.type !== "boolean" &&
      item[f.name] !== undefined &&
      item[f.name] !== ""
  );

  return (
    <article className="card item-card reveal" data-tilt="5">
      {image && <img className="item-image" src={image} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.display = "none")} />}
      <div className="item-body">
        <div className="item-head">
          <h3>{String(title ?? "Untitled")}</h3>
          {priceField && item[priceField.name] !== undefined && item[priceField.name] !== "" && (
            <span className="price">{formatValue(priceField, item[priceField.name])}</span>
          )}
        </div>

        {(subtitleField && item[subtitleField.name]) || flags.length ? (
          <div className="chips">
            {subtitleField && item[subtitleField.name] && <span className="chip strong">{String(item[subtitleField.name])}</span>}
            {flags.map((f) => (
              <span key={f.name} className="chip"><Icon name="Check" size={14} /> {f.label}</span>
            ))}
          </div>
        ) : null}

        {details.length > 0 && (
          <dl className="details">
            {details.map((f) =>
              f.type === "textarea" ? (
                <p key={f.name} className="long-text">{String(item[f.name])}</p>
              ) : (
                <div key={f.name}>
                  <dt>{f.label}</dt>
                  <dd>
                    {f.type === "relation" ? (
                      linkTitle[f.name](item[f.name])
                    ) : f.type === "url" ? (
                      <a href={String(item[f.name])} target="_blank" rel="noopener noreferrer">Open link</a>
                    ) : (
                      formatValue(f, item[f.name])
                    )}
                  </dd>
                </div>
              )
            )}
          </dl>
        )}

        {(onEdit || onDelete) && (
          <div className="actions small">
            {onEdit && <button className="btn ghost" onClick={() => onEdit(item)}>Edit</button>}
            {onDelete && <button className="btn danger" onClick={() => onDelete(item)}>Delete</button>}
          </div>
        )}
      </div>
    </article>
  );
}
