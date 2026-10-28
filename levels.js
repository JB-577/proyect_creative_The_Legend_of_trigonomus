/* =================================================================
   levels.js — Sistema de Cámara, Fondos Replicados y Diseño de Niveles
   Clases: Camera, Level, LevelBuilder
   (Secciones 2.3.2, 2.3.4, 3 y 4: 4.1, 4.1.1, 4.2, 4.2.1, 4.3 y 4.3.1)
   ================================================================= */

'use strict';

/* ═══════════════════════════════════════════════════════════════════
   1. CLASE Camera (Sección 2.3.2 y 4)
   Sigue suavemente al personaje manteniendo un enfoque amplio del
   escenario estilo Super Mario Bros.
   Restringida (clamped) estrictamente entre x = 0 y levelWidth = 3700.
   Dibuja el fondo replicado continuamente con renderizado pixelado.
   ═══════════════════════════════════════════════════════════════════ */

class Camera {
    /**
     * @param {number} levelWidth – ancho máximo del nivel (por defecto 3700)
     */
    constructor(levelWidth = 3700) {
        this.x          = 0;
        this.width      = CANVAS_W;  // 960 px
        this.height     = CANVAS_H; // 540 px
        this.levelWidth = levelWidth;
    }

    /**
     * Sigue suavemente al jugador centrando el foco en el tercio
     * izquierdo de la pantalla (estilo Mario).
     * @param {Player} player
     */
    follow(player) {
        if (!player) return;

        /* Enfoque amplio: jugador ubicado al 35% del ancho de la pantalla */
        const targetX = player.x - this.width * 0.35;

        /* Suavizado continuo (lerp 10% por frame) */
        this.x += (targetX - this.x) * 0.1;

        /* Restricción estricta (clamping) a los límites del nivel */
        if (this.x < 0) {
            this.x = 0;
        }
        const maxX = this.levelWidth - this.width;
        if (this.x > maxX) {
            this.x = maxX;
        }
    }

    /**
     * Dibuja el fondo 2D del nivel replicándose horizontalmente de forma continua
     * y sin costura vertical mediante espejado alterno en los mosaicos impares.
     * @param {CanvasRenderingContext2D} ctx
     * @param {string} bgAssetKey – clave en AssetLoader ('fondoGrecia'|'fondoCiudad'|'fondoDesierto')
     */
    renderBackground(ctx, bgAssetKey) {
        const img = AssetLoader.get(bgAssetKey);

        /* Si la imagen aún no está disponible, pintar fondo de respaldo oscuro */
        if (!img || !img.complete || img.naturalWidth === 0) {
            ctx.fillStyle = '#0f0f1b';
            ctx.fillRect(0, 0, this.width, this.height);
            return;
        }

        const renderH = this.height; // 540 px
        const scale = renderH / img.naturalHeight;
        const renderW = Math.floor(img.naturalWidth * scale);

        /* Desplazamiento parallax suave (0.7) */
        const camX = this.x;
        const parallaxX = camX * 0.7;
        const firstTileIndex = Math.floor(parallaxX / renderW);
        const startDrawX = firstTileIndex * renderW - parallaxX;

        let drawX = startDrawX;
        let tileIndex = firstTileIndex;

        /* Bucle de mosaicos con espejado alterno para eliminar líneas de corte vertical */
        while (drawX < this.width) {
            const isOdd = Math.abs(tileIndex) % 2 === 1;
            if (isOdd) {
                ctx.save();
                ctx.translate(drawX + renderW, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(img, 0, 0, renderW, renderH);
                ctx.restore();
            } else {
                ctx.drawImage(img, drawX, 0, renderW, renderH);
            }
            drawX += renderW;
            tileIndex++;
        }
    }
}


/* ═══════════════════════════════════════════════════════════════════
   2. CLASE Level (Contenedor de Nivel)
   Agrupa bloques de relieve, trampolines, cuadros de habilidad,
   obstáculos fijos y móviles, y la meta final.
   ═══════════════════════════════════════════════════════════════════ */

class Level {
    /**
     * @param {string} name        – 'Grecia' | 'Ciudad' | 'Desierto'
     * @param {string} bgAssetKey  – clave de la imagen de fondo
     * @param {string} style       – estilo visual de bloques ('marble'|'brick'|'sand')
     */
    constructor(name, bgAssetKey, style) {
        this.name            = name;
        this.bgAssetKey      = bgAssetKey;
        this.style           = style;
        this.levelWidth      = 3700;
        this.groundY         = GROUND_Y;

        /* Colecciones de entidades interactivas del escenario */
        this.blocks          = []; // TerrainBlock[] / Platform[]
        this.platforms       = this.blocks; // Alias para compatibilidad
        this.bounceBlocks    = []; // BounceBlock[]
        this.skillBoxes      = []; // SkillBox[] (mínimo 3)
        this.fixedObstacle   = null; // FixedObstacle (exactamente 1 en x ≈ 1750)
        this.mobileObstacles = []; // MobileObstacle[] (exactamente 6)
        this.goal            = null; // LevelGoal (en x = 3500)
    }

    /**
     * Actualiza la lógica y animaciones internas de todas las entidades.
     * @param {number} dt – delta time en segundos
     * @param {Player} [player]
     */
    update(dt, player) {
        /* Actualizar animaciones de trampolines */
        for (let i = 0; i < this.bounceBlocks.length; i++) {
            this.bounceBlocks[i].update(dt);
        }

        /* Actualizar rebotes de cuadros de habilidad */
        for (let i = 0; i < this.skillBoxes.length; i++) {
            this.skillBoxes[i].update(dt);
        }

        /* Actualizar patrullaje autónomo de los 6 obstáculos móviles pasando plataformas */
        for (let i = 0; i < this.mobileObstacles.length; i++) {
            this.mobileObstacles[i].update(dt, this.platforms);
        }

        /* Actualizar ondular de la bandera de meta */
        if (this.goal) {
            this.goal.update(dt);
        }
    }

    /**
     * Renderiza el fondo continuo con la cámara.
     */
    renderBackground(ctx, camera) {
        if (camera) {
            camera.renderBackground(ctx, this.bgAssetKey);
        }
    }

    /**
     * Dibuja el nivel completo: fondo replicado, terreno, bloques,
     * habilidades, obstáculos y meta.
     * @param {CanvasRenderingContext2D} ctx
     * @param {Camera} camera
     */
    draw(ctx, camera) {
        /* 1. Fondo 2D replicado */
        camera.renderBackground(ctx, this.bgAssetKey);

        /* 2. Bloques sólidos de terreno (suelo, pilares, escalinatas, plataformas) */
        for (let i = 0; i < this.blocks.length; i++) {
            this.blocks[i].draw(ctx, camera);
        }

        /* 3. Bloques especiales de rebote (trampolines retro) */
        for (let i = 0; i < this.bounceBlocks.length; i++) {
            this.bounceBlocks[i].draw(ctx, camera);
        }

        /* 4. Cuadros de habilidad flotantes estilo "?" */
        for (let i = 0; i < this.skillBoxes.length; i++) {
            this.skillBoxes[i].draw(ctx, camera);
        }

        /* 5. Obstáculo fijo a mitad del nivel */
        if (this.fixedObstacle) {
            this.fixedObstacle.draw(ctx, camera);
        }

        /* 6. Los 6 obstáculos móviles patrullando */
        for (let i = 0; i < this.mobileObstacles.length; i++) {
            this.mobileObstacles[i].draw(ctx, camera);
        }

        /* 7. Meta de final de nivel (estandarte arcade) */
        if (this.goal) {
            this.goal.draw(ctx, camera);
        }
    }
}


/* ═══════════════════════════════════════════════════════════════════
   3. GENERADOR DE ESCENARIOS (LevelBuilder — Sección 4)
   Construye con precisión retro y matemática cada uno de los 3 niveles:
   - Suelo firme continuo a lo largo de 3700 px.
   - Exactamente 1 FixedObstacle a mitad del nivel (x = 1750) en suelo despejado.
   - Exactamente 6 MobileObstacle distribuidos con variación aleatoria segura (Sección 3).
   - Al menos 3 SkillBox distribuidos estratégicamente.
   - Al menos 1 BounceBlock para alcanzar zonas elevadas.
   - Meta LevelGoal en x = 3500.
   - NUNCA superpone obstáculos con muros ni pilares.
   ═══════════════════════════════════════════════════════════════════ */

const LevelBuilder = {

    /**
     * Crea de forma aleatoria y segura un obstáculo móvil que patrulle
     * dentro de una zona despejada garantizada (cumple Sección 3).
     * @param {number} minX    – límite izquierdo del callejón
     * @param {number} maxX    – límite derecho del callejón
     * @param {number} groundY – altura del suelo
     * @returns {MobileObstacle}
     */
    _createSafeMobile(minX, maxX, groundY) {
        /* Margen de seguridad para no iniciar pegado a las paredes */
        const safetyMargin = 20;
        const safeMin      = minX + safetyMargin;
        const safeMax      = Math.max(safeMin + 30, maxX - safetyMargin - 40);

        /* Variación aleatoria de posición inicial dentro del tramo */
        const startX = Math.floor(safeMin + Math.random() * (safeMax - safeMin));

        const mob = new MobileObstacle(startX, groundY, minX, maxX);

        /* Dirección aleatoria inicial (1 = derecha, -1 = izquierda) */
        mob.direction = Math.random() < 0.5 ? 1 : -1;

        return mob;
    },

    /**
     * Genera la base de suelo continuo para todo el nivel.
     * @param {number} levelWidth
     * @param {number} groundY
     * @param {string} style
     * @returns {TerrainBlock[]}
     */
    _buildBaseGround(levelWidth, groundY, style) {
        const blocks = [];
        const segmentW = 64; // Segmentos de suelo para textura limpia
        const height   = CANVAS_H - groundY;

        for (let x = 0; x < levelWidth; x += segmentW) {
            const w = Math.min(segmentW, levelWidth - x);
            blocks.push(new TerrainBlock(x, groundY, w, height, style));
        }

        return blocks;
    },

    /* ───────────────────────────────────────────────────────────────
       4.1. NIVEL GRECIA (Grupo Geometría, Sección 4.1 y 4.1.1)
       Estética: Mármol blanco/crema, piedra antigua y pilares griegos.
       ─────────────────────────────────────────────────────────────── */
    buildGrecia(callbacks = {}) {
        const onSkillHit = callbacks && callbacks.onSkillBoxHit ? callbacks.onSkillBoxHit : null;
        const level = new Level('Grecia', 'fondoGrecia', 'marble');
        const gy    = level.groundY; // 476 px
        const theme = 'marble';

        /* ── Suelo firme continuo de mármol ── */
        level.blocks.push(...this._buildBaseGround(level.levelWidth, gy, theme));

        /* ── 1. TRAMO INICIAL (x: 0 - 1300) ── */
        // Plataformas con plataforma base en x: 260, y: 360 para Cuadro 1
        level.blocks.push(
            new Platform(260, 360, 160, 24, theme, 'floating'),
            new Platform(660, 340, 150, 20, theme, 'floating'),
            new Platform(940, 380, 150, 20, theme, 'floating')
        );

        // Columnas bajas griegas tipo tubería de Mario
        level.blocks.push(
            new Platform(440, gy - 48, 40, 48, theme, 'pillar'),
            new Platform(860, gy - 56, 40, 56, theme, 'pillar')
        );

        // Cuadro 1 (sobre plataforma x:260, y:360): deja 91px libres para caminar y saltar
        level.skillBoxes.push(
            new SkillBox(318, 225, onSkillHit)
        );

        // Obstáculos móviles: Mob 1 (140..250), Mob 2 (480..730), Mob 3 (800..1230)
        level.mobileObstacles.push(
            this._createSafeMobile(140, 250, gy),
            this._createSafeMobile(480, 730, gy),
            this._createSafeMobile(800, 1230, gy)
        );

        /* ── 2. TRAMO MEDIO (x: 1300 - 2100) ── */
        // Templo griego clásico con escalinatas y cima en x: 1460, y: 340
        level.blocks.push(
            new Platform(1300, gy - 30,  80, 30, theme, 'step'),
            new Platform(1380, gy - 60,  80, 60, theme, 'step'),
            new Platform(1460, 340,     150, gy - 340, theme, 'temple'), // Cima del templo
            new Platform(1610, gy - 60,  80, 60, theme, 'step'),
            new Platform(1690, gy - 30,  60, 30, theme, 'step')
        );

        // Cuadro 2 (sobre cima del templo x:1460, y:340):
        level.skillBoxes.push(
            new SkillBox(1498, 205, onSkillHit)
        );

        // Tramo de suelo plano completamente despejado (1700 - 1860) con FixedObstacle en 1750
        level.fixedObstacle = new FixedObstacle(1750, gy);

        // Obstáculo móvil 4 patrullando en el tramo posterior al obstáculo fijo
        level.mobileObstacles.push(
            this._createSafeMobile(1880, 2140, gy)
        );

        /* ── 3. TRAMO FINAL (x: 2100 - 3500) ── */
        // Plataforma alta en x: 2580, y: 250 y trampolín con trayectoria libre en x: 2510, y: 436
        level.blocks.push(
            new Platform(2220, 390, 140, 20, theme, 'floating'),
            new Platform(2580, 250, 140, 24, theme, 'floating'), // Plataforma alta
            new Platform(2780, 380, 140, 20, theme, 'floating')
        );

        // Pilares griegos entre los cuales patrullan Mob 5 y Mob 6
        level.blocks.push(
            new Platform(2380, gy - 56, 36, 56, theme, 'pillar'),
            new Platform(2820, gy - 56, 36, 56, theme, 'pillar'),
            new Platform(3120, gy - 56, 36, 56, theme, 'pillar')
        );

        // Trampolín BounceBlock situado a la izquierda con cielo libre
        level.bounceBlocks.push(
            new BounceBlock(2510, 436, 48, 24, theme)
        );

        // Cuadro 3 (sobre plataforma alta x:2580, y:250):
        level.skillBoxes.push(
            new SkillBox(2628, 115, onSkillHit)
        );

        // Obstáculos móviles: Mob 5 (2860..3090) y Mob 6 (3160..3340)
        level.mobileObstacles.push(
            this._createSafeMobile(2860, 3090, gy), // Mob 5
            this._createSafeMobile(3160, 3340, gy)  // Mob 6
        );

        // Meta final en x = 3500
        level.goal = new LevelGoal(3500, gy);

        return level;
    },

    /* ───────────────────────────────────────────────────────────────
       4.2. NIVEL CIUDAD (Grupo Trigonometría, Sección 4.2 y 4.2.1)
       Estética: Ladrillo urbano, vigas metálicas, cajas y trampolines.
       ─────────────────────────────────────────────────────────────── */
    buildCiudad(callbacks = {}) {
        const onSkillHit = callbacks && callbacks.onSkillBoxHit ? callbacks.onSkillBoxHit : null;
        const level = new Level('Ciudad', 'fondoCiudad', 'brick');
        const gy    = level.groundY;
        const theme = 'brick';

        /* ── Suelo firme continuo urbano ── */
        level.blocks.push(...this._buildBaseGround(level.levelWidth, gy, theme));

        /* ── 1. TRAMO INICIAL (x: 0 - 1300) ── */
        // Contenedores y andamio en x: 280, y: 350 para Cuadro 1
        level.blocks.push(
            new Platform(240, gy - 36, 40, 36, theme, 'container'),
            new Platform(280, 350, 160, 20, theme, 'floating'), // Andamio Cuadro 1
            new Platform(500, 340, 140, 16, theme, 'floating'),
            new Platform(780, 370, 130, 16, theme, 'floating'),
            new Platform(950, 340, 150, 16, theme, 'floating')
        );

        // Cuadro 1 (sobre andamio x:280, y:350): deja 91px libres
        level.skillBoxes.push(
            new SkillBox(348, 215, onSkillHit)
        );

        // Obstáculos móviles: Mob 1 (140..230), Mob 2 (480..680), Mob 3 (755..1210)
        level.mobileObstacles.push(
            this._createSafeMobile(140, 230, gy),
            this._createSafeMobile(480, 680, gy),
            this._createSafeMobile(755, 1210, gy)
        );

        /* ── 2. TRAMO MEDIO (x: 1300 - 2100) ── */
        // Estructura de construcción con viga central en x: 1500, y: 300
        level.blocks.push(
            new Platform(1320, gy - 40,  80, 40, theme, 'container'),
            new Platform(1410, 370,      90, 16, theme, 'floating'),
            new Platform(1500, 300,     180, 20, theme, 'beam'), // Viga Cuadro 2
            new Platform(1630, gy - 50,  60, 50, theme, 'container')
        );

        // Cuadro 2 (sobre viga x:1500, y:300):
        level.skillBoxes.push(
            new SkillBox(1548, 165, onSkillHit)
        );

        // Explanada de asfalto totalmente limpia y plana (1690 - 1840) con FixedObstacle en 1750
        level.fixedObstacle = new FixedObstacle(1750, gy);

        // Obstáculo móvil 4 en el callejón posterior al fijo
        level.mobileObstacles.push(
            this._createSafeMobile(1870, 2150, gy)
        );

        /* ── 3. TRAMO FINAL (x: 2100 - 3500) ── */
        // Cajas sólidas bajas, trampolín en 2410 y plataforma alta en 2480, 250
        level.blocks.push(
            new Platform(2220, gy - 32, 40, 32, theme, 'box'),
            new Platform(2340, gy - 45, 45, 45, theme, 'box'), // Segunda caja x:2340..2385
            new Platform(2480, 250, 140, 20, theme, 'floating'), // Plataforma alta 1
            new Platform(2680, 340, 130, 16, theme, 'floating'),
            new Platform(2900, gy - 56, 44, 56, theme, 'container'), // Contenedor x:2900
            new Platform(3200, gy - 40, 44, 40, theme, 'box')
        );

        // Trampolín urbano con trayectoria libre en x: 2410, y: 436
        level.bounceBlocks.push(
            new BounceBlock(2410, 436, 48, 24, theme)
        );

        // Cuadro 3 (sobre plataforma alta x:2480, y:250):
        level.skillBoxes.push(
            new SkillBox(2528, 115, onSkillHit)
        );

        // Obstáculos móviles: Mob 5 (2475..2890, evitando trampolín 2410..2458) y Mob 6 (2965..3170)
        level.mobileObstacles.push(
            this._createSafeMobile(2475, 2890, gy), // Mob 5
            this._createSafeMobile(2965, 3170, gy)  // Mob 6
        );

        // Meta final en x = 3500
        level.goal = new LevelGoal(3500, gy);

        return level;
    },

    /* ───────────────────────────────────────────────────────────────
       4.3. NIVEL DESIERTO (Grupo Ambos, Sección 4.3 y 4.3.1)
       Estética: Arenisca dorada/ocre, pirámides y ruinas del desierto.
       ─────────────────────────────────────────────────────────────── */
    buildDesierto(callbacks = {}) {
        const onSkillHit = callbacks && callbacks.onSkillBoxHit ? callbacks.onSkillBoxHit : null;
        const level = new Level('Desierto', 'fondoDesierto', 'sand');
        const gy    = level.groundY;
        const theme = 'sand';

        /* ── Suelo firme continuo de arena dorada ── */
        level.blocks.push(...this._buildBaseGround(level.levelWidth, gy, theme));

        /* ── 1. TRAMO INICIAL (x: 0 - 1300) ── */
        // Ruinas y losa en x: 260, y: 360 para Cuadro 1
        level.blocks.push(
            new Platform(260, 360, 160, 24, theme, 'floating'), // Plataforma Cuadro 1
            new Platform(440, gy - 44, 40, 44, theme, 'ruin'),
            new Platform(680, gy - 54, 40, 54, theme, 'ruin'),
            new Platform(840, 350, 140, 20, theme, 'floating'),
            new Platform(1060, gy - 44, 40, 44, theme, 'ruin')
        );

        // Cuadro 1 (sobre plataforma x:260, y:360): deja 91px libres
        level.skillBoxes.push(
            new SkillBox(323, 225, onSkillHit)
        );

        // Obstáculos móviles: Mob 1 (140..250), Mob 2 (480..670), Mob 3 (740..1210)
        level.mobileObstacles.push(
            this._createSafeMobile(140, 250, gy),
            this._createSafeMobile(480, 670, gy),
            this._createSafeMobile(740, 1210, gy)
        );

        /* ── 2. TRAMO MEDIO (x: 1300 - 2100) ── */
        // Gran pirámide escalonada con cima en x: 1510, y: 300
        level.blocks.push(
            new Platform(1300, gy - 30, 380, 30, theme, 'pyramid'),
            new Platform(1370, gy - 65, 240, 35, theme, 'pyramid'),
            new Platform(1440, gy - 105, 170, 40, theme, 'pyramid'),
            new Platform(1510, 300,     150, gy - 300, theme, 'pyramid') // Cima de la pirámide
        );

        // Cuadro 2 (sobre cima de pirámide x:1510, y:300):
        level.skillBoxes.push(
            new SkillBox(1533, 165, onSkillHit)
        );

        // Explanada limpia en el suelo en x: 1690..1840 con FixedObstacle en 1750
        level.fixedObstacle = new FixedObstacle(1750, gy);

        // Obstáculo móvil 4 en la planicie post-fijo
        level.mobileObstacles.push(
            this._createSafeMobile(1870, 2140, gy)
        );

        /* ── 3. TRAMO FINAL (x: 2100 - 3500) ── */
        // Plataforma elevada en 2400, 250 y trampolín en 2330, 436 con cielo libre
        level.blocks.push(
            new Platform(2180, 380, 130, 20, theme, 'floating'),
            new Platform(2400, 250, 140, 24, theme, 'floating'), // Plataforma elevada
            new Platform(2620, 340, 130, 20, theme, 'floating')
        );

        // Obeliscos delimitando patrullas
        level.blocks.push(
            new Platform(2260, gy - 56, 32, 56, theme, 'obelisk'),
            new Platform(2720, gy - 64, 32, 64, theme, 'obelisk'),
            new Platform(3060, gy - 60, 32, 60, theme, 'obelisk')
        );

        // Trampolín retro del desierto en x: 2330, y: 436 con cielo libre hacia la plataforma alta
        level.bounceBlocks.push(
            new BounceBlock(2330, 436, 48, 24, theme)
        );

        // Cuadro 3 (sobre plataforma elevada x:2400, y:250):
        level.skillBoxes.push(
            new SkillBox(2448, 115, onSkillHit)
        );

        // Gran escalinata piramidal final antes de la meta (estilo Mario Bros)
        level.blocks.push(
            new Platform(3250, gy - 20, 35, 20, theme, 'step'),
            new Platform(3285, gy - 40, 35, 40, theme, 'step'),
            new Platform(3320, gy - 60, 35, 60, theme, 'step'),
            new Platform(3355, gy - 80, 35, 80, theme, 'step'),
            new Platform(3390, gy - 100, 45, 100, theme, 'step')
        );

        // Obstáculos móviles: Mob 5 (2780..3040) y Mob 6 (3110..3240)
        level.mobileObstacles.push(
            this._createSafeMobile(2780, 3040, gy), // Mob 5
            this._createSafeMobile(3110, 3240, gy)  // Mob 6
        );

        // Meta final en x = 3500
        level.goal = new LevelGoal(3500, gy);

        return level;
    },

    /**
     * Construye y retorna la instancia completa de un nivel según su nombre.
     * @param {string} levelName – 'Grecia' | 'Ciudad' | 'Desierto'
     * @param {Object} [callbacks] – { onSkillBoxHit }
     * @returns {Level}
     */
    createLevel(levelName, callbacks = {}) {
        switch (levelName) {
            case 'Grecia':
                return this.buildGrecia(callbacks);
            case 'Ciudad':
                return this.buildCiudad(callbacks);
            case 'Desierto':
                return this.buildDesierto(callbacks);
            default:
                console.warn(`Nivel desconocido "${levelName}", usando Grecia por defecto.`);
                return this.buildGrecia(callbacks);
        }
    }
};
