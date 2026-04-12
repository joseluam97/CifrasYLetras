import { useState, useEffect, useRef } from "react";
import { supabase } from "../../supabase";
import { GameState } from "../../constants/gameStates";

const PlayerCifrasScreen = ({ juego, jugador, tiempoRestante }) => {
  const [fichasDisponibles, setFichasDisponibles] = useState([]);

  const [operando1, setOperando1] = useState(null);
  const [operador, setOperador] = useState(null);
  const [operando2, setOperando2] = useState(null);

  const [mejorResultadoEnviado, setMejorResultadoEnviado] = useState(null);
  const [enviando, setEnviando] = useState(false);

  // Seguro para evitar que el auto-envío se dispare en bucle
  const autoEnvioRealizado = useRef(false);

  const objetivo = juego.result;

  const inicializarFichas = () => {
    const fichasIniciales = juego.data.map((numStr, index) => ({
      id: `base-${index}`,
      valor: parseInt(numStr, 10),
      esOriginal: true
    }));
    setFichasDisponibles(fichasIniciales);
    setOperando1(null);
    setOperador(null);
    setOperando2(null);
  };

  useEffect(() => {
    inicializarFichas();
    autoEnvioRealizado.current = false; // Reiniciamos el seguro en cada ronda
  }, [juego.data, juego.id]);

  // Lógica de la calculadora
  const clickFicha = (ficha) => {
    if (!operando1) {
      setOperando1(ficha);
      setFichasDisponibles(prev => prev.filter(f => f.id !== ficha.id));
    } else if (operando1 && operador && !operando2) {
      setOperando2(ficha);
      setFichasDisponibles(prev => prev.filter(f => f.id !== ficha.id));
    }
  };

  const clickOperador = (op) => {
    if (operando1 && !operando2) setOperador(op);
  };

  const devolverFicha = (tipo) => {
    if (tipo === 1 && operando1) {
      setFichasDisponibles(prev => [...prev, operando1]);
      setOperando1(null);
      setOperador(null);
    } else if (tipo === 2 && operando2) {
      setFichasDisponibles(prev => [...prev, operando2]);
      setOperando2(null);
    }
  };

  const calcular = () => {
    if (!operando1 || !operador || !operando2) return;

    const val1 = operando1.valor;
    const val2 = operando2.valor;
    let resultado = 0;

    switch (operador) {
      case "+": resultado = val1 + val2; break;
      case "-": resultado = val1 - val2; break;
      case "*": resultado = val1 * val2; break;
      case "/": resultado = val1 / val2; break;
      default: return;
    }

    // Validar divisiones exactas y sin negativos
    if (resultado <= 0 || !Number.isInteger(resultado)) {
      alert("Operación inválida. No se permiten decimales ni números negativos o cero.");
      setFichasDisponibles(prev => [...prev, operando1, operando2]);
      setOperando1(null);
      setOperador(null);
      setOperando2(null);
      return;
    }

    const nuevaFicha = {
      id: `calc-${Date.now()}`,
      valor: resultado,
      esOriginal: false
    };

    setFichasDisponibles(prev => [...prev, nuevaFicha]);
    setOperando1(null);
    setOperador(null);
    setOperando2(null);
  };

  // Función clave: Busca la mejor ficha actual en el panel del jugador
  const obtenerMejorCifraActual = () => {
    if (fichasDisponibles.length === 0) return 0;
    return fichasDisponibles.reduce((mejor, actual) => {
      const difMejor = Math.abs(mejor - objetivo);
      const difActual = Math.abs(actual.valor - objetivo);
      return difActual < difMejor ? actual.valor : mejor;
    }, fichasDisponibles[0].valor);
  };

  const mejorActual = obtenerMejorCifraActual();

  // Función que habla con Supabase
  const guardarEnBaseDeDatos = async (cifraAGuardar) => {
    try {
      const { data: registroPrevio } = await supabase
        .from('Result_Game')
        .select('id')
        .eq('game', juego.id)
        .eq('player', jugador.id)
        .single();

      if (registroPrevio) {
        await supabase.from('Result_Game').update({ result_numeric: cifraAGuardar }).eq('id', registroPrevio.id);
      } else {
        await supabase.from('Result_Game').insert([{
          game: juego.id,
          player: jugador.id,
          result_numeric: cifraAGuardar,
          result_string: ""
        }]);
      }
      setMejorResultadoEnviado(cifraAGuardar);
    } catch (error) {
      console.error("Error al guardar cifra:", error);
    }
  };

  // Envío manual
  const enviarResultado = async () => {
    if (mejorResultadoEnviado !== null) {
      const difAnterior = Math.abs(mejorResultadoEnviado - objetivo);
      const difNuevo = Math.abs(mejorActual - objetivo);

      if (difNuevo >= difAnterior) {
        alert("¡Ya has asegurado un número igual o más cercano al objetivo!");
        return;
      }
    }
    setEnviando(true);
    await guardarEnBaseDeDatos(mejorActual);
    setEnviando(false);
  };

  // ==========================================
  // ✨ AUTO-ENVÍO CUANDO EL TIEMPO SE ACABA
  // ==========================================
  useEffect(() => {
    if (juego.state === GameState.RESULT && !autoEnvioRealizado.current) {
      autoEnvioRealizado.current = true; // Evitamos que se ejecute dos veces

      const difActual = Math.abs(mejorActual - objetivo);
      const difEnviado = mejorResultadoEnviado !== null ? Math.abs(mejorResultadoEnviado - objetivo) : Infinity;

      // Si no ha enviado nada aún, o lo que tiene en su panel es MEJOR que lo que había asegurado antes
      if (difActual < difEnviado) {
        console.log(`⏳ ¡Tiempo! Auto-enviando mejor cifra: ${mejorActual}`);
        guardarEnBaseDeDatos(mejorActual);
      }
    }
  }, [juego.state, mejorActual, mejorResultadoEnviado, objetivo]);
  // ==========================================

  // --- Vistas ---
  if (juego.state === GameState.RESULT || juego.state === GameState.END) {
    return (
      <div className="container mt-5 text-center animate__animated animate__fadeIn">
        <h2 className="fw-bold text-danger">¡Tiempo Finalizado!</h2>
        <p className="fs-5 mt-3 text-muted">Tu número final contabilizado:</p>
        <div className="display-1 fw-bold text-primary">{mejorResultadoEnviado ?? mejorActual}</div>
      </div>
    );
  }

  return (
    <div className="container mt-4 text-center pb-5">

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="text-primary fw-bold m-0">Consigue la cifra mas cercana</h4>
        <div className={`badge fs-4 ${tiempoRestante <= 5 ? 'bg-danger animate__animated animate__pulse animate__infinite' : 'bg-dark'}`}>
          ⏱ {tiempoRestante}
        </div>
      </div>

      <div className="bg-dark text-white p-3 rounded shadow-sm mb-4">
        <h5 className="m-0 text-uppercase text-secondary" style={{ letterSpacing: "2px" }}>Objetivo</h5>
        <h1 className="m-0 fw-bold text-warning display-4">{objetivo}</h1>
      </div>

      <div className="card shadow-sm mb-4 border-primary bg-light">
        <div className="card-body d-flex justify-content-center align-items-center gap-2" style={{ minHeight: "100px" }}>
          <div
            className={`border rounded px-3 py-2 fs-3 fw-bold bg-white text-center d-flex align-items-center justify-content-center ${operando1 ? 'text-dark border-primary' : 'text-muted border-dashed'}`}
            style={{ minWidth: "80px", height: "70px", cursor: operando1 ? 'pointer' : 'default' }}
            onClick={() => devolverFicha(1)}
          >
            {operando1 ? operando1.valor : '_'}
          </div>

          <div className="fs-3 fw-bold text-primary px-2">{operador ? operador : ' '}</div>

          <div
            className={`border rounded px-3 py-2 fs-3 fw-bold bg-white text-center d-flex align-items-center justify-content-center ${operando2 ? 'text-dark border-primary' : 'text-muted border-dashed'}`}
            style={{ minWidth: "80px", height: "70px", cursor: operando2 ? 'pointer' : 'default' }}
            onClick={() => devolverFicha(2)}
          >
            {operando2 ? operando2.valor : '_'}
          </div>

          <button
            className="btn btn-primary btn-lg ms-3 fw-bold rounded-circle shadow-sm"
            style={{ width: "60px", height: "60px" }}
            onClick={calcular}
            disabled={!operando1 || !operador || !operando2}
          >
            =
          </button>
        </div>
      </div>

      <div className="d-flex justify-content-center gap-2 mb-4">
        {['+', '-', '*', '/'].map(op => (
          <button
            key={op}
            className="btn btn-warning btn-lg fw-bold fs-3 shadow-sm"
            style={{ width: "70px" }}
            onClick={() => clickOperador(op)}
            disabled={!operando1 || operando2}
          >
            {op}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <h6 className="text-muted text-start mb-2 fw-bold text-uppercase">Tus Números</h6>
        <div className="d-flex flex-wrap gap-2 justify-content-center bg-white p-3 rounded shadow-sm border">
          {fichasDisponibles.map(ficha => (
            <button
              key={ficha.id}
              onClick={() => clickFicha(ficha)}
              className={`btn px-3 py-2 fs-3 fw-bold shadow-sm ${ficha.esOriginal ? 'btn-outline-primary' : 'btn-success text-white'}`}
              style={{ minWidth: "80px" }}
            >
              {ficha.valor}
            </button>
          ))}
          {fichasDisponibles.length === 0 && (
            <span className="text-muted fst-italic">No te quedan números</span>
          )}
        </div>
      </div>

      <hr className="my-4 text-muted" />

      <div className="d-flex flex-column gap-3">
        <div className="d-flex justify-content-between align-items-center">
          <span className="text-muted">Mejor cifra actual: <strong className="fs-5 text-dark">{mejorActual}</strong></span>
          <button onClick={inicializarFichas} className="btn btn-outline-danger fw-bold">↻ Reiniciar Panel</button>
        </div>

        <button
          onClick={enviarResultado}
          disabled={enviando || fichasDisponibles.length === 0}
          className="btn btn-success btn-lg w-100 py-3 fw-bold shadow-sm d-flex justify-content-between align-items-center px-4"
        >
          <span>{enviando ? "Asegurando..." : "Asegurar resultado"}</span>
          <span className="badge bg-white text-success fs-5">{mejorActual}</span>
        </button>

        {mejorResultadoEnviado !== null && (
          <p className="text-success mt-2 fw-bold">✓ Has asegurado el número: {mejorResultadoEnviado}</p>
        )}
      </div>
    </div>
  );
};

export default PlayerCifrasScreen;