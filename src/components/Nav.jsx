import { Link } from "react-router-dom";
// Mantenemos tu logo si quieres usarlo, o puedes usar texto.
// import logo from "../assets/imgs/logo.png";

const Nav = () => {
  return (
    <nav className="navbar navbar-expand-lg bg-body-tertiary mb-5 custom-navbar fixed-top w-100 shadow-sm">
      <div className="container-fluid d-flex justify-content-between align-items-center">
        
        {/* Link principal para volver al Inicio (Home) */}
        <Link className="navbar-brand fw-bold text-primary fs-3" to="/">
          {/* Si quieres usar la imagen, descomenta esto y borra el texto de abajo */}
          {/* <img src={logo} alt="Cifras y Letras" style={{ width: "100px" }} /> */}
          🔢 Cifras y Letras
        </Link>

        {/* Zona derecha: Por ahora vacía, ideal para el futuro */}
        <div className="d-flex align-items-center">
           {/* Ejemplo de lo que pondremos aquí más adelante cuando leamos el estado:
               <span className="badge bg-secondary fs-6">Sala: K9X2</span> 
           */}
        </div>

      </div>
    </nav>
  );
};

export default Nav;