import { create } from 'zustand';
import { supabase } from '../../supabase.js'; // Asegúrate de que la ruta a supabase.js es correcta
import { persist, createJSONStorage } from 'zustand/middleware';
import { verificarPalabra } from '../../utils/dictionaryValidator';
import { RoomState } from '../../constants/gameStates';

export const useGameStore = create(
    persist(
        (set, get) => ({
            // --- ESTADOS ---
            codigoSalaActual: null,
            jugadorActual: null,
            isLoading: false,
            error: null,

            // --- ACCIONES NUEVAS ---
            // Esta función es crucial ahora que guardamos en caché. 
            // Permitirá al jugador salir voluntariamente y borrar sus datos locales.
            salirPartida: () => {
                set({ codigoSalaActual: null, jugadorActual: null });
            },

            // Acción: Crear la sala en Supabase
            crearPartida: async (nombreSala, maxJugadores, codigoGenerado, totalRounds, firstGame) => {
                set({ isLoading: true, error: null });

                try {
                    const { data, error } = await supabase
                        .from('Room')
                        .insert([
                            {
                                name: nombreSala,
                                code: codigoGenerado,
                                players: maxJugadores,
                                total_rounds: totalRounds,   // Nueva columna
                                first_game: firstGame,       // Nueva columna (LETRA o CIFRA)
                                current_rounds: 0,           // Empezamos en la ronda 0
                                state: RoomState.CREATED           // Estado inicial de la sala
                            }
                        ])
                        .select();

                    if (error) throw error;

                    // Guardamos el código en el store persistente (gracias al middleware persist)
                    set({
                        codigoSalaActual: codigoGenerado,
                        isLoading: false
                    });

                    return { success: true, data };

                } catch (error) {
                    console.error("Error en el store al crear partida:", error);
                    set({ error: error.message, isLoading: false });
                    return { success: false, error: error.message };
                }
            },

            unirsePartida: async (nombreJugador, codigoSala) => {
                set({ isLoading: true, error: null });

                try {
                    // 1. Buscamos la sala por su código de 4 caracteres
                    // NOTA: Asegúrate de que el nombre de la tabla de salas es "Room" en tu BD
                    const { data: roomData, error: roomError } = await supabase
                        .from('Room')
                        .select('id')
                        .eq('code', codigoSala.toUpperCase()) // Buscamos por el código
                        .single(); // Solo queremos un resultado

                    if (roomError || !roomData) {
                        throw new Error("No hemos encontrado ninguna sala con ese código.");
                    }

                    // 2. Insertamos el jugador con el ID de la sala que acabamos de encontrar
                    const { data: playerData, error: playerError } = await supabase
                        .from('Player')
                        .insert([
                            {
                                name: nombreJugador,
                                room_join: roomData.id,
                                points: 0,
                                rounds: 0
                            }
                        ])
                        .select()
                        .single();

                    if (playerError) throw playerError;

                    // 3. Guardamos los datos en el store para usarlos en la pantalla del móvil
                    set({
                        codigoSalaActual: codigoSala.toUpperCase(),
                        jugadorActual: playerData,
                        isLoading: false
                    });

                    return { success: true };

                } catch (error) {
                    console.error("Error al unirse:", error);
                    set({ error: error.message, isLoading: false });
                    return { success: false, error: error.message };
                }
            },

            procesarResultadosRonda: async (gameId, tipoJuego, valorObjetivo) => {
                set({ isLoading: true });
                try {
                    // 1. Bloqueamos envíos
                    await supabase.from('Games').update({ state: 'RESULT' }).eq('id', gameId);

                    // Tiempo de cortesía para peticiones latentes
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // 2. Traemos todas las respuestas
                    const { data: respuestas, error } = await supabase
                        .from('Result_Game')
                        .select('*, Player(id, name, points)')
                        .eq('game', gameId);

                    if (error) throw error;

                    if (!respuestas || respuestas.length === 0) {
                        await supabase.from('Games').update({ state: 'END' }).eq('id', gameId);
                        set({ isLoading: false });
                        return { success: true, message: "Sin respuestas" };
                    }

                    let ganadores = [];
                    let puntosOtorgados = 0;
                    let idsRechazados = [];

                    // ==========================================
                    // LÓGICA PARA LETRAS
                    // ==========================================
                    if (tipoJuego === 'LETRAS') {
                        let respuestasValidas = [];

                        for (const resp of respuestas) {
                            const isValid = await verificarPalabra(resp.result_string);
                            if (isValid) {
                                respuestasValidas.push(resp);
                            } else {
                                idsRechazados.push(resp.id);
                            }
                        }

                        if (respuestasValidas.length > 0) {
                            const maxLongitud = Math.max(...respuestasValidas.map(r => r.result_string.length));
                            ganadores = respuestasValidas.filter(r => r.result_string.length === maxLongitud);
                            puntosOtorgados = maxLongitud;
                        }
                    }
                    // ==========================================
                    // LÓGICA PARA CIFRAS
                    // ==========================================
                    else {
                        const conDiferencia = respuestas.map(r => ({
                            ...r,
                            diferencia: Math.abs(r.result_numeric - valorObjetivo)
                        }));

                        const minimaDiferencia = Math.min(...conDiferencia.map(r => r.diferencia));
                        ganadores = conDiferencia.filter(r => r.diferencia === minimaDiferencia);
                        puntosOtorgados = (minimaDiferencia === 0) ? 10 : 5;
                    }

                    // ==========================================
                    // ACTUALIZACIÓN DE PUNTOS (PUNTOS GANADOS Y TOTALES)
                    // ==========================================

                    // A. Marcamos los rechazados (letras inventadas)
                    if (idsRechazados.length > 0) {
                        await supabase.from('Result_Game')
                            .update({ reject_string: true, points_win: 0 })
                            .in('id', idsRechazados);
                    }

                    // B. Actualizar TODOS los registros de esta ronda a 0 puntos por defecto 
                    // (Evita que queden como null si alguien no ganó nada)
                    await supabase.from('Result_Game')
                        .update({ points_win: 0 })
                        .eq('game', gameId)
                        .is('reject_string', null); // Solo los que no han sido marcados como rechazados aún

                    if (ganadores.length > 0) {
                        const idsGanadores = ganadores.map(g => g.id);

                        // 1. Actualizar points_win en Result_Game para los afortunados
                        await supabase.from('Result_Game')
                            .update({ points_win: puntosOtorgados })
                            .in('id', idsGanadores);

                        // 2. Sumar puntos al total de cada jugador en la tabla Player
                        for (const ganador of ganadores) {
                            const { error: pError } = await supabase
                                .from('Player')
                                .update({ points: (ganador.Player.points || 0) + puntosOtorgados })
                                .eq('id', ganador.player);

                            if (pError) console.error("Error al actualizar puntos de:", ganador.Player.name, pError);
                        }
                    }

                    // 3. Finalizar ronda definitivamente
                    await supabase.from('Games').update({ state: 'END' }).eq('id', gameId);

                    set({ isLoading: false });

                    return {
                        success: true,
                        ganadores: ganadores.map(g => g.Player.name).join(', ') || 'Ninguno',
                        puntos: puntosOtorgados
                    };

                } catch (err) {
                    console.error("Error procesando resultados:", err);
                    set({ isLoading: false });
                    return { success: false, error: err.message };
                }
            },
            resetearPartida: async (roomId) => {
                set({ isLoading: true });
                try {
                    // 1. Borrar todas las respuestas de los jugadores vinculadas a los juegos de esta sala
                    // Buscamos los IDs de los juegos de esta sala para borrar sus resultados
                    const { data: juegos } = await supabase
                        .from('Games')
                        .select('id')
                        .eq('room', roomId);

                    if (juegos && juegos.length > 0) {
                        const idsJuegos = juegos.map(j => j.id);
                        await supabase
                            .from('Result_Game')
                            .delete()
                            .in('game', idsJuegos);
                    }

                    // 2. Borrar todos los juegos de la sala
                    await supabase
                        .from('Games')
                        .delete()
                        .eq('room', roomId);

                    // 3. Reiniciar la sala: current_rounds a 0 y estado a CREATED
                    // Mantenemos el 'name', 'code', 'players', 'total_rounds' y 'first_game'
                    const { error } = await supabase
                        .from('Room')
                        .update({
                            current_rounds: 0,
                            state: 'CREATED'
                        })
                        .eq('id', roomId);

                    if (error) throw error;

                    // 3. Reiniciar la sala: current_rounds a 0 y estado a CREATED
                    // Mantenemos el 'name', 'code', 'players', 'total_rounds' y 'first_game'
                    const { errorUpdateUser } = await supabase
                        .from('Player')
                        .update({
                            points: 0,
                        })
                        .eq('room_join', roomId);

                    if (errorUpdateUser) throw error;

                    set({ isLoading: false });
                    return { success: true };

                } catch (err) {
                    console.error("Error al resetear partida:", err);
                    set({ isLoading: false });
                    return { success: false, error: err.message };
                }
            }
        }),
        {
            // --- CONFIGURACIÓN DE PERSISTENCIA ---
            name: 'cifras-letras-storage', // El nombre de la "caja" en la caché del navegador

            // Usamos sessionStorage: Los datos sobreviven a recargas de página (F5), 
            // pero se borran si el usuario cierra la pestaña por completo. 
            // Es ideal para juegos de este tipo.
            storage: createJSONStorage(() => sessionStorage),

            // Opcional: Solo guardamos estos campos. No nos interesa guardar el "isLoading" o "error"
            partialize: (state) => ({
                codigoSalaActual: state.codigoSalaActual,
                jugadorActual: state.jugadorActual
            }),
        }
    )
);