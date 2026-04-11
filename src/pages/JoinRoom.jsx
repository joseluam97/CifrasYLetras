import { useEffect, useState } from "react";
import { useNavigate, Link, useParams } from "react-router-dom";
import { useGameStore } from "../store/gameStore";

const JoinRoom = () => {
  const { roomCodeUrl } = useParams(); // Obtenemos el código de la URL
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [blockedCode, setBlockedCode] = useState(false);
  const navigate = useNavigate();
  
  // Extraemos la función y los estados de nuestro store
  const { unirsePartida, isLoading, error } = useGameStore();

  useEffect(() => {
    console.log("Código de sala en URL:", roomCodeUrl);
    if(roomCodeUrl != null) {
      setRoomCode(roomCodeUrl.toUpperCase());
      setBlockedCode(true);
    }
  }, [roomCodeUrl]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Llamamos a la función del store (los pasos 1 y 2 que comentamos arriba)
    const resultado = await unirsePartida(playerName, roomCode);

    if (resultado.success) {
      // Si todo va bien, mandamos al jugador a su pantalla de mando
      navigate(`/player/${roomCode.toUpperCase()}`);
    } else {
      // Si el código no existe o falla, mostramos una alerta
      alert(resultado.error || "Error al intentar unirse a la sala.");
    }
  };

  return (
    <div className="container mt-5 mb-5 d-flex justify-content-center">
      <div className="card shadow p-5" style={{ maxWidth: "400px", width: "100%", borderRadius: "15px" }}>
        
        <Link to="/" className="btn btn-sm btn-outline-secondary mb-4" style={{ width: "fit-content" }}>
          &larr; Volver
        </Link>

        <h2 className="text-center mb-4 fw-bold text-primary">Unirse a la Partida</h2>

        {/* Si hay un error desde el store, lo mostramos bonito aquí */}
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Nombre del jugador */}
          <div className="mb-4">
            <label htmlFor="playerName" className="form-label fw-semibold">Tu Nickname</label>
            <input
              type="text"
              className="form-control form-control-lg text-center"
              id="playerName"
              placeholder="Ej: Jugador1"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              required
              maxLength={15}
            />
          </div>

          {/* Código de la sala */}
          <div className="mb-4">
            <label htmlFor="roomCode" className="form-label fw-semibold">Código de la Sala</label>
            <input
              type="text"
              className="form-control form-control-lg text-center text-uppercase fw-bold text-primary tracking-widest"
              id="roomCode"
              placeholder="EJ: K9X2"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              required
              maxLength={4}
              disabled={blockedCode}
              style={{ letterSpacing: "5px" }} // Le da un toque chulo al teclear
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary btn-lg w-100 fw-bold py-3 shadow-sm"
            disabled={isLoading || roomCode.length !== 4 || playerName.length === 0}
          >
            {isLoading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
                <span role="status">Conectando...</span>
              </>
            ) : (
              "Entrar a Jugar"
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default JoinRoom;