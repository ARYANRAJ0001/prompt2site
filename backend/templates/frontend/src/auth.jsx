import { createContext, useContext, useEffect, useState } from "react";
import { api, tokenStore, DEMO } from "./api.js";
import { SITE } from "./config.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(!SITE.auth || DEMO);

  useEffect(() => {
    if (!SITE.auth || DEMO) return;
    if (!tokenStore.get()) {
      setReady(true);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => tokenStore.set(null))
      .finally(() => setReady(true));
  }, []);

  const finish = ({ token, user: u }) => {
    tokenStore.set(token);
    setUser(u);
    return u;
  };

  // Each returns either the user, or { needsVerification, email } when an emailed code is needed.
  const settle = (data) => (data?.token ? finish(data) : data);
  const value = {
    user,
    ready,
    isAdmin: !SITE.auth || user?.role === "admin",
    isCustomer: user?.role === "customer",
    login: (email, password) => api.login({ email, password }).then(settle, (err) => {
      if (err.response?.data?.needsVerification) return err.response.data;
      throw err;
    }),
    register: (name, email, password, phone) => api.register({ name, email, password, phone }).then(settle),
    verify: (email, code) => api.verify({ email, code }).then(settle),
    reset: (email, code, password) => api.reset({ email, code, password }).then(settle),
    logout: () => {
      tokenStore.set(null);
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/** What the current visitor may do with a model (mirrors the backend rules). */
export function permissions(model, auth) {
  if (!SITE.auth) return { view: true, submit: true, manage: true };
  if (model.ownedByUser) {
    const signedIn = Boolean(auth.user);
    return { view: signedIn, submit: signedIn, manage: signedIn };
  }
  return {
    view: model.public.list || auth.isAdmin,
    submit: model.public.create || auth.isAdmin,
    manage: auth.isAdmin,
  };
}
