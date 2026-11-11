import { useEffect, useState } from "react";
import { api } from "./api.js";
import { SITE } from "./config.js";

/**
 * Linked fields store the id of an item in another collection.
 * useLookup loads that collection once (shared by all components) so we can
 * show titles instead of ids and offer a dropdown in forms.
 */
const cache = new Map();
const listeners = new Map();

export function resetLookups() {
  cache.clear();
}

export function refreshLookup(modelName) {
  cache.delete(modelName);
  (listeners.get(modelName) || []).forEach((fn) => fn());
}

function load(modelName) {
  if (!cache.has(modelName)) {
    const model = SITE.models.find((m) => m.name === modelName);
    cache.set(
      modelName,
      api
        .list(model.key)
        .then((rows) => (Array.isArray(rows) ? rows : []).map((r) => ({ id: r._id, title: String(r[model.titleField] ?? r._id) })))
        .catch(() => [])
    );
  }
  return cache.get(modelName);
}

export function useLookup(modelName) {
  const [options, setOptions] = useState(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!modelName) return;
    const bump = () => setVersion((v) => v + 1);
    listeners.set(modelName, [...(listeners.get(modelName) || []), bump]);
    return () => listeners.set(modelName, (listeners.get(modelName) || []).filter((f) => f !== bump));
  }, [modelName]);

  useEffect(() => {
    if (!modelName) return;
    let alive = true;
    load(modelName).then((o) => alive && setOptions(o));
    return () => {
      alive = false;
    };
  }, [modelName, version]);

  const titleOf = (id) => options?.find((o) => o.id === id)?.title ?? (options ? "—" : "…");
  return { options: options || [], loading: options === null, titleOf };
}

/** Titles for every linked field of a model: { fieldName: (id) => title } */
export function useLinkTitles(model) {
  const relations = model.fields.filter((f) => f.type === "relation");
  const lookups = {};
  // The number of linked fields of a model never changes, so calling hooks in a loop is safe here.
  for (const f of relations) lookups[f.name] = useLookup(f.model); // eslint-disable-line react-hooks/rules-of-hooks
  return Object.fromEntries(relations.map((f) => [f.name, lookups[f.name].titleOf]));
}
