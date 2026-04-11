import { useState, useEffect } from "react";
import { supabase } from "../../supabase";
import { GameState } from "../../constants/gameStates";

const PlayerLetrasScreen = ({ juego, jugador }) => {
  const [letrasDisponibles, setLetrasDisponibles] = useState([]);
  const [palabraActual, setPalabraActual] = useState([]);
  const [mejorPalabraEnviada, setMejorPalabraEnviada] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Inicializar letras cuando empieza el juego
  useEffect(() => {
    // Convertimos el array de strings en objetos con un ID único para evitar 
    // problemas si hay letras repetidas (ej. dos 'A')
    const letrasObj = juego.data.map((letra, index) => ({ id: index, char: letra }));
    setLetrasDisponibles(letrasObj);
    setPalabraActual([]);
  }, [juego.data]);

  const seleccionarLetra = (letraObj) => {
    setLetrasDisponibles(prev => prev.filter(l => l.id !== letraObj.id));
    setPalabraActual(prev => [...prev, letraObj]);
  };

  const quitarLetra = (letraObj) => {
    setPalabraActual(prev => prev.filter(l => l.id !== letraObj.id));
    setLetrasDisponibles(prev => [...prev, letraObj].sort((a, b) => a.id - b.id)); // Mantenemos el orden original
  };

  const enviarPalabra = async () => {
    const palabraString = palabraActual.map(l => l.char).join('');
    
    // Solo enviamos si es mejor que la anterior
    if (palabraString.length <= mejorPalabraEnviada.length) {
      alert("¡Ya has enviado una palabra de igual o mayor longitud!");
      return;
    }

    setEnviando(true);
    try {
      // Usamos el match para ver si este jugador ya envió algo en esta ronda
      const { data: registroPrevio } = await supabase
        .from('Result_Game')
        .select('id')
        .eq('game', juego.id)
        .eq('player', jugador.id)
        .single();

      if (registroPrevio) {
        // Actualizar
        await supabase.from('Result_Game').update({ result_string: palabraString }).eq('id', registroPrevio.id);
      } else {
        // Insertar nuevo
        await supabase.from('Result_Game').insert([{
          game: juego.id,
          player: jugador.id,
          result_string: palabraString,
          result_numeric: 0
        }]);
      }
      setMejorPalabraEnviada(palabraString);
      // Limpiamos el tablero para que pueda seguir buscando
      setLetrasDisponibles(juego.data.map((letra, index) => ({ id: index, char: letra })));
      setPalabraActual([]);
    } catch (error) {
      console.error("Error al enviar palabra:", error);
    } finally {
      setEnviando(false);
    }
  };

  if (juego.state === GameState.RESULT) {
    return <div className="text-center mt-5"><h3>¡Tiempo Finalizado!</h3><p>Tu mejor palabra enviada: <strong>{mejorPalabraEnviada || "Ninguna"}</strong></p></div>;
  }

  return (
    <div className="container mt-4 text-center">
      <h4 className="text-primary fw-bold mb-4">Forma la palabra más larga</h4>
      
      {/* Zona de la palabra formada */}
      <div className="card shadow-sm mb-4 p-3 border-primary" style={{ minHeight: "100px" }}>
        <h6 className="text-muted">Tu Palabra:</h6>
        <div className="d-flex justify-content-center flex-wrap gap-2">
          {palabraActual.map(letra => (
            <button key={letra.id} onClick={() => quitarLetra(letra)} className="btn btn-primary btn-lg fs-3 fw-bold p-3">
              {letra.char}
            </button>
          ))}
        </div>
      </div>

      {/* Letras disponibles */}
      <div className="mb-5">
        <h6 className="text-muted mb-3">Letras Disponibles:</h6>
        <div className="d-flex justify-content-center flex-wrap gap-2">
          {letrasDisponibles.map(letra => (
            <button key={letra.id} onClick={() => seleccionarLetra(letra)} className="btn btn-outline-secondary btn-lg fs-3 fw-bold p-3">
              {letra.char}
            </button>
          ))}
        </div>
      </div>

      {/* Botón de Enviar */}
      <button 
        onClick={enviarPalabra} 
        disabled={palabraActual.length < 3 || enviando}
        className="btn btn-success btn-lg w-100 py-3 fw-bold shadow-sm"
      >
        {enviando ? "Enviando..." : `Enviar Palabra (${palabraActual.length} letras)`}
      </button>

      {mejorPalabraEnviada && (
        <p className="text-success mt-3 fw-bold">Palabra asegurada: {mejorPalabraEnviada}</p>
      )}
    </div>
  );
};

export default PlayerLetrasScreen;