// Fusión de cambios cuando los dos móviles editan a la vez.
// base = último estado confirmado por el servidor, local = mis cambios, remote = lo que hay ahora en el servidor.
// Se aplican sobre "remote" solo los elementos que YO he añadido, modificado o borrado respecto a "base".
function mergeById(baseArr = [], localArr = [], remoteArr = []) {
  if (![...baseArr, ...localArr, ...remoteArr].every((x) => x && x.id != null)) return localArr;
  const b = new Map(baseArr.map((x) => [x.id, x]));
  const l = new Map(localArr.map((x) => [x.id, x]));
  const result = new Map(remoteArr.map((x) => [x.id, x]));
  for (const id of b.keys()) if (!l.has(id)) result.delete(id);
  for (const [id, item] of l) {
    const old = b.get(id);
    if (!old || JSON.stringify(old) !== JSON.stringify(item)) result.set(id, item);
  }
  const sameOrder = (x, y) => x.length === y.length && x.every((it, i) => it.id === y[i].id);
  const orderSrc = sameOrder(baseArr, localArr) ? remoteArr : localArr;
  const ordered = orderSrc.filter((x) => result.has(x.id)).map((x) => result.get(x.id));
  const seen = new Set(ordered.map((x) => x.id));
  for (const [id, item] of result) if (!seen.has(id)) ordered.push(item);
  return ordered;
}

export function mergeData(base, local, remote) {
  if (!base) return local;
  const merged = { ...remote, ...local };
  for (const k of ["sources", "categories", "transactions", "recurrents"]) {
    merged[k] = mergeById(base[k], local[k], remote[k]);
  }
  for (const k of ["lastActiveMonth", "payrollCycle"]) {
    if (local[k] === base[k]) merged[k] = remote[k];
  }
  return merged;
}

// Separa la versión (_rev) del resto de datos que devuelve la API
export const splitRemote = (remote) => {
  const { _rev, ...rest } = remote || {};
  return [rest, String(_rev ?? "0")];
};
