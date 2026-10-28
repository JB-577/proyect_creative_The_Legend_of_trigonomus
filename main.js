/**
 * ============================================================================
 * THE LEGEND OF TRIGONOMUS - MAIN.JS (FASE 5)
 * Bucle Principal (Game Loop), Máquina de Estados, HUD, Desafíos y Orquestación
 * Especificación Técnica: "instrucciones juego PAP 2.0.txt"
 * ============================================================================
 */

(function (window) {
  'use strict';

  // Dependencias de módulos anteriores
  const Config = window.GAME_CONFIG || {};
  const AudioMgr = window.AudioManager || {};
  const Entities = window.GameEntities || {};
  const Levels = window.GameLevels || {};

  // ==========================================================================
  // 1. ESTADO GLOBAL DEL JUEGO (GAME ENGINE)
  // ==========================================================================
  const GameEngine = {
    // Canvas y Contexto 2D
    canvas: null,
    ctx: null,

    // Variables internas de estado global (Notas del Juego y Sección 4)
    lives: 3,         // Variable "lives" (inicia en 3 al comenzar la partida)
    time: 180,        // Variable "time" (180s regresivos por nivel)
    progress: 0,      // Variable "Progress" (0 a 3 para completar el juego)

    // Cola de niveles barajados sin repetición para la partida activa (Sección 3)
    levelQueue: [],
    currentLevelIndex: 0,
    currentLevel: null,
    player: null,

    // Estados del motor: 'START_SCREEN', 'PLAYING', 'QUESTION_MODAL', 'GAME_OVER', 'VICTORY'
    state: 'START_SCREEN',

    // Control del temporizador de nivel
    levelTimerInterval: null,
    isTimePaused: false,

    // Desafío / Pregunta activa en pantalla
    activeQuestion: null,
    activeEventSource: null, // Instancia del obstáculo o SkillBox activador

    // Temporizador para avisos flotantes (Toast)
    toastTimeout: null,

    // Temporizador y listener de salida para pantalla de victoria
    victoryTimeout: null,
    victoryKeyHandler: null,

    // Estado del teclado para controles de movimiento
    inputState: {
      left: false,
      right: false,
      jump: false
    },

    // Tiempo delta para Game Loop a 60 FPS
    lastTimestamp: 0,

    // ========================================================================
    // 2. INICIALIZACIÓN
    // ========================================================================
    init() {
      this.canvas = document.getElementById('gameCanvas');
      if (!this.canvas) {
        console.error('[GameEngine] No se encontró el elemento #gameCanvas.');
        return;
      }
      this.ctx = this.canvas.getContext('2d');

      // Asegurar renderizado pixelado en el contexto 2D
      this.ctx.imageSmoothingEnabled = false;

      // Precargar recursos gráficos
      if (Config.AssetLoader) {
        Config.AssetLoader.loadAll((loaded, total) => {
          // Progreso opcional de carga
        }).then(() => {
          console.log('[GameEngine] Todos los recursos gráficos han sido precargados.');
        });
      }

      // Enlazar eventos de UI, teclado y ratón
      this.bindControls();
      this.bindUI();

      // Iniciar el Game Loop a 60 FPS
      this.lastTimestamp = performance.now();
      requestAnimationFrame((t) => this.loop(t));

      console.log('[GameEngine] Motor de juego The_Legend_of_trigonomus listo.');
    },

    // ========================================================================
    // 3. ENLACE DE CONTROLES (TECLADO Y RATÓN)
    // ========================================================================
    bindControls() {
      // 1. Controles de Movimiento del Jugador (Sección 2.3.1)
      window.addEventListener('keydown', (e) => {
        // Si hay un modal o la pantalla de inicio está activa, no procesar movimiento de juego
        if (this.state !== 'PLAYING') return;

        // Movimiento a la izquierda (Flecha izquierda o tecla A)
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
          this.inputState.left = true;
          e.preventDefault();
        }
        // Movimiento a la derecha (Flecha derecha o tecla D)
        else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
          this.inputState.right = true;
          e.preventDefault();
        }
        // Salto hacia arriba (Flecha arriba, Espacio o tecla W)
        else if (e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'KeyW') {
          this.inputState.jump = true;
          e.preventDefault();
        }
      });

      window.addEventListener('keyup', (e) => {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
          this.inputState.left = false;
        } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
          this.inputState.right = false;
        } else if (e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'KeyW') {
          this.inputState.jump = false;
        }
      });

      // 2. Activación de Cuadros de Habilidad mediante Clic en el Canvas (Sección 2.3.3)
      this.canvas.addEventListener('click', (e) => {
        if (this.state !== 'PLAYING' || !this.currentLevel) return;

        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        const screenX = (e.clientX - rect.left) * scaleX;
        const screenY = (e.clientY - rect.top) * scaleY;

        // Comprueba si impacta en algún Cuadro de Habilidad
        this.currentLevel.handleCanvasClick(screenX, screenY);
      });
    },

    // ========================================================================
    // 4. ENLACE DE INTERFAZ DE USUARIO (HUD, MODALES Y BOTONES)
    // ========================================================================
    bindUI() {
      // Botón "-> Jugar" en Pantalla de Inicio
      const btnPlay = document.getElementById('btn-play');
      if (btnPlay) {
        btnPlay.addEventListener('click', () => {
          this.startNewGame();
        });
      }

      // Botón "Responder" en el Modal de Preguntas (#modal-question, Sección 2.4)
      const btnSubmit = document.getElementById('btn-submit-answer');
      if (btnSubmit) {
        btnSubmit.addEventListener('click', () => {
          this.handleSubmitAnswer();
        });
      }

      // Permitir enviar respuesta pulsando Enter en el input de texto
      const textInput = document.getElementById('question-text-input');
      if (textInput) {
        textInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            const submitBtn = document.getElementById('btn-submit-answer');
            if (submitBtn && !submitBtn.disabled) {
              this.handleSubmitAnswer();
            }
          }
        });
      }
    },

    // ========================================================================
    // 5. INICIO Y GESTIÓN DE PARTIDA (Sección 1, 3 y Notas del Juego)
    // ========================================================================
    startNewGame() {
      // 1. Inicializar variables globales
      this.lives = Config.CONSTANTS.INITIAL_LIVES; // 3 vidas
      this.progress = 0;                          // Progreso 0 de 3

      // 2. Barajar los 3 niveles garantizando que NUNCA se repita ninguno en la partida (Sección 3)
      this.levelQueue = Config.Randomizer.shuffleLevels();
      this.currentLevelIndex = 0;

      // 3. Reiniciar pools de preguntas sin repetición
      Config.Randomizer.reset();

      // 4. Ocultar pantalla de inicio y pantallas especiales
      document.getElementById('start-screen')?.classList.add('hidden');
      document.getElementById('gameover-screen')?.classList.add('hidden');
      document.getElementById('victory-screen')?.classList.add('hidden');
      document.getElementById('toast-notification')?.classList.add('hidden');

      // 5. Mostrar HUD superior
      document.getElementById('game-hud')?.classList.remove('hidden');

      // 6. Cargar el primer nivel
      this.loadLevel(this.levelQueue[this.currentLevelIndex]);
    },

    /**
     * Carga y arranca un nivel específico ('Grecia', 'Ciudad', 'Desierto')
     */
    loadLevel(levelId) {
      // 1. Reiniciar variable time a 180 segundos (Sección 4 y Notas del Juego)
      this.time = Config.CONSTANTS.INITIAL_TIME;
      this.updateHUD();

      // 2. Instanciar al jugador con el personaje seleccionado
      const selectedCharId = Config.getSelectedCharacterId();
      this.player = new Entities.Player(60, 380, selectedCharId);

      // 3. Construir nivel con sus plataformas, obstáculos y callbacks
      this.currentLevel = Levels.LevelBuilder.buildLevel(levelId, {
        onFixedObstacleTrigger: (obstacle) => this.handleObstacleTrigger(obstacle, 'fixed'),
        onMobileObstacleTrigger: (obstacle) => this.handleObstacleTrigger(obstacle, 'mobile'),
        onSkillBoxHit: (box) => this.handleSkillBoxTrigger(box),
        onLevelGoalReached: (goal) => this.handleLevelGoalReached(goal)
      });

      // 4. Establecer estado activo
      this.state = 'PLAYING';
      this.isTimePaused = false;

      // 5. Reproducir Soundtrack del nivel correspondiente (Sección 2.7)
      if (AudioMgr.playBGM) {
        AudioMgr.playBGM(this.currentLevel.bgmKey);
      }

      // 6. Iniciar contador regresivo por segundo
      this.startLevelTimer();

      console.log(`[GameEngine] Nivel "${this.currentLevel.name}" iniciado. Grupo: ${this.currentLevel.questionGroup}`);
    },

    /**
     * Temporizador regresivo de nivel (resta 1s a 'time' cada segundo, Notas del Juego)
     */
    startLevelTimer() {
      if (this.levelTimerInterval) {
        clearInterval(this.levelTimerInterval);
      }

      this.levelTimerInterval = setInterval(() => {
        // Pausar si hay un modal de pregunta abierto o no estamos jugando
        if (this.state !== 'PLAYING' || this.isTimePaused) return;

        this.time--;
        this.updateHUD();

        // Condición de GAME OVER por tiempo agotado (time = 0, Notas del Juego)
        if (this.time <= 0) {
          this.time = 0;
          this.updateHUD();
          this.triggerGameOver('¡Tiempo agotado!');
        }
      }, 1000);
    },

    /**
     * Actualiza los valores en el HUD de pantalla
     */
    updateHUD() {
      const livesElem = document.getElementById('hud-lives-val');
      const timeElem = document.getElementById('hud-time-val');
      const progElem = document.getElementById('hud-progress-val');

      if (livesElem) livesElem.textContent = this.lives;
      if (timeElem) timeElem.textContent = Math.max(0, this.time);
      if (progElem) progElem.textContent = this.progress;
    },

    // ========================================================================
    // 6. FLUJO DE PREGUNTAS (OBSTÁCULOS Y CUADROS DE HABILIDAD)
    // ========================================================================

    /**
     * Disparado al tocar el Obstáculo Fijo o un Obstáculo Móvil (Sección 2.5)
     */
    handleObstacleTrigger(obstacleInstance, type) {
      if (!obstacleInstance || obstacleInstance.resolved) return;
      if (this.player && this.player.isImmune) return; // Con inmunidad pasa libremente

      this.openQuestionModal({
        sourceType: 'obstacle',
        sourceInstance: obstacleInstance,
        title: type === 'fixed' ? '¡OBSTÁCULO FIJO - DESAFÍO!' : '¡OBSTÁCULO MÓVIL - DESAFÍO!'
      });
    },

    /**
     * Disparado al golpear desde abajo o hacer clic en un Cuadro de Habilidad (Sección 2.3.3 y 2.6)
     */
    handleSkillBoxTrigger(skillBoxInstance) {
      if (!skillBoxInstance) return;

      this.openQuestionModal({
        sourceType: 'skill',
        sourceInstance: skillBoxInstance,
        title: '⭐ ¡CUADRO DE HABILIDAD! ⭐'
      });
    },

    /**
     * Abre y prepara el Modal de Preguntas (#modal-question, Sección 2.4)
     */
    openQuestionModal(eventConfig) {
      this.state = 'QUESTION_MODAL';
      this.isTimePaused = true;

      // Bloquear inmediatamente el movimiento del personaje (Sección 2.3.1)
      if (this.player) {
        this.player.inputLocked = true;
        this.player.vx = 0;
      }
      this.inputState.left = false;
      this.inputState.right = false;
      this.inputState.jump = false;

      this.activeEventSource = eventConfig;

      // Extraer pregunta aleatoria sin repetición del grupo del nivel vigente (Sección 3)
      const group = this.currentLevel ? this.currentLevel.questionGroup : 'Ambos';
      this.activeQuestion = Config.Randomizer.getQuestion(group);

      // Configurar textos en el DOM
      const titleElem = document.getElementById('question-modal-title');
      const textElem = document.getElementById('question-text');
      const inputWrap = document.getElementById('question-input-wrapper');
      const optionsWrap = document.getElementById('question-options-wrapper');
      const textInput = document.getElementById('question-text-input');
      const submitBtn = document.getElementById('btn-submit-answer');

      if (titleElem) titleElem.textContent = eventConfig.title;
      if (textElem) textElem.textContent = this.activeQuestion.question;

      // Preparar interfaz según sea pregunta de texto libre o de opción múltiple
      if (this.activeQuestion.type === 'text') {
        inputWrap?.classList.remove('hidden');
        optionsWrap?.classList.add('hidden');

        if (textInput) {
          textInput.value = '';
          setTimeout(() => textInput.focus(), 80);
        }
      } else {
        // Opción múltiple
        inputWrap?.classList.add('hidden');
        optionsWrap?.classList.remove('hidden');

        // Deseleccionar radios
        document.querySelectorAll('input[name="math-bullet-choice"]').forEach((r) => {
          r.checked = false;
        });

        // Renderizar opciones matemáticas con innerHTML para entidades &pi;, &sup2;, &deg;, &infin;
        const opts = this.activeQuestion.options;
        const setOpt = (id, html) => {
          const el = document.getElementById(id);
          if (el) el.innerHTML = html || '';
        };
        if (opts) {
          setOpt('opt-text-A', opts.A);
          setOpt('opt-text-B', opts.B);
          setOpt('opt-text-C', opts.C);
          setOpt('opt-text-D', opts.D);
        }
      }

      // Deshabilitar botón de respuesta hasta que se ingrese valor
      if (submitBtn) submitBtn.disabled = true;

      // Mostrar modal
      document.getElementById('modal-question')?.classList.remove('hidden');
    },

    /**
     * Procesamiento del clic en "Responder" (#btn-submit-answer)
     */
    handleSubmitAnswer() {
      if (!this.activeQuestion) return;

      // Obtener respuesta del usuario
      let userAnswer = '';
      if (this.activeQuestion.type === 'text') {
        const textInput = document.getElementById('question-text-input');
        userAnswer = textInput ? textInput.value : '';
      } else {
        const checkedRadio = document.querySelector('input[name="math-bullet-choice"]:checked');
        userAnswer = checkedRadio ? checkedRadio.value : '';
      }

      // Comparación y normalización (Sección 2.4.1)
      const isCorrect = Config.checkAnswer(this.activeQuestion, userAnswer);

      // Cerrar modal
      document.getElementById('modal-question')?.classList.add('hidden');

      // Reanudar tiempo y desbloquear movimiento del jugador
      this.isTimePaused = false;
      if (this.player) {
        this.player.inputLocked = false;
      }
      this.state = 'PLAYING';

      const source = this.activeEventSource;
      const obstacleOrBox = source ? source.sourceInstance : null;

      // Marcar obstáculo o caja como resuelto para permitir el paso
      if (obstacleOrBox) {
        obstacleOrBox.resolved = true;
      }

      // ======================================================================
      // CASO A: Obstáculo (Fijo o Móvil, Sección 2.5)
      // ======================================================================
      if (source && source.sourceType === 'obstacle') {
        if (isCorrect) {
          // Respuesta Correcta: Sonido victoria + Aviso de 3s "Desafío Superado"
          if (AudioMgr.playSFX) AudioMgr.playSFX('SFX_VICTORIA');
          this.showToast('Desafío Superado', 3000, '⭐');
        } else {
          // Respuesta Incorrecta: Sonido error + Resta 1 vida + Aviso 3s "Respuesta incorrecta- Se le restará una vida"
          if (AudioMgr.playSFX) AudioMgr.playSFX('SFX_INCORRECTO');
          this.lives--;
          this.updateHUD();
          this.showToast('Respuesta incorrecta- Se le restará una vida', 3000, '❌');

          // Comprobar Game Over por vidas agotadas
          if (this.lives <= 0) {
            this.lives = 0;
            this.updateHUD();
            this.triggerGameOver('¡Te has quedado sin vidas!');
          }
        }
      }
      // ======================================================================
      // CASO B: Cuadro de Habilidad (IMG_0672.png, Sección 2.6 y 4)
      // ======================================================================
      else if (source && source.sourceType === 'skill') {
        if (isCorrect) {
          if (AudioMgr.playSFX) AudioMgr.playSFX('SFX_VICTORIA');
          this.grantRandomSkillReward();
        } else {
          // Fallo en reto opcional de habilidad (sin penalización de vida)
          if (AudioMgr.playSFX) AudioMgr.playSFX('SFX_INCORRECTO');
          this.showToast('Reto de habilidad fallido', 3000, '❌');
        }
      }

      this.activeQuestion = null;
      this.activeEventSource = null;
    },

    /**
     * Aplica 1 de las 3 habilidades aleatorias tras superar el Cuadro de Habilidad (Sección 2.6)
     */
    grantRandomSkillReward() {
      // 1: Inmunidad (10s), 2: 1 Vida extra, 3: 120s extra
      const rewardType = Math.floor(Math.random() * 3) + 1;

      switch (rewardType) {
        case 1:
          // 1.1 Inmunidad por 10s con cuenta regresiva en el borde superior
          if (this.player) {
            this.player.activateImmunity(Config.CONSTANTS.IMMUNITY_DURATION);
          }
          this.showToast('¡Inmunidad activada por 10 segundos!', 3000, '⚡');
          this.startImmunityBannerCountdown(Config.CONSTANTS.IMMUNITY_DURATION);
          break;

        case 2:
          // 1.2 Brindar 1 vida extra (+1 a lives, aviso "haz ganado 1 vida extra", Sección 2.6 - 1.2)
          this.lives += Config.CONSTANTS.EXTRA_LIFE_REWARD;
          this.updateHUD();
          this.showToast('haz ganado 1 vida extra', 3000, '❤️');
          break;

        case 3:
          // 1.3 Brindar 2 minutos extra (+120 a time, aviso "haz ganado 120s extra de tiempo", Sección 2.6 - 1.3)
          this.time += Config.CONSTANTS.EXTRA_TIME_REWARD;
          this.updateHUD();
          this.showToast('haz ganado 120s extra de tiempo', 3000, '⏳');
          break;
      }
    },

    /**
     * Despliega y gestiona el recuadro de cuenta regresiva de Inmunidad (#immunity-banner)
     */
    startImmunityBannerCountdown(seconds) {
      const banner = document.getElementById('immunity-banner');
      const timerVal = document.getElementById('immunity-timer-val');

      if (!banner || !timerVal) return;

      banner.classList.remove('hidden');
      timerVal.textContent = seconds;

      let remaining = seconds;
      if (this.immunityInterval) clearInterval(this.immunityInterval);

      this.immunityInterval = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
          clearInterval(this.immunityInterval);
          banner.classList.add('hidden');
          if (this.player) this.player.isImmune = false;
        } else {
          timerVal.textContent = remaining;
        }
      }, 1000);
    },

    // ========================================================================
    // 7. AVISO TEMPORAL (TOAST FLOTANTE, Sección 2.5 y 2.6)
    // ========================================================================
    showToast(message, duration = 3000, icon = '⭐') {
      const toast = document.getElementById('toast-notification');
      const msgElem = document.getElementById('toast-message');
      const iconElem = document.getElementById('toast-icon');

      if (!toast) return;

      if (msgElem) msgElem.textContent = message;
      if (iconElem) iconElem.textContent = icon;

      toast.classList.remove('hidden');

      if (this.toastTimeout) {
        clearTimeout(this.toastTimeout);
      }

      this.toastTimeout = setTimeout(() => {
        toast.classList.add('hidden');
      }, duration);
    },

    // ========================================================================
    // 8. META DE NIVEL Y PANTALLA DE DESPEDIDA / FIN DEL JUEGO
    // ========================================================================
    handleLevelGoalReached(goal) {
      if (this.state !== 'PLAYING') return;
      this.state = 'LEVEL_COMPLETE';

      // Sonido de victoria de nivel (Sección 2.7)
      if (AudioMgr.playSFX) AudioMgr.playSFX('SFX_VICTORIA');

      // Incrementar variable "Progress" en +1 (Sección 2.3.4 y 4)
      this.progress++;
      this.updateHUD();

      // Detener temporizador
      if (this.levelTimerInterval) clearInterval(this.levelTimerInterval);

      // Comprobar si se completaron los 3 niveles (Progress = 3, Sección 5)
      if (this.progress >= Config.CONSTANTS.TOTAL_LEVELS) {
        this.triggerVictoryScreen();
      } else {
        // Pasar al siguiente nivel de la cola barajada
        this.showToast(`¡Nivel Superado! Avanzando al siguiente escenario...`, 2500, '🚩');
        setTimeout(() => {
          this.currentLevelIndex++;
          if (this.currentLevelIndex < this.levelQueue.length) {
            this.loadLevel(this.levelQueue[this.currentLevelIndex]);
          } else {
            this.triggerVictoryScreen();
          }
        }, 2200);
      }
    },

    /**
     * Pantalla de Despedida / Fin del Juego (#victory-screen, Sección 5)
     */
    triggerVictoryScreen() {
      this.state = 'VICTORY';

      // Detener temporizadores de nivel e inmunidad
      if (this.levelTimerInterval) clearInterval(this.levelTimerInterval);
      if (this.immunityInterval) clearInterval(this.immunityInterval);

      // Ocultar HUD
      document.getElementById('game-hud')?.classList.add('hidden');
      document.getElementById('immunity-banner')?.classList.add('hidden');

      // Reproducir música de Créditos "ssstik.io.mp3" (Sección 2.7)
      if (AudioMgr.playBGM) {
        AudioMgr.playBGM('BGM_CREDITOS');
      }

      // Mostrar Pantalla de Despedida
      const victoryScreen = document.getElementById('victory-screen');
      if (victoryScreen) {
        victoryScreen.classList.remove('hidden');
      }

      // Función de regreso al menú de inicio
      const returnToStartMenu = () => {
        if (this.victoryTimeout) clearTimeout(this.victoryTimeout);
        if (this.victoryKeyHandler) window.removeEventListener('keydown', this.victoryKeyHandler);

        victoryScreen?.classList.add('hidden');
        document.getElementById('start-screen')?.classList.remove('hidden');

        // Volver a la música de inicio "slimeyfox-582346.mp3"
        if (AudioMgr.playBGM) {
          AudioMgr.playBGM('BGM_INICIO');
        }
        this.state = 'START_SCREEN';
      };

      // Retorno automático tras 60 segundos (Sección 5)
      this.victoryTimeout = setTimeout(returnToStartMenu, Config.CONSTANTS.VICTORY_SCREEN_TIMEOUT);

      // O retorno inmediato al detectar cualquier pulsación del teclado (Sección 5)
      this.victoryKeyHandler = (e) => {
        returnToStartMenu();
      };
      window.addEventListener('keydown', this.victoryKeyHandler, { once: true });
    },

    // ========================================================================
    // 9. FLUJO DE GAME OVER (Notas del Juego)
    // ========================================================================
    triggerGameOver(reason) {
      this.state = 'GAME_OVER';

      // Detener temporizadores
      if (this.levelTimerInterval) clearInterval(this.levelTimerInterval);
      if (this.immunityInterval) clearInterval(this.immunityInterval);

      // Detener música de nivel y reproducir sonido de Game Over "csy3tfy6v_NWM.mp3" (Sección 2.7)
      if (AudioMgr.stopBGM) AudioMgr.stopBGM();
      if (AudioMgr.playSFX) AudioMgr.playSFX('SFX_GAMEOVER');

      // Ocultar HUD e inmunidad
      document.getElementById('game-hud')?.classList.add('hidden');
      document.getElementById('immunity-banner')?.classList.add('hidden');
      document.getElementById('toast-notification')?.classList.add('hidden');

      // Mostrar pantalla GAME OVER (fondo negro con letras blancas centradas, Notas del Juego)
      const gameOverScreen = document.getElementById('gameover-screen');
      if (gameOverScreen) {
        gameOverScreen.classList.remove('hidden');
      }

      // Proceder a regresar a la pantalla de inicio tras 4 segundos (Notas del Juego)
      setTimeout(() => {
        gameOverScreen?.classList.add('hidden');
        document.getElementById('start-screen')?.classList.remove('hidden');

        // Reiniciar soundtrack de inicio "slimeyfox-582346.mp3"
        if (AudioMgr.playBGM) {
          AudioMgr.playBGM('BGM_INICIO');
        }
        this.state = 'START_SCREEN';
      }, 4000);
    },

    // ========================================================================
    // 10. GAME LOOP PRINCIPAL (60 FPS)
    // ========================================================================
    loop(timestamp) {
      // Calcular deltaTime en segundos
      let dt = (timestamp - this.lastTimestamp) / 1000;
      this.lastTimestamp = timestamp;

      // Limitar dt para evitar saltos drásticos si se minimiza la ventana
      if (dt > 0.08) dt = 0.08;

      // Actualizar y renderizar solo si estamos en partida activa
      if (this.state === 'PLAYING' && this.currentLevel && this.player) {
        // 1. Actualizar física del jugador
        this.player.update(dt, this.inputState);

        // 2. Resolver colisiones de relieve AABB (Sección 2.3.4)
        Entities.resolvePlayerPlatformCollisions(this.player, this.currentLevel.platforms);

        // 3. Resolver colisión con el Obstáculo Fijo (Sección 2.5.1)
        Entities.checkFixedObstacleCollision(this.player, this.currentLevel.fixedObstacle);

        // 4. Resolver colisión con los Obstáculos Móviles (Sección 2.5.2)
        Entities.checkMobileObstaclesCollision(this.player, this.currentLevel.mobileObstacles);

        // 5. Verificar llegada a la meta del nivel (Sección 2.3.4)
        Entities.checkLevelGoal(this.player, this.currentLevel.goal);

        // 6. Actualizar entidades y cámara del nivel
        this.currentLevel.update(dt, this.player);

        // 7. Renderizar fotograma completo en el Canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.currentLevel.render(this.ctx, this.player);
      }

      // Siguiente cuadro de animación
      requestAnimationFrame((t) => this.loop(t));
    }
  };

  // Inicializar el motor cuando el documento esté completamente cargado
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => GameEngine.init());
  } else {
    GameEngine.init();
  }

  // Exportar al objeto global
  window.GameEngine = GameEngine;

})(window);
