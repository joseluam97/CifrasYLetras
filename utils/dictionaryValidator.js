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
    const response = await fetch(`/api/proxy?type=rae&word=${palabraLimpia}`);
    const data = await response.json(); 

    if (data.ok) {
      console.log(`✅ Válida en RAE:`, data.data.word);
      return true;
    }
    if (data.error) {
      console.log(`❌ Error RAE: ${data.error}`);
    }

    // 2. Fallback A: Sugerencias de la propia RAE
    if (data.suggestions && data.suggestions.length > 0) {
      console.log(`⚠️ Reintentando con sugerencia RAE: ${data.suggestions[0]}`);
      const sResp = await fetch(`/api/proxy?type=rae&word=${encodeURIComponent(data.suggestions[0])}`);
      const sData = await sResp.json();

      if (sData.ok && compararStrings(palabraLimpia, data.suggestions[0])) {
        console.log(`✅ Válida tras sugerencia RAE:`, sData.data.word);
        return true;
      } else {
        console.log(`❌ La sugerencia RAE "${data.suggestions[0]}" no es válida.`);
      }
    }

    // 3. Fallback B: LanguageTool
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
          console.log(`✅ Válida tras corrección:`, finalData.data.word);
          return true;
        }
      } else {
        console.log(`❌ La sugerencia LT "${sugerencia}" no coincide.`);
      }
    }

    console.log(`❌ La palabra "${palabraLimpia}" no existe.`);
    return false;

  } catch (error) {
    console.error(`🚨 Error en verificación:`, error);
    return false;
  }
};