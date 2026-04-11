import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "../../supabase";
import GameBoard from "../components/GameBoard.jsx";
import { AppRole } from "../../constants/gameStates";

const AdminScreen = () => {
  const { roomCode } = useParams(); // Este es el código de la sala (ej. K9X2)
  const navigate = useNavigate();
  
  const [sala, setSala] = useState(null);
  const [jugadores, setJugadores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Cargar datos iniciales
    const fetchDatos = async () => {
      // Buscar la sala (CORREGIDO: usamos 'code' en lugar de 'codigo_sala')
      const { data: roomData, error: roomError } = await supabase
        .from('Room')
        .select('*')
        .eq('code', roomCode) 
        .single();

      if (roomError || !roomData) {
        alert("Sala no encontrada");
        navigate("/");
        return;
      }
      setSala(roomData);

      // Buscar jugadores
      const { data: playersData } = await supabase
        .from('Player')
        .select('*')
        .eq('room_join', roomData.id)
        .order('created_at', { ascending: true });
        
      if (playersData) setJugadores(playersData);
      setLoading(false);
    };

    fetchDatos();

    // 2. Suscripción en tiempo real a la tabla de Jugadores
    // Así la lista se actualiza sola cuando alguien entra o es expulsado
    const channel = supabase.channel(`admin-players-${roomCode}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Player' },
        () => {
          // Si hay cualquier cambio en los jugadores, recargamos la lista
          fetchDatos();
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [roomCode, navigate]);

  // --- LÓGICA DE EXPULSIÓN ---
  const handleEliminarJugador = async (idJugador, nombreJugador) => {
    // 1. Mensaje de verificación nativo del navegador
    const confirmar = window.confirm(`¿Estás seguro de que quieres expulsar a "${nombreJugador}" de la partida?\n\nPerderá todos sus puntos y no podrá volver a enviar respuestas.`);
    
    if (!confirmar) return;

    try {
      // 2. Borrar las respuestas del jugador (Evita errores de Foreign Key)
      await supabase
        .from('Result_Game')
        .delete()
        .eq('player', idJugador);

      // 3. Borrar al jugador
      const { error } = await supabase
        .from('Player')
        .delete()
        .eq('id', idJugador);

      if (error) throw error;

      // El realtime (useEffect) se encargará de quitarlo de la lista visualmente
      
    } catch (error) {
      console.error("Error al expulsar jugador:", error);
      alert("Hubo un error al intentar expulsar al jugador.");
    }
  };

  if (loading) return <div className="text-center mt-5"><span className="spinner-border"></span></div>;

  return (
    <div className="container mt-4 pb-5">
      
      {/* Cabecera de la Sala */}
      <div className="d-flex justify-content-between align-items-center mb-4 bg-white p-3 rounded shadow-sm border-start border-5 border-primary">
        <div>
          {/* CORREGIDO: usamos 'name' y 'code' */}
          <h2 className="m-0 fw-bold">{sala.name}</h2>
          <span className="text-muted">Código de acceso: <strong className="fs-5 text-dark">{sala.code}</strong></span>
        </div>
        <Link to="/" className="btn btn-outline-secondary">Salir del Panel</Link>
      </div>

      <div className="row">
        {/* COLUMNA IZQUIERDA: Control del Juego (El GameBoard) */}
        <div className="col-lg-8 mb-4">
          <GameBoard sala={sala} role={AppRole.ADMIN} />
        </div>

        {/* COLUMNA DERECHA: Gestión de Jugadores */}
        <div className="col-lg-4">
          <div className="card shadow-sm border-0">
            <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center py-3">
              {/* CORREGIDO: Añadido sala.players para mostrar el máximo permitido de la sala */}
              <h5 className="m-0 fw-bold">Jugadores ({jugadores.length} / {sala.players})</h5>
            </div>
            
            <div className="list-group list-group-flush" style={{ maxHeight: "500px", overflowY: "auto" }}>
              {jugadores.length === 0 ? (
                <div className="p-4 text-center text-muted">
                  Nadie se ha unido todavía.
                </div>
              ) : (
                jugadores.map((jugador) => (
                  <div key={jugador.id} className="list-group-item d-flex justify-content-between align-items-center py-3">
                    <div>
                      <div className="fw-bold fs-5">{jugador.name}</div>
                      <small className="text-muted">{jugador.points} puntos</small>
                    </div>
                    
                    {/* Botón de Expulsar */}
                    <button 
                      onClick={() => handleEliminarJugador(jugador.id, jugador.name)}
                      className="btn btn-sm btn-outline-danger"
                      title="Expulsar jugador"
                    >
                      {/* Icono de papelera */}
                      🗑️ Expulsar
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default AdminScreen;