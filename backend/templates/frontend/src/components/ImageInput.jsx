import { useState } from "react";
import { api, errorMessage } from "../api.js";

/** Shrink a photo in the browser (max 1200px, JPEG) so uploads are small and fast. */
function resize(file, max = 1200) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file isn't an image"));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff"; // transparent PNGs get a white background
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function ImageInput({ id, value, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [linkMode, setLinkMode] = useState(Boolean(value) && !String(value).startsWith("data:"));

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Please choose an image file.");
    setBusy(true);
    setError("");
    try {
      onChange(await api.upload(await resize(file)));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="image-input">
      {value ? (
        <div className="image-preview">
          <img src={value} alt="" />
          <button type="button" className="btn ghost small-btn" onClick={() => onChange("")}>Remove</button>
        </div>
      ) : null}
      {linkMode ? (
        <input id={id} type="url" placeholder="https://… (image link)" value={String(value || "").startsWith("data:") ? "" : value || ""} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <label className="btn ghost upload-btn">
          {busy ? "Uploading…" : value ? "Change photo" : "Upload photo"}
          <input id={id} type="file" accept="image/*" onChange={pick} disabled={busy} hidden />
        </label>
      )}
      <button type="button" className="link small" onClick={() => setLinkMode(!linkMode)}>
        {linkMode ? "Upload a photo instead" : "or paste an image link"}
      </button>
      {error && <p className="alert error">{error}</p>}
    </div>
  );
}
