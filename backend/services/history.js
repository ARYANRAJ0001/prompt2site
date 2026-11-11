/** Keep earlier versions of a project's plan so they can be restored. */
const MAX = 20;

/** Set a new plan on the project, saving the previous one in its history. */
function setBlueprint(project, blueprint, label) {
  const before = project.blueprint ? JSON.stringify(project.blueprint) : null;
  if (before && before !== JSON.stringify(blueprint)) {
    project.history.push({ at: new Date(), label: label || "Edited", blueprint: JSON.parse(before) });
    if (project.history.length > MAX) project.history.splice(0, project.history.length - MAX);
    // Plans with photos are big: keep the whole project well under MongoDB's 16 MB
    // limit by dropping the oldest versions first.
    const size = (v) => JSON.stringify(v).length;
    let total = size(blueprint) + project.history.reduce((n, h) => n + size(h.blueprint), 0);
    while (total > 11_000_000 && project.history.length > 1) total -= size(project.history.shift().blueprint);
    project.markModified("history");
  }
  project.blueprint = blueprint;
  project.name = blueprint.name;
  project.markModified("blueprint");
}

module.exports = { setBlueprint };
