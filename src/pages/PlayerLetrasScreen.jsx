import { useState, useEffect } from "react";
import { supabase } from "../../supabase";
import { GameState } from "../../constants/gameStates";

const PlayerLetrasScreen = ({ juego, jugador }) => {
  // Ahora manejamos un solo array de objetos para las letras de la base
  const [letrasSource, setLetrasSource] = useState([]);
  const [palabraActual, setPalabraActual] = useState([]);
  const [mejorPalabraEnviada, setMejorPalabraEnviada] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Inicializar letras cuando empieza el juego
  useEffect(() => {
    const letrasObj = juego.data.map((letra, index) => ({ 
      id: index, 
      char: letra,
      usada: false // Nueva propiedad para controlar el bloqueo
    }));
    setLetrasSource(letrasObj);
    setPalabraActual([]);
  }, [juego.data]);

  const seleccionarLetra = (letraObj) => {
    if (letraObj.usada) return;

    // Marcamos la letra como usada en el panel inferior
    setLetrasSource(prev => prev.map(l => 
      l.id === letraObj.id ? { ...l, usada: true } : l
    ));
    
    // La añadimos a la palabra de arriba
    setPalabraActual(prev => [...prev, letraObj]);
  };

  const quitarLetra = (letraObj) => {
    // La quitamos de la palabra de arriba
    setPalabraActual(prev => prev.filter(l => l.id !== letraObj.id));
    
    // La desbloqueamos en el panel inferior
    setLetrasSource(prev => prev.map(l => 
      l.id === letraObj.id ? { ...l, usada: false } : l
    ));
  };

  const enviarPalabra = async () => {
    const palabraString = palabraActual.map(l => l.char).join('');
    
    if (palabraString.length <= mejorPalabraEnviada.length - 1) {
      alert("¡Ya has enviado una palabra de mayor longitud!");
      return;
    }

    setEnviando(true);
    try {
      const { data: registroPrevio } = await supabase
        .from('Result_Game')
        .select('id')
        .eq('game', juego.id)
        .eq('player', jugador.id)
        .single();

      if (registroPrevio) {
        await supabase.from('Result_Game').update({ result_string: palabraString }).eq('id', registroPrevio.id);
      } else {
        await supabase.from('Result_Game').insert([{
          game: juego.id,
          player: jugador.id,
          result_string: palabraString,
          result_numeric: 0
        }]);
      }
      setMejorPalabraEnviada(palabraString);
      
      // Resetear el tablero: todas las letras vuelven a estar disponibles (usada: false)
      setLetrasSource(prev => prev.map(l => ({ ...l, usada: false })));
      setPalabraActual([]);
    } catch (error) {
      console.error("Error al enviar palabra:", error);
    } finally {
      setEnviando(false);
    }
  };

  if (juego.state === GameState.RESULT) {
    return (
      <div className="text-center mt-5">
        <h3>¡Tiempo Finalizado!</h3>
        <p>Tu mejor palabra enviada: <strong>{mejorPalabraEnviada || "Ninguna"}</strong></p>
      </div>
    );
  }

  return (
    <div className="container mt-4 text-center">
      <h4 className="text-primary fw-bold mb-4">Forma la palabra más larga</h4>
      
      {/* Zona de la palabra formada */}
      <div className="card shadow-sm mb-4 p-3 border-primary" style={{ minHeight: "100px" }}>
        <h6 className="text-muted">Tu Palabra:</h6>
        <div className="d-flex justify-content-center flex-wrap gap-2">
          {palabraActual.map(letra => (
            <button 
              key={`selected-${letra.id}`} 
              onClick={() => quitarLetra(letra)} 
              className="btn btn-primary btn-lg fs-3 fw-bold p-3 animate__animated animate__bounceIn"
            >
              {letra.char}
            </button>
          ))}
        </div>
      </div>

      {/* Letras disponibles (Estáticas, no se mueven) */}
      <div className="mb-5">
        <h6 className="text-muted mb-3">Letras Disponibles:</h6>
        <div className="d-flex justify-content-center flex-wrap gap-2">
          {letrasSource.map(letra => (
            <button 
              key={`source-${letra.id}`} 
              onClick={() => seleccionarLetra(letra)} 
              disabled={letra.usada}
              className={`btn btn-lg fs-3 fw-bold p-3 transition-all ${
                letra.usada 
                ? "btn-light text-muted opacity-25" 
                : "btn-outline-secondary shadow-sm"
              }`}
              style={{ width: "60px", minHeight: "70px" }}
            >
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
        <p className="text-success mt-3 fw-bold animate__animated animate__fadeIn">
           ✅ Palabra asegurada: {mejorPalabraEnviada}
        </p>
      )}
    </div>
  );
};

export default PlayerLetrasScreen;