import { useEffect, useState } from "react";
import { supabase } from "../../supabase";

const GlobalScoreboard = ({ salaId, compact = false }) => {
    const [jugadores, setJugadores] = useState([]);

    useEffect(() => {
        if (!salaId) return;

        const fetchJugadores = async () => {
            const { data } = await supabase
                .from('Player')
                .select('*')
                .eq('room_join', salaId)
                .order('points', { ascending: false });

            if (data) setJugadores(data);
        };

        fetchJugadores();

        const channelPlayers = supabase.channel(`scoreboard-${salaId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'Player', filter: `room_join=eq.${salaId}` },
                () => fetchJugadores()
            ).subscribe();

        return () => supabase.removeChannel(channelPlayers);
    }, [salaId]);

    return (
        // CAMBIO CLAVE: maxHeight: "35vh" para móvil, "25vh" para TV. 
        // Añadido 'mt-auto' para que siempre empuje hacia abajo.
        <div className={`bg-dark text-white py-2 px-3 shadow mt-auto flex-shrink-0 z-1 ${compact ? 'w-100 rounded-top' : ''}`} style={{ maxHeight: compact ? "35vh" : "25vh", overflowY: "auto" }}>
            <div className="text-center text-uppercase text-secondary mb-2 sticky-top bg-dark pt-1" style={{ fontSize: "0.7rem", letterSpacing: "2px" }}>
                Marcador Global
            </div>

            <div className="d-flex justify-content-center flex-wrap gap-2 gap-md-3">
                {jugadores.length > 0 ? (
                    jugadores.map((jugador, index) => (
                        <div key={jugador.id} className="d-flex align-items-center bg-secondary bg-opacity-25 rounded px-3 py-1">
                            <span className="fs-15 me-1 fw-bold text-warning">#{index + 1}</span>
                            <div className="text-start lh-sm">
                                <div className="fw-bold text-truncate" style={{ fontSize: "0.9rem", maxWidth: "120px" }}>{jugador.name}</div>
                                <div className="text-info" style={{ fontSize: "0.8rem" }}>{jugador.points} pts</div>
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