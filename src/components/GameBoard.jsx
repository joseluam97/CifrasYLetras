import { Link } from "react-router-dom";
import { useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import { useGameStore } from '../store/gameStore';
import { GameState, GameType, AppRole, RoomState } from '../../constants/gameStates';
import RoomQRCode from './RoomQRCode';

const GameBoard = ({ sala: salaProp, role }) => {
    const { procesarResultadosRonda, resetearPartida } = useGameStore();
    const [sala, setSala] = useState(salaProp);
    const [juegoActual, setJuegoActual] = useState(null);
    const [resultadosRonda, setResultadosRonda] = useState([]);
    const [loading, setLoading] = useState(false);
    const [tiempoRestante, setTiempoRestante] = useState(30);
    const [jugadoresConectados, setJugadoresConectados] = useState([]);

    // Sincronizar estado local con la prop inicial
    useEffect(() => {
        setSala(salaProp);
    }, [salaProp]);

    // --- 1. DATOS Y SUSCRIPCIONES ---
    useEffect(() => {
        if (!sala?.id) return;

        const fetchDatosIniciales = async () => {
            if (sala.current_rounds > 0) {
                const { data } = await supabase
                    .from('Games')
                    .select('*')
                    .eq('room', sala.id)
                    .eq('identifier', sala.current_rounds)
                    .single();
                if (data) setJuegoActual(data);
            }

            const { data: pData } = await supabase
                .from('Player')
                .select('*')
                .eq('room_join', sala.id)
                .order('points', { ascending: false });
            if (pData) setJugadoresConectados(pData);
        };

        fetchDatosIniciales();

        // SUSCRIPCIÓN A LA SALA (ROOM) - Faltaba esto para detectar FINISHED
        const channelRoom = supabase.channel(`room-realtime-${sala.id}`)
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'Room', filter: `id=eq.${sala.id}` },
                (payload) => {
                    console.log("Cambio en Room detectado:", payload.new);
                    setSala(payload.new);

                    if (payload.new.state === RoomState.CREATED || payload.new.current_rounds === 0) {
                        setJuegoActual(null);
                        setResultadosRonda([]);
                        setTiempoRestante(30);
                    }
                }
            ).subscribe();

        // SUSCRIPCIÓN A LOS JUEGOS
        const channelGames = supabase.channel(`games-realtime-${sala.id}`)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'Games', filter: `room=eq.${sala.id}` },
                (payload) => {
                    // Si el juego se borra (DELETE), limpiamos el estado
                    if (payload.eventType === 'DELETE') {
                        setJuegoActual(null);
                    } else {
                        setJuegoActual(payload.new);
                    }
                }
            ).subscribe();

        // SUSCRIPCIÓN A LOS JUGADORES
        const channelPlayers = supabase.channel(`players-realtime-${sala.id}`)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'Player', filter: `room_join=eq.${sala.id}` },
                async () => {
                    const { data } = await supabase.from('Player').select('*').eq('room_join', sala.id).order('points', { ascending: false });
                    setJugadoresConectados(data || []);
                }
            ).subscribe();

        return () => {
            supabase.removeChannel(channelRoom);
            supabase.removeChannel(channelGames);
            supabase.removeChannel(channelPlayers);
        };
        // IMPORTANTE: Escuchamos el ID para que si cambia la sala se reinicie la suscripción, 
        // pero no el objeto sala entero para evitar loops.
    }, [sala?.id]);

    // --- 2. LÓGICA DE ESTADOS DE SALA ---
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
        if (juegoActual?.state === GameState.PLAYING && tiempoRestante > 0) {
            timer = setInterval(() => {
                setTiempoRestante(prev => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        if (role === AppRole.TV) {
                            procesarResultadosRonda(juegoActual.id, juegoActual.type, juegoActual.result);
                        }
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        if (juegoActual?.state === GameState.CREATED) setTiempoRestante(30);
        return () => clearInterval(timer);
    }, [juegoActual?.state, role, procesarResultadosRonda, juegoActual?.id, juegoActual?.type, juegoActual?.result]);

    // --- 4. CARGA DE RESULTADOS --
    useEffect(() => {
        const cargarResultados = async () => {
            if (juegoActual?.state === GameState.END || juegoActual?.state === GameState.RESULT) {
                const orderByField = juegoActual.type === GameType.LETRAS ? 'result_string' : 'result_numeric';
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
    }, [juegoActual?.state, juegoActual?.id, juegoActual?.type]);

    // --- 5. FUNCIONES ADMIN ---
    const VOCALES = "AEIOU";
    const CONSONANTES = "BCDFGHJKLMNPQRSTVWXYZ";
    const NUMEROS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 25, 50, 75, 100];

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

        const nextRoundNumber = (sala.current_rounds || 0) + 1;
        const esRondaTipoInicial = nextRoundNumber % 2 !== 0;
        const tipoSiguiente = esRondaTipoInicial ? sala.first_game : (sala.first_game === GameType.LETRAS ? GameType.CIFRAS : GameType.LETRAS);

        let dataArray = [];
        let valorObjetivo = 0;

        if (tipoSiguiente === GameType.LETRAS) {
            const numVocales = Math.floor(Math.random() * 4) + 3;
            const numConsonantes = 10 - numVocales;
            for (let i = 0; i < numVocales; i++) dataArray.push(VOCALES[Math.floor(Math.random() * VOCALES.length)]);
            for (let i = 0; i < numConsonantes; i++) dataArray.push(CONSONANTES[Math.floor(Math.random() * CONSONANTES.length)]);
            dataArray.sort(() => Math.random() - 0.5);
        } else {
            for (let i = 0; i < 6; i++) dataArray.push(NUMEROS[Math.floor(Math.random() * NUMEROS.length)]);
            valorObjetivo = Math.floor(Math.random() * 900) + 100;
            dataArray = dataArray.map(String);
        }

        try {
            await supabase.from('Games').insert([{
                room: sala.id, identifier: nextRoundNumber, type: tipoSiguiente, data: dataArray, result: valorObjetivo, state: GameState.CREATED
            }]);

            await supabase.from('Room').update({
                current_rounds: nextRoundNumber,
                state: RoomState.PLAYING
            }).eq('id', sala.id);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const iniciarTiempo = async () => {
        if (!juegoActual) return;
        await supabase.from('Games').update({ state: GameState.PLAYING }).eq('id', juegoActual.id);
    };

    // --- VISTAS ---

    if (role === AppRole.ADMIN) {
        if (sala?.state === RoomState.FINISHED) {
            return (
                <div className="card shadow-sm p-4 text-center mt-4 border-success animate__animated animate__fadeIn">
                    <h2 className="text-success fw-bold mb-3">🏆 Partida Finalizada</h2>
                    <div className="d-grid gap-2 mt-4">
                        <button
                            className="btn btn-success btn-lg fw-bold py-3"
                            onClick={async () => {
                                if (window.confirm("Se borrarán los puntos y el historial. ¿Continuar?")) {
                                    await resetearPartida(sala.id);
                                }
                            }}
                            disabled={loading}
                        >
                            🔄 REINICIAR Y BORRAR DATOS
                        </button>
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
                        <button
                            className="btn btn-primary btn-lg py-3 w-100 fw-bold shadow"
                            onClick={generarSiguienteRonda}
                            disabled={loading || (esPrimeraRonda && jugadoresConectados.length === 0)}
                        >
                            {sala?.current_rounds >= sala?.total_rounds ? 'FINALIZAR PARTIDA' :
                                esPrimeraRonda ? '🚀 INICIAR JUEGO' : 'GENERAR SIGUIENTE RONDA'}
                        </button>
                    </div>
                ) : (
                    <div>
                        <div className="alert alert-info">Ronda {juegoActual.identifier} ({juegoActual.type})</div>
                        {juegoActual.state === GameState.CREATED && (
                            <button className="btn btn-success btn-lg py-3 w-100 fw-bold animate__animated animate__pulse animate__infinite" onClick={iniciarTiempo}>▶ Iniciar Tiempo</button>
                        )}
                        {juegoActual.state === GameState.PLAYING && <button className="btn btn-warning btn-lg py-3 w-100 fw-bold" disabled>⏳ Jugando...</button>}
                        {juegoActual.state === GameState.RESULT && <button className="btn btn-secondary btn-lg py-3 w-100 fw-bold" disabled>Calculando...</button>}
                    </div>
                )}
            </div>
        );
    }

    if (role === AppRole.TV) {
        if (sala?.state === RoomState.FINISHED) {
            return (
                <div className="container text-center mt-5 animate__animated animate__zoomIn">
                    <h1 className="display-2 fw-bold text-primary mb-5">🏆 PODIO FINAL</h1>
                    <div className="row justify-content-center">
                        {jugadoresConectados.map((jugador, index) => (
                            <div key={jugador.id} className={`col-md-8 mb-3 p-4 rounded-pill shadow d-flex justify-content-between align-items-center ${index === 0 ? 'bg-warning border border-4 border-white' : 'bg-white'}`}>
                                <span className="fs-2 fw-bold">#{index + 1} {jugador.name}</span>
                                <span className="fs-2 fw-bold">{jugador.points} pts</span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        if (!juegoActual) {
            return (
                <div className="container text-center mt-5 animate__animated animate__fadeIn">
                    <div className="row align-items-center justify-content-center">
                        <div className="col-md-7">
                            <h1 className="display-3 fw-bold mb-4">{esSalaLlena ? '¡Listos para empezar!' : '¡Únete a la partida!'}</h1>
                            <div className="bg-white shadow-sm rounded-pill p-4 d-inline-block border border-primary border-4 mb-4">
                                <span className="display-1 fw-bold text-primary" style={{ letterSpacing: "12px" }}>{sala?.code}</span>
                            </div>
                            <div className="mt-4">
                                <h4 className="text-secondary fw-bold mb-3">Jugadores ({jugadoresConectados.length}/{sala?.players}):</h4>
                                <div className="d-flex justify-content-center flex-wrap gap-2">
                                    {jugadoresConectados.map((j) => (
                                        <div key={j.id} className="bg-success text-white px-4 py-2 rounded-pill fw-bold animate__animated animate__bounceIn">👤 {j.name}</div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="col-md-5"><RoomQRCode code={sala?.code} /></div>
                    </div>
                </div>
            );
        }

        if (juegoActual.state === GameState.END) {
            return (
                <div className="text-center animate__animated animate__fadeIn">
                    <h2 className="text-warning fw-bold mb-2">Clasificación Ronda {juegoActual.identifier}</h2>
                    <div className="list-group shadow-sm mx-auto" style={{ maxWidth: "650px" }}>
                        {resultadosRonda.map((res, index) => {
                            const esInvalida = juegoActual.type === GameType.LETRAS && res.reject_string === true;
                            const ganoPuntos = res.points_win > 0;

                            return (
                                <div
                                    key={res.id}
                                    className={`list-group-item d-flex justify-content-between align-items-center py-3 ${esInvalida ? 'bg-light' : ''}`}
                                >
                                    {/* Nombre y Posición */}
                                    <div className="d-flex align-items-center">
                                        <span className={`fs-4 fw-bold me-3 ${index === 0 && ganoPuntos ? 'text-warning' : 'text-secondary'}`}>
                                            #{index + 1}
                                        </span>
                                        <span className="fs-4 fw-bold text-dark">
                                            {res.Player?.name}
                                        </span>
                                    </div>

                                    {/* Respuesta y Puntos Ganados */}
                                    <div className="d-flex align-items-center gap-3">
                                        <span className={`badge ${esInvalida ? 'bg-danger text-decoration-line-through' : 'bg-secondary'} fs-6 fw-normal`}>
                                            {juegoActual.type === GameType.LETRAS
                                                ? `${res.result_string || '---'}`
                                                : `${res.result_numeric || '---'} (dif: ${Math.abs(res.result_numeric - juegoActual.result)})`
                                            }
                                        </span>

                                        <div className="text-end" style={{ minWidth: "90px" }}>
                                            <span className={`badge ${ganoPuntos ? 'bg-success' : 'bg-dark'} fs-5 shadow-sm`}>
                                                +{res.points_win || 0} pts
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }

        return (
            <div className="w-100 d-flex flex-column align-items-center justify-content-center mt-4">
                <h3 className="text-uppercase fw-bold text-secondary mb-3">Ronda {juegoActual.identifier} / {sala?.total_rounds}</h3>
                <div className="mb-4 fw-bold text-primary" style={{ fontSize: "6rem" }}>⏱ {tiempoRestante}</div>
                {juegoActual.type === GameType.CIFRAS && (
                    <div className="mb-4 bg-dark text-white px-5 py-3 rounded-pill shadow">
                        <h2 className="m-0 fw-bold">OBJETIVO: <span className="text-warning">{juegoActual.result}</span></h2>
                    </div>
                )}
                <div className="d-flex flex-wrap justify-content-center gap-3 mb-5">
                    {juegoActual.data.map((item, index) => (
                        <div key={index} className="card shadow d-flex align-items-center justify-content-center fw-bold text-dark bg-white" style={{ width: "90px", height: "90px", fontSize: "3rem", border: "4px solid #0d6efd" }}>{item}</div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

export default GameBoard;