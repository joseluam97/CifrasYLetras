import { Link } from "react-router-dom";
import { useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import { useGameStore } from '../store/gameStore';
import { GameState, GameType, AppRole, RoomState } from '../../constants/gameStates';
import RoomQRCode from './RoomQRCode';
import QualifyingRound from './QualifyingRound.jsx';
import { TIME_PER_ROUND_LETTERS, TIME_PER_ROUND_NUMBERS } from '../../constants/gameStates';

const GameBoard = ({ sala: salaProp, role }) => {
    const { procesarResultadosRonda, resetearPartida, generateNextRound } = useGameStore();
    const [sala, setSala] = useState(salaProp);
    const [juegoActual, setJuegoActual] = useState(null);
    const [resultadosRonda, setResultadosRonda] = useState([]);
    const [loading, setLoading] = useState(false);
    const [tiempoRestante, setTiempoRestante] = useState(TIME_PER_ROUND_LETTERS);
    const [jugadoresConectados, setJugadoresConectados] = useState([]);

    useEffect(() => { setSala(salaProp); }, [salaProp]);

    // --- 1. DATOS Y SUSCRIPCIONES ---
    useEffect(() => {
        if (!sala?.id) return;

        const fetchDatosIniciales = async () => {
            if (sala.current_rounds > 0) {
                const { data } = await supabase.from('Games').select('*').eq('room', sala.id).eq('identifier', sala.current_rounds).single();
                if (data) setJuegoActual(data);
            }
            const { data: pData } = await supabase.from('Player').select('*').eq('room_join', sala.id).order('points', { ascending: false });
            if (pData) setJugadoresConectados(pData);
        };

        fetchDatosIniciales();

        const channelRoom = supabase.channel(`room-realtime-${sala.id}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'Room', filter: `id=eq.${sala.id}` }, (payload) => {
                setSala(payload.new);
                if (payload.new.state === RoomState.CREATED || payload.new.current_rounds === 0) {
                    setJuegoActual(null);
                    setResultadosRonda([]);
                    setTiempoRestante(30);
                }
            }).subscribe();

        const channelGames = supabase.channel(`games-realtime-${sala.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'Games', filter: `room=eq.${sala.id}` }, (payload) => {
                if (payload.eventType === 'DELETE') setJuegoActual(null);
                else setJuegoActual(payload.new);
            }).subscribe();

        const channelPlayers = supabase.channel(`players-realtime-${sala.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'Player', filter: `room_join=eq.${sala.id}` }, async () => {
                const { data } = await supabase.from('Player').select('*').eq('room_join', sala.id).order('points', { ascending: false });
                setJugadoresConectados(data || []);
            }).subscribe();

        return () => {
            supabase.removeChannel(channelRoom);
            supabase.removeChannel(channelGames);
            supabase.removeChannel(channelPlayers);
        };
    }, [sala?.id]);

    // --- 2. LÓGICA DE ESTADOS ---
    const esSalaLlena = jugadoresConectados.length >= (sala?.players || 0);
    const esPrimeraRonda = sala?.current_rounds === 0;

    useEffect(() => {
        if (!sala?.id || role !== AppRole.ADMIN) return;
        if (esSalaLlena && sala.state === RoomState.CREATED) {
            supabase.from('Room').update({ state: RoomState.COMPLETE }).eq('id', sala.id).then();
        }
        if (!esSalaLlena && sala.state === RoomState.COMPLETE) {
            supabase.from('Room').update({ state: RoomState.CREATED }).eq('id', sala.id).then();
        }
    }, [esSalaLlena, sala?.state, role, sala?.id]);

    // --- 3. CRONÓMETRO ---
    useEffect(() => {
        let timer;

        // 1. Cuando el juego se crea, fijamos el tiempo inicial según el tipo
        if (juegoActual?.state === GameState.CREATED) {
            const tiempoInicial = juegoActual.type === GameType.CIFRAS
                ? TIME_PER_ROUND_NUMBERS
                : TIME_PER_ROUND_LETTERS;
            setTiempoRestante(tiempoInicial);
        }

        // 2. Cuando el juego está en marcha, empezamos la cuenta atrás
        if (juegoActual?.state === GameState.PLAYING && tiempoRestante > 0) {
            timer = setInterval(() => {
                setTiempoRestante(prev => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        // Solo el rol de TV procesa el final para evitar llamadas duplicadas a la BD
                        if (role === AppRole.TV) {
                            procesarResultadosRonda(juegoActual.id, juegoActual.type, juegoActual.result);
                        }
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }

        return () => clearInterval(timer);
    }, [juegoActual?.state, juegoActual?.type, role, procesarResultadosRonda, juegoActual?.id, juegoActual?.result]);

    // --- 4. CARGA DE RESULTADOS ---
    useEffect(() => {
        const cargarResultados = async () => {
            if (juegoActual?.id && (juegoActual.state === GameState.END || juegoActual.state === GameState.RESULT)) {
                const { data } = await supabase.from('Result_Game').select('*, Player(name)').eq('game', juegoActual.id).order('points_win', { ascending: false });
                setResultadosRonda(data || []);
            } else {
                setResultadosRonda([]);
            }
        };
        cargarResultados();
    }, [juegoActual?.state, juegoActual?.id]);

    // --- 5. FUNCIONES ADMIN ---
    const generarSiguienteRonda = async () => {
        if (sala.current_rounds >= sala.total_rounds) {
            if (window.confirm("¿Deseas finalizar la partida?")) {
                setLoading(true);
                await supabase.from('Room').update({ state: RoomState.FINISHED }).eq('id', sala.id);
                setLoading(false);
            }
            return;
        }
        if (jugadoresConectados.length === 0) return;
        setLoading(true);
        generateNextRound(sala);
        setLoading(false);
    };

    const iniciarTiempo = async () => {
        if (!juegoActual) return;
        await supabase.from('Games').update({ state: GameState.PLAYING }).eq('id', juegoActual.id);
    };

    // ==========================================
    // VISTAS
    // ==========================================

    if (role === AppRole.ADMIN) {
        // ... (Mantenemos la vista ADMIN exactamente igual, no afecta a la TV)
        if (sala?.state === RoomState.FINISHED) {
            return (
                <div className="card shadow-sm p-4 text-center mt-4 border-success animate__animated animate__fadeIn">
                    <h2 className="text-success fw-bold mb-3">🏆 Partida Finalizada</h2>
                    <div className="d-grid gap-2 mt-4">
                        <button className="btn btn-success btn-lg fw-bold py-3" disabled={loading} onClick={async () => { if (window.confirm("Se borrarán los puntos y el historial. ¿Continuar?")) { await resetearPartida(sala.id); } }}>🔄 REINICIAR Y BORRAR DATOS</button>
                        <Link to="/" className="btn btn-outline-secondary">Salir al Menú Principal</Link>
                    </div>
                </div>
            );
        }

        return (
            <div className="card shadow-sm p-4 text-center mt-4 border-primary">
                <h4 className="fw-bold text-primary mb-4">Panel de Control</h4>
                {!juegoActual || juegoActual.state === GameState.END ? (
                    <div>
                        <p className="text-muted mb-4">Ronda: <strong>{sala?.current_rounds} de {sala?.total_rounds}</strong></p>
                        {esPrimeraRonda && (
                            <div className={`alert ${esSalaLlena ? 'alert-success' : 'alert-info'} py-2`}>
                                {esSalaLlena ? '✅ Sala Completa' : `⏳ Esperando jugadores (${jugadoresConectados.length}/${sala?.players})`}
                            </div>
                        )}
                        <button className="btn btn-primary btn-lg py-3 w-100 fw-bold shadow" onClick={generarSiguienteRonda} disabled={loading || (esPrimeraRonda && jugadoresConectados.length === 0)}>
                            {sala?.current_rounds >= sala?.total_rounds ? 'FINALIZAR PARTIDA' : esPrimeraRonda ? '🚀 INICIAR JUEGO' : 'GENERAR SIGUIENTE RONDA'}
                        </button>
                    </div>
                ) : (
                    <div>
                        <div className="alert alert-info">Ronda {juegoActual.identifier} ({juegoActual.type})</div>
                        {juegoActual.state === GameState.CREATED && <button className="btn btn-success btn-lg py-3 w-100 fw-bold animate__animated animate__pulse animate__infinite" onClick={iniciarTiempo}>▶ Iniciar Tiempo</button>}
                        {juegoActual.state === GameState.PLAYING && <button className="btn btn-warning btn-lg py-3 w-100 fw-bold" disabled>⏳ Jugando...</button>}
                        {juegoActual.state === GameState.RESULT && <button className="btn btn-secondary btn-lg py-3 w-100 fw-bold" disabled>Calculando...</button>}
                    </div>
                )}
            </div>
        );
    }

    if (role === AppRole.TV) {

        // PODIO FINAL
        if (sala?.state === RoomState.FINISHED) {
            return (
                // Añadimos d-flex flex-column align-items-center para centrar todo el bloque
                <div className="container-fluid text-center mt-3 mt-md-5 animate__animated animate__zoomIn px-2 d-flex flex-column align-items-center">
                    <h1 className="fw-bold text-primary mb-4" style={{ fontSize: "clamp(2.5rem, 6vw, 4rem)" }}>🏆 PODIO FINAL</h1>

                    {/* Cambiamos el 'row' por una columna flexible con gap (espacio) entre los elementos */}
                    <div className="w-100 d-flex flex-column align-items-center gap-3">
                        {jugadoresConectados.map((jugador, index) => (
                            <div
                                key={jugador.id}
                                // Quitamos los col-12 col-md-8 y ponemos w-100
                                className={`w-100 p-3 p-md-4 rounded-pill shadow-sm d-flex justify-content-between align-items-center ${index === 0 ? 'bg-warning border border-4 border-white' : 'bg-white'}`}
                                // Fijamos un ancho máximo para que la píldora no mida 2 metros en una TV gigante
                                style={{ maxWidth: "800px" }}
                            >
                                <span className="fs-3 fs-md-2 fw-bold text-truncate" style={{ maxWidth: "60%" }}>
                                    #{index + 1} {jugador.name}
                                </span>
                                <span className="fs-3 fs-md-2 fw-bold text-end">
                                    {jugador.points} pts
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        // LOBBY (PANTALLA DE UNIÓN Y QR)
        if (!juegoActual) {
            return (
                // h-100 para que ocupe todo el flex-grow del padre
                <div className="container-fluid text-center animate__animated animate__fadeIn px-2 h-100 d-flex flex-column justify-content-center">
                    <div className="row align-items-center justify-content-center mx-0 w-100">

                        <div className="col-12 col-md-7 d-flex flex-column align-items-center mb-3 mb-md-0">
                            {/* Texto reducido */}
                            <h2 className="fw-bold mb-2 mb-md-3" style={{ fontSize: "clamp(1.8rem, 4vw, 3.5rem)" }}>
                                {esSalaLlena ? '¡Listos para empezar!' : '¡Únete a la partida!'}
                            </h2>

                            {/* Píldora del código más fina y con menos padding */}
                            <div className="bg-white shadow-sm rounded-pill p-2 p-md-3 border border-primary border-3 mb-3 w-100" style={{ maxWidth: "400px" }}>
                                <span className="fw-bold text-primary d-block text-center w-100 lh-1" style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)", letterSpacing: "clamp(4px, 2vw, 10px)" }}>
                                    {sala?.code}
                                </span>
                            </div>

                            {/* Jugadores */}
                            <div>
                                <h6 className="text-secondary fw-bold mb-2">Jugadores ({jugadoresConectados.length}/{sala?.players}):</h6>
                                <div className="d-flex justify-content-center flex-wrap gap-2" style={{ maxHeight: "15vh", overflowY: "auto" }}>
                                    {jugadoresConectados.map((j) => (
                                        <div key={j.id} className="bg-success text-white px-3 py-1 rounded-pill fw-bold animate__animated animate__bounceIn" style={{ fontSize: "0.9rem" }}>
                                            👤 {j.name}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* QR Code contenedor más ajustado */}
                        <div className="col-8 col-md-4 mx-auto mt-2 mt-md-0" style={{ maxWidth: "280px" }}>
                            <div className="bg-white p-2 rounded shadow-sm">
                                <RoomQRCode code={sala?.code} />
                            </div>
                        </div>

                    </div>
                </div>
            );
        }

        // CLASIFICACIÓN DE RONDA
        if (juegoActual.state === GameState.END) {
            return (
                <QualifyingRound
                    resultadosRonda={resultadosRonda}
                    juegoActual={juegoActual}
                />
            );
        }

        // TABLERO DE JUEGO ACTIVO
        return (
            <div className="w-100 d-flex flex-column align-items-center justify-content-center mt-2 mt-md-4 px-2">
                <h4 className="text-uppercase fw-bold text-secondary mb-2 mb-md-3" style={{ fontSize: "clamp(1.2rem, 3vw, 1.75rem)" }}>Ronda {juegoActual.identifier} / {sala?.total_rounds}</h4>

                {/* Reloj Dinámico */}
                <div className="mb-2 mb-md-4 fw-bold text-primary lh-1" style={{ fontSize: "clamp(4rem, 12vw, 7rem)" }}>
                    ⏱ {tiempoRestante}
                </div>

                {juegoActual.type === GameType.CIFRAS && (
                    <div className="mb-3 mb-md-4 bg-dark text-white px-4 py-2 px-md-5 py-md-3 rounded-pill shadow d-inline-block">
                        <h2 className="m-0 fw-bold" style={{ fontSize: "clamp(1.5rem, 4vw, 2.5rem)" }}>
                            OBJETIVO: <span className="text-warning">{juegoActual.result}</span>
                        </h2>
                    </div>
                )}

                {/* Fichas Responsivas */}
                <div className="d-flex flex-wrap justify-content-center gap-2 gap-md-3 mb-3 mb-md-5">
                    {juegoActual.data.map((item, index) => (
                        <div
                            key={index}
                            className="card shadow d-flex align-items-center justify-content-center fw-bold text-dark bg-white"
                            style={{
                                width: "clamp(50px, 12vw, 90px)",   // Se encoge si la pantalla es estrecha
                                height: "clamp(50px, 12vw, 90px)",
                                fontSize: "clamp(1.5rem, 5vw, 3rem)", // El texto se encoge proporcionalmente
                                border: "clamp(2px, 0.5vw, 4px) solid #0d6efd"
                            }}
                        >
                            {item}
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

export default GameBoard;