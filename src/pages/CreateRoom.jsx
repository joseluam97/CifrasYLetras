import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useGameStore } from "../store/gameStore";
import { GameType } from "../../constants/gameStates"; // Importamos los tipos de juego

const CreateRoom = () => {
  const [roomName, setRoomName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [totalRounds, setTotalRounds] = useState(5); // Estado para total_rounds
  const [firstGame, setFirstGame] = useState(GameType.LETRAS); // Estado para first_game

  const navigate = useNavigate();
  const { crearPartida, isLoading } = useGameStore();

  const generateRoomCode = () => {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const roomCode = generateRoomCode();

    // Llamamos al método del store con los nuevos parámetros de la BD
    const resultado = await crearPartida(
      roomName, 
      maxPlayers, 
      roomCode, 
      totalRounds, 
      firstGame
    );

    if (resultado.success) {
      navigate(`/admin/${roomCode}`);
    } else {
      alert("No se pudo crear la sala. Inténtalo de nuevo.");
    }
  };

  return (
    <div className="container mt-5 mb-5 d-flex justify-content-center">
      <div className="card shadow p-5" style={{ maxWidth: "500px", width: "100%", borderRadius: "15px" }}>
        
        <Link to="/" className="btn btn-sm btn-outline-secondary mb-4" style={{ width: "fit-content" }}>
          &larr; Volver
        </Link>

        <h2 className="text-center mb-4 fw-bold text-primary">Configurar Sala</h2>

        <form onSubmit={handleSubmit}>
          {/* Nombre de la sala */}
          <div className="mb-4">
            <label htmlFor="roomName" className="form-label fw-semibold">Nombre de la sala</label>
            <input
              type="text"
              className="form-control form-control-lg"
              id="roomName"
              placeholder="Ej: Duelo de Titanes"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              required
              maxLength={30}
            />
          </div>

          {/* Máximo de jugadores */}
          <div className="mb-4">
            <label htmlFor="maxPlayers" className="form-label fw-semibold">
              Jugadores permitidos: <span className="text-primary fs-5">{maxPlayers}</span>
            </label>
            <input
              type="range"
              className="form-range"
              id="maxPlayers"
              min="2" max="10" step="1"
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
            />
          </div>

          {/* Rondas Totales */}
          <div className="mb-4">
            <label htmlFor="totalRounds" className="form-label fw-semibold">
              Rondas totales: <span className="text-primary fs-5">{totalRounds}</span>
            </label>
            <input
              type="range"
              className="form-range"
              id="totalRounds"
              min="1" max="15" step="1"
              value={totalRounds}
              onChange={(e) => setTotalRounds(parseInt(e.target.value))}
            />
          </div>

          {/* Juego Inicial */}
          <div className="mb-4">
            <label className="form-label fw-semibold d-block">Empezar partida con:</label>
            <div className="btn-group w-100" role="group">
              <input
                type="radio"
                className="btn-check"
                name="firstGame"
                id="startLetras"
                autoComplete="off"
                checked={firstGame === GameType.LETRAS}
                onChange={() => setFirstGame(GameType.LETRAS)}
              />
              <label className="btn btn-outline-primary py-2" htmlFor="startLetras">🔤 Letras</label>

              <input
                type="radio"
                className="btn-check"
                name="firstGame"
                id="startCifras"
                autoComplete="off"
                checked={firstGame === GameType.CIFRAS}
                onChange={() => setFirstGame(GameType.CIFRAS)}
              />
              <label className="btn btn-outline-primary py-2" htmlFor="startCifras">🔢 Cifras</label>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary btn-lg w-100 fw-bold py-3 shadow-sm"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
                <span role="status">Configurando...</span>
              </>
            ) : (
              "Crear Sala y Generar Código"
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateRoom;