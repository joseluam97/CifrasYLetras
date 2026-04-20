/**
 * Verifica si una palabra existe en un diccionario español.
 * Retorna true si es válida, false si no existe o hay error.
 */

const compararStrings = (str1, str2) => {
  // sensitivity: 'base' ignora diferencias de mayúsculas/minúsculas y acentos
  return str1.localeCompare(str2, 'es', { sensitivity: 'base' }) === 0;
};

export const verificarPalabraRAE = async (palabra) => {
  
      console.log("verificarPalabraRAE: ", palabra);
  
  if (!palabra || palabra.trim().length === 0) return false;

  try {
    const proxy = "https://corsproxy.io/?";
    const urlBase = "https://rae-api.com/api/words/";
    
    // Usamos una API gratuita de diccionario en español
    let response = await fetch(`${proxy}${urlBase}${palabra}`);
    
      console.log("URL: ", `${proxy}${urlBase}${palabra}`);
    //const response = await fetch(`https://corsproxy.io/?https://rae-api.com/api/words/${palabra.toLowerCase()}`);

    let data = await response.json();
    
    console.log(`Verificando la palabra "${palabra}"... Respuesta:`, data);
    // Si la respuesta es OK (200), la palabra existe
    
    if (!data.ok && data.suggestions && data.suggestions.length > 0) {
      console.log(`No encontrada. Reintentando con sugerencia: ${data.suggestions[0]}`);
      
      // Segunda llamada con la primera sugerencia
      response = await fetch(`${proxy}${urlBase}${data.suggestions[0]}`);
      data = await response.json();
    }

    if (data.ok) {
      console.log("Palabra válida encontrada:", data.word);
      return data;
    } else {
      throw new Error("Palabra no encontrada incluso en sugerencias");
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
