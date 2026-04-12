import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../supabase";
import GameBoard from "../components/GameBoard.jsx";
import { RoomState } from '../../constants/gameStates';

const TvScreen = () => {
  const { roomCode } = useParams();
  const [sala, setSala] = useState(null);
  const [jugadores, setJugadores] = useState([]);

  useEffect(() => {
    const fetchDatosIniciales = async () => {
      const { data: roomData } = await supabase.from('Room').select('*').eq('code', roomCode).single();
      if (roomData) {
        setSala(roomData);
        const { data: playersData } = await supabase.from('Player').select('*').eq('room_join', roomData.id);
        if (playersData) setJugadores(playersData);
      }
    };

    fetchDatosIniciales();

    const channelPlayers = supabase.channel('cambios-jugadores')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Player' }, () => {
          fetchDatosIniciales();
      }).subscribe();

    return () => supabase.removeChannel(channelPlayers);
  }, [roomCode]);

  if (!sala) return <div className="text-center mt-5"><h2>Cargando señal de TV... 📺</h2></div>;

  const jugadoresOrdenados = [...jugadores].sort((a, b) => b.points - a.points);

  return (
    // overflow-hidden es vital aquí para matar la barra de scroll lateral de la TV
    <div className="container-fluid vh-100 d-flex flex-column bg-light p-0 overflow-hidden">

      {/* HEADER: Info de la Sala (Más compacto: py-2) */}
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

      {/* MAIN CONTENT: Tablero (flex-grow-1 para ocupar el resto, overflow-hidden para no romper) */}
      <div className="flex-grow-1 d-flex flex-column align-items-center justify-content-center text-center overflow-hidden px-2 position-relative">
        
        {/* Alerta de sala completa más pequeña */}
        {sala.state === RoomState.COMPLETE && (
          <div className="alert alert-success py-2 px-4 shadow-sm mb-2 mt-2 w-auto mx-auto z-1">
            <h5 className="fs-5 fw-bold mb-1">¡Sala Completa! 🎉</h5>
            <p className="mb-0" style={{ fontSize: "0.85rem" }}>Esperando al Admin...</p>
          </div>
        )}

        <GameBoard sala={sala} role={"TV"} />
      </div>

      {/* FOOTER: Marcador (Máximo 25% del alto de la pantalla) */}
      <div className="bg-dark text-white py-2 px-3 shadow mt-auto flex-shrink-0 z-1" style={{ maxHeight: "25vh", overflowY: "auto" }}>
        <div className="text-center text-uppercase text-secondary mb-2" style={{ fontSize: "0.7rem", letterSpacing: "2px" }}>Marcador Global</div>
        <div className="d-flex justify-content-center flex-wrap gap-2 gap-md-3">
          {jugadoresOrdenados.length > 0 ? (
            jugadoresOrdenados.map((jugador, index) => (
              <div key={jugador.id} className="d-flex align-items-center bg-secondary bg-opacity-25 rounded px-3 py-1">
                <span className="fs-5 me-2 fw-bold text-warning">#{index + 1}</span>
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

    </div>
  );
};

export default TvScreen;