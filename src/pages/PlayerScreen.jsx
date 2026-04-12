import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../../supabase";
import { useGameStore } from "../store/gameStore";
import { GameState, GameType, RoomState } from "../../constants/gameStates";
import PlayerLetrasScreen from "./PlayerLetrasScreen.jsx";
import PlayerCifrasScreen from "./PlayerCifrasScreen.jsx";
import GameBoard from "../components/GameBoard.jsx";
import QualifyingRound from "../components/QualifyingRound.jsx";
import GlobalScoreboard from "../components/GlobalScoreboard.jsx";
import { TIME_PER_ROUND_LETTERS, TIME_PER_ROUND_NUMBERS } from '../../constants/gameStates';

const PlayerScreen = () => {
  const { roomCode } = useParams();
  const { jugadorActual } = useGameStore();

  const [sala, setSala] = useState(null);
  const [juegoActual, setJuegoActual] = useState(null);
  const [resultadosRonda, setResultadosRonda] = useState([]);
  const [loading, setLoading] = useState(true);

  const [tiempoRestante, setTiempoRestante] = useState(TIME_PER_ROUND_LETTERS);

  useEffect(() => {
    if (!jugadorActual) {
      setLoading(false);
      return;
    }

    const fetchDatos = async () => {
      try {
        const { data: roomData, error: roomError } = await supabase
          .from('Room')
          .select('*')
          .eq('code', roomCode)
          .single();

        if (roomError) throw roomError;

        if (roomData) {
          setSala(roomData);

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

    const roomChannel = supabase.channel(`room-changes-${roomCode}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'Room', filter: `code=eq.${roomCode}` },
        (payload) => {
          setSala(payload.new);
          if (payload.new.current_rounds === 0) {
            setJuegoActual(null);
          }
        }
      )
      .subscribe();

    const gamesChannel = supabase.channel(`game-changes-${roomCode}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Games' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setJuegoActual(null);
          } else {
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

  // --- NUEVO EFECTO: Cronómetro Local ---
  useEffect(() => {
    let timer;

    // 1. Setear el tiempo según el tipo de ronda cuando se crea
    if (juegoActual?.state === GameState.CREATED) {
      const tiempoInicial = juegoActual.type === GameType.CIFRAS
        ? TIME_PER_ROUND_NUMBERS
        : TIME_PER_ROUND_LETTERS;
      setTiempoRestante(tiempoInicial);
    }

    // 2. Iniciar cuenta atrás cuando pasa a PLAYING
    if (juegoActual?.state === GameState.PLAYING && tiempoRestante > 0) {
      timer = setInterval(() => {
        setTiempoRestante(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0; // El móvil llega a 0, pero no procesa el final. Espera a que Supabase cambie el estado.
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(timer);
  }, [juegoActual?.state, juegoActual?.type]);

  // --- 3. NUEVO EFECTO: Cargar resultados cuando termina la ronda ---
  useEffect(() => {
    const cargarResultados = async () => {
      if (juegoActual?.id && (juegoActual.state === GameState.END || juegoActual.state === GameState.RESULT)) {
        const { data } = await supabase
          .from('Result_Game')
          .select('*, Player(name)')
          .eq('game', juegoActual.id)
          .order('points_win', { ascending: false });
        setResultadosRonda(data || []);
      } else {
        setResultadosRonda([]);
      }
    };
    cargarResultados();
  }, [juegoActual?.state, juegoActual?.id]);


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

  // VISTA: Lobby inicial (Aún no hay juegos)
  if (!juegoActual) {
    return (
      <div className="container mt-5 text-center animate__animated animate__fadeIn">
        <h2 className="fw-bold text-primary">¡Bienvenido!</h2>
        <p className="lead text-muted mt-3">Mira la TV.</p>
        <p>Esperando a que el Admin inicie la primera ronda...</p>
      </div>
    );
  }

  // VISTA: Descanso o Resultados de Ronda
  if (juegoActual.state === GameState.END) {
    return (
      <div className="bg-light vh-100 d-flex flex-column pt-4 px-2">

        {/* Cabecera del móvil */}
        <div className="text-center animate__animated animate__fadeIn mb-3">
          <h2 className="fw-bold text-primary mb-1">¡Descanso!</h2>
          <p className="text-muted small mb-0">Esperando al Admin para la siguiente ronda...</p>
        </div>

        {/* Contenedor flexible para la tabla (se lleva el espacio restante) */}
        <div className="flex-grow-1 overflow-auto">
          <QualifyingRound
            resultadosRonda={resultadosRonda}
            juegoActual={juegoActual}
            compact={true}
          />
        </div>

        <GlobalScoreboard salaId={sala.id} />
      </div>
    );
  }

  // VISTA: Preparación
  if (juegoActual.state === GameState.CREATED) {
    return (
      <div className="bg-light vh-100 d-flex flex-column pt-4 px-2">
        <div className="container mt-5 text-center animate__animated animate__pulse animate__infinite">
          <h1 className="fw-bold text-warning">¡PREPÁRATE!</h1>
          <h3 className="mt-3">Ronda de {juegoActual.type}</h3>
          <p className="text-muted mt-4">La ronda está a punto de empezar...</p>

        </div>
        <GlobalScoreboard salaId={sala.id} />
      </div>
    );
  }

  // VISTA: Juegos Activos
  if (juegoActual.type === GameType.LETRAS) {
    return <PlayerLetrasScreen juego={juegoActual} jugador={jugadorActual} tiempoRestante={tiempoRestante} />;
  }

  if (juegoActual.type === GameType.CIFRAS) {
    return <PlayerCifrasScreen juego={juegoActual} jugador={jugadorActual} tiempoRestante={tiempoRestante} />;
  }

  return null;
};

export default PlayerScreen;