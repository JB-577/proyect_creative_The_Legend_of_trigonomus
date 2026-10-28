/**
 * ============================================================================
 * THE LEGEND OF TRIGONOMUS - CONFIG.JS (FASE 2)
 * Especificación Técnica: "instrucciones juego PAP 2.0.txt"
 * ============================================================================
 */

(function (window) {
  'use strict';

  // 1. CONFIGURACIÓN GENERAL DEL JUEGO
  const GAME_CONFIG = {
    CANVAS_WIDTH: 960,
    CANVAS_HEIGHT: 540,
    INITIAL_LIVES: 3,             // Variable "lives" interna (3 vidas)
    INITIAL_TIME: 180,            // Variable "time" interna (3 minutos = 180s regresivos)
    TOTAL_LEVELS: 3,              // Variable "Progress" hasta alcanzar 3
    IMMUNITY_DURATION: 10,        // Inmunidad temporal en segundos (Sección 2.6 - 1.1)
    EXTRA_TIME_REWARD: 120,       // Recompensa de tiempo extra en segundos (Sección 2.6 - 1.3)
    EXTRA_LIFE_REWARD: 1,         // Recompensa de vida extra (Sección 2.6 - 1.2)
    TOAST_DURATION: 3000,         // Avisos temporales con duración de 3s (Sección 2.5)
    VICTORY_SCREEN_TIMEOUT: 60000,// Retorno automático de pantalla final tras 60s (Sección 5)
    LEVEL_LENGTH: 3500            // Longitud meta del nivel (~3500px, Sección 2.3.4)
  };

  // 2. CATÁLOGO GLOBAL DE RUTAS DE ARCHIVOS (ASSETS, Sección 6 exacta)
  const ASSETS = {
    // Obstáculos y Cuadro de Habilidades
    OBSTACULO_MOVIBLE: "proyect_creative_The_Legend_of_trigonomus/Mapas/Obstáculos/obstaculo_movible.png",
    OBSTACULO_FIJO:    "proyect_creative_The_Legend_of_trigonomus/Mapas/Obstáculos/obstaculo_del_mapa.png",
    CUADRO_HABILIDAD:  "proyect_creative_The_Legend_of_trigonomus/Mapas/Cuadro de habilidades/IMG_0672.png",

    // Fondos de Niveles
    BG_GRECIA:   "proyect_creative_The_Legend_of_trigonomus/Mapas/Nivel-Grecia/IMG_0659.JPG",
    BG_CIUDAD:   "proyect_creative_The_Legend_of_trigonomus/Mapas/Nivel-Ciudad/IMG_0664.JPG",
    BG_DESIERTO: "proyect_creative_The_Legend_of_trigonomus/Mapas/Nivel-Desierto/IMG_0670.JPG",

    // Música y Efectos de Sonido
    SFX_GAMEOVER:   "proyect_creative_The_Legend_of_trigonomus/Música/Sonido de game over/csy3tfy6v_NWM.mp3",
    BGM_CREDITOS:   "proyect_creative_The_Legend_of_trigonomus/Música/Creditos/ssstik.io.mp3",
    BGM_INICIO:     "proyect_creative_The_Legend_of_trigonomus/Música/Sonido de inicio de juego/slimeyfox-582346.mp3",
    SFX_VICTORIA:   "proyect_creative_The_Legend_of_trigonomus/Música/Sonido de victoria/ltz88bg8ju_NWM.mp3",
    SFX_INCORRECTO: "proyect_creative_The_Legend_of_trigonomus/Música/sonido respuesta incorrecta/feedback-incorrect-24_NWM.mp3",
    BGM_GRECIA:     "proyect_creative_The_Legend_of_trigonomus/Música/Soundtrack/arcade-beat.mp3",
    BGM_CIUDAD:     "proyect_creative_The_Legend_of_trigonomus/Música/Soundtrack/heart.mp3",
    BGM_DESIERTO:   "proyect_creative_The_Legend_of_trigonomus/Música/Soundtrack/8-bit-music.mp3",

    // Sprites de Personajes (Derecha e Izquierda)
    PITAGORAS_DER: "proyect_creative_The_Legend_of_trigonomus/Personajes/Pitágoras/Pitágoras-Cara Derecha.png",
    PITAGORAS_IZQ: "proyect_creative_The_Legend_of_trigonomus/Personajes/Pitágoras/Pitágoras-Cara Izquierda.png",
    HUGO_DER:      "proyect_creative_The_Legend_of_trigonomus/Personajes/Hugo polanco/Hugo polanco-Cara Derecha.png",
    HUGO_IZQ:      "proyect_creative_The_Legend_of_trigonomus/Personajes/Hugo polanco/Hugo polanco-Cara Izquierda.png",
    EINSTEIN_DER:  "proyect_creative_The_Legend_of_trigonomus/Personajes/Albert Einstein/Albert Einstein-Cara Derecha.png",
    EINSTEIN_IZQ:  "proyect_creative_The_Legend_of_trigonomus/Personajes/Albert Einstein/Albert Einstein-Cara Izquierda.png"
  };

  /**
   * Genera la ruta alternativa de fallback (removiendo el prefijo proyect_creative_The_Legend_of_trigonomus/)
   * y ajustando el casing de personajes si fuera necesario.
   */
  function getAssetFallbackPath(primaryPath) {
    if (!primaryPath) return '';
    let fallback = primaryPath.replace('proyect_creative_The_Legend_of_trigonomus/', '');
    return fallback;
  }

  // 3. PRECARGADOR DE IMÁGENES (AssetLoader)
  const AssetLoader = {
    images: {},
    totalAssets: 0,
    loadedAssets: 0,
    hasLoaded: false,

    // Conjunto de claves de imágenes a precargar
    imageKeys: [
      'OBSTACULO_MOVIBLE', 'OBSTACULO_FIJO', 'CUADRO_HABILIDAD',
      'BG_GRECIA', 'BG_CIUDAD', 'BG_DESIERTO',
      'PITAGORAS_DER', 'PITAGORAS_IZQ',
      'HUGO_DER', 'HUGO_IZQ',
      'EINSTEIN_DER', 'EINSTEIN_IZQ'
    ],

    /**
     * Precarga todas las imágenes y devuelve una Promesa cuando finalizan
     */
    loadAll(onProgress) {
      if (this.hasLoaded) {
        return Promise.resolve(this.images);
      }

      this.totalAssets = this.imageKeys.length;
      this.loadedAssets = 0;

      const promises = this.imageKeys.map((key) => {
        return new Promise((resolve) => {
          const img = new Image();
          const primaryPath = ASSETS[key];
          const fallbackPath = getAssetFallbackPath(primaryPath);

          let hasRetried = false;

          img.onload = () => {
            this.images[key] = img;
            this.loadedAssets++;
            if (typeof onProgress === 'function') {
              onProgress(this.loadedAssets, this.totalAssets, key);
            }
            resolve(img);
          };

          img.onerror = () => {
            if (!hasRetried && fallbackPath && fallbackPath !== primaryPath) {
              hasRetried = true;
              // Intenta la ruta fallback local (ej. sin proyect_creative_The_Legend_of_trigonomus/)
              img.src = fallbackPath;
            } else if (hasRetried && fallbackPath.includes('Personajes')) {
              // Prueba con minúscula 'personajes' por diferencias de sistema operativo
              img.src = fallbackPath.replace('Personajes', 'personajes');
            } else {
              console.warn(`[AssetLoader] No se pudo cargar imagen (${key}): ${primaryPath}`);
              this.images[key] = img; // Guarda el objeto para evitar caídas
              this.loadedAssets++;
              if (typeof onProgress === 'function') {
                onProgress(this.loadedAssets, this.totalAssets, key);
              }
              resolve(img);
            }
          };

          img.src = primaryPath;
        });
      });

      return Promise.all(promises).then(() => {
        this.hasLoaded = true;
        return this.images;
      });
    },

    /**
     * Retorna una imagen ya cargada por su clave
     */
    getImage(key) {
      return this.images[key] || null;
    }
  };

  // 4. CATÁLOGO DE PERSONAJES (CHARACTERS, Sección 2.1)
  const CHARACTERS = {
    Pitagoras: {
      id: "Pitagoras",
      name: "Pitágoras",
      coverImageKey: "PITAGORAS_DER",
      sprites: {
        right: ASSETS.PITAGORAS_DER,
        left: ASSETS.PITAGORAS_IZQ
      },
      imageKeys: {
        right: "PITAGORAS_DER",
        left: "PITAGORAS_IZQ"
      }
    },
    HugoPolanco: {
      id: "HugoPolanco",
      name: "Ing. Hugo Polanco",
      coverImageKey: "HUGO_DER",
      sprites: {
        right: ASSETS.HUGO_DER,
        left: ASSETS.HUGO_IZQ
      },
      imageKeys: {
        right: "HUGO_DER",
        left: "HUGO_IZQ"
      }
    },
    AlbertEinstein: {
      id: "AlbertEinstein",
      name: "Albert Einstein",
      coverImageKey: "EINSTEIN_DER",
      sprites: {
        right: ASSETS.EINSTEIN_DER,
        left: ASSETS.EINSTEIN_IZQ
      },
      imageKeys: {
        right: "EINSTEIN_DER",
        left: "EINSTEIN_IZQ"
      }
    }
  };

  /**
   * Obtiene el ID del personaje seleccionado actualmente desde el DOM o por defecto "Pitagoras"
   */
  function getSelectedCharacterId() {
    const selectedCard = document.querySelector('.character-card.selected');
    if (selectedCard) {
      return selectedCard.getAttribute('data-char-id') || "Pitagoras";
    }
    return "Pitagoras";
  }

  /**
   * Obtiene el objeto de configuración del personaje seleccionado
   */
  function getSelectedCharacter() {
    const id = getSelectedCharacterId();
    return CHARACTERS[id] || CHARACTERS.Pitagoras;
  }

  /**
   * Establece visual y lógicamente el personaje seleccionado
   */
  function setSelectedCharacter(charId) {
    if (!CHARACTERS[charId]) return;
    const cards = document.querySelectorAll('.character-card');
    cards.forEach((card) => {
      const match = card.getAttribute('data-char-id') === charId;
      card.classList.toggle('selected', match);
      card.setAttribute('aria-pressed', match ? 'true' : 'false');
      const tag = card.querySelector('.char-tag');
      if (tag) tag.textContent = match ? 'SELECCIONADO' : 'SELECCIONAR';
    });
  }

  // 5. BANCO DE PREGUNTAS (QUESTION_BANK, Sección 2.4)
  const QUESTION_BANK = {
    // 2.4.1 Grupo Geometría
    Geometria: [
      {
        id: "GEO_A",
        group: "Geometria",
        type: "text",
        question: "¿Cómo se llama el polígono regular que tiene exactamente 5 lados?",
        options: null,
        answer: "pentágono"
      },
      {
        id: "GEO_B",
        group: "Geometria",
        type: "text",
        question: "¿Cuál es el valor numérico en grados de un ángulo recto?",
        options: null,
        answer: "90"
      },
      {
        id: "GEO_C",
        group: "Geometria",
        type: "multiple",
        question: "¿Cuál es la fórmula para calcular el área de un círculo con radio \"r\"?",
        options: {
          A: "&pi; * r",
          B: "2 * &pi; * r",
          C: "&pi; * r&sup2;",
          D: "&pi; * d"
        },
        answer: "C"
      },
      {
        id: "GEO_D",
        group: "Geometria",
        type: "multiple",
        question: "En un triángulo rectángulo, ¿Cuál es la relación correcta entre la hipotenusa (c) y los catetos (a y b)?",
        options: {
          A: "c&sup2; = a&sup2; + b&sup2;",
          B: "c = a + b",
          C: "c&sup2; = a&sup2; - b&sup2;",
          D: "c = a * b"
        },
        answer: "A"
      }
    ],

    // 2.4.2 Grupo Trigonometría
    Trigonometria: [
      {
        id: "TRIG_A",
        group: "Trigonometria",
        type: "text",
        question: "¿Qué razón trigonométrica se obtiene al dividir el cateto opuesto sobre la hipotenusa?",
        options: null,
        answer: "seno"
      },
      {
        id: "TRIG_B",
        group: "Trigonometria",
        type: "text",
        question: "¿A cuántos grados sexagesimales equivale un ángulo de π radianes?",
        options: null,
        answer: "180"
      },
      {
        id: "TRIG_C",
        group: "Trigonometria",
        type: "multiple",
        question: "¿Cuál de las siguientes es la identidad trigonométrica fundamental (identidad pitagórica)?",
        options: {
          A: "sen&sup2;(x) + cos&sup2;(x) = 1",
          B: "sen(x) + cos(x) = 1",
          C: "sen&sup2;(x) - cos&sup2;(x) = 1",
          D: "tan(x) = cos(x) / sen(x)"
        },
        answer: "A"
      },
      {
        id: "TRIG_D",
        group: "Trigonometria",
        type: "multiple",
        question: "¿Cuál es el valor numérico exacto de la tangente de 45 grados (tan 45°)?",
        options: {
          A: "0",
          B: "1",
          C: "&infin;",
          D: "-1"
        },
        answer: "B"
      }
    ]
  };

  // 2.4.3 Grupo Ambos: Combinación de Geometría y Trigonometría
  QUESTION_BANK.Ambos = [...QUESTION_BANK.Geometria, ...QUESTION_BANK.Trigonometria];

  // 6. FUNCIÓN DE NORMALIZACIÓN DE RESPUESTAS (Sección 2.4.1)
  /**
   * Normaliza cadenas para comparación flexible (ignora mayúsculas, espacios extremos y acentos/tildes)
   * Ejemplo: "Pentágono" -> "pentagono", "  90 " -> "90"
   */
  function normalizeAnswer(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  /**
   * Compara la respuesta provista por el usuario con la solución del desafío
   */
  function checkAnswer(questionObj, userAnswer) {
    if (!questionObj || userAnswer === null || userAnswer === undefined) return false;
    const cleanUser = normalizeAnswer(userAnswer);
    const cleanCorrect = normalizeAnswer(questionObj.answer);
    return cleanUser === cleanCorrect;
  }

  // 7. SISTEMA ALEATORIO INTERNO (Randomizer, Sección 3)
  const Randomizer = {
    // Pools de preguntas activas por grupo para evitar repeticiones en la partida
    questionPools: {
      Geometria: [],
      Trigonometria: [],
      Ambos: []
    },

    /**
     * Algoritmo de barajado Fisher-Yates (genera una nueva permutación aleatoria)
     */
    shuffle(array) {
      const arr = [...array];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },

    /**
     * Baraja y retorna el orden de los 3 niveles para la partida sin repeticiones.
     * Ejemplo retornado: ['Grecia', 'Ciudad', 'Desierto'] o ['Desierto', 'Grecia', 'Ciudad']
     */
    shuffleLevels() {
      const baseLevels = ['Grecia', 'Ciudad', 'Desierto'];
      return this.shuffle(baseLevels);
    },

    /**
     * Obtiene una pregunta aleatoria sin repetición del grupo solicitado ('Geometria', 'Trigonometria', 'Ambos').
     * Si se agotan las preguntas del grupo, recarga y baraja de nuevo automáticamente.
     */
    getQuestion(groupName) {
      const groupKey = (groupName === 'Geometria' || groupName === 'Trigonometria' || groupName === 'Ambos')
        ? groupName
        : 'Ambos';

      if (!this.questionPools[groupKey] || this.questionPools[groupKey].length === 0) {
        this.questionPools[groupKey] = this.shuffle(QUESTION_BANK[groupKey]);
      }

      return this.questionPools[groupKey].pop();
    },

    /**
     * Reinicia todos los pools de preguntas activas
     */
    reset() {
      this.questionPools.Geometria = [];
      this.questionPools.Trigonometria = [];
      this.questionPools.Ambos = [];
    }
  };

  // Exportar todo al objeto global window.GAME_CONFIG
  window.GAME_CONFIG = Object.assign(window.GAME_CONFIG || {}, {
    CONSTANTS: GAME_CONFIG,
    ASSETS,
    getAssetFallbackPath,
    AssetLoader,
    CHARACTERS,
    getSelectedCharacterId,
    getSelectedCharacter,
    setSelectedCharacter,
    QUESTION_BANK,
    normalizeAnswer,
    checkAnswer,
    Randomizer
  });

})(window);
