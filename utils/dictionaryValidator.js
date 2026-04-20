/**
 * Verifica si una palabra existe usando el proxy interno de Vercel.
 */

const compararStrings = (str1, str2) => {
  return str1.localeCompare(str2, 'es', { sensitivity: 'base' }) === 0;
};

export const verificarPalabraRAE = async (palabra) => {
  if (!palabra || palabra.trim().length === 0) return false;
  
  const palabraLimpia = palabra.trim().toLowerCase();
  console.log(`Iniciando verificación para: "${palabraLimpia}"`);

  try {
    // 1. Intento principal con RAE (vía nuestro proxy)
    let response = await fetch(`/api/proxy?type=rae&word=${palabraLimpia}`);
    let data = await response.json();

    if (data.ok) {
      console.log(`✅ Válida en RAE:`, data.word);
      return true;
    }

    // 2. Fallback A: Sugerencias de la propia RAE
    if (data.suggestions && data.suggestions.length > 0) {
      console.log(`⚠️ Reintentando con sugerencia RAE: ${data.suggestions[0]}`);
      let sResp = await fetch(`/api/proxy?type=rae&word=${encodeURIComponent(data.suggestions[0])}`);
      let sData = await sResp.json();
      if (sData.ok) return true;
    }

    // 3. Fallback B: LanguageTool (vía nuestro proxy para evitar bloqueos)
    console.log(`🔍 Buscando corrección ortográfica para: "${palabraLimpia}"...`);
    const ltResponse = await fetch(`/api/proxy?type=lt&word=${palabraLimpia}`);
    const ltData = await ltResponse.json();

    if (ltData.matches && ltData.matches.length > 0) {
      const sugerencia = ltData.matches[0].replacements[0]?.value;
      
      if (sugerencia && compararStrings(palabraLimpia, sugerencia)) {
        console.log(`💡 Sugerencia LT: ${sugerencia}. Verificando en RAE...`);
        
        const finalResp = await fetch(`/api/proxy?type=rae&word=${encodeURIComponent(sugerencia)}`);
        const finalData = await finalResp.json();
        
        if (finalData.ok) {
          console.log(`✅ Válida tras corrección:`, finalData.word);
          return true;
        }
      }
    }

    console.log(`❌ La palabra "${palabraLimpia}" no existe.`);
    return false;

  } catch (error) {
    console.error(`🚨 Error en verificación:`, error);
    return false;
  }
};
