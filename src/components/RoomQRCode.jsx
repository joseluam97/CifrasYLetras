import { QRCodeSVG } from 'qrcode.react';

const RoomQRCode = ({ code }) => {
  // Construimos la URL de unión. 
  // window.location.origin detectará si estás en localhost o en producción automáticamente.
  const joinUrl = `${window.location.origin}/join/${code}`;

  return (
    <div className="d-flex flex-column align-items-center bg-white p-4 rounded shadow-sm border mt-3">
      <div className="bg-white p-2 border rounded mb-2">
        <QRCodeSVG 
          value={joinUrl} 
          size={200}
          level={"H"} // Nivel de corrección de errores alto
          includeMargin={false}
          imageSettings={{
            // Opcional: Puedes poner un pequeño icono en el centro si quieres
            src: "/cyl.png",
            x: undefined,
            y: undefined,
            height: 30,
            width: 30,
            excavate: true,
          }}
        />
      </div>
      <p className="text-muted small mb-0 mt-2">Escanea para unirte rápido</p>
      <div className="badge bg-primary fs-6 mt-1">{code}</div>
    </div>
  );
};

export default RoomQRCode;