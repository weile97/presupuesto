import { useEffect, useRef, useState } from "react";

// Música de una pantalla de carga: intenta sonar sola. Si el navegador la bloquea, `blocked` es true
// y `handleTap` la activa con el primer toque (en vez de saltar la pantalla).
export function useLoaderMusic(play, onSkip) {
  const musicRef = useRef(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    play().then((m) => {
      if (cancelled) return m?.stop();
      musicRef.current = m;
      if (!m) setBlocked(true);
    });
    return () => { cancelled = true; musicRef.current?.stop(); };
  }, [play]);

  const handleTap = async () => {
    if (blocked) {
      setBlocked(false);
      musicRef.current = await play();
      return;
    }
    onSkip?.();
  };

  return { blocked, handleTap };
}
