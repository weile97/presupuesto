// Temporada de Halloween: del 24 de octubre al 2 de noviembre (fecha "YYYY-MM-DD")
export const isHalloweenSeason = (iso) => {
  const md = iso.slice(5);
  return md >= "10-24" || md <= "11-02";
};
export const HALLOWEEN_LOADER_MS = 5000;
