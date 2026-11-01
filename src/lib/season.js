// Temporadas de la pantalla de carga, a partir de la fecha "YYYY-MM-DD"
export const SEASON_LOADER_MS = 5000;

export function currentSeason(iso) {
  const md = iso.slice(5);
  if (md >= "10-24" && md <= "10-31") return "halloween"; // 24 - 31 oct
  if (md >= "11-01" || md <= "01-06") return "christmas"; // 1 nov - 6 ene (cruza el cambio de año)
  return null;
}
