/* =================================================================
   main.js — FASE 5: Controlador principal y bucle de juego
   Conecta index.html, config.js, audio.js, entities.js y levels.js.
   Manejo de estados, físicas, preguntas, habilidades y pantallas.
   (Secciones 1, 2, 3, 4 y 5 de "instrucciones juego PAP 2.0.txt")
   ================================================================= */

'use strict';

(function () {

    /* ═════════════════════════════════════════════════════════════
       VARIABLES Y REFERENCIAS GLOBALES DEL MÓDULO
       ═════════════════════════════════════════════════════════════ */

    let canvas = null;
    let ctx = null;

    let player = null;
    let camera = null;
    let currentLevel = null;

    let isPlaying = false;
    let lastTime = 0;
    let secondAccumulator = 0;

    // Objeto contenedor del evento de pregunta activo
    let activeQuestion = {
        entity: null,       // FixedObstacle | MobileObstacle | SkillBox
        type: null,         // 'fixed' | 'mobile' | 'skill'
        questionData: null  // { id, type, question, options, answer }
    };

    let toastTimeout = null;
    const keys = {};


    /* ═════════════════════════════════════════════════════════════
       INICIALIZACIÓN DEL SISTEMA
       ═════════════════════════════════════════════════════════════ */

    window.addEventListener('DOMContentLoaded', () => {
        canvas = document.getElementById('gameCanvas');
        ctx = canvas.getContext('2d');

        // Configuración de controles del menú y listeners del DOM
        setupMenuControls();
        setupQuestionModalControls();
        setupKeyboardListeners();
        setupCanvasClickInteraction();

        // Iniciar loop de renderizado pasivo (para dibujar el canvas cuando no se juegue)
        requestAnimationFrame(gameLoop);

        // Precarga de todos los sprites y fondos de ASSETS sincronizada con pantalla de carga inicial (Módulo 3)
        const initScreen = document.getElementById('initial-loading-screen');
        const barFill    = document.getElementById('initial-load-bar-fill');
        const pctText    = document.getElementById('initial-load-percent');

        const loadStart = performance.now();
        const duration = 1500; // ~1.5 segundos
        let assetsLoaded = false;

        AssetLoader.loadAll().then(() => {
            assetsLoaded = true;
            console.log('Todos los assets gráficos fueron cargados con éxito.');
        }).catch(err => {
            assetsLoaded = true;
            console.warn('Aviso de carga de assets:', err.message);
        });

        function animateInitialLoad(now) {
            const elapsed = now - loadStart;
            const pct = Math.min(100, Math.floor((elapsed / duration) * 100));
            if (barFill) barFill.style.width = `${pct}%`;
            if (pctText) pctText.textContent = `${pct}%`;

            if (elapsed < duration || !assetsLoaded) {
                requestAnimationFrame(animateInitialLoad);
            } else {
                if (barFill) barFill.style.width = '100%';
                if (pctText) pctText.textContent = '100%';

                setTimeout(() => {
                    if (initScreen) {
                        initScreen.classList.add('fade-out');
                        setTimeout(() => {
                            initScreen.classList.add('hidden');
                        }, 350);
                    }
                }, 100);
            }
        }

        requestAnimationFrame(animateInitialLoad);
    });


    /* ═════════════════════════════════════════════════════════════
       1. CONTROLES DEL MENÚ DE INICIO Y MODALES (Sección 1)
       ═════════════════════════════════════════════════════════════ */

    function setupMenuControls() {
        // Selección de personaje (Módulo 1: actualiza insignia SELECCIONADO / SELECCIONAR)
        const cards = document.querySelectorAll('.character-card');
        cards.forEach(card => {
            card.addEventListener('click', () => {
                cards.forEach(c => {
                    c.classList.remove('selected');
                    const tag = c.querySelector('.char-tag');
                    if (tag) tag.textContent = 'SELECCIONAR';
                });
                card.classList.add('selected');
                const selectedTag = card.querySelector('.char-tag');
                if (selectedTag) selectedTag.textContent = 'SELECCIONADO';
                GameState.selectedChar = card.getAttribute('data-character');
            });
        });

        // Botones de iconos de los bordes
        const btnSettings = document.getElementById('btn-settings');
        const btnHelp     = document.getElementById('btn-help');
        const btnCredits  = document.getElementById('btn-credits');

        const modalSettings = document.getElementById('modal-settings');
        const modalHelp     = document.getElementById('modal-help');
        const modalCredits  = document.getElementById('modal-credits');

        function openModal(modal) {
            modal.classList.remove('modal-closing');
            modal.classList.remove('hidden');
        }

        function closeModal(modal) {
            modal.classList.add('modal-closing');
            setTimeout(() => {
                modal.classList.add('hidden');
                modal.classList.remove('modal-closing');
            }, 150);
        }

        btnSettings.addEventListener('click', () => openModal(modalSettings));
        btnHelp.addEventListener('click',     () => openModal(modalHelp));
        btnCredits.addEventListener('click',  () => {
            openModal(modalCredits);
            // Reproducir música de créditos al abrir
            AudioManager.playOverrideBGM('creditos');
        });

        // Botones ✕ y botones de pie para cerrar modales
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.getAttribute('data-close');
                const modal = document.getElementById(targetId);
                if (modal) {
                    closeModal(modal);
                    if (targetId === 'modal-credits') {
                        AudioManager.restoreContextBGM();
                    }
                }
            });
        });

        // Cerrar modales haciendo clic en el fondo oscuro exterior
        [modalSettings, modalHelp, modalCredits].forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    closeModal(overlay);
                    if (overlay === modalCredits) {
                        AudioManager.restoreContextBGM();
                    }
                }
            });
        });

        // Botón "-> Jugar"
        const btnPlay = document.getElementById('btn-play');
        btnPlay.addEventListener('click', () => {
            startNewGame();
        });
    }


    /* ═════════════════════════════════════════════════════════════
       2. INICIO Y CARGA DE PARTIDA / NIVELES (Secciones 2, 3 y 4)
       ═════════════════════════════════════════════════════════════ */

    function resetImmunityUI() {
        if (player && typeof player.clearImmunity === 'function') {
            player.clearImmunity();
        } else {
            GameState.isImmune = false;
            GameState.immunityTimer = 0;
            const banner = document.getElementById('immunity-banner');
            if (banner) banner.classList.add('hidden');
            const timerEl = document.getElementById('immunity-timer');
            if (timerEl) timerEl.textContent = '10';
        }
    }

    function startNewGame() {
        resetImmunityUI();

        if (typeof Randomizer.resetMatchQuestions === 'function') {
            Randomizer.resetMatchQuestions();
        }

        // Variables globales requeridas (Notas del Juego y Sección 4)
        GameState.lives        = 3;
        GameState.progress     = 0;
        GameState.time         = 180; // 3 minutos por nivel
        GameState.isImmune     = false;
        GameState.immunityTimer = 0;
        GameState.isPaused     = false;

        // Barajar orden de los 3 niveles sin repetición mediante Fisher-Yates (Sección 3)
        GameState.levelOrder   = Randomizer.shuffleLevels();
        GameState.currentLevel = 0;

        // Ocultar pantalla de inicio y pantallas de término
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('gameover-screen').classList.add('hidden');
        document.getElementById('victory-screen').classList.add('hidden');
        document.getElementById('immunity-banner').classList.add('hidden');

        const transScreen = document.getElementById('level-transition-screen');
        if (transScreen) transScreen.classList.add('hidden');
        const initScreen = document.getElementById('initial-loading-screen');
        if (initScreen) initScreen.classList.add('hidden');

        // Mostrar HUD
        document.getElementById('game-hud').classList.remove('hidden');

        // Cargar el primer nivel
        loadLevel(GameState.levelOrder[0]);

        isPlaying = true;
        lastTime = performance.now();
        secondAccumulator = 0;
    }

    function loadLevel(levelName) {
        resetImmunityUI();

        // Crear instancia del nivel y su relieve temático (Sección 4)
        currentLevel = LevelBuilder.createLevel(levelName, {
            onSkillBoxHit: (box) => {
                triggerQuestionEvent(box, 'skill');
            }
        });

        // Crear cola de preguntas aleatorias sin repetición del grupo correspondiente (Sección 3)
        GameState.questionQueue = Randomizer.createQuestionQueue(levelName);

        // Instanciar jugador y cámara
        player = new Player(GameState.selectedChar, 60, GROUND_Y);
        resetImmunityUI();
        camera = new Camera(currentLevel.levelWidth);

        // Reset de tiempo de 3 minutos al inicio de cada nivel
        GameState.time = 180;
        GameState.isPaused = false;
        secondAccumulator = 0;

        updateHud();

        // Reproducir soundtrack del nivel correspondiente (Sección 2.7)
        const trackKey = levelName.toLowerCase();
        AudioManager.setContextBGM(trackKey);

        showToast(`¡Comienza Nivel: ${levelName}!`);
    }

    function updateHud() {
        const livesEl = document.getElementById('hud-lives-val');
        const timeEl  = document.getElementById('hud-time-val');
        const progEl  = document.getElementById('hud-progress-val');

        if (livesEl) livesEl.textContent = Math.max(0, GameState.lives);
        if (timeEl)  timeEl.textContent  = Math.max(0, GameState.time);
        if (progEl)  progEl.textContent  = GameState.progress;
    }


    /* ═════════════════════════════════════════════════════════════
       3. TECLADO Y CLIC EN CANVAS (Secciones 2.3.1 y 2.3.3)
       ═════════════════════════════════════════════════════════════ */

    function setupKeyboardListeners() {
        window.addEventListener('keydown', (e) => {
            keys[e.key] = true;
            keys[e.code] = true;

            // Prevenir scroll de la ventana con las flechas o barra espaciadora
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
                e.preventDefault();
            }
        });

        window.addEventListener('keyup', (e) => {
            keys[e.key] = false;
            keys[e.code] = false;
        });
    }

    function setupCanvasClickInteraction() {
        // Permitir golpear Cuadros de Habilidad haciendo clic sobre ellos (Sección 2.3.3)
        canvas.addEventListener('click', (e) => {
            if (!isPlaying || GameState.isPaused || !player || !currentLevel) return;

            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;

            const clickCanvasX = (e.clientX - rect.left) * scaleX;
            const clickCanvasY = (e.clientY - rect.top)  * scaleY;

            // Convertir coordenadas del canvas a coordenadas del mundo (sumando camera.x)
            const worldX = clickCanvasX + camera.x;
            const worldY = clickCanvasY;

            for (let i = 0; i < currentLevel.skillBoxes.length; i++) {
                const box = currentLevel.skillBoxes[i];
                if (!box.used && !box.resolved && box.containsPoint(worldX, worldY)) {
                    if (typeof box.onHit === 'function') {
                        box.hitFromBelow();
                    } else {
                        box.hitFromBelow();
                        triggerQuestionEvent(box, 'skill');
                    }
                    break;
                }
            }
        });
    }


    /* ═════════════════════════════════════════════════════════════
       4. BUCLE PRINCIPAL DE JUEGO (GAME LOOP)
       ═════════════════════════════════════════════════════════════ */

    function gameLoop(timestamp) {
        if (!lastTime) lastTime = timestamp;
        const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
        lastTime = timestamp;

        if (isPlaying && currentLevel && player) {
            // Actualización de física y colisiones si no está en pausa
            if (!GameState.isPaused) {
                updateGame(dt);
            }

            // Renderizado completo en Canvas
            renderGame();
        }

        requestAnimationFrame(gameLoop);
    }

    function updateGame(dt) {
        // 1. Temporizador regresivo: se le resta 1 segundo cada segundo (Notas del Juego)
        secondAccumulator += dt;
        if (secondAccumulator >= 1.0) {
            secondAccumulator -= 1.0;
            GameState.time -= 1;
            updateHud();

            if (GameState.time <= 0) {
                triggerGameOver();
                return;
            }
        }

        // 2. Control y actualización física del jugador
        player.handleInput(keys);
        player.update(dt);

        // 3. Resolución de colisiones AABB con terreno / plataformas (Sección 2.3.4)
        Entities.resolvePlayerPlatformCollisions(player, currentLevel.blocks, dt);

        // 4. Resolución de colisiones AABB con Cuadros de Habilidad (Paso 2)
        const hitSkill = Entities.resolvePlayerSkillBoxCollisions(player, currentLevel.skillBoxes);
        if (hitSkill) {
            if (typeof hitSkill.onHit !== 'function') {
                triggerQuestionEvent(hitSkill, 'skill');
            }
            return;
        }

        // 5. Bloques de rebote / trampolines (1.5× salto)
        CollisionEngine.resolvePlayerVsBounce(player, currentLevel.bounceBlocks);

        // 6. Colisión con Obstáculo Fijo (Paso 1)
        const fixedHit = checkFixedObstacleCollision(player, currentLevel.fixedObstacle);
        if (fixedHit && !currentLevel.fixedObstacle.resolved && !player.isImmune) {
            triggerQuestionEvent(currentLevel.fixedObstacle, 'fixed');
            return;
        }

        // 7. Colisión con Obstáculos Móviles ("Goombas")
        const hitMobile = CollisionEngine.resolvePlayerVsMobiles(player, currentLevel.mobileObstacles);
        if (hitMobile && !hitMobile.resolved && !player.isImmune) {
            triggerQuestionEvent(hitMobile, 'mobile');
            return;
        }

        // 8. Llegada a la meta del nivel (LevelGoal en x = 3500)
        if (CollisionEngine.checkGoal(player, currentLevel.goal)) {
            handleLevelComplete();
            return;
        }

        // 9. Actualización de cámara y entidades del nivel
        camera.follow(player);
        currentLevel.update(dt, player);
    }

    function renderGame() {
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

        // Dibujar nivel completo (fondo replicado, bloques, cuadros, meta)
        currentLevel.draw(ctx, camera);

        // Dibujar jugador
        player.draw(ctx, camera);
    }


    /* ═════════════════════════════════════════════════════════════
       5. SISTEMA DE PREGUNTAS Y MODAL (Secciones 2.4, 2.5 y 2.6)
       ═════════════════════════════════════════════════════════════ */

    function triggerQuestionEvent(entity, type) {
        // Si ya hay un modal abierto o el juego está pausado, ignorar nuevo disparo para evitar consumir 2 preguntas
        const modalEl = document.getElementById('modal-question');
        if (GameState.isPaused && modalEl && !modalEl.classList.contains('hidden')) return;

        // Bloquear inmediatamente movimiento del personaje (Sección 2.3.1)
        player.inputLocked = true;
        player.vx = 0;
        GameState.isPaused = true;

        // Extraer siguiente pareja pregunta-respuesta de la cola sin repetir (Sección 3)
        const questionData = GameState.questionQueue.next();

        activeQuestion = {
            entity: entity,
            type: type,
            questionData: questionData
        };

        // Preparar y abrir el modal
        openQuestionModal(questionData, type);
    }

    function openQuestionModal(qData, type) {
        const modal = document.getElementById('modal-question');
        const titleEl = document.getElementById('question-title');
        const textEl = document.getElementById('question-text');

        const inputContainer   = document.getElementById('question-input-container');
        const inputField       = document.getElementById('question-input');
        const optionsContainer = document.getElementById('question-options-container');
        const btnSubmit        = document.getElementById('btn-submit-answer');

        // Título del evento
        if (type === 'skill') {
            titleEl.textContent = '⭐ Desafío de Habilidad';
        } else if (type === 'fixed') {
            titleEl.textContent = '⛔ Desafío de Obstáculo Fijo';
        } else {
            titleEl.textContent = '👾 Desafío de Obstáculo Móvil';
        }

        // Texto de la pregunta
        textEl.textContent = qData.question;
        btnSubmit.disabled = true;

        if (qData.type === 'text') {
            // Pregunta de texto libre
            inputContainer.classList.remove('hidden');
            optionsContainer.classList.add('hidden');
            inputField.value = '';
            setTimeout(() => inputField.focus(), 100);
        } else {
            // Pregunta de opción múltiple (A, B, C, D)
            inputContainer.classList.add('hidden');
            optionsContainer.classList.remove('hidden');

            // Limpiar selección previa
            const radios = document.querySelectorAll('input[name="question-option"]');
            radios.forEach(r => { r.checked = false; });

            // Renderizar textos de opciones con entidades HTML (&sup2;, &pi;, &deg;, &infin;)
            document.getElementById('option-a').innerHTML = qData.options.A;
            document.getElementById('option-b').innerHTML = qData.options.B;
            document.getElementById('option-c').innerHTML = qData.options.C;
            document.getElementById('option-d').innerHTML = qData.options.D;
        }

        modal.classList.remove('hidden');
    }

    function setupQuestionModalControls() {
        const inputField       = document.getElementById('question-input');
        const btnSubmit        = document.getElementById('btn-submit-answer');
        const inputContainer   = document.getElementById('question-input-container');
        const optionsContainer = document.getElementById('question-options-container');
        const radios           = document.querySelectorAll('input[name="question-option"]');

        function evaluateButtonState() {
            let ready = false;
            if (!inputContainer.classList.contains('hidden')) {
                ready = inputField.value.trim().length > 0;
            }
            if (!optionsContainer.classList.contains('hidden')) {
                ready = Array.from(radios).some(r => r.checked);
            }
            btnSubmit.disabled = !ready;
        }

        inputField.addEventListener('input', evaluateButtonState);
        radios.forEach(r => r.addEventListener('change', evaluateButtonState));

        // Permitir responder presionando Enter en el campo de texto
        inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !btnSubmit.disabled) {
                btnSubmit.click();
            }
        });

        // Al presionar el botón "Responder"
        btnSubmit.addEventListener('click', () => {
            handleAnswerSubmission();
        });
    }

    function handleAnswerSubmission() {
        if (!activeQuestion.questionData) return;

        const qData = activeQuestion.questionData;
        let userAnswer = '';

        if (qData.type === 'text') {
            userAnswer = document.getElementById('question-input').value;
        } else {
            const checked = document.querySelector('input[name="question-option"]:checked');
            userAnswer = checked ? checked.value : '';
        }

        // Comparar respuesta usando normalizeAnswer tolerante a tildes y mayúsculas
        const isCorrect = checkAnswer(qData, userAnswer);

        // Cerrar modal y reanudar estado de juego
        document.getElementById('modal-question').classList.add('hidden');
        player.inputLocked = false;
        GameState.isPaused = false;

        // Marcar la entidad como resuelta para permitir el paso del jugador
        if (activeQuestion.entity) {
            activeQuestion.entity.resolved = true;
            if (activeQuestion.type === 'skill') {
                activeQuestion.entity.used = true;
            }
        }

        // Procesar consecuencias según el tipo de entidad
        if (activeQuestion.type === 'fixed' || activeQuestion.type === 'mobile') {
            handleObstacleResult(isCorrect);
        } else if (activeQuestion.type === 'skill') {
            handleSkillResult(isCorrect);
        }

        // Limpiar contexto activo
        activeQuestion = { entity: null, type: null, questionData: null };
    }


    /* ═════════════════════════════════════════════════════════════
       6. CONSECUENCIAS: OBSTÁCULOS Y HABILIDADES (Secciones 2.5 y 2.6)
       ═════════════════════════════════════════════════════════════ */

    function handleObstacleResult(isCorrect) {
        if (isCorrect) {
            // Respuesta correcta en obstáculo (Sección 2.5)
            AudioManager.playSFX('victoria');
            showToast('Desafío Superado');
        } else {
            // Respuesta incorrecta en obstáculo: -1 vida (Sección 2.5)
            AudioManager.playSFX('incorrecta');
            GameState.lives -= 1;
            updateHud();
            showToast('Respuesta incorrecta- Se le restará una vida');

            if (GameState.lives <= 0) {
                triggerGameOver();
            }
        }
    }

    function handleSkillResult(isCorrect) {
        if (isCorrect) {
            // Respuesta correcta en habilidad: sonido de victoria y bonificación aleatoria (Sección 2.6)
            AudioManager.playSFX('victoria');

            // Elegir aleatoriamente 1 de las 3 habilidades (1.1, 1.2 o 1.3)
            const bonusType = Math.floor(Math.random() * 3);

            if (bonusType === 0) {
                // 1.1 Inmunidad por 10 segundos
                player.activateImmunity();
                showToast('¡Has ganado Inmunidad por 10 segundos!');
            } else if (bonusType === 1) {
                // 1.2 1 vida extra
                GameState.lives += 1;
                updateHud();
                showToast('haz ganado 1 vida extra');
            } else {
                // 1.3 2 minutos (120s) extra de tiempo
                GameState.time += 120;
                updateHud();
                showToast('haz ganado 120s extra de tiempo');
            }
        } else {
            // Reto opcional fallido: no resta vida
            AudioManager.playSFX('incorrecta');
            showToast('Reto no superado - No obtienes bonificación');
        }
    }


    /* ═════════════════════════════════════════════════════════════
       7. FIN DE NIVEL, VICTORIA Y GAME OVER (Notas del Juego y Secc 5)
       ═════════════════════════════════════════════════════════════ */

    function handleLevelComplete() {
        if (currentLevel.goal.reached) return;
        currentLevel.goal.reached = true;

        resetImmunityUI();

        player.inputLocked = true;
        player.vx = 0;
        GameState.isPaused = true;

        // Sonido de victoria y +1 al progreso
        AudioManager.playSFX('victoria');
        GameState.progress += 1;
        updateHud();

        if (GameState.progress < 3) {
            GameState.currentLevel += 1;
            const nextLevelName = GameState.levelOrder[GameState.currentLevel];
            showLevelTransition(nextLevelName);
        } else {
            // Se completaron los 3 niveles: Pantalla de Despedida (Sección 5)
            setTimeout(() => {
                triggerVictory();
            }, 1200);
        }
    }

    function showLevelTransition(nextLevelName) {
        const transScreen = document.getElementById('level-transition-screen');
        const progBadge  = document.getElementById('transition-progress-text');
        const nextText   = document.getElementById('transition-next-level');
        const heroImg    = document.getElementById('transition-hero-img');
        const barFill    = document.getElementById('level-load-bar-fill');

        if (progBadge) {
            progBadge.textContent = `PROGRESO: ${GameState.progress} / 3`;
        }
        if (nextText) {
            nextText.textContent = `PREPARANDO SIGUIENTE ESCENARIO: ${nextLevelName.toUpperCase()}...`;
        }
        if (heroImg && CHARACTERS[GameState.selectedChar]) {
            const charData = CHARACTERS[GameState.selectedChar];
            const imgSrc = ASSETS[charData.rightImg];
            if (imgSrc) heroImg.src = imgSrc;
        }

        if (barFill) barFill.style.width = '0%';
        if (transScreen) transScreen.classList.remove('hidden');

        const startTime = performance.now();
        const duration = 1800; // ~1.8 segundos

        function animateLevelLoad(now) {
            const elapsed = now - startTime;
            const pct = Math.min(100, (elapsed / duration) * 100);
            if (barFill) barFill.style.width = `${pct}%`;

            if (elapsed < duration) {
                requestAnimationFrame(animateLevelLoad);
            } else {
                setTimeout(() => {
                    if (transScreen) transScreen.classList.add('hidden');
                    loadLevel(nextLevelName);
                }, 80);
            }
        }

        requestAnimationFrame(animateLevelLoad);
    }

    function triggerVictory() {
        resetImmunityUI();
        isPlaying = false;
        GameState.isPaused = true;

        // Ocultar HUD y mostrar pantalla de victoria dividida en 3 franjas
        document.getElementById('game-hud').classList.add('hidden');
        document.getElementById('victory-screen').classList.remove('hidden');

        // Reproducir música de créditos (Sección 2.7)
        AudioManager.setContextBGM('creditos');

        let handled = false;
        const returnToStart = () => {
            if (handled) return;
            handled = true;

            window.removeEventListener('keydown', returnToStart);
            window.removeEventListener('click', returnToStart);
            clearTimeout(victoryTimer);

            document.getElementById('victory-screen').classList.add('hidden');
            document.getElementById('start-screen').classList.remove('hidden');
            AudioManager.setContextBGM('inicio');
        };

        // Regresar a la pantalla de inicio tras 60 segundos o al pulsar cualquier tecla/clic (Sección 5)
        const victoryTimer = setTimeout(returnToStart, 60000);
        setTimeout(() => {
            window.addEventListener('keydown', returnToStart);
            window.addEventListener('click', returnToStart);
        }, 500);
    }

    function triggerGameOver() {
        resetImmunityUI();
        isPlaying = false;
        GameState.isPaused = true;

        // Detener música de fondo y reproducir SFX de game over (Notas del Juego y Secc 2.7)
        AudioManager.stopAll();
        AudioManager.playSFX('gameover');

        document.getElementById('game-hud').classList.add('hidden');
        document.getElementById('gameover-screen').classList.remove('hidden');

        // Regresar automáticamente a la pantalla de inicio tras unos segundos
        setTimeout(() => {
            document.getElementById('gameover-screen').classList.add('hidden');
            document.getElementById('start-screen').classList.remove('hidden');
            AudioManager.setContextBGM('inicio');
        }, 4000);
    }


    /* ═════════════════════════════════════════════════════════════
       8. AVISO TEMPORAL / TOAST (Duración 3s, Secciones 2.5 y 2.6)
       ═════════════════════════════════════════════════════════════ */

    function showToast(message) {
        const toast = document.getElementById('toast-notification');
        const textEl = document.getElementById('toast-message');
        if (!toast || !textEl) return;

        if (toastTimeout) {
            clearTimeout(toastTimeout);
        }

        textEl.textContent = message;
        toast.classList.remove('hidden');

        toastTimeout = setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
    }

})();
