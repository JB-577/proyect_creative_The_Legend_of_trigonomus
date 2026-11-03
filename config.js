/* =================================================================
   config.js — Configuración global del juego
   Rutas de archivos, personajes, banco de preguntas,
   normalización de respuestas y sistema aleatorio interno.
   ================================================================= */

'use strict';

/* ─────────────────────────────────────────────────────────────────
   1. RUTAS DE ARCHIVOS (ASSETS — Sección 6)
   20 rutas exactas de "instrucciones juego PAP 2.0.txt" § 6.
   (Se elimina el prefijo "proyect_creative_The_Legend_of_trigonomus/"
    porque index.html ya vive en esa carpeta.)
   ───────────────────────────────────────────────────────────────── */
const ASSETS = {

    /* ── Mapas / Obstáculos ── */
    obstaculoMovible  : 'Mapas/Obstáculos/obstaculo_movible.png',
    obstaculoFijo     : 'Mapas/Obstáculos/obstaculo_del_mapa.png',

    /* ── Mapas / Cuadro de habilidades ── */
    cuadroHabilidad   : 'Mapas/Cuadro de habilidades/IMG_0672.png',

    /* ── Mapas / Fondos de nivel ── */
    fondoGrecia       : 'Mapas/Nivel-Grecia/IMG_0659.JPG',
    fondoCiudad       : 'Mapas/Nivel-Ciudad/IMG_0664.JPG',
    fondoDesierto     : 'Mapas/Nivel-Desierto/IMG_0670.JPG',

    /* ── Música ── */
    musicGameover     : 'Música/Sonido de game over/csy3tfy6v_NWM.mp3',
    musicCreditos     : 'Música/Creditos/ssstik.io.mp3',
    musicInicio       : 'Música/Sonido de inicio de juego/slimeyfox-582346.mp3',
    musicVictoria     : 'Música/Sonido de victoria/ltz88bg8ju_NWM.mp3',
    sfxIncorrecta     : 'Música/sonido respuesta incorrecta/feedback-incorrect-24_NWM.mp3',
    musicGrecia       : 'Música/Soundtrack/arcade-beat.mp3',
    musicCiudad       : 'Música/Soundtrack/heart.mp3',
    musicDesierto     : 'Música/Soundtrack/8-bit-music.mp3',

    /* ── Personajes ── */
    pitagorasRight    : 'personajes/Pitágoras/Pitágoras-Cara Derecha.png',
    pitagorasLeft     : 'personajes/Pitágoras/Pitágoras-Cara Izquierda.png',
    hugoRight         : 'personajes/Hugo polanco/Hugo polanco-Cara Derecha.png',
    hugoLeft          : 'personajes/Hugo polanco/Hugo polanco-Cara Izquierda.png',
    einsteinRight     : 'personajes/Albert Einstein/Albert Einstein-Cara Derecha.png',
    einsteinLeft      : 'personajes/Albert Einstein/Albert Einstein-Cara Izquierda.png'
};


/* ─────────────────────────────────────────────────────────────────
   2. PRECARGADOR DE IMÁGENES (AssetLoader)
   Carga todas las imágenes en objetos Image listos para canvas.
   ───────────────────────────────────────────────────────────────── */

/** Claves de ASSETS que apuntan a imágenes (no audio). */
const IMAGE_ASSET_KEYS = [
    'obstaculoMovible', 'obstaculoFijo', 'cuadroHabilidad',
    'fondoGrecia',      'fondoCiudad',   'fondoDesierto',
    'pitagorasRight',   'pitagorasLeft',
    'hugoRight',        'hugoLeft',
    'einsteinRight',    'einsteinLeft'
];

const AssetLoader = {

    /** Almacén de objetos Image ya cargados: { clave: HTMLImageElement } */
    images: {},

    /**
     * Carga una sola imagen y la almacena en this.images[key].
     * @param {string} key  - Clave de ASSETS.
     * @param {string} src  - Ruta relativa del archivo.
     * @returns {Promise<HTMLImageElement>}
     */
    loadImage(key, src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload  = () => { this.images[key] = img; resolve(img); };
            img.onerror = ()  => reject(new Error(`No se pudo cargar: ${src}`));
            img.src = src;
        });
    },

    /**
     * Carga todas las imágenes de IMAGE_ASSET_KEYS en paralelo.
     * @returns {Promise<Object>} — this.images con todas las refs listas.
     */
    loadAll() {
        const promises = IMAGE_ASSET_KEYS.map(key =>
            this.loadImage(key, ASSETS[key])
        );
        return Promise.all(promises).then(() => this.images);
    },

    /**
     * Obtiene un Image ya cargado por su clave.
     * @param {string} key
     * @returns {HTMLImageElement|undefined}
     */
    get(key) {
        return this.images[key];
    }
};


/* ─────────────────────────────────────────────────────────────────
   3. CATÁLOGO DE PERSONAJES (CHARACTERS — Sección 2.1)
   Las claves coinciden con data-character del HTML.
   ───────────────────────────────────────────────────────────────── */
const CHARACTERS = {
    pitagoras: {
        name     : 'Pitágoras',
        rightImg : 'pitagorasRight',   // clave en ASSETS / AssetLoader
        leftImg  : 'pitagorasLeft'
    },
    hugo: {
        name     : 'Ing. Hugo Polanco',
        rightImg : 'hugoRight',
        leftImg  : 'hugoLeft'
    },
    einstein: {
        name     : 'Albert Einstein',
        rightImg : 'einsteinRight',
        leftImg  : 'einsteinLeft'
    }
};


/* ─────────────────────────────────────────────────────────────────
   4. BANCO DE PREGUNTAS (QUESTION_BANK — Sección 2.4)
   Cada pregunta es un objeto pareja:
     { id, type: 'text'|'multiple', question, options, answer }
   Las opciones usan entidades HTML (&sup2;, &pi;, &deg;, &infin;)
   para renderizarse con innerHTML en el modal.
   ───────────────────────────────────────────────────────────────── */
const QUESTION_BANK = {

    /* ── 2.4.1 Grupo Geometría ── */
    Geometria: [
        {
            id       : 'geo-a',
            type     : 'text',
            question : '¿Cómo se llama el polígono regular que tiene exactamente 5 lados?',
            options  : null,
            answer   : 'pentágono'
        },
        {
            id       : 'geo-b',
            type     : 'text',
            question : '¿Cuál es el valor numérico en grados de un ángulo recto?',
            options  : null,
            answer   : '90'
        },
        {
            id       : 'geo-c',
            type     : 'multiple',
            question : '¿Cuál es la fórmula para calcular el área de un círculo con radio "r"?',
            options  : {
                A : '(A) &pi; * r',
                B : '(B) 2 * &pi; * r',
                C : '(C) &pi; * r&sup2;',
                D : '(D) &pi; * d'
            },
            answer   : 'C'
        },
        {
            id       : 'geo-d',
            type     : 'multiple',
            question : 'En un triángulo rectángulo, ¿Cuál es la relación correcta entre la hipotenusa (c) y los catetos (a y b)?',
            options  : {
                A : '(A) c&sup2; = a&sup2; + b&sup2;',
                B : '(B) c = a + b',
                C : '(C) c&sup2; = a&sup2; - b&sup2;',
                D : '(D) c = a * b'
            },
            answer   : 'A'
        },
        {
            id       : 'geo-e',
            type     : 'text',
            question : '¿Cuántos lados tiene un hexágono regular?',
            options  : null,
            answer   : '6'
        },
        {
            id       : 'geo-f',
            type     : 'text',
            question : '¿Cuánto suman los ángulos interiores de cualquier triángulo en grados?',
            options  : null,
            answer   : '180'
        },
        {
            id       : 'geo-g',
            type     : 'multiple',
            question : '¿Cómo se llama el triángulo que tiene sus tres lados de igual longitud?',
            options  : {
                A : '(A) Escaleno',
                B : '(B) Isósceles',
                C : '(C) Equilátero',
                D : '(D) Rectángulo'
            },
            answer   : 'C'
        },
        {
            id       : 'geo-h',
            type     : 'multiple',
            question : '¿Cuál es la fórmula del perímetro de un cuadrado de lado "L"?',
            options  : {
                A : '(A) L&sup2;',
                B : '(B) 4 * L',
                C : '(C) 2 * L',
                D : '(D) L / 4'
            },
            answer   : 'B'
        },
        {
            id       : 'geo-i',
            type     : 'text',
            question : '¿Cuál es el valor numérico en grados de un ángulo llano?',
            options  : null,
            answer   : '180'
        },
        {
            id       : 'geo-j',
            type     : 'multiple',
            question : '¿Qué segmento une el centro de un círculo con cualquier punto de su circunferencia?',
            options  : {
                A : '(A) Cuerda',
                B : '(B) Arco',
                C : '(C) Tangente',
                D : '(D) Radio'
            },
            answer   : 'D'
        },
        {
            id       : 'geo-k',
            type     : 'text',
            question : '¿Cuántas caras cuadradas tiene un cubo (hexaedro regular)?',
            options  : null,
            answer   : '6'
        },
        {
            id       : 'geo-l',
            type     : 'multiple',
            question : '¿Cuál es la fórmula para calcular el área de un triángulo de base "b" y altura "h"?',
            options  : {
                A : '(A) (b * h) / 2',
                B : '(B) b * h',
                C : '(C) 2 * b * h',
                D : '(D) b + h'
            },
            answer   : 'A'
        }
    ],

    /* ── 2.4.2 Grupo Trigonometría ── */
    Trigonometria: [
        {
            id       : 'trig-a',
            type     : 'text',
            question : '¿Qué razón trigonométrica se obtiene al dividir el cateto opuesto sobre la hipotenusa?',
            options  : null,
            answer   : 'seno'
        },
        {
            id       : 'trig-b',
            type     : 'text',
            question : '¿A cuántos grados sexagesimales equivale un ángulo de π radianes?',
            options  : null,
            answer   : '180'
        },
        {
            id       : 'trig-c',
            type     : 'multiple',
            question : '¿Cuál de las siguientes es la identidad trigonométrica fundamental (identidad pitagórica)?',
            options  : {
                A : '(A) sen&sup2;(x) + cos&sup2;(x) = 1',
                B : '(B) sen(x) + cos(x) = 1',
                C : '(C) sen&sup2;(x) - cos&sup2;(x) = 1',
                D : '(D) tan(x) = cos(x) / sen(x)'
            },
            answer   : 'A'
        },
        {
            id       : 'trig-d',
            type     : 'multiple',
            question : '¿Cuál es el valor numérico exacto de la tangente de 45 grados (tan 45°;)?',
            options  : {
                A : '(A) 0',
                B : '(B) 1',
                C : '(C) 5;',
                D : '(D) -1'
            },
            answer   : 'B'
        },
        {
            id       : 'trig-e',
            type     : 'text',
            question : '¿Qué razón trigonométrica se obtiene al dividir el cateto adyacente sobre la hipotenusa?',
            options  : null,
            answer   : 'coseno'
        },
        {
            id       : 'trig-f',
            type     : 'text',
            question : '¿Cuál es el valor numérico exacto del seno de 90 grados (sen 90°)?',
            options  : null,
            answer   : '1'
        },
        {
            id       : 'trig-g',
            type     : 'multiple',
            question : '¿Qué razón trigonométrica equivale a dividir el cateto opuesto entre el cateto adyacente?',
            options  : {
                A : '(A) Seno',
                B : '(B) Coseno',
                C : '(C) Tangente',
                D : '(D) Secante'
            },
            answer   : 'C'
        },
        {
            id       : 'trig-h',
            type     : 'multiple',
            question : '¿Cuál es la razón trigonométrica recíproca de la función seno?',
            options  : {
                A : '(A) Secante',
                B : '(B) Cosecante',
                C : '(C) Cotangente',
                D : '(D) Coseno'
            },
            answer   : 'B'
        },
        {
            id       : 'trig-i',
            type     : 'text',
            question : '¿Cuál es el valor numérico exacto del coseno de 0 grados (cos 0°)?',
            options  : null,
            answer   : '1'
        },
        {
            id       : 'trig-j',
            type     : 'multiple',
            question : '¿A cuántos radianes equivale un giro completo de 360°?',
            options  : {
                A : '(A) &pi; / 2',
                B : '(B) &pi;',
                C : '(C) 2 * &pi;',
                D : '(D) 4 * &pi;'
            },
            answer   : 'C'
        },
        {
            id       : 'trig-k',
            type     : 'text',
            question : '¿A cuántos grados sexagesimales equivale un ángulo recto de π/2 radianes?',
            options  : null,
            answer   : '90'
        },
        {
            id       : 'trig-l',
            type     : 'multiple',
            question : '¿Cuál es el valor numérico exacto del seno de 30° (sen 30°)?',
            options  : {
                A : '(A) 0.5',
                B : '(B) 1',
                C : '(C) 0',
                D : '(D) 2'
            },
            answer   : 'A'
        }
    ],

    /* ── 2.4.3 Grupo Ambos (combinación Geometría + Trigonometría) ── */
    Ambos: []   // se rellena abajo
};

// Sección 2.4.3: la unión de ambos grupos
QUESTION_BANK.Ambos = [
    ...QUESTION_BANK.Geometria,
    ...QUESTION_BANK.Trigonometria
];


/* ─────────────────────────────────────────────────────────────────
   5. NORMALIZACIÓN DE RESPUESTAS (Sección 2.4.1 nota al dev)
   Convierte a minúsculas, elimina espacios y remueve tildes
   para comparar respuestas de texto libre de forma tolerante.
   ───────────────────────────────────────────────────────────────── */

/**
 * Normaliza una cadena para comparación de respuestas.
 *   normalizeAnswer("Pentágono")  → "pentagono"
 *   normalizeAnswer("pentágono")  → "pentagono"
 *   normalizeAnswer("  90 ")      → "90"
 *
 * @param {string} str
 * @returns {string}
 */
function normalizeAnswer(str) {
    return str
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Compara la respuesta del usuario con la respuesta correcta.
 * Para tipo 'text' normaliza ambas; para 'multiple' compara la letra.
 *
 * @param {Object}  questionObj  - Objeto pregunta del QUESTION_BANK.
 * @param {string}  userAnswer   - Respuesta ingresada por el jugador.
 * @returns {boolean}
 */
function checkAnswer(questionObj, userAnswer) {
    if (questionObj.type === 'text') {
        return normalizeAnswer(userAnswer) === normalizeAnswer(questionObj.answer);
    }
    // Opción múltiple: comparar letra (A, B, C, D)
    return userAnswer.trim().toUpperCase() === questionObj.answer.toUpperCase();
}


/* ─────────────────────────────────────────────────────────────────
   6. SISTEMA ALEATORIO INTERNO (Randomizer — Sección 3)
   • Baraja los 3 niveles con Fisher-Yates (sin repeticiones).
   • Crea colas de preguntas por nivel que se extraen sin repetir
     consecutivamente.
   ───────────────────────────────────────────────────────────────── */

/** Mapa de nivel → grupo de preguntas correspondiente (Secciones 4.1-4.3) */
const LEVEL_QUESTION_GROUP = {
    'Grecia'   : 'Geometria',      // Nivel Grecia   → Grupo Geometría
    'Ciudad'   : 'Trigonometria',   // Nivel Ciudad   → Grupo Trigonometría
    'Desierto' : 'Ambos'           // Nivel Desierto → Grupo Ambos
};

const Randomizer = {

    usedIdsInMatch: new Set(),

    resetMatchQuestions() {
        this.usedIdsInMatch.clear();
    },

    /**
     * Fisher-Yates: baraja una copia del array sin mutar el original.
     * @param {Array} array
     * @returns {Array}
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
     * Baraja el orden de los 3 niveles para una nueva partida.
     * Garantiza que NUNCA se repita un nivel en la misma partida.
     * @returns {string[]}  p.ej. ['Ciudad', 'Grecia', 'Desierto']
     */
    shuffleLevels() {
        return this.shuffle(['Grecia', 'Ciudad', 'Desierto']);
    },

    /**
     * Crea una cola/bolsa de preguntas para un nivel dado.
     * Las preguntas se extraen con next(); al agotarse la bolsa
     * se re-baraja automáticamente sin repetir la última pregunta.
     *
     * @param {string} levelName - 'Grecia' | 'Ciudad' | 'Desierto'
     * @returns {{ next: () => Object }}
     */
    createQuestionQueue(levelName) {
        const groupName = LEVEL_QUESTION_GROUP[levelName] || 'Ambos';
        const fullPool  = QUESTION_BANK[groupName] || QUESTION_BANK.Ambos;

        // Filtrar preguntas que aún no han salido en la partida actual
        let available = fullPool.filter(q => !Randomizer.usedIdsInMatch.has(q.id));
        if (available.length < 10) {
            available = [...fullPool];
        }

        return {
            _pool   : fullPool,
            _queue  : Randomizer.shuffle(available),
            _lastId : null,

            next() {
                if (this._queue.length === 0) {
                    const remaining = this._pool.filter(q => !Randomizer.usedIdsInMatch.has(q.id));
                    this._queue = Randomizer.shuffle(remaining.length > 0 ? remaining : [...this._pool]);

                    if (
                        this._lastId !== null &&
                        this._queue.length > 1 &&
                        this._queue[0].id === this._lastId
                    ) {
                        const swapIdx = 1 + Math.floor(
                            Math.random() * (this._queue.length - 1)
                        );
                        [this._queue[0], this._queue[swapIdx]] =
                            [this._queue[swapIdx], this._queue[0]];
                    }
                }

                const q = this._queue.shift();
                this._lastId = q.id;
                Randomizer.usedIdsInMatch.add(q.id);
                return q;
            }
        };
    }
};


/* ─────────────────────────────────────────────────────────────────
   7. VARIABLES DE ESTADO GLOBAL (accesibles desde los demás scripts)
   Se inicializan al arrancar una partida en main.js (FASE 3+).
   ───────────────────────────────────────────────────────────────── */
const GameState = {
    lives          : 3,        // vidas del jugador
    time           : 180,      // segundos restantes del nivel (3 min)
    progress       : 0,        // niveles superados (de 3)
    levelOrder     : [],       // orden aleatorio de niveles
    currentLevel   : 0,        // índice dentro de levelOrder
    selectedChar   : 'pitagoras',  // personaje seleccionado
    isImmune       : false,    // inmunidad activa (Sección 2.6 - 1.1)
    immunityTimer  : 0,        // cuenta regresiva de inmunidad
    questionQueue  : null,     // cola de preguntas del nivel actual
    isPaused       : false     // juego pausado (modal abierto, etc.)
};
