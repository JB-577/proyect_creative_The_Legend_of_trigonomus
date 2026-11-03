/* =================================================================
   audio.js — Controlador global de audio (AudioManager)
   Mezclador de pistas BGM + SFX, desbloqueo al primer toque,
   control de volumen y cambio limpio de pistas por pantalla/nivel.
   (Secciones 1.1, 2.7 y Notas del Juego)
   ================================================================= */

'use strict';

const AudioManager = {

    /* ── Estado interno ── */
    volume      : 0.80,     // 0.0 – 1.0  (80 % por defecto)
    unlocked    : false,     // ¿el usuario ya hizo clic/tecla?
    currentBGM  : null,      // clave de la pista de fondo activa
    contextBGM  : null,      // pista "correcta" para la pantalla actual

    /** Pistas de fondo (BGM) — solo UNA suena a la vez, en bucle */
    tracks: {},

    /** Efectos de sonido (SFX) — suenan POR ENCIMA de la BGM */
    sfx: {},

    /* ═════════════════════════════════════════════════════════════
       INICIALIZACIÓN
       ═════════════════════════════════════════════════════════════ */

    /**
     * Instancia todos los objetos Audio con las rutas exactas
     * de la Sección 6, configura bucles y conecta los listeners.
     * Debe llamarse una sola vez al cargar la página.
     */
    init() {

        /* ── BGM (en bucle) ──────────────────────────────────── */
        this.tracks = {
            inicio   : this._createAudio(ASSETS.musicInicio,   true),
            creditos : this._createAudio(ASSETS.musicCreditos,  true),
            grecia   : this._createAudio(ASSETS.musicGrecia,    true),
            ciudad   : this._createAudio(ASSETS.musicCiudad,    true),
            desierto : this._createAudio(ASSETS.musicDesierto,  true)
        };

        /* ── SFX (efecto puntual, sin bucle) ─────────────────── */
        this.sfx = {
            victoria   : this._createAudio(ASSETS.musicVictoria,  false),
            incorrecta : this._createAudio(ASSETS.sfxIncorrecta,   false),
            gameover   : this._createAudio(ASSETS.musicGameover,   false)
        };

        /* Aplicar volumen inicial a todo */
        this._applyVolume();

        /* Conectar eventos del DOM */
        this._setupUnlock();
        this._setupVolumeSlider();
        this._setupCreditsModal();
    },

    /* ═════════════════════════════════════════════════════════════
       FÁBRICA DE AUDIO
       ═════════════════════════════════════════════════════════════ */

    /**
     * Crea un objeto Audio con la ruta y el loop indicados.
     * preload="auto" para empezar la descarga cuanto antes.
     */
    _createAudio(src, loop) {
        const a   = new Audio();
        a.src     = src;
        a.loop    = loop;
        a.preload = 'auto';
        return a;
    },

    /* ═════════════════════════════════════════════════════════════
       DESBLOQUEO DE AUDIO (Notas del Juego)
       Al primer clic / tecla / toque se oculta el banner y se
       arranca la música de la pantalla de inicio.
       ═════════════════════════════════════════════════════════════ */

    _setupUnlock() {
        const handler = () => {
            if (this.unlocked) return;
            this.unlocked = true;

            /* Ocultar el banner de aviso */
            const banner = document.getElementById('audio-banner');
            if (banner) {
                banner.style.transition = 'opacity 0.5s';
                banner.style.opacity    = '0';
                setTimeout(() => { banner.style.display = 'none'; }, 500);
            }

            /* Arrancar la música de la pantalla de inicio */
            this.setContextBGM('inicio');
        };

        window.addEventListener('click',      handler);
        window.addEventListener('keydown',     handler);
        window.addEventListener('touchstart',  handler);
    },

    /* ═════════════════════════════════════════════════════════════
       MEZCLADOR DE PISTAS  (BGM)
       ═════════════════════════════════════════════════════════════ */

    /**
     * Establece la pista de fondo "del contexto" (pantalla/nivel)
     * y la reproduce.
     * @param {string} key – clave de this.tracks
     */
    setContextBGM(key) {
        this.contextBGM = key;
        this._switchBGM(key);
    },

    /**
     * Reproduce una pista temporal por encima del contexto
     * (p.ej. créditos sobre la pantalla de inicio).
     * @param {string} key
     */
    playOverrideBGM(key) {
        this._switchBGM(key);
    },

    /**
     * Restaura la pista de fondo del contexto
     * (al cerrar créditos, volver a la pantalla anterior, etc.)
     */
    restoreContextBGM() {
        this._switchBGM(this.contextBGM);
    },

    /**
     * Detiene la BGM actual, inicia la nueva con el volumen correcto.
     * @private
     */
    _switchBGM(key) {
        /* Detener la pista actual */
        if (this.currentBGM && this.tracks[this.currentBGM]) {
            this.tracks[this.currentBGM].pause();
            this.tracks[this.currentBGM].currentTime = 0;
        }

        this.currentBGM = key;

        if (key && this.tracks[key] && this.unlocked) {
            this.tracks[key].volume = this.volume;
            this.tracks[key].play().catch(() => {
                /* Navegador bloqueó autoplay — se reintentará */
            });
        }
    },

    /**
     * Detiene TODA la música y efectos.
     */
    stopAll() {
        Object.values(this.tracks).forEach(t => {
            t.pause();
            t.currentTime = 0;
        });
        Object.values(this.sfx).forEach(s => {
            s.pause();
            s.currentTime = 0;
        });
        this.currentBGM = null;
    },

    /* ═════════════════════════════════════════════════════════════
       MEZCLADOR DE PISTAS  (SFX)
       Los efectos suenan POR ENCIMA de la BGM sin detenerla.
       ═════════════════════════════════════════════════════════════ */

    /**
     * Reproduce un efecto de sonido puntual.
     * @param {string} key – clave de this.sfx ('victoria'|'incorrecta'|'gameover')
     */
    playSFX(key) {
        const sound = this.sfx[key];
        if (!sound || !this.unlocked) return;

        /* Reiniciar para que pueda reproducirse de nuevo rápido */
        sound.currentTime = 0;
        sound.volume      = this.volume;
        sound.play().catch(() => {});
    },

    /* ═════════════════════════════════════════════════════════════
       CONTROL DE VOLUMEN (Sección 1.1)
       ═════════════════════════════════════════════════════════════ */

    /**
     * Ajusta el volumen general del juego.
     * @param {number} val – valor de 0.0 a 1.0
     */
    setVolume(val) {
        this.volume = Math.max(0, Math.min(1, val));
        this._applyVolume();
    },

    /** @private Aplica this.volume a todas las pistas y efectos. */
    _applyVolume() {
        Object.values(this.tracks).forEach(t => { t.volume = this.volume; });
        Object.values(this.sfx).forEach(s    => { s.volume = this.volume; });
    },

    /**
     * Conecta el slider del modal de configuración y las flechas
     * ← → del teclado para subir/bajar volumen.
     * @private
     */
    _setupVolumeSlider() {
        const slider  = document.getElementById('volume-slider');
        const display = document.getElementById('volume-value');
        const modal   = document.getElementById('modal-settings');
        if (!slider || !display) return;

        /** Actualiza display + AudioManager al mover el slider */
        const sync = () => {
            const pct = parseInt(slider.value, 10);
            display.textContent = pct + '%';
            this.setVolume(pct / 100);
        };

        slider.addEventListener('input', sync);

        /** Flechas ← → ajustan ±5 % cuando el modal está visible */
        document.addEventListener('keydown', (e) => {
            if (!modal || modal.classList.contains('hidden')) return;

            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                slider.value = Math.max(0,   parseInt(slider.value, 10) - 5);
                sync();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                slider.value = Math.min(100, parseInt(slider.value, 10) + 5);
                sync();
            }
        });

        /* Sincronizar al valor inicial del slider */
        sync();
    },

    /* ═════════════════════════════════════════════════════════════
       INTEGRACIÓN CON MODAL DE CRÉDITOS (Sección 2.7 – evento 2)
       Al abrir → suena ssstik.io.mp3
       Al cerrar → vuelve la pista del contexto (inicio / nivel)
       ═════════════════════════════════════════════════════════════ */

    _setupCreditsModal() {
        const btnCredits  = document.getElementById('btn-credits');
        const modal       = document.getElementById('modal-credits');
        if (!btnCredits || !modal) return;

        /* Abrir créditos → override con música de créditos */
        btnCredits.addEventListener('click', () => {
            this.playOverrideBGM('creditos');
        });

        /* Cerrar créditos (botón ✕) → restaurar contexto */
        const closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.restoreContextBGM();
            });
        }

        /* Cerrar créditos (clic en overlay) → restaurar contexto */
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.restoreContextBGM();
            }
        });
    }
};


/* ═══════════════════════════════════════════════════════════════
   AUTO-INIT: Se ejecuta cuando el DOM está listo.
   ═══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
    AudioManager.init();
});
