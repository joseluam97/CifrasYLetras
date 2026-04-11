import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../supabase";
import GameBoard from "../components/GameBoard.jsx";
import { RoomState } from '../../constants/gameStates';

const TvScreen = () => {
  const { roomCode } = useParams(); // Obtenemos el código de la URL
  const [sala, setSala] = useState(null);
  const [jugadores, setJugadores] = useState([]);

  // Simularemos algunos datos del tablero para que no te dé error visual ahora mismo
  // En el futuro, estos datos vendrán de la tabla de la sala en Supabase
  const [tiempoRestante, setTiempoRestante] = useState(30);
  const [consignaActual, setConsignaActual] = useState(['C', 'I', 'F', 'R', 'A', 'S']);

  useEffect(() => {
    // 1. Carga inicial de datos
    const fetchDatosIniciales = async () => {
      // Buscar la sala
      const { data: roomData } = await supabase
        .from('Room')
        .select('*')
        .eq('code', roomCode)
        .single();

      console.log("Datos de la sala obtenidos:", roomData);

      if (roomData) {
        setSala(roomData);
        // Buscar los jugadores de esta sala
        const { data: playersData } = await supabase
          .from('Player')
          .select('*')
          .eq('room_join', roomData.id);

        if (playersData) setJugadores(playersData);
      }
    };

    fetchDatosIniciales();

    // 2. Suscripción en Tiempo Real a nuevos jugadores
    const channelPlayers = supabase.channel('cambios-jugadores')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Player' },
        (payload) => {
          console.log('Cambio en jugadores detectado:', payload);
          // Si hay un cambio, volvemos a descargar los jugadores para tener la lista actualizada
          fetchDatosIniciales();
        }
      )
      .subscribe();

    // Limpieza al desmontar el componente
    return () => {
      supabase.removeChannel(channelPlayers);
    };
  }, [roomCode]);

  // Pantalla de carga mientras lee Supabase
  if (!sala) return <div className="text-center mt-5"><h2>Cargando señal de TV... 📺</h2></div>;

  // Lógica de estado de la partida
  const faltanJugadores = jugadores.length < sala.players;
  const listosParaEmpezar = jugadores.length === sala.players;

  // Ordenar jugadores por puntos para el marcador inferior
  const jugadoresOrdenados = [...jugadores].sort((a, b) => b.points - a.points);

  return (
    <div className="container-fluid vh-100 d-flex flex-column bg-light" style={{ paddingTop: "80px" }}>

      {/* HEADER: Info de la Sala */}
      <div className="row bg-white shadow-sm py-3 px-4 mb-4 align-items-center">
        <div className="col text-start">
          <span className="text-muted text-uppercase fw-bold">Código para unirse:</span>
          <h2 className="text-primary fw-bold tracking-widest m-0" style={{ letterSpacing: "5px" }}>{sala.code}</h2>
        </div>
        <div className="col text-center">
          <h3 className="m-0 fw-bold">{sala.name}</h3>
        </div>
        <div className="col text-end">
          <h5 className="m-0 text-secondary">Ronda {sala.current_rounds || 0} de {sala.total_rounds || '?'}</h5>
        </div>
      </div>

      {/* MAIN CONTENT: El estado del juego */}
      <div className="flex-grow-1 d-flex flex-column align-items-center justify-content-center text-center">

        {/* ESTADO 2: Todos listos */}
        {sala.state == RoomState.COMPLETE && (
          <div className="alert alert-success p-4 shadow-sm mb-0">
            <h5 className="display-5 fw-bold mb-2">¡Sala Completa! 🎉</h5>
            <p>Esperando a que el Administrador inicie la partida...</p>
          </div>
        )}

        {/* ESTADO 3: Partida en curso (Usamos tu nuevo componente) */}
        <GameBoard
          sala={sala}
          role={"TV"}
        />
      </div>

      {/* FOOTER: Marcador de Jugadores */}
      <div className="bg-dark text-white py-3 px-4 shadow mt-auto">
        <h5 className="text-center text-uppercase text-secondary mb-3" style={{ letterSpacing: "2px" }}>Marcador Global</h5>
        <div className="d-flex justify-content-center flex-wrap gap-4">
          {jugadoresOrdenados.length > 0 ? (
            jugadoresOrdenados.map((jugador, index) => (
              <div key={jugador.id} className="d-flex align-items-center bg-secondary bg-opacity-25 rounded px-4 py-2">
                <span className="fs-4 me-3 fw-bold text-warning">#{index + 1}</span>
                <div className="text-start">
                  <div className="fw-bold fs-5">{jugador.name}</div>
                  <div className="text-info">{jugador.points} pts</div>
                </div>
              </div>
            ))
          ) : (
            <span className="text-muted">Aún no hay jugadores en la sala</span>
          )}
        </div>
      </div>

    </div>
  );
};

export default TvScreen;