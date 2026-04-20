// api/proxy.js
export default async function handler(req, res) {
  const { word, type } = req.query;

  if (!word) return res.status(400).json({ error: 'Falta la palabra' });

  try {
    let url;
    if (type === 'rae') {
      url = `https://rae-api.com/api/words/${encodeURIComponent(word)}`;
    } else if (type === 'lt') {
      url = `https://api.languagetool.org/v2/check?text=${encodeURIComponent(word)}&language=es`;
    } else {
      return res.status(400).json({ error: 'Tipo de consulta no válido' });
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Vercel Serverless)'
      }
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error("Error en el proxy serverless:", error);
    return res.status(500).json({ error: 'Error al conectar con el servicio externo' });
  }
}
