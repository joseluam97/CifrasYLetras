import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../../supabase";
import { useGameStore } from "../store/gameStore";
import { GameState, GameType, RoomState } from "../../constants/gameStates";
import PlayerLetrasScreen from "./PlayerLetrasScreen.jsx";
import PlayerCifrasScreen from "./PlayerCifrasScreen.jsx";
import GameBoard from "../components/GameBoard.jsx";

const PlayerScreen = () => {
  const { roomCode } = useParams(); // Este es el 'code' de la URL
  const { jugadorActual } = useGameStore();

  const [sala, setSala] = useState(null);
  const [juegoActual, setJuegoActual] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Si no hay jugador (ni en store ni en persistencia), no hacemos nada
    if (!jugadorActual) {
      setLoading(false);
      return;
    }

    const fetchDatos = async () => {
      try {
        // 1. Obtener la sala (Asegúrate que la columna es 'code')
        console.log("Buscando sala con código:", roomCode);
        const { data: roomData, error: roomError } = await supabase
          .from('Room')
          .select('*')
          .eq('code', roomCode) // CAMBIADO: Antes tenías codigo_sala
          .single();

        if (roomError) throw roomError;

        if (roomData) {
          setSala(roomData);

          // 2. Obtener el juego actual si hay rondas activas
          if (roomData.current_rounds > 0) {
            const { data: gameData } = await supabase
              .from('Games')
              .select('*')
              .eq('room', roomData.id)
              .eq('identifier', roomData.current_rounds)
              .single();

            if (gameData) setJuegoActual(gameData);
          }
        }
      } catch (err) {
        console.error("Error al recuperar datos:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDatos();

    // 3. Suscripción a la SALA (Para detectar FINISHED o cambios de ronda)
    const roomChannel = supabase.channel(`room-changes-${roomCode}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'Room', filter: `code=eq.${roomCode}` },
        (payload) => {
          console.log("Cambio en sala detectado:", payload.new);
          setSala(payload.new);

          // Si la sala se resetea (vuelve a 0 rondas), limpiamos el juego actual localmente
          if (payload.new.current_rounds === 0) {
            setJuegoActual(null);
          }
        }
      )
      .subscribe();

    // 4. Suscripción a los JUEGOS
    const gamesChannel = supabase.channel(`game-changes-${roomCode}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Games' },
        (payload) => {
          // Si el evento es un borrado (DELETE), el payload.new será nulo
          if (payload.eventType === 'DELETE') {
            setJuegoActual(null);
          } else {
            // Solo actualizamos si el juego pertenece a nuestra sala id
            // Si sala no está cargado aún, solo seteamos el nuevo
            setJuegoActual(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(gamesChannel);
    };
  }, [roomCode, jugadorActual]);

  // --- Lógica de Renderizado ---

  if (loading) {
    return <div className="container mt-5 text-center"><div className="spinner-border text-primary"></div></div>;
  }

  if (!jugadorActual) {
    return (
      <div className="container mt-5 text-center">
        <h2>Vuelve al inicio para unirte.</h2>
        <Link to="/" className="btn btn-primary mt-3">Ir al Inicio</Link>
      </div>
    );
  }

  // VISTA: Partida Finalizada
  if (sala?.state === RoomState.FINISHED) {
    return (
      <>
        <div className="container mt-5 text-center animate__animated animate__fadeIn">
          <h2 className="fw-bold text-danger">🏆 ¡Partida Terminada!</h2>
          <p className="lead text-muted mt-3">Mira la clasificación final en la TV.</p>
        </div>
        <GameBoard
          sala={sala}
          role={"TV"}
        />
      </>
    );
  }

  // VISTA: Descanso o Resultados de Ronda
  if (!juegoActual || juegoActual.state === GameState.END) {
    return (
      <div className="container mt-5 text-center animate__animated animate__fadeIn">
        <h2 className="fw-bold text-primary">¡Descanso!</h2>
        <p className="lead text-muted mt-3">Mira la TV para ver los resultados.</p>
        <p>Esperando a que el Admin inicie la siguiente ronda...</p>
      </div>
    );
  }

  // VISTA: Preparación
  if (juegoActual.state === GameState.CREATED) {
    return (
      <div className="container mt-5 text-center animate__animated animate__pulse animate__infinite">
        <h1 className="fw-bold text-warning">¡PREPÁRATE!</h1>
        <h3 className="mt-3">Ronda de {juegoActual.type}</h3>
        <p className="text-muted mt-4">La ronda está a punto de empezar...</p>
      </div>
    );
  }

  // VISTA: Juegos Activos
  if (juegoActual.type === GameType.LETRAS) {
    return <PlayerLetrasScreen juego={juegoActual} jugador={jugadorActual} />;
  }

  if (juegoActual.type === GameType.CIFRAS) {
    return <PlayerCifrasScreen juego={juegoActual} jugador={jugadorActual} />;
  }

  return null;
};

export default PlayerScreen;