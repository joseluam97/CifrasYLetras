import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../supabase";
import GameBoard from "../components/GameBoard.jsx";
import GlobalScoreboard from "../components/GlobalScoreboard.jsx";
import { RoomState } from '../../constants/gameStates';

const TvScreen = () => {
  const { roomCode } = useParams();
  const [sala, setSala] = useState(null);

  // ELIMINADO: const [jugadores, setJugadores] = useState([]);

  useEffect(() => {
    // Ahora TvScreen SOLO busca y escucha los cambios de la TABLA ROOM
    const fetchDatosIniciales = async () => {
      const { data: roomData } = await supabase
        .from('Room')
        .select('*')
        .eq('code', roomCode)
        .single();

      if (roomData) setSala(roomData);
    };

    fetchDatosIniciales();

    // ELIMINADO: La suscripción a 'Player' ya no está aquí.

    // Suscripción a los cambios de la sala (por si el admin cambia de ronda)
    const channelRoom = supabase.channel(`tv-room-${roomCode}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'Room', filter: `code=eq.${roomCode}` }, (payload) => {
        setSala(payload.new);
      }).subscribe();

    return () => supabase.removeChannel(channelRoom);
  }, [roomCode]);

  if (!sala) return <div className="text-center mt-5"><h2>Cargando señal de TV... 📺</h2></div>;

  return (
    // Candado 1: vh-100 y overflow-hidden. NUNCA habrá scroll global.
    <div className="container-fluid vh-100 d-flex flex-column bg-light p-0 overflow-hidden">

      {/* HEADER: Info de la Sala */}
      <div className="row bg-white shadow-sm py-2 px-3 mx-0 align-items-center flex-shrink-0 z-1">
        <div className="col-4 text-start">
          <span className="text-muted text-uppercase fw-bold" style={{ fontSize: "0.75rem" }}>Código para unirse:</span>
          <h3 className="text-primary fw-bold m-0" style={{ letterSpacing: "3px" }}>{sala.code}</h3>
        </div>
        <div className="col-4 text-center">
          <h4 className="m-0 fw-bold text-truncate">{sala.name}</h4>
        </div>
        <div className="col-4 text-end">
          <h6 className="m-0 text-secondary">Ronda {sala.current_rounds || 0} de {sala.total_rounds || '?'}</h6>
        </div>
      </div>

      {/* MAIN CONTENT: Tablero */}
      {/* Candado 2: flex-grow-1 y overflow-hidden para el espacio central */}
      <div className="flex-grow-1 d-flex flex-column align-items-center justify-content-center text-center px-2 position-relative overflow-hidden">
        {sala.state === RoomState.COMPLETE && (
          <div className="alert alert-success py-2 px-4 shadow-sm mb-2 mt-2 w-auto mx-auto z-1">
            <h5 className="fs-5 fw-bold mb-1">¡Sala Completa! 🎉</h5>
            <p className="mb-0" style={{ fontSize: "0.85rem" }}>Esperando al Admin...</p>
          </div>
        )}

        <GameBoard sala={sala} role={"TV"} />
      </div>

      {/* FOOTER: Marcador Global */}
      <GlobalScoreboard salaId={sala.id} />

    </div>
  );
};

export default TvScreen;