// Temporadas de la pantalla de carga, a partir de la fecha "YYYY-MM-DD"
export const SEASON_LOADER_MS = 5000;

export function currentSeason(iso) {
  const md = iso.slice(5);
  if (md >= "10-24" && md <= "11-02") return "halloween"; // 24 oct - 2 nov
  if (md >= "12-01" || md <= "01-06") return "christmas"; // 1 dic - 6 ene (cruza el cambio de año)
  return null;
}
