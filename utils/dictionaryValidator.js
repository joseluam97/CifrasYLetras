/**
 * Verifica si una palabra existe en un diccionario español.
 * Retorna true si es válida, false si no existe o hay error.
 */

const compararStrings = (str1, str2) => {
  // sensitivity: 'base' ignora diferencias de mayúsculas/minúsculas y acentos
  return str1.localeCompare(str2, 'es', { sensitivity: 'base' }) === 0;
};

export const verificarPalabraRAE = async (palabra) => {
  if (!palabra || palabra.trim().length === 0) return false;

  try {
    // Usamos una API gratuita de diccionario en español
    const response = await fetch(`https://corsproxy.io/?https://rae-api.com/api/words/${palabra.toLowerCase()}`);

    console.log(`Verificando la palabra "${palabra}"... Respuesta:`, response);
    // Si la respuesta es OK (200), la palabra existe
    if (response.ok) {
      return true;
    }

    // Sino comprobar el 0 de la alternativa con tilde (ej: "via" -> "vía")
    const ltResponse = await fetch(`https://corsproxy.io/?https://api.languagetool.org/v2/check?text=${palabra}&language=es`);
    const ltData = await ltResponse.json();
    if (ltData.matches && ltData.matches.length > 0 && ltData.matches[0].replacements && ltData.matches[0].replacements.length > 0) {
      const palabraCorregida = ltData.matches[0].replacements[0].value;
      if (compararStrings(palabra, palabraCorregida)) {
        console.log(`Corrigiendo ${palabra} a ${palabraCorregida}...`);
        const finalResponse = await fetch(`https://corsproxy.io/?https://rae-api.com/api/words/${palabraCorregida.toLowerCase()}`);

        if (finalResponse.ok) {
          return true;
        }
      }
    }

    // Si es 404, la palabra no fue encontrada
    return false;
  } catch (error) {
    console.error(`Error al validar la palabra ${palabra}:`, error);
    // En caso de que la API falle (ej. sin internet), puedes decidir si 
    // devolver false (estricto) o true (permisivo). Lo dejamos estricto.
    return false;
  }
}