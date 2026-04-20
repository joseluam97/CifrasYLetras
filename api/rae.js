// api/rae.js
export default async function handler(req, res) {
  // Obtenemos la palabra de la URL (ej: /api/rae?word=liceo)
  const { word } = req.query;

  if (!word) {
    return res.status(400).json({ error: 'Falta la palabra' });
  }

  try {
    // El servidor de Vercel llama a la RAE DIRECTAMENTE. ¡Aquí no existe el CORS!
    const response = await fetch(`https://rae-api.com/api/words/${word}`);
    const data = await response.json();

    // Devolvemos la respuesta de la RAE a tu web
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
