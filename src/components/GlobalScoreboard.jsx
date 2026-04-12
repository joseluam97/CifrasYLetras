import { useEffect, useState } from "react";
import { supabase } from "../../supabase";

// Recibe el 'salaId' para saber de qué sala debe buscar los jugadores.
// Opcional: 'compact' por si en el móvil quieres que se vea distinto que en la TV.
const GlobalScoreboard = ({ salaId, compact = false }) => {
  const [jugadores, setJugadores] = useState([]);

  useEffect(() => {
    if (!salaId) return;

    // 1. Fetch inicial de los jugadores
    const fetchJugadores = async () => {
      const { data } = await supabase
        .from('Player')
        .select('*')
        .eq('room_join', salaId)
        .order('points', { ascending: false }); // Ya los pedimos ordenados por la BD

      if (data) setJugadores(data);
    };

    fetchJugadores();

    // 2. Suscripción en Tiempo Real a los cambios de puntuación/nuevos jugadores
    const channelPlayers = supabase.channel(`scoreboard-${salaId}`)
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'Player', filter: `room_join=eq.${salaId}` }, 
        () => {
          // Si alguien entra o gana puntos, volvemos a descargar la lista
          fetchJugadores();
        }
      ).subscribe();

    return () => {
      supabase.removeChannel(channelPlayers);
    };
  }, [salaId]);

  return (
    <div className={`bg-dark text-white py-2 px-3 shadow mt-auto flex-shrink-0 z-1 ${compact ? 'w-100 rounded' : ''}`} style={{ maxHeight: compact ? "100%" : "25vh", overflowY: "auto" }}>
      <div className="text-center text-uppercase text-secondary mb-2" style={{ fontSize: "0.7rem", letterSpacing: "2px" }}>
        Marcador Global
      </div>
      
      <div className="d-flex justify-content-center flex-wrap gap-2 gap-md-3">
        {jugadores.length > 0 ? (
          jugadores.map((jugador, index) => (
            <div key={jugador.id} className="d-flex align-items-center bg-secondary bg-opacity-25 rounded px-3 py-1">
              <span className="fs-5 me-2 fw-bold text-warning">#{index + 1}</span>
              <div className="text-start lh-sm">
                <div className="fw-bold text-truncate" style={{ fontSize: "0.9rem", maxWidth: "120px" }}>
                  {jugador.name}
                </div>
                <div className="text-info" style={{ fontSize: "0.8rem" }}>
                  {jugador.points} pts
                </div>
              </div>
            </div>
          ))
        ) : (
          <span className="text-muted small">Esperando jugadores...</span>
        )}
      </div>
    </div>
  );
};

export default GlobalScoreboard;