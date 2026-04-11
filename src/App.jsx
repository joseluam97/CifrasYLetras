import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Nav from "./components/Nav.jsx";
import Footer from "./components/Footer.jsx";
import CreateRoom from "./pages/CreateRoom.jsx";

import AdminScreen from "./pages/AdminScreen.jsx"; 
import JoinRoom from "./pages/JoinRoom.jsx";
import TvScreen from "./pages/TvScreen.jsx";
import PlayerScreen from "./pages/PlayerScreen.jsx";

// Este es tu nuevo Home (puedes sacarlo a un archivo Home.jsx en el futuro si crece mucho)
const Home = () => {
  return (
    <div className="container mt-5 mb-5 d-flex flex-column align-items-center justify-content-center" style={{ minHeight: "60vh" }}>
      
      <div className="mt-5 d-flex flex-column gap-4 w-100" style={{ maxWidth: "400px" }}>
        <Link to="/crear-sala" className="btn btn-primary btn-lg py-3 fw-bold fs-4 shadow-sm">
          Crear Sala
        </Link>
        <Link to="/join" className="btn btn-outline-primary btn-lg py-3 fw-bold fs-4 shadow-sm">
          Unirse a Sala Existente
        </Link>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      {/* El Nav se mostrará en todas las pantallas. Quizás quieras ocultarlo en la vista de la Tele luego */}
      {/* <Nav /> */}

      <Routes>
        {/* Ruta principal: El menú que acabamos de diseñar */}
        <Route path="/" element={<Home />} />
        
        {/* Ruta del Administrador */}
        <Route path="/crear-sala" element={<CreateRoom />} />
        <Route path="/join" element={<JoinRoom />} />
        <Route path="/join/:roomCodeUrl" element={<JoinRoom />} />
        
        {/* Rutas futuras (comentadas por ahora para que no de error) */}
        <Route path="/admin/:roomCode" element={<AdminScreen />} />
        <Route path="/player/:roomCode" element={<PlayerScreen />} />
        <Route path="/tv/:roomCode" element={<TvScreen />} />
      </Routes>

      {/* El Footer también se mostrará en todas las pantallas */}
      {/* <Footer /> */}
    </BrowserRouter>
  );
};

export default App;
