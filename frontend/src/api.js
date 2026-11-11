import axios from "axios";
import { useCallback, useRef, useState } from "react";

// Set VITE_API_URL in frontend/.env.local (local) or in Netlify/Render (deployed).
export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:1256").replace(/\/$/, "");

const TOKEN = "p2s_token";
export const session = {
  token() {
    try {
      return localStorage.getItem(TOKEN);
    } catch {
      return null;
    }
  },
  save(token, user) {
    try {
      localStorage.setItem(TOKEN, token);
      localStorage.setItem("p2s_user", JSON.stringify(user));
    } catch {}
  },
  user() {
    try {
      return JSON.parse(localStorage.getItem("p2s_user") || "null");
    } catch {
      return null;
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN);
      localStorage.removeItem("p2s_user");
    } catch {}
  },
};

export const http = axios.create({ baseURL: API_URL, timeout: 60000 });
/** The user's own OpenRouter key (optional), kept only in this browser. */
export const ownKey = {
  get() {
    try {
      return localStorage.getItem("p2s_openrouter_key") || "";
    } catch {
      return "";
    }
  },
  set(v) {
    try {
      if (v) localStorage.setItem("p2s_openrouter_key", v.trim());
      else localStorage.removeItem("p2s_openrouter_key");
    } catch {}
  },
};

http.interceptors.request.use((config) => {
  const t = session.token();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  const k = ownKey.get();
  if (k) config.headers["X-OpenRouter-Key"] = k;
  return config;
});
http.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && session.token()) {
      session.clear();
      window.dispatchEvent(new Event("p2s-logout"));
    }
    return Promise.reject(err);
  }
);

export function errorText(err) {
  if (err?.message === "Network Error") return `Can't reach the server at ${API_URL}. Is the backend running?`;
  if (err?.code === "ECONNABORTED") return "The server took too long to answer. Please try again.";
  return err?.response?.data?.message || err?.message || "Something went wrong";
}

/**
 * Start a background job on the server and wait for it, reporting progress.
 *   const job = useJob();  const result = await job.run("/api/fullstack/plan", { prompt });
 */
export function useJob() {
  const [step, setStep] = useState("");
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const cancelled = useRef(false);

  const run = useCallback(async (path, body) => {
    cancelled.current = false;
    setRunning(true);
    setStep("Starting");
    setSeconds(0);
    try {
      const { data } = await http.post(path, body);
      if (!data.jobId) throw new Error(data.message || "The server didn't start the task");

      let misses = 0;
      for (;;) {
        await new Promise((r) => setTimeout(r, 2000));
        if (cancelled.current) throw new Error("Stopped waiting");
        let job;
        try {
          job = (await http.get(`/api/jobs/${data.jobId}`)).data.job;
          misses = 0;
        } catch (err) {
          if (err.response?.status === 404 || err.response?.status === 401) throw err;
          if (++misses > 15) throw err; // keep polling through brief network blips
          continue;
        }
        setStep(job.step);
        setSeconds(job.seconds);
        if (job.status === "done") return job.result;
        if (job.status === "failed") throw Object.assign(new Error(job.error), { details: job.details });
      }
    } finally {
      setRunning(false);
    }
  }, []);

  return { run, step, running, seconds, cancel: () => (cancelled.current = true) };
}

/** Download a POST response as a file. */
export async function downloadPost(path, body, filename) {
  const res = await http.post(path, body, { responseType: "blob", timeout: 120000 });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
