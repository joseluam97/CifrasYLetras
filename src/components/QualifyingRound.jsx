import { GameType } from '../../constants/gameStates';

const QualifyingRound = ({ resultadosRonda, juegoActual }) => {
    return (
        <div className="container-fluid text-center animate__animated animate__fadeIn px-2 h-100 d-flex flex-column justify-content-center overflow-hidden">
            
            <h2 className="text-warning fw-bold mb-3 mb-md-5" style={{ fontSize: "clamp(1.8rem, 5vw, 4rem)" }}>
                Clasificación Ronda {juegoActual.identifier}
            </h2>

            {resultadosRonda.length === 0 ? (
                <div className="spinner-border text-primary mx-auto" role="status" style={{ width: "4rem", height: "4rem" }}></div>
            ) : (
                // Añadido overflow-y-auto por si hay muchos jugadores y la pantalla no es muy alta
                <div className="list-group shadow-lg mx-auto w-100 flex-grow-1" style={{ maxWidth: "1100px", overflowY: "auto", maxHeight: "65vh" }}>
                    {resultadosRonda.map((res, index) => {
                        const esInvalida = juegoActual.type === GameType.LETRAS && res.reject_string === true;
                        const ganoPuntos = res.points_win > 0;

                        return (
                            // Flex-wrap permite que en pantallas muy pequeñas la información se apile
                            <div key={res.id} className={`list-group-item d-flex flex-wrap justify-content-between align-items-center py-3 py-md-4 px-3 px-md-5 gap-2 ${esInvalida ? 'bg-light' : ''}`}>

                                {/* Columna Izquierda: Posición y Nombre */}
                                <div className="d-flex align-items-center overflow-hidden" style={{ minWidth: "150px" }}>
                                    <span
                                        className={`fw-bold me-3 me-md-4 ${index === 0 && ganoPuntos ? 'text-warning' : 'text-secondary'}`}
                                        style={{ fontSize: "clamp(1.5rem, 3.5vw, 2.8rem)" }}
                                    >
                                        #{index + 1}
                                    </span>
                                    <span
                                        className="fw-bold text-dark text-truncate"
                                        style={{ fontSize: "clamp(1.5rem, 3.5vw, 2.8rem)" }}
                                    >
                                        {res.Player?.name}
                                    </span>
                                </div>

                                {/* Columna Derecha: Respuesta y Puntos */}
                                {/* Quitamos flex-shrink-0 y ajustamos para que ocupe el espacio restante sin romperse */}
                                <div className="d-flex flex-wrap justify-content-end align-items-center gap-2 gap-md-4 ms-auto">
                                    <span
                                        className={`badge ${esInvalida ? 'bg-danger text-decoration-line-through' : 'bg-secondary'} fw-normal text-truncate`}
                                        style={{ fontSize: "clamp(1.2rem, 2.5vw, 2.2rem)", maxWidth: "45vw" }}
                                    >
                                        {juegoActual.type === GameType.LETRAS
                                            ? `${res.result_string || '---'}`
                                            : `${res.result_numeric || '---'} (dif: ${Math.abs(res.result_numeric - juegoActual.result)})`
                                        }
                                    </span>

                                    <div className="text-end">
                                        <span
                                            className={`badge ${ganoPuntos ? 'bg-success' : 'bg-dark'} shadow-sm`}
                                            style={{ fontSize: "clamp(1.4rem, 3vw, 2.5rem)", padding: "0.4em 0.7em" }}
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