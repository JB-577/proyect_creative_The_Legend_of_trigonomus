/**
 * ============================================================================
 * THE LEGEND OF TRIGONOMUS - AUDIO.JS (FASE 2)
 * Especificación Técnica: "instrucciones juego PAP 2.0.txt" (Sección 2.7 y Notas)
 * ============================================================================
 */

(function (window) {
  'use strict';

  // Configuración de pistas de audio (Sección 6)
  const AUDIO_PATHS = {
    // Música de Fondo (BGM)
    BGM_INICIO:     "proyect_creative_The_Legend_of_trigonomus/Música/Sonido de inicio de juego/slimeyfox-582346.mp3",
    BGM_CREDITOS:   "proyect_creative_The_Legend_of_trigonomus/Música/Creditos/ssstik.io.mp3",
    BGM_GRECIA:     "proyect_creative_The_Legend_of_trigonomus/Música/Soundtrack/arcade-beat.mp3",
    BGM_CIUDAD:     "proyect_creative_The_Legend_of_trigonomus/Música/Soundtrack/heart.mp3",
    BGM_DESIERTO:   "proyect_creative_The_Legend_of_trigonomus/Música/Soundtrack/8-bit-music.mp3",

    // Efectos de Sonido (SFX)
    SFX_VICTORIA:   "proyect_creative_The_Legend_of_trigonomus/Música/Sonido de victoria/ltz88bg8ju_NWM.mp3",
    SFX_INCORRECTO: "proyect_creative_The_Legend_of_trigonomus/Música/sonido respuesta incorrecta/feedback-incorrect-24_NWM.mp3",
    SFX_GAMEOVER:   "proyect_creative_The_Legend_of_trigonomus/Música/Sonido de game over/csy3tfy6v_NWM.mp3"
  };

  /**
   * Genera variantes de ruta para fallback automático
   */
  function getAudioFallbacks(primaryPath) {
    const list = [primaryPath];
    // Sin prefijo de carpeta
    const withoutPrefix = primaryPath.replace('proyect_creative_The_Legend_of_trigonomus/', '');
    list.push(withoutPrefix);
    // Con URL encode de tilde
    list.push(withoutPrefix.replace('Música', encodeURIComponent('Música')));
    list.push(primaryPath.replace('Música', encodeURIComponent('Música')));
    return list;
  }

  const AudioManager = {
    audioContext: null,
    masterVolume: 0.8, // 80% por defecto (coincide con el slider de index.html)
    isUnlocked: false,
    currentBgmKey: null,
    currentBgmAudio: null,
    bgmElements: {},
    sfxPools: {},

    /**
     * Inicialización del gestor de audio
     */
    init() {
      // 1. Instanciar elementos de audio para cada pista
      this._createAudioElements();

      // 2. Vincular listeners de UI (volumen, modal de créditos, banner de inicio)
      this._bindUIEvents();

      // 3. Registrar eventos de interacción inicial para desbloquear el audio
      this._bindUnlockEvents();

      console.log('[AudioManager] Motor de audio retro inicializado.');
    },

    /**
     * Crea elementos de audio HTML5 con soporte de fallback
     */
    _createAudioElements() {
      // Pistas de fondo (Loop activo)
      const bgmKeys = ['BGM_INICIO', 'BGM_CREDITOS', 'BGM_GRECIA', 'BGM_CIUDAD', 'BGM_DESIERTO'];
      bgmKeys.forEach((key) => {
        const audio = this._createAudioWithFallback(AUDIO_PATHS[key], true);
        this.bgmElements[key] = audio;
      });

      // Pistas de SFX (Pool para reproducción simultánea)
      const sfxKeys = ['SFX_VICTORIA', 'SFX_INCORRECTO', 'SFX_GAMEOVER'];
      sfxKeys.forEach((key) => {
        this.sfxPools[key] = {
          primaryPath: AUDIO_PATHS[key],
          instances: []
        };
      });
    },

    /**
     * Crea un elemento HTMLAudioElement con fallback automático en onerror
     */
    _createAudioWithFallback(primaryPath, isLoop) {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.loop = !!isLoop;
      audio.volume = this.masterVolume;

      const candidates = getAudioFallbacks(primaryPath);
      let candidateIndex = 0;

      audio.src = candidates[0];

      audio.addEventListener('error', () => {
        candidateIndex++;
        if (candidateIndex < candidates.length) {
          audio.src = candidates[candidateIndex];
          audio.load();
        } else {
          console.warn(`[AudioManager] No se pudo cargar pista: ${primaryPath}`);
        }
      });

      return audio;
    },

    /**
     * Vincula eventos de la interfaz (slider de volumen, modal de ajustes, modal de créditos)
     */
    _bindUIEvents() {
      const slider = document.getElementById('game-volume-slider');
      const readout = document.getElementById('volume-readout');

      // Control de volumen por slider
      if (slider) {
        slider.value = Math.round(this.masterVolume * 100);
        slider.addEventListener('input', (e) => {
          const val = parseInt(e.target.value, 10);
          this.setVolume(val);
        });
      }

      if (readout) {
        readout.textContent = Math.round(this.masterVolume * 100);
      }

      // Control de volumen mediante flechas del teclado en modal de configuración (Sección 1.1)
      window.addEventListener('keydown', (e) => {
        const modalSettings = document.getElementById('modal-settings');
        if (!modalSettings || modalSettings.classList.contains('hidden')) return;

        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          e.preventDefault();
          this.setVolume(Math.min(100, Math.round(this.masterVolume * 100) + 5));
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          e.preventDefault();
          this.setVolume(Math.max(0, Math.round(this.masterVolume * 100) - 5));
        }
      });

      // Manejo de música para el Modal de Créditos (Sección 1.3 y 2.7)
      const btnCredits = document.getElementById('btn-credits');
      if (btnCredits) {
        btnCredits.addEventListener('click', () => {
          this.playBGM('BGM_CREDITOS');
        });
      }

      // Cuando se cierre el modal de créditos, regresar a la música de inicio si estamos en start-screen
      const handleCloseCredits = () => {
        const startScreen = document.getElementById('start-screen');
        const modalCredits = document.getElementById('modal-credits');
        if (modalCredits && modalCredits.classList.contains('hidden')) {
          if (startScreen && !startScreen.classList.contains('hidden')) {
            if (this.currentBgmKey === 'BGM_CREDITOS') {
              this.playBGM('BGM_INICIO');
            }
          }
        }
      };

      // Escuchar clicks de cierre de créditos
      document.querySelectorAll('[data-close="modal-credits"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          setTimeout(handleCloseCredits, 50);
        });
      });

      // Escuchar backdrop click y tecla Escape para retorno de música de inicio
      const modalCreditsElem = document.getElementById('modal-credits');
      if (modalCreditsElem) {
        modalCreditsElem.addEventListener('click', (e) => {
          if (e.target === modalCreditsElem) {
            setTimeout(handleCloseCredits, 50);
          }
        });
      }
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          setTimeout(handleCloseCredits, 50);
        }
      });
    },

    /**
     * Desbloqueo inicial al interactuar con el juego (clic o teclado)
     */
    _bindUnlockEvents() {
      const unlockAudio = () => {
        if (this.isUnlocked) return;
        this.isUnlocked = true;

        // Iniciar Web Audio Context si está disponible
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx && !this.audioContext) {
          try {
            this.audioContext = new AudioCtx();
            if (this.audioContext.state === 'suspended') {
              this.audioContext.resume();
            }
          } catch (e) {
            console.warn('[AudioManager] No se pudo inicializar AudioContext:', e);
          }
        }

        // Ocultar banner superior centrado de aviso de audio
        const banner = document.getElementById('audio-prompt-banner');
        if (banner) {
          banner.classList.add('hidden');
        }

        // Reproducir automáticamente la música de inicio si estamos en el menú de inicio
        const startScreen = document.getElementById('start-screen');
        if (startScreen && !startScreen.classList.contains('hidden')) {
          if (!this.currentBgmKey) {
            this.playBGM('BGM_INICIO');
          }
        }

        // Remover listeners de desbloqueo tras el primer gesto
        ['pointerdown', 'click', 'keydown', 'touchstart'].forEach((evt) => {
          window.removeEventListener(evt, unlockAudio, true);
        });
      };

      ['pointerdown', 'click', 'keydown', 'touchstart'].forEach((evt) => {
        window.addEventListener(evt, unlockAudio, { once: false, capture: true });
      });
    },

    /**
     * Resuelve una clave de pista canónica o su alias
     */
    _resolveTrackKey(rawKey) {
      if (!rawKey) return null;
      const upper = String(rawKey).toUpperCase().trim();
      const map = {
        'INICIO': 'BGM_INICIO',
        'BGM_INICIO': 'BGM_INICIO',
        'SLIMEYFOX-582346.MP3': 'BGM_INICIO',

        'CREDITOS': 'BGM_CREDITOS',
        'CRÉDITOS': 'BGM_CREDITOS',
        'BGM_CREDITOS': 'BGM_CREDITOS',
        'SSSTIK.IO.MP3': 'BGM_CREDITOS',

        'GRECIA': 'BGM_GRECIA',
        'BGM_GRECIA': 'BGM_GRECIA',
        'ARCADE-BEAT.MP3': 'BGM_GRECIA',

        'CIUDAD': 'BGM_CIUDAD',
        'BGM_CIUDAD': 'BGM_CIUDAD',
        'HEART.MP3': 'BGM_CIUDAD',

        'DESIERTO': 'BGM_DESIERTO',
        'BGM_DESIERTO': 'BGM_DESIERTO',
        '8-BIT-MUSIC.MP3': 'BGM_DESIERTO',

        'VICTORIA': 'SFX_VICTORIA',
        'SFX_VICTORIA': 'SFX_VICTORIA',
        'LTZ88BG8JU_NWM.MP3': 'SFX_VICTORIA',

        'INCORRECTO': 'SFX_INCORRECTO',
        'ERROR': 'SFX_INCORRECTO',
        'SFX_INCORRECTO': 'SFX_INCORRECTO',
        'FEEDBACK-INCORRECT-24_NWM.MP3': 'SFX_INCORRECTO',

        'GAMEOVER': 'SFX_GAMEOVER',
        'GAME_OVER': 'SFX_GAMEOVER',
        'SFX_GAMEOVER': 'SFX_GAMEOVER',
        'CSY3TFY6V_NWM.MP3': 'SFX_GAMEOVER'
      };
      return map[upper] || upper;
    },

    /**
     * Reproduce una música de fondo (BGM) en loop, deteniendo la anterior si existe
     */
    playBGM(trackKey) {
      const key = this._resolveTrackKey(trackKey);
      if (!key || !this.bgmElements[key]) {
        console.warn(`[AudioManager] Pista BGM no encontrada: ${trackKey}`);
        return;
      }

      // Si ya está reproduciendo esa pista, asegurarse que el volumen esté sincronizado y salir
      if (this.currentBgmKey === key && this.currentBgmAudio && !this.currentBgmAudio.paused) {
        this.currentBgmAudio.volume = this.masterVolume;
        return;
      }

      // Detener pista anterior
      this.stopBGM();

      this.currentBgmKey = key;
      this.currentBgmAudio = this.bgmElements[key];
      this.currentBgmAudio.volume = this.masterVolume;
      this.currentBgmAudio.currentTime = 0;

      const playPromise = this.currentBgmAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          // El autoplay puede ser diferido hasta el primer gesto de usuario
          console.log(`[AudioManager] Reproducción BGM diferida (${key}): Esperando interacción de usuario.`);
        });
      }
    },

    /**
     * Detiene la música de fondo activa
     */
    stopBGM() {
      if (this.currentBgmAudio) {
        try {
          this.currentBgmAudio.pause();
          this.currentBgmAudio.currentTime = 0;
        } catch (e) {
          // Silencioso
        }
      }
      this.currentBgmAudio = null;
      this.currentBgmKey = null;
    },

    /**
     * Pausa temporalmente la BGM actual
     */
    pauseBGM() {
      if (this.currentBgmAudio) {
        this.currentBgmAudio.pause();
      }
    },

    /**
     * Reanuda la BGM si estaba en pausa
     */
    resumeBGM() {
      if (this.currentBgmAudio) {
        this.currentBgmAudio.volume = this.masterVolume;
        this.currentBgmAudio.play().catch(() => {});
      }
    },

    /**
     * Reproduce un efecto de sonido (SFX) sin interrumpir la música de fondo
     */
    playSFX(sfxKey) {
      const key = this._resolveTrackKey(sfxKey);
      if (!key || !this.sfxPools[key]) {
        console.warn(`[AudioManager] SFX no encontrado: ${sfxKey}`);
        return;
      }

      const pool = this.sfxPools[key];
      // Reutiliza una instancia pausada o crea una nueva
      let audio = pool.instances.find((a) => a.paused || a.ended);
      if (!audio) {
        audio = this._createAudioWithFallback(pool.primaryPath, false);
        pool.instances.push(audio);
      }

      audio.volume = this.masterVolume;
      audio.currentTime = 0;
      audio.play().catch((err) => {
        console.log(`[AudioManager] Reproducción SFX diferida (${key})`);
      });
    },

    /**
     * Ajusta el volumen maestro (0 a 100 o 0.0 a 1.0)
     */
    setVolume(value) {
      let percent = typeof value === 'number' ? value : parseFloat(value);
      if (isNaN(percent)) percent = 80;

      // Si se pasa entre 0 y 1, convertir a 0-100
      if (percent > 0 && percent <= 1) {
        percent = percent * 100;
      }

      percent = Math.max(0, Math.min(100, Math.round(percent)));
      this.masterVolume = percent / 100;

      // Actualizar volumen de la BGM activa
      if (this.currentBgmAudio) {
        this.currentBgmAudio.volume = this.masterVolume;
      }

      // Actualizar todos los elementos de audio
      Object.values(this.bgmElements).forEach((audio) => {
        if (audio) audio.volume = this.masterVolume;
      });

      Object.values(this.sfxPools).forEach((pool) => {
        pool.instances.forEach((audio) => {
          if (audio) audio.volume = this.masterVolume;
        });
      });

      // Actualizar controles visuales en index.html
      const slider = document.getElementById('game-volume-slider');
      if (slider && parseInt(slider.value, 10) !== percent) {
        slider.value = percent;
      }

      const readout = document.getElementById('volume-readout');
      if (readout) {
        readout.textContent = percent;
      }
    },

    /**
     * Retorna el volumen actual (0 a 100)
     */
    getVolume() {
      return Math.round(this.masterVolume * 100);
    }
  };

  // Auto-inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AudioManager.init());
  } else {
    AudioManager.init();
  }

  // Exportar al objeto global
  window.AudioManager = AudioManager;

})(window);
