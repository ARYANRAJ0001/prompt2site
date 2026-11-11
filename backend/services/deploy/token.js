/** A deploy token from .env, cleaned of quotes/spaces people paste by accident. */
function token(name) {
  const v = String(process.env[name] || "").trim().replace(/^['"]|['"]$/g, "").trim();
  if (!v) throw new Error(`${name} is not set in backend/.env`);
  if (/^https?:\/\//i.test(v)) throw new Error(`${name} in backend/.env is a link — paste the token itself instead`);
  return v;
}

/** "starts with ghp_, 40 characters" — enough to spot a wrong token without showing it. */
const describe = (name) => {
  const v = String(process.env[name] || "").trim();
  return v ? `the ${name} in backend/.env starts with "${v.slice(0, 4)}" and is ${v.length} characters long` : `${name} is empty`;
};

module.exports = { token, describe };
