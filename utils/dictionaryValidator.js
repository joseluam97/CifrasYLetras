/**
 * Verifica si una palabra existe en un diccionario español.
 * Retorna true si es válida, false si no existe o hay error.
 */
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
    
    // Si es 404, la palabra no fue encontrada
    return false;
  } catch (error) {
    console.error(`Error al validar la palabra ${palabra}:`, error);
    // En caso de que la API falle (ej. sin internet), puedes decidir si 
    // devolver false (estricto) o true (permisivo). Lo dejamos estricto.
    return false;
  }
};

export const verificarPalabra = async (palabraUsuario) => {
  const RAE_URL = "https://corsproxy.io/?https://rae-api.com/api/words/";
  const LT_URL = "https://corsproxy.io/?https://api.languagetool.org/v2/check";

  let palabraLimpia = palabraUsuario.toLowerCase();

  // 1. Intentar búsqueda directa en la RAE
  try {
    let response = await fetch(`${RAE_URL}${palabraUsuario}`);
    let data = await response.json();

    // Si la palabra existe tal cual (con tilde o sin ella si no la lleva)
    if (data.ok !== false && !data.error) {
      return data;
    }

    // 2. Si falla, pedimos ayuda a LanguageTool para que nos dé la tilde
    const ltRes = await fetch(`${LT_URL}?text=${palabraUsuario}&language=es`);
    const ltData = await ltRes.json();

    // Si hay sugerencias de corrección
    if (ltData.matches && ltData.matches.length > 0) {
      // Tomamos la primera sugerencia (ej: "vía")
      const palabraCorregida = ltData.matches[0].replacements[0].value;
      
      // 3. Volvemos a intentar en la RAE con la palabra que tiene tilde
      console.log(`Corrigiendo ${palabraUsuario} a ${palabraCorregida}...`);
      const finalRes = await fetch(`${RAE_URL}${palabraCorregida}`);
      return await finalRes.json();
    }

    return { error: "NOT_FOUND", ok: false };
  } catch (error) {
    console.error("Error de conexión:", error);
    return null;
  }
}

// MODO DE USO EN TU JUEGO:
// const resultado = await validarEnRAE("via"); 
// console.log(resultado); // Ahora devolverá los datos de "vía"