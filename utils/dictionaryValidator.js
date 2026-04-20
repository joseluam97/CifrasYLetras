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
  
  // Normalizamos la palabra para evitar espacios y mayúsculas
  const palabraLimpia = palabra.trim().toLowerCase();
  console.log(`Iniciando verificación para: "${palabraLimpia}"`);

  try {
    const proxy = "https://corsproxy.io/?";
    const urlBase = "https://rae-api.com/api/words/";

    // 1. Intento principal con la API de la RAE
    let response = await fetch(`${proxy}${urlBase}${palabraLimpia}`);
    let data = await response.json();

    if (data.ok) {
      console.log(`✅ Palabra válida encontrada en RAE:`, data.word);
      return true;
    }

    // 2. Fallback A: Sugerencias nativas de la API de la RAE
    if (!data.ok && data.suggestions && data.suggestions.length > 0) {
      console.log(`⚠️ No encontrada. Reintentando con sugerencia RAE: ${data.suggestions[0]}`);
      
      response = await fetch(`${proxy}${urlBase}${data.suggestions[0]}`);
      data = await response.json();
      
      if (data.ok) {
         console.log(`✅ Palabra válida encontrada vía sugerencia:`, data.word);
         return true;
      }
    }

    // 3. Fallback B: Si RAE no sugiere nada (null), usamos LanguageTool
    // ¡IMPORTANTE! Se llama DIRECTAMENTE, sin corsproxy, ya que LT soporta CORS.
    console.log(`🔍 Buscando alternativas con tilde en LanguageTool para: "${palabraLimpia}"...`);
    const ltResponse = await fetch(`https://api.languagetool.org/v2/check?text=${palabraLimpia}&language=es`);
    
    if (ltResponse.ok) {
      const ltData = await ltResponse.json();
      
      if (ltData.matches && ltData.matches.length > 0 && ltData.matches[0].replacements && ltData.matches[0].replacements.length > 0) {
        const palabraCorregida = ltData.matches[0].replacements[0].value;
        
        // Verificamos que la sugerencia sea la misma palabra (ignorando tildes)
        if (compararStrings(palabraLimpia, palabraCorregida)) {
          console.log(`💡 LanguageTool sugiere: ${palabraCorregida}. Comprobando en RAE...`);
          
          const finalResponse = await fetch(`${proxy}${urlBase}${palabraCorregida.toLowerCase()}`);
          const finalData = await finalResponse.json();

          if (finalData.ok) {
            console.log(`✅ Palabra válida encontrada (corregida con tilde):`, finalData.word);
            return true;
          }
        }
      }
    }

    // Si llegamos hasta aquí, la palabra definitivamente no existe o no tiene tildes válidas
    console.log(`❌ La palabra "${palabraLimpia}" no es válida.`);
    return false;

  } catch (error) {
    console.error(`🚨 Error crítico al validar la palabra "${palabra}":`, error);
    // Mantenemos la regla estricta: si hay error, devolvemos false
    return false;
  }
};
