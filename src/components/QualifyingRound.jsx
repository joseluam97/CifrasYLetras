import { GameType } from '../../constants/gameStates';

const QualifyingRound = ({ resultadosRonda, juegoActual }) => {
    return (
        // Candado 3: h-100 y overflow-hidden. Se adapta 100% al hueco que le deja la TV.
        <div className="w-100 h-100 d-flex flex-column justify-content-center align-items-center text-center animate__animated animate__fadeIn px-2 py-3 overflow-hidden">
            
            <h2 className="text-warning fw-bold mb-3 flex-shrink-0" style={{ fontSize: "clamp(1.8rem, 5vw, 3.5rem)" }}>
                Clasificación Ronda {juegoActual.identifier}
            </h2>

            {resultadosRonda.length === 0 ? (
                <div className="spinner-border text-primary" role="status" style={{ width: "4rem", height: "4rem" }}></div>
            ) : (
                // La lista toma el espacio restante. SIN SCROLL (overflow-hidden)
                <div className="list-group shadow-lg w-100 flex-grow-1 overflow-hidden" style={{ maxWidth: "1100px" }}>
                    {resultadosRonda.map((res, index) => {
                        const esInvalida = juegoActual.type === GameType.LETRAS && res.reject_string === true;
                        const ganoPuntos = res.points_win > 0;

                        return (
                            // AJUSTE: py-2 py-md-3 en lugar de py-4. Hace las filas más compactas para que quepan más.
                            <div key={res.id} className={`list-group-item d-flex flex-wrap justify-content-between align-items-center py-2 py-md-3 px-3 px-md-4 gap-2 ${esInvalida ? 'bg-light' : ''}`}>

                                {/* Columna Izquierda */}
                                <div className="d-flex align-items-center overflow-hidden" style={{ minWidth: "120px" }}>
                                    <span
                                        className={`fw-bold me-3 ${index === 0 && ganoPuntos ? 'text-warning' : 'text-secondary'}`}
                                        style={{ fontSize: "clamp(1.2rem, 3vw, 2.2rem)" }}
                                    >
                                        #{index + 1}
                                    </span>
                                    <span
                                        className="fw-bold text-dark text-truncate"
                                        style={{ fontSize: "clamp(1.2rem, 3vw, 2.2rem)" }}
                                    >
                                        {res.Player?.name}
                                    </span>
                                </div>

                                {/* Columna Derecha */}
                                <div className="d-flex flex-wrap justify-content-end align-items-center gap-2 ms-auto">
                                    <span
                                        className={`badge ${esInvalida ? 'bg-danger text-decoration-line-through' : 'bg-secondary'} fw-normal text-truncate`}
                                        style={{ fontSize: "clamp(1rem, 2vw, 1.8rem)", maxWidth: "45vw" }}
                                    >
                                        {juegoActual.type === GameType.LETRAS
                                            ? `${res.result_string || '---'}`
                                            : `${res.result_numeric || '---'} (dif: ${Math.abs(res.result_numeric - juegoActual.result)})`
                                        }
                                    </span>

                                    <div className="text-end ms-2">
                                        <span
                                            className={`badge ${ganoPuntos ? 'bg-success' : 'bg-dark'} shadow-sm`}
                                            style={{ fontSize: "clamp(1.2rem, 2.5vw, 2rem)", padding: "0.4em 0.7em" }}
                                        >
                                            +{res.points_win || 0} pts
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default QualifyingRound;