/**
 * ============================================================================
 * THE LEGEND OF TRIGONOMUS - LEVELS.JS (FASE 4)
 * Generador de Niveles, Relieve Interactivo, Cámara y Fondos Replicados
 * Especificación Técnica: Secciones 2.3.2, 2.3.4, 3 y 4 (4.1, 4.2, 4.3)
 * ============================================================================
 */

(function (window) {
  'use strict';

  // Importar entidades y configuración de juego
  const Entities = window.GameEntities || {};
  const Platform = Entities.Platform;
  const BounceBlock = Entities.BounceBlock;
  const SkillBox = Entities.SkillBox;
  const FixedObstacle = Entities.FixedObstacle;
  const MobileObstacle = Entities.MobileObstacle;
  const LevelGoal = Entities.LevelGoal;

  // ==========================================================================
  // 1. SISTEMA DE CÁMARA (Sección 2.3.2)
  // "La cámara seguirá al personaje en todo momento, con un rango de enfoque amplio,
  // siempre y cuando no exceda los bordes del nivel (similar a Super Mario Bros)"
  // ==========================================================================
  class Camera {
    /**
     * @param {number} viewportWidth - Ancho visible de la pantalla (960px)
     * @param {number} viewportHeight - Alto visible de la pantalla (540px)
     * @param {number} levelWidth - Longitud total del nivel (~3700px)
     */
    constructor(viewportWidth = 960, viewportHeight = 540, levelWidth = 3700) {
      this.viewportWidth = viewportWidth;
      this.viewportHeight = viewportHeight;
      this.levelWidth = levelWidth;
      this.x = 0;
      this.y = 0;

      // Suavizado cinemático de cámara (lerp)
      this.smoothFactor = 0.12;

      // El jugador se mantiene preferentemente alrededor del 38% del ancho de pantalla
      this.targetLead = this.viewportWidth * 0.38;
    }

    /**
     * Restablece la cámara al inicio del nivel
     */
    reset() {
      this.x = 0;
      this.y = 0;
    }

    /**
     * Actualiza la posición de la cámara siguiendo al jugador sin rebasar bordes (Clamped)
     */
    update(player) {
      if (!player) return;

      // Objetivo ideal de posición horizontal de cámara
      const desiredX = player.x - this.targetLead;

      // Interpolación suave hacia la posición objetivo
      this.x += (desiredX - this.x) * this.smoothFactor;

      // Límite estricto: nunca mostrar más allá de x = 0 ni del extremo final del nivel
      const maxCameraX = Math.max(0, this.levelWidth - this.viewportWidth);
      if (this.x < 0) {
        this.x = 0;
      } else if (this.x > maxCameraX) {
        this.x = maxCameraX;
      }
    }
  }

  // ==========================================================================
  // 2. CLASE LEVEL (ESTRUCTURA DE CADA ESCENARIO)
  // ==========================================================================
  class Level {
    /**
     * @param {Object} options - Parámetros del nivel
     */
    constructor(options) {
      this.id = options.id;                             // 'Grecia', 'Ciudad', 'Desierto'
      this.name = options.name;                         // 'Nivel Grecia', etc.
      this.questionGroup = options.questionGroup;       // 'Geometria', 'Trigonometria', 'Ambos'
      this.bgAssetKey = options.bgAssetKey;             // 'BG_GRECIA', 'BG_CIUDAD', 'BG_DESIERTO'
      this.bgmKey = options.bgmKey;                     // 'BGM_GRECIA', 'BGM_CIUDAD', 'BGM_DESIERTO'
      this.theme = options.theme;                       // 'grecia', 'ciudad', 'desierto'
      this.width = options.width || 3700;
      this.height = options.height || 540;

      // Entidades que componen el escenario
      this.platforms = options.platforms || [];
      this.fixedObstacle = options.fixedObstacle || null;
      this.mobileObstacles = options.mobileObstacles || [];
      this.skillBoxes = options.skillBoxes || [];
      this.goal = options.goal || null;

      // Cámara asociada
      this.camera = new Camera(960, 540, this.width);

      // Callbacks de interacción
      this.onFixedObstacleTrigger = options.onFixedObstacleTrigger || null;
      this.onMobileObstacleTrigger = options.onMobileObstacleTrigger || null;
      this.onSkillBoxHit = options.onSkillBoxHit || null;
      this.onLevelGoalReached = options.onLevelGoalReached || null;
    }

    /**
     * Actualiza todas las entidades del nivel y la cámara
     */
    update(dt, player) {
      // 1. Actualizar cámara siguiendo al jugador
      this.camera.update(player);

      // 2. Actualizar obstáculos móviles
      for (let i = 0; i < this.mobileObstacles.length; i++) {
        this.mobileObstacles[i].update(dt);
      }

      // 3. Actualizar bloques de habilidad (rebote al golpearse)
      for (let i = 0; i < this.skillBoxes.length; i++) {
        this.skillBoxes[i].update(dt);
      }

      // 4. Actualizar resortes/trampolines (animación de compresión)
      for (let i = 0; i < this.platforms.length; i++) {
        if (this.platforms[i].isBounce && typeof this.platforms[i].update === 'function') {
          this.platforms[i].update(dt);
        }
      }
    }

    /**
     * Dibuja el fondo replicado horizontalmente a medida que el jugador avanza
     */
    renderBackground(ctx) {
      let bgImg = null;
      if (window.GAME_CONFIG && window.GAME_CONFIG.AssetLoader) {
        bgImg = window.GAME_CONFIG.AssetLoader.getImage(this.bgAssetKey);
      }

      const camX = this.camera.x;
      const viewW = this.camera.viewportWidth;
      const viewH = this.camera.viewportHeight;

      if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
        // Altura de renderizado ajustada a la pantalla (540px)
        const renderH = viewH;
        // Ancho manteniendo la relación de aspecto original
        const renderW = Math.round((bgImg.naturalWidth / bgImg.naturalHeight) * renderH);

        // Desplazamiento de fondo replicado (estilo retro arcade)
        // Parallax sutil del 70% de la velocidad de cámara
        const offsetX = (camX * 0.7) % renderW;
        let startDrawX = -Math.round(offsetX);

        // Si startDrawX deja un hueco a la izquierda, retroceder un bloque
        if (startDrawX > 0) {
          startDrawX -= renderW;
        }

        // Dibujar franjas replicadas consecutivas hasta cubrir todo el ancho de la pantalla
        while (startDrawX < viewW) {
          ctx.drawImage(bgImg, startDrawX, 0, renderW, renderH);
          startDrawX += renderW;
        }

        // Filtro sutil para homogeneizar contraste con los sprites y plataformas
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.fillRect(0, 0, viewW, viewH);
      } else {
        // Fallback temático en gradiente retro si la imagen no ha cargado
        const grad = ctx.createLinearGradient(0, 0, 0, viewH);
        if (this.theme === 'grecia') {
          grad.addColorStop(0, '#1a365d');
          grad.addColorStop(1, '#63b3ed');
        } else if (this.theme === 'ciudad') {
          grad.addColorStop(0, '#171923');
          grad.addColorStop(1, '#4a5568');
        } else {
          grad.addColorStop(0, '#744210');
          grad.addColorStop(1, '#ecc94b');
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, viewW, viewH);
      }
    }

    /**
     * Renderizado completo del escenario, bloques y entidades
     */
    render(ctx, player) {
      const camX = this.camera.x;

      // 1. Fondo replicado
      this.renderBackground(ctx);

      // 2. Plataformas, escalones, pilares y trampolines
      for (let i = 0; i < this.platforms.length; i++) {
        this.platforms[i].render(ctx, camX);
      }

      // 3. Cuadros de Habilidad
      for (let i = 0; i < this.skillBoxes.length; i++) {
        this.skillBoxes[i].render(ctx, camX);
      }

      // 4. Meta del nivel
      if (this.goal) {
        this.goal.render(ctx, camX);
      }

      // 5. Obstáculo Fijo (a mitad del nivel)
      if (this.fixedObstacle) {
        this.fixedObstacle.render(ctx, camX);
      }

      // 6. Obstáculos Móviles patrullando
      for (let i = 0; i < this.mobileObstacles.length; i++) {
        this.mobileObstacles[i].render(ctx, camX);
      }

      // 7. Jugador
      if (player) {
        player.render(ctx, camX);
      }
    }

    /**
     * Permite comprobar si un clic en la pantalla impacta en un Cuadro de Habilidad
     */
    handleCanvasClick(screenX, screenY) {
      const worldX = screenX + this.camera.x;
      const worldY = screenY;

      for (let i = 0; i < this.skillBoxes.length; i++) {
        const box = this.skillBoxes[i];
        if (box.checkClick(worldX, worldY)) {
          return true;
        }
      }
      return false;
    }
  }

  // ==========================================================================
  // 3. GENERADOR DE ESCENARIOS (LEVEL BUILDER, Sección 4)
  // ==========================================================================
  const LevelBuilder = {
    GROUND_Y: 460,       // Nivel del suelo base
    GROUND_HEIGHT: 80,   // Altura visual del suelo base
    LEVEL_WIDTH: 3700,   // Longitud total del mapa (~3700px)
    GOAL_X: 3500,        // Posición de la meta

    /**
     * Generador seguro de variaciones aleatorias para cumplir con la Sección 3
     * (los obstáculos tienen ligeras variaciones de ritmo y posición en cada partida)
     */
    _randomBetween(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    /**
     * Construye y retorna la instancia del nivel solicitado ('Grecia', 'Ciudad' o 'Desierto')
     */
    buildLevel(levelId, callbacks = {}) {
      switch (levelId) {
        case 'Grecia':
          return this.buildGrecia(callbacks);
        case 'Ciudad':
          return this.buildCiudad(callbacks);
        case 'Desierto':
          return this.buildDesierto(callbacks);
        default:
          console.warn(`[LevelBuilder] Nivel desconocido "${levelId}". Cargando Grecia por defecto.`);
          return this.buildGrecia(callbacks);
      }
    },

    // ------------------------------------------------------------------------
    // 4.1 NIVEL "GRECIA" (Grupo Geometría, Secciones 4.1 y 4.1.1)
    // ------------------------------------------------------------------------
    buildGrecia(callbacks = {}) {
      const theme = 'grecia';
      const platforms = [];

      // 1. Suelo firme continuo (Sección 2.3.4)
      platforms.push(new Platform(0, this.GROUND_Y, this.LEVEL_WIDTH, this.GROUND_HEIGHT, theme, 'ground'));

      // 2. Tramo inicial (x: 0 - 1300):
      // Suelo plano con plataformas bajas de mármol a media altura
      platforms.push(new Platform(260, 360, 160, 24, theme, 'floating'));
      platforms.push(new Platform(520, 310, 180, 24, theme, 'floating'));
      platforms.push(new Platform(820, 350, 200, 24, theme, 'floating'));
      platforms.push(new Platform(1080, 300, 160, 24, theme, 'floating'));

      // Pilares griegos bajos iniciales (funcionando como tuberías de Mario, Sección 4.1.1)
      platforms.push(new Platform(740, 390, 48, 70, theme, 'pillar'));
      platforms.push(new Platform(1240, 380, 52, 80, theme, 'pillar'));

      // 3. Tramo medio (x: 1300 - 2100):
      // Escalinatas ascendentes y descendentes tipo templo griego (x: 1340 - 1640)
      platforms.push(new Platform(1340, 420, 60, 40, theme, 'step'));
      platforms.push(new Platform(1400, 380, 60, 80, theme, 'step'));
      platforms.push(new Platform(1460, 340, 120, 120, theme, 'step')); // Cima del templo
      platforms.push(new Platform(1580, 380, 60, 80, theme, 'step'));
      platforms.push(new Platform(1640, 420, 60, 40, theme, 'step'));

      // ZONA COMPLETAMENTE DESPEJADA DEL SUELO EN x = 1700 a 1840 para el OBSTÁCULO FIJO
      // (Garantiza que no quede superpuesto sobre ningún pilar o bloque, Sección 4.1.1)

      // Plataforma post-obstáculo fijo
      platforms.push(new Platform(1900, 350, 180, 24, theme, 'floating'));

      // 4. Tramo final (x: 2100 - 3500):
      // Plataformas flotantes escalonadas a doble altura
      platforms.push(new Platform(2180, 340, 160, 24, theme, 'floating'));
      platforms.push(new Platform(2380, 290, 180, 24, theme, 'floating'));

      // Bloque de rebote (Trampolín) para alcanzar un cuadro de habilidad elevado (Sección 4.1.1)
      const bounceX = 2620;
      platforms.push(new BounceBlock(bounceX, 436, 48, 24, theme));
      // Plataforma superior sobre el trampolín
      platforms.push(new Platform(2580, 210, 130, 24, theme, 'floating'));

      // Pilares bajos que acotan patrullaje de obstáculos móviles
      platforms.push(new Platform(2800, 380, 52, 80, theme, 'pillar'));
      platforms.push(new Platform(3100, 370, 52, 90, theme, 'pillar'));
      platforms.push(new Platform(3350, 410, 60, 50, theme, 'step'));

      // ======================================================================
      // CUADROS DE HABILIDAD (IMG_0672.png, Al menos 3 por nivel)
      // ======================================================================
      const skillBoxes = [];
      // Cuadro 1: Tramo inicial accesible mediante salto simple (x = 320, y = 240)
      skillBoxes.push(new SkillBox(320, 240, callbacks.onSkillBoxHit));
      // Cuadro 2: Tramo medio sobre la escalinata del templo (x = 1500, y = 220)
      skillBoxes.push(new SkillBox(1500, 220, callbacks.onSkillBoxHit));
      // Cuadro 3: Tramo final elevado sobre el trampolín de rebote (x = 2620, y = 140)
      skillBoxes.push(new SkillBox(2620, 140, callbacks.onSkillBoxHit));

      // ======================================================================
      // OBSTÁCULO FIJO (obstaculo_del_mapa.png, Mitad del nivel x = 1750)
      // ======================================================================
      const fixedObstacle = new FixedObstacle(1750, this.GROUND_Y - 110, callbacks.onFixedObstacleTrigger);

      // ======================================================================
      // 6 OBSTÁCULOS MÓVILES (obstaculo_movible.png, Sección 2.5.2)
      // Variaciones aleatorias seguras dentro de sus zonas despejadas (Sección 3)
      // ======================================================================
      const mobileObstacles = [];
      const mobY = this.GROUND_Y - 44; // Apoyados en el suelo

      // Mob 1: Tramo inicial bajo primera plataforma
      const m1Min = 140, m1Max = 440;
      mobileObstacles.push(new MobileObstacle(this._randomBetween(m1Min, m1Max), mobY, m1Min, m1Max, callbacks.onMobileObstacleTrigger));

      // Mob 2: Antes del primer pilar
      const m2Min = 500, m2Max = 710;
      mobileObstacles.push(new MobileObstacle(this._randomBetween(m2Min, m2Max), mobY, m2Min, m2Max, callbacks.onMobileObstacleTrigger));

      // Mob 3: Entre primer y segundo pilar
      const m3Min = 820, m3Max = 1200;
      mobileObstacles.push(new MobileObstacle(this._randomBetween(m3Min, m3Max), mobY, m3Min, m3Max, callbacks.onMobileObstacleTrigger));

      // Mob 4: Tras el obstáculo fijo
      const m4Min = 1880, m4Max = 2120;
      mobileObstacles.push(new MobileObstacle(this._randomBetween(m4Min, m4Max), mobY, m4Min, m4Max, callbacks.onMobileObstacleTrigger));

      // Mob 5: Entre pilares finales
      const m5Min = 2860, m5Max = 3080;
      mobileObstacles.push(new MobileObstacle(this._randomBetween(m5Min, m5Max), mobY, m5Min, m5Max, callbacks.onMobileObstacleTrigger));

      // Mob 6: Antes del altar/meta final
      const m6Min = 3160, m6Max = 3320;
      mobileObstacles.push(new MobileObstacle(this._randomBetween(m6Min, m6Max), mobY, m6Min, m6Max, callbacks.onMobileObstacleTrigger));

      // ======================================================================
      // META FINAL (LevelGoal, x = 3500)
      // ======================================================================
      const goal = new LevelGoal(this.GOAL_X, this.GROUND_Y - 220, callbacks.onLevelGoalReached);

      return new Level({
        id: 'Grecia',
        name: 'Nivel Grecia',
        questionGroup: 'Geometria',
        bgAssetKey: 'BG_GRECIA',
        bgmKey: 'BGM_GRECIA',
        theme: 'grecia',
        width: this.LEVEL_WIDTH,
        height: 540,
        platforms,
        fixedObstacle,
        mobileObstacles,
        skillBoxes,
        goal,
        ...callbacks
      });
    },

    // ------------------------------------------------------------------------
    // 4.2 NIVEL "CIUDAD" (Grupo Trigonometría, Secciones 4.2 y 4.2.1)
    // ------------------------------------------------------------------------
    buildCiudad(callbacks = {}) {
      const theme = 'ciudad';
      const platforms = [];

      // 1. Asfalto principal continuo (Sección 2.3.4)
      platforms.push(new Platform(0, this.GROUND_Y, this.LEVEL_WIDTH, this.GROUND_HEIGHT, theme, 'ground'));

      // 2. Tramo inicial (x: 0 - 1300):
      // Acera principal con plataformas flotantes tipo andamio/ladrillo a distintas alturas
      platforms.push(new Platform(280, 350, 180, 24, theme, 'floating'));
      platforms.push(new Platform(520, 280, 160, 24, theme, 'floating'));
      platforms.push(new Platform(760, 340, 200, 24, theme, 'floating'));
      platforms.push(new Platform(1040, 290, 180, 24, theme, 'floating'));

      // Contenedores/cajas sólidas para escalar
      platforms.push(new Platform(690, 400, 50, 60, theme, 'step'));
      platforms.push(new Platform(1220, 390, 54, 70, theme, 'step'));

      // 3. Tramo medio (x: 1300 - 2100):
      // Bloques escalonados y vigas suspendidas con cuadro de habilidad superior
      platforms.push(new Platform(1350, 410, 60, 50, theme, 'step'));
      platforms.push(new Platform(1420, 360, 70, 100, theme, 'step'));
      platforms.push(new Platform(1500, 300, 140, 24, theme, 'floating')); // Viga suspendida
      platforms.push(new Platform(1650, 390, 60, 70, theme, 'step'));

      // ZONA COMPLETAMENTE PLANA Y DESPEJADA EN EL ASFALTO EN x = 1750 PARA EL OBSTÁCULO FIJO
      // (Sección 4.2.1)

      platforms.push(new Platform(1920, 350, 160, 24, theme, 'floating'));

      // 4. Tramo final (x: 2100 - 3500):
      // Secuencia rítmica de cajas sólidas bajas que obligan a saltar
      platforms.push(new Platform(2180, 415, 45, 45, theme, 'step'));
      platforms.push(new Platform(2340, 415, 45, 45, theme, 'step'));

      // Plataformas aéreas en dos niveles con trampolín de rebote (Sección 4.2.1)
      const bounceX = 2520;
      platforms.push(new BounceBlock(bounceX, 436, 48, 24, theme));
      platforms.push(new Platform(2480, 230, 140, 24, theme, 'floating')); // Nivel alto 1
      platforms.push(new Platform(2680, 310, 160, 24, theme, 'floating')); // Nivel alto 2

      // Contenedores y callejones inferiores
      platforms.push(new Platform(2900, 390, 52, 70, theme, 'step'));
      platforms.push(new Platform(3180, 380, 56, 80, theme, 'step'));
      platforms.push(new Platform(3360, 410, 60, 50, theme, 'step'));

      // ======================================================================
      // CUADROS DE HABILIDAD (IMG_0672.png)
      // ======================================================================
      const skillBoxes = [];
      // Cuadro 1: Tramo inicial flotando entre andamios (x = 360, y = 230)
      skillBoxes.push(new SkillBox(360, 230, callbacks.onSkillBoxHit));
      // Cuadro 2: Tramo medio en la parte superior de la viga (x = 1550, y = 180)
      skillBoxes.push(new SkillBox(1550, 180, callbacks.onSkillBoxHit));
      // Cuadro 3: Tramo final elevado alcanzable con trampolín urbano (x = 2520, y = 130)
      skillBoxes.push(new SkillBox(2520, 130, callbacks.onSkillBoxHit));

      // ======================================================================
      // OBSTÁCULO FIJO (obstaculo_del_mapa.png, x = 1750 sobre asfalto limpio)
      // ======================================================================
      const fixedObstacle = new FixedObstacle(1750, this.GROUND_Y - 110, callbacks.onFixedObstacleTrigger);

      // ======================================================================
      // 6 OBSTÁCULOS MÓVILES (obstaculo_movible.png, Sección 2.5.2)
      // ======================================================================
      const mobileObstacles = [];
      const mobY = this.GROUND_Y - 44;

      // Mob 1: Callejón inicial
      const m1Min = 120, m1Max = 440;
      mobileObstacles.push(new MobileObstacle(this._randomBetween(m1Min, m1Max), mobY, m1Min, m1Max, callbacks.onMobileObstacleTrigger));

      // Mob 2: Entre contenedores iniciales
      const m2Min = 480, m2Max = 660;
      mobileObstacles.push(new MobileObstacle(this._randomBetween(m2Min, m2Max), mobY, m2Min, m2Max, callbacks.onMobileObstacleTrigger));

      // Mob 3: Antes del tramo medio
      const m3Min = 760, m3Max = 1180;
      mobileObstacles.push(new MobileObstacle(this._randomBetween(m3Min, m3Max), mobY, m3Min, m3Max, callbacks.onMobileObstacleTrigger));

      // Mob 4: Callejón tras el obstáculo fijo
      const m4Min = 1880, m4Max = 2120;
      mobileObstacles.push(new MobileObstacle(this._randomBetween(m4Min, m4Max), mobY, m4Min, m4Max, callbacks.onMobileObstacleTrigger));

      // Mob 5: Entre cajas del tramo final
      const m5Min = 2240, m5Max = 2460;
      mobileObstacles.push(new MobileObstacle(this._randomBetween(m5Min, m5Max), mobY, m5Min, m5Max, callbacks.onMobileObstacleTrigger));

      // Mob 6: Callejón previo a la meta
      const m6Min = 2970, m6Max = 3300;
      mobileObstacles.push(new MobileObstacle(this._randomBetween(m6Min, m6Max), mobY, m6Min, m6Max, callbacks.onMobileObstacleTrigger));

      // ======================================================================
      // META FINAL (LevelGoal, x = 3500)
      // ======================================================================
      const goal = new LevelGoal(this.GOAL_X, this.GROUND_Y - 220, callbacks.onLevelGoalReached);

      return new Level({
        id: 'Ciudad',
        name: 'Nivel Ciudad',
        questionGroup: 'Trigonometria',
        bgAssetKey: 'BG_CIUDAD',
        bgmKey: 'BGM_CIUDAD',
        theme: 'ciudad',
        width: this.LEVEL_WIDTH,
        height: 540,
        platforms,
        fixedObstacle,
        mobileObstacles,
        skillBoxes,
        goal,
        ...callbacks
      });
    },

    // ------------------------------------------------------------------------
    // 4.3 NIVEL "DESIERTO" (Grupo Ambos, Secciones 4.3 y 4.3.1)
    // ------------------------------------------------------------------------
    buildDesierto(callbacks = {}) {
      const theme = 'desierto';
      const platforms = [];

      // 1. Suelo arenoso continuo (Sección 2.3.4)
      platforms.push(new Platform(0, this.GROUND_Y, this.LEVEL_WIDTH, this.GROUND_HEIGHT, theme, 'ground'));

      // 2. Tramo inicial (x: 0 - 1300):
      // Terreno desértico con plataformas de arenisca y muros de ruinas
      platforms.push(new Platform(260, 360, 170, 24, theme, 'floating'));
      platforms.push(new Platform(490, 300, 160, 24, theme, 'floating'));
      platforms.push(new Platform(780, 350, 180, 24, theme, 'floating'));
      platforms.push(new Platform(1050, 310, 160, 24, theme, 'floating'));

      // Pequeños muros de ruinas donde rebotan los obstáculos móviles (Sección 4.3.1)
      platforms.push(new Platform(680, 395, 48, 65, theme, 'pillar'));
      platforms.push(new Platform(1220, 390, 50, 70, theme, 'pillar'));

      // 3. Tramo medio (x: 1300 - 2100):
      // Estructura piramidal escalonada (subida y bajada de bloques)
      platforms.push(new Platform(1330, 420, 60, 40, theme, 'step'));
      platforms.push(new Platform(1390, 380, 60, 80, theme, 'step'));
      platforms.push(new Platform(1450, 340, 60, 120, theme, 'step'));
      platforms.push(new Platform(1510, 300, 90, 160, theme, 'step')); // Cima de la pirámide
      platforms.push(new Platform(1600, 340, 60, 120, theme, 'step'));
      platforms.push(new Platform(1660, 380, 60, 80, theme, 'step'));
      platforms.push(new Platform(1720, 420, 60, 40, theme, 'step'));

      // EXPLANADA LIMPIA EN EL SUELO EN x = 1750 PARA EL OBSTÁCULO FIJO (Sección 4.3.1)

      platforms.push(new Platform(1920, 350, 170, 24, theme, 'floating'));

      // 4. Tramo final (x: 2100 - 3500):
      // Plataformas aéreas con bloque de rebote (Sección 4.3.1)
      platforms.push(new Platform(2180, 330, 160, 24, theme, 'floating'));

      const bounceX = 2440;
      platforms.push(new BounceBlock(bounceX, 436, 48, 24, theme));
      platforms.push(new Platform(2400, 220, 130, 24, theme, 'floating')); // Plataforma elevada

      // Pilares de piedra de ruinas acotando obstáculos
      platforms.push(new Platform(2720, 380, 52, 80, theme, 'pillar'));
      platforms.push(new Platform(3050, 370, 52, 90, theme, 'pillar'));

      // Gran escalinata piramidal final que conduce a la meta del nivel (Sección 4.3.1)
      platforms.push(new Platform(3250, 420, 60, 40, theme, 'step'));
      platforms.push(new Platform(3310, 380, 60, 80, theme, 'step'));
      platforms.push(new Platform(3370, 340, 60, 120, theme, 'step'));
      platforms.push(new Platform(3430, 300, 80, 160, theme, 'step')); // Podio final

      // ======================================================================
      // CUADROS DE HABILIDAD (IMG_0672.png)
      // ======================================================================
      const skillBoxes = [];
      // Cuadro 1: Tramo inicial (x = 320, y = 240)
      skillBoxes.push(new SkillBox(320, 240, callbacks.onSkillBoxHit));
      // Cuadro 2: Suspendido sobre la cima de la pirámide (x = 1530, y = 180, Sección 4.3.1)
      skillBoxes.push(new SkillBox(1530, 180, callbacks.onSkillBoxHit));
      // Cuadro 3: Elevado sobre el trampolín de rebote (x = 2440, y = 140)
      skillBoxes.push(new SkillBox(2440, 140, callbacks.onSkillBoxHit));

      // ======================================================================
      // OBSTÁCULO FIJO (obstaculo_del_mapa.png, x = 1750 en la explanada limpia)
      // ======================================================================
      const fixedObstacle = new FixedObstacle(1750, this.GROUND_Y - 110, callbacks.onFixedObstacleTrigger);

      // ======================================================================
      // 6 OBSTÁCULOS MÓVILES (obstaculo_movible.png, Sección 2.5.2)
      // ======================================================================
      const mobileObstacles = [];
      const mobY = this.GROUND_Y - 44;

      // Mob 1: Entre el inicio y el primer muro de ruinas
      const m1Min = 140, m1Max = 440;
      mobileObstacles.push(new MobileObstacle(this._randomBetween(m1Min, m1Max), mobY, m1Min, m1Max, callbacks.onMobileObstacleTrigger));

      // Mob 2: Entre el primer y segundo muro
      const m2Min = 500, m2Max = 650;
      mobileObstacles.push(new MobileObstacle(this._randomBetween(m2Min, m2Max), mobY, m2Min, m2Max, callbacks.onMobileObstacleTrigger));

      // Mob 3: Antes de la pirámide central
      const m3Min = 760, m3Max = 1180;
      mobileObstacles.push(new MobileObstacle(this._randomBetween(m3Min, m3Max), mobY, m3Min, m3Max, callbacks.onMobileObstacleTrigger));

      // Mob 4: Explanada tras el obstáculo fijo
      const m4Min = 1890, m4Max = 2120;
      mobileObstacles.push(new MobileObstacle(this._randomBetween(m4Min, m4Max), mobY, m4Min, m4Max, callbacks.onMobileObstacleTrigger));

      // Mob 5: Entre pilares de ruinas
      const m5Min = 2790, m5Max = 3020;
      mobileObstacles.push(new MobileObstacle(this._randomBetween(m5Min, m5Max), mobY, m5Min, m5Max, callbacks.onMobileObstacleTrigger));

      // Mob 6: Antes de la gran escalinata piramidal final
      const m6Min = 3120, m6Max = 3230;
      mobileObstacles.push(new MobileObstacle(this._randomBetween(m6Min, m6Max), mobY, m6Min, m6Max, callbacks.onMobileObstacleTrigger));

      // ======================================================================
      // META FINAL (LevelGoal, x = 3500)
      // ======================================================================
      const goal = new LevelGoal(this.GOAL_X, this.GROUND_Y - 220, callbacks.onLevelGoalReached);

      return new Level({
        id: 'Desierto',
        name: 'Nivel Desierto',
        questionGroup: 'Ambos',
        bgAssetKey: 'BG_DESIERTO',
        bgmKey: 'BGM_DESIERTO',
        theme: 'desierto',
        width: this.LEVEL_WIDTH,
        height: 540,
        platforms,
        fixedObstacle,
        mobileObstacles,
        skillBoxes,
        goal,
        ...callbacks
      });
    }
  };

  // ==========================================================================
  // EXPORTACIÓN AL OBJETO GLOBAL window.GameLevels
  // ==========================================================================
  window.GameLevels = {
    Camera,
    Level,
    LevelBuilder
  };

})(window);
