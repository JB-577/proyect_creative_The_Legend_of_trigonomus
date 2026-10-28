/* =================================================================
   entities.js — Entidades del juego, físicas y colisiones AABB
   Clases: Player, Camera, FixedObstacle, MobileObstacle,
           SkillBox, BounceBlock, LevelGoal, CollisionEngine
   (Secciones 2.1, 2.2, 2.3, 2.5 y 2.6)
   ================================================================= */

'use strict';

/* ═══════════════════════════════════════════════════════════════════
   CONSTANTES FÍSICAS GLOBALES
   ═══════════════════════════════════════════════════════════════════ */

/** Ancho y alto del canvas */
const CANVAS_W = 960;
const CANVAS_H = 540;

/** Ancho total del nivel en píxeles (Sección 2.3.4: ~3600-3700 px) */
const LEVEL_WIDTH = 3700;

/** Altura del suelo base desde la parte superior del canvas */
const GROUND_Y = CANVAS_H - 64;   // 476 px  (deja 64 px de suelo)

/** Dimensiones del sprite del jugador */
const PLAYER_W = 48;
const PLAYER_H = 64;

/**
 * Constantes de salto calibradas (Sección 2.1):
 *   jumpHeight  = PLAYER_H * 2 = 128 px
 *   timeToApex  = 0.3 s
 *   gravity     = 2 * jumpHeight / timeToApex²  ≈ 2844.44 px/s²
 *   jumpVelocity = -√(2 * gravity * jumpHeight) ≈ -853.33 px/s
 *   Parábola completa ≈ 0.6 s (subida 0.3 s + bajada 0.3 s)
 */
const JUMP_HEIGHT    = PLAYER_H * 2;                                  // 128 px
const TIME_TO_APEX   = 0.3;                                           // s
const GRAVITY        = (2 * JUMP_HEIGHT) / (TIME_TO_APEX * TIME_TO_APEX); // ≈2844
const JUMP_VELOCITY  = -Math.sqrt(2 * GRAVITY * JUMP_HEIGHT);         // ≈-853

/** Factor de rebote para trampolines (Sección 2.3.4) */
const BOUNCE_FACTOR  = 1.5;
const BOUNCE_VELOCITY = -Math.sqrt(2 * GRAVITY * JUMP_HEIGHT * BOUNCE_FACTOR);

/** Velocidad horizontal del jugador (px/s) */
const PLAYER_SPEED   = 200;

/** Velocidad de patrulla de los obstáculos móviles (px/s) */
const MOBILE_SPEED   = 60;

/** Tamaños estándar de bloques del nivel */
const BLOCK_SIZE     = 32;


/* ═══════════════════════════════════════════════════════════════════
   1. CLASE Player (Secciones 2.1 y 2.3.1)
   ═══════════════════════════════════════════════════════════════════ */

class Player {
    /**
     * @param {string} characterKey – clave de CHARACTERS ('pitagoras'|'hugo'|'einstein')
     * @param {number} startX       – posición inicial X en el mundo
     * @param {number} startY       – posición inicial Y (base de los pies)
     */
    constructor(characterKey, startX, startY) {
        /* ── Dimensiones del sprite ── */
        this.width  = PLAYER_W;   // 48 px
        this.height = PLAYER_H;   // 64 px

        /* ── Posición (esquina superior izquierda) ── */
        this.x = startX;
        this.y = startY - this.height;   // pies en startY
        this.prevX = this.x;
        this.prevY = this.y;

        /* ── Velocidades ── */
        this.vx = 0;
        this.vy = 0;

        /* ── Estado de suelo / salto ── */
        this.onGround    = true;
        this.jumpPressed = false;     // anti-rebote de tecla

        /* ── Sprites direccionales (Sección 2.1) ── */
        const charData   = CHARACTERS[characterKey];
        this.spriteRight = AssetLoader.get(charData.rightImg);
        this.spriteLeft  = AssetLoader.get(charData.leftImg);
        this.facing      = 'right';   // dirección visual actual

        /* ── Bloqueo de movimiento (Sección 2.3.1) ── */
        this.inputLocked = false;

        /* ── Inmunidad (Sección 2.6 - 1.1) ── */
        this.isImmune     = false;
        this._immuneTimer = 0;        // cuenta regresiva (segundos)
        this._immuneBlink = 0;        // acumulador para parpadeo visual
    }

    /* ── Getters de caja (AABB) ── */
    get left()   { return this.x; }
    get right()  { return this.x + this.width; }
    get top()    { return this.y; }
    get bottom() { return this.y + this.height; }

    /* ─────────────────────────────────────────────────────────── */
    /*  ENTRADA DE TECLADO                                       */
    /* ─────────────────────────────────────────────────────────── */

    /**
     * Lee las teclas actualmente presionadas y actualiza velocidades.
     * @param {Object} keys – mapa { keyCode/key : boolean }
     */
    handleInput(keys) {
        /* Si el input está bloqueado, velocidad horizontal = 0 */
        if (this.inputLocked) {
            this.vx = 0;
            return;
        }

        /* Movimiento horizontal */
        if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
            this.vx     = -PLAYER_SPEED;
            this.facing = 'left';
        } else if (keys['ArrowRight'] || keys['d'] || keys['D']) {
            this.vx     = PLAYER_SPEED;
            this.facing = 'right';
        } else {
            this.vx = 0;
        }

        /* Salto (solo si está en el suelo y no se ha saltado ya) */
        const jumpKey = keys['ArrowUp'] || keys['w'] || keys['W'] || keys[' '];
        if (jumpKey && this.onGround && !this.jumpPressed) {
            this.vy          = JUMP_VELOCITY;
            this.onGround    = false;
            this.jumpPressed = true;
        }
        if (!jumpKey) {
            this.jumpPressed = false;
        }
    }

    /* ─────────────────────────────────────────────────────────── */
    /*  ACTUALIZACIÓN POR FRAME                                  */
    /* ─────────────────────────────────────────────────────────── */

    /**
     * Actualiza posición, gravedad e inmunidad.
     * @param {number} dt – deltaTime en segundos
     */
    update(dt) {
        /* Guardar posición previa para resolución AABB precisa */
        this.prevX = this.x;
        this.prevY = this.y;

        /* ── Gravedad continua ── */
        this.vy += GRAVITY * dt;
        if (this.vy > 950) this.vy = 950; // Velocidad terminal de caída suave

        /* ── Integración de posición ── */
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        /* ── Límite izquierdo del nivel ── */
        if (this.x < 0) {
            this.x = 0;
            if (this.vx < 0) this.vx = 0;
        }

        /* ── Suelo base del nivel ── */
        if (this.bottom >= GROUND_Y) {
            this.y        = GROUND_Y - this.height;
            this.vy       = 0;
            this.onGround = true;
        } else {
            // Asumir que está en el aire hasta que las colisiones confirmen apoyo
            this.onGround = false;
        }

        /* ── Temporizador de inmunidad (Sección 2.6 - 1.1) ── */
        if (this.isImmune) {
            this._immuneTimer -= dt;
            this._immuneBlink += dt;
            if (this._immuneTimer <= 0) {
                this.isImmune     = false;
                this._immuneTimer = 0;
                GameState.isImmune = false;
                /* Ocultar banner en HUD */
                const banner = document.getElementById('immunity-banner');
                if (banner) banner.classList.add('hidden');
            } else {
                /* Actualizar cuenta regresiva visible en HUD */
                GameState.immunityTimer = Math.ceil(this._immuneTimer);
                const timerEl = document.getElementById('immunity-timer');
                if (timerEl) timerEl.textContent = Math.ceil(this._immuneTimer);
            }
        }
    }

    /* ─────────────────────────────────────────────────────────── */
    /*  ACTIVAR INMUNIDAD                                        */
    /* ─────────────────────────────────────────────────────────── */

    /**
     * Activa la inmunidad de obstáculos por 10 segundos.
     */
    activateImmunity() {
        this.isImmune        = true;
        this._immuneTimer    = 10;
        this._immuneBlink    = 0;
        GameState.isImmune   = true;
        GameState.immunityTimer = 10;

        /* Mostrar banner de inmunidad en HUD */
        const banner = document.getElementById('immunity-banner');
        if (banner) banner.classList.remove('hidden');
        const timerEl = document.getElementById('immunity-timer');
        if (timerEl) timerEl.textContent = '10';
    }

    /**
     * Limpia y resetea el estado e interfaz de inmunidad (Ajuste 1.1).
     */
    clearImmunity() {
        this.isImmune = false;
        this._immuneTimer = 0;
        this._immuneBlink = 0;
        GameState.isImmune = false;
        GameState.immunityTimer = 0;
        const banner = document.getElementById('immunity-banner');
        if (banner) banner.classList.add('hidden');
        const timerEl = document.getElementById('immunity-timer');
        if (timerEl) timerEl.textContent = '10';
    }

    /* ─────────────────────────────────────────────────────────── */
    /*  DIBUJAR EN CANVAS                                        */
    /* ─────────────────────────────────────────────────────────── */

    /**
     * Dibuja el sprite del jugador en el canvas.
     * @param {CanvasRenderingContext2D} ctx
     * @param {Camera} camera
     */
    draw(ctx, camera) {
        const charData = CHARACTERS[GameState.selectedChar] || CHARACTERS.pitagoras;
        const sprite = this.facing === 'right'
            ? (this.spriteRight || AssetLoader.get(charData.rightImg))
            : (this.spriteLeft  || AssetLoader.get(charData.leftImg));
        const drawX  = this.x - camera.x;
        const drawY  = this.y;

        /* ── Efecto visual de inmunidad: parpadeo dorado ── */
        if (this.isImmune) {
            // Parpadeo: alternar entre visible y semitransparente ~5 Hz
            const blinkOn = Math.sin(this._immuneBlink * 10) > 0;
            ctx.save();
            ctx.globalAlpha = blinkOn ? 1.0 : 0.4;

            // Resplandor dorado
            if (blinkOn) {
                ctx.shadowColor = '#f0e040';
                ctx.shadowBlur  = 16;
            }
        }

        if (sprite && sprite.complete && sprite.naturalWidth > 0) {
            ctx.drawImage(sprite, drawX, drawY, this.width, this.height);
        } else {
            // Fallback: rectángulo coloreado
            ctx.fillStyle = '#40c0e0';
            ctx.fillRect(drawX, drawY, this.width, this.height);
        }

        if (this.isImmune) {
            ctx.restore();
        }
    }
}


/* ═══════════════════════════════════════════════════════════════════
   2. SISTEMA DE CÁMARA (Sección 2.3.2)
   Implementado en levels.js (FASE 4) junto al renderizado de fondos.
   ═══════════════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════════════
   3. CLASE FixedObstacle (Sección 2.5.1)
   Barrera vertical infranqueable a mitad del nivel.
   ═══════════════════════════════════════════════════════════════════ */

class FixedObstacle {
    /**
     * @param {number} x – posición X en el mundo
     * @param {number} y – posición Y o nivel del suelo
     */
    constructor(x, y) {
        this.x = x;
        // Guarda this.groundY = y + 110 (es decir, el nivel del suelo 460-476)
        this.groundY = (y !== undefined && y > 400) ? y : ((y !== undefined ? y : 350) + 110);
        this.height = 115;
        this.width = 115;
        this.y = this.groundY - this.height;
        this.resolved = false;   // ¿ya fue contestada la pregunta?
        this.sprite = AssetLoader.get('obstaculoFijo');
        this.onTrigger = null;
    }

    /* ── AABB ── */
    get left()   { return this.x; }
    get right()  { return this.x + this.width; }
    get top()    { return this.y; }
    get bottom() { return this.y + this.height; }

    /**
     * Sincroniza dimensiones y posición exacta a partir de la imagen cargada.
     * @param {HTMLImageElement} obsImg
     */
    syncDimensionsFromImage(obsImg) {
        if (!obsImg || !obsImg.complete || obsImg.naturalWidth <= 0) return;
        const aspect = obsImg.naturalWidth / obsImg.naturalHeight;
        this.height = 120;
        this.width = Math.round(this.height * aspect);
        this.y = this.groundY - this.height + 8; // +8 compensa margen transparente inferior
    }

    /**
     * Devuelve la caja física ajustada al dibujo visible real del pórtico.
     */
    getHitbox() {
        const insetX = Math.round(this.width * 0.24);
        const insetTop = Math.round(this.height * 0.22);
        return {
            x: this.x + insetX,
            y: this.y + insetTop,
            width: Math.max(32, this.width - insetX * 2),
            height: Math.max(48, this.height - insetTop)
        };
    }

    /**
     * Dibuja el obstáculo fijo respetando su proporción visual y estado.
     * @param {CanvasRenderingContext2D} ctx
     * @param {Camera} camera
     */
    draw(ctx, camera) {
        const drawX = this.x - camera.x;
        if (drawX > CANVAS_W + 80 || drawX + this.width < -80) return; // fuera de vista

        const sprite = this.sprite || AssetLoader.get('obstaculoFijo');

        if (sprite && sprite.complete && sprite.naturalWidth > 0) {
            this.syncDimensionsFromImage(sprite);
            ctx.save();
            if (this.resolved) ctx.globalAlpha = 0.35;
            ctx.drawImage(sprite, this.x - camera.x, this.y, this.width, this.height);
            ctx.restore();
        } else {
            ctx.fillStyle = this.resolved ? '#555' : '#c03030';
            ctx.fillRect(drawX, this.y, this.width, this.height);
            ctx.strokeStyle = '#800';
            ctx.lineWidth = 2;
            ctx.strokeRect(drawX, this.y, this.width, this.height);
        }

        /* Indicador sutil de resuelto */
        if (this.resolved) {
            ctx.globalAlpha = 0.25;
            ctx.fillStyle = '#0f0';
            ctx.fillRect(this.x - camera.x, this.y, this.width, this.height);
            ctx.globalAlpha = 1.0;
        }
    }

    render(ctx, camera) {
        this.draw(ctx, camera);
    }
}

/**
 * Evalúa colisión precisa y bloqueo infranqueable contra FixedObstacle.
 * @param {Player} player
 * @param {FixedObstacle} fixedObstacle
 * @returns {boolean} – true si se disparó el desafío
 */
function checkFixedObstacleCollision(player, fixedObstacle) {
    if (!fixedObstacle || fixedObstacle.resolved) return false;
    if (player.isImmune) return false;

    const hb = fixedObstacle.getHitbox();
    const playerRight = player.x + player.width;
    const playerLeft = player.x;
    const hbRight = hb.x + hb.width;

    // Contacto horizontal con el hitbox visible
    const overlapsX = (playerRight >= hb.x && playerLeft <= hbRight);
    if (!overlapsX) return false;

    // Como barrera vertical infranqueable sin inmunidad (Sección 2.3.3):
    if (player.y + player.height > hb.y - 90) {
        const prevX = (player.prevX !== undefined) ? player.prevX : player.x;
        player.x = (prevX < hb.x) ? (hb.x - player.width) : hbRight;
        player.vx = 0;

        // Disparar desafío únicamente cerca de la altura del obstáculo (evita saltos en el aire)
        if (player.y + player.height >= hb.y - 16) {
            if (typeof fixedObstacle.onTrigger === 'function') {
                fixedObstacle.onTrigger(fixedObstacle);
            }
            return true;
        }
    }

    return false;
}


/* ═══════════════════════════════════════════════════════════════════
   4. CLASE MobileObstacle (Sección 2.5.2)
   "Goomba" que patrulla de lado a lado en el suelo sin atravesar bloques.
   ═══════════════════════════════════════════════════════════════════ */

class MobileObstacle {
    /**
     * @param {number} x        – posición inicial X
     * @param {number} groundY  – Y del suelo donde camina
     * @param {number} minX     – límite izquierdo de patrulla
     * @param {number} maxX     – límite derecho de patrulla
     */
    constructor(x, groundY, minX, maxX) {
        this.width     = 40;
        this.height    = 40;
        this.x         = x;
        this.y         = groundY - this.height;
        this.groundY   = groundY;
        this.minX      = minX;
        this.maxX      = maxX;
        this.speed     = MOBILE_SPEED;
        this.direction = 1;      // 1 = derecha, -1 = izquierda
        this.vx        = this.speed * this.direction;
        this.resolved  = false;   // ¿ya fue contestada la pregunta?
        this.sprite    = AssetLoader.get('obstaculoMovible');
    }

    /* ── AABB ── */
    get left()   { return this.x; }
    get right()  { return this.x + this.width; }
    get top()    { return this.y; }
    get bottom() { return this.y + this.height; }

    /**
     * Mueve al obstáculo dentro de sus límites y rebota contra bloques sólidos.
     * @param {number} dt – deltaTime en segundos
     * @param {Array} [platforms] – bloques sólidos del nivel
     */
    update(dt, platforms) {
        if (this.vx === undefined || this.vx === 0) {
            this.vx = (this.direction || 1) * this.speed;
        }
        this.x += this.vx * dt;
        this.direction = this.vx >= 0 ? 1 : -1;

        /* Rebotar en los límites de patrulla */
        if (this.x <= this.minX) {
            this.x = this.minX;
            this.vx = Math.abs(this.vx);
            this.direction = 1;
        } else if (this.x + this.width >= this.maxX) {
            this.x = this.maxX - this.width;
            this.vx = -Math.abs(this.vx);
            this.direction = -1;
        }

        /* Si se recibe platforms, verificar colisión AABB contra bloques sólidos que no sean el suelo base */
        if (platforms && Array.isArray(platforms)) {
            for (let i = 0; i < platforms.length; i++) {
                const block = platforms[i];
                if (block.subType === 'ground' || block.isGround || (block.y >= 460 && block.height >= 50)) continue;

                if (
                    this.x < block.x + block.width &&
                    this.x + this.width > block.x &&
                    this.y < block.y + block.height &&
                    this.y + this.height > block.y
                ) {
                    if (this.vx > 0) {
                        this.x = block.x - this.width;
                        this.vx = -Math.abs(this.vx);
                        this.direction = -1;
                    } else if (this.vx < 0) {
                        this.x = block.x + block.width;
                        this.vx = Math.abs(this.vx);
                        this.direction = 1;
                    }
                    break;
                }
            }
        }
    }

    /**
     * Dibuja el obstáculo móvil.
     * @param {CanvasRenderingContext2D} ctx
     * @param {Camera} camera
     */
    draw(ctx, camera) {
        const drawX = this.x - camera.x;
        if (drawX > CANVAS_W + 50 || drawX + this.width < -50) return;

        const sprite = this.sprite || AssetLoader.get('obstaculoMovible');

        ctx.save();

        /* Voltear sprite según dirección */
        if (this.direction === -1 && sprite) {
            ctx.translate(drawX + this.width, 0);
            ctx.scale(-1, 1);
            if (sprite.complete && sprite.naturalWidth > 0) {
                ctx.drawImage(sprite, 0, this.y, this.width, this.height);
            } else {
                ctx.fillStyle = this.resolved ? '#555' : '#d08020';
                ctx.fillRect(0, this.y, this.width, this.height);
            }
        } else {
            if (sprite && sprite.complete && sprite.naturalWidth > 0) {
                ctx.drawImage(sprite, drawX, this.y, this.width, this.height);
            } else {
                ctx.fillStyle = this.resolved ? '#555' : '#d08020';
                ctx.fillRect(drawX, this.y, this.width, this.height);
            }
        }

        ctx.restore();

        /* Indicador de resuelto */
        if (this.resolved) {
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = '#0f0';
            ctx.fillRect(this.x - camera.x, this.y, this.width, this.height);
            ctx.globalAlpha = 1.0;
        }
    }

    render(ctx, camera) {
        this.draw(ctx, camera);
    }
}


/* ═══════════════════════════════════════════════════════════════════
   5. CLASE SkillBox (Sección 2.3.3)
   Cuadro de habilidad flotante estilo bloque "?" de Mario.
   Se activa al golpearlo desde abajo o al hacer clic sobre él.
   ═══════════════════════════════════════════════════════════════════ */

class SkillBox {
    /**
     * @param {number} x – posición X en el mundo
     * @param {number} y – posición Y (borde superior del bloque)
     * @param {Function} [onHit] – callback al golpearlo
     */
    constructor(x, y, onHit = null) {
        this.width      = 44;
        this.height     = 44;
        this.x          = x;
        this.y          = y;
        this.baseY      = y;         // Y original para animación de rebote
        this.onHit      = onHit;
        this.used       = false;     // ¿ya fue abierto?
        this.resolved   = false;
        this.isBouncing = false;
        this.sprite     = AssetLoader.get('cuadroHabilidad');

        /* Animación de rebote al ser golpeado */
        this._bouncing       = false;
        this._bounceTime     = 0;
        this._bounceDuration = 0.25;   // duración del rebote (s)
        this._bounceHeight   = 8;       // píxeles de desplazamiento
    }

    /* ── AABB ── */
    get left()   { return this.x; }
    get right()  { return this.x + this.width; }
    get top()    { return this.y; }
    get bottom() { return this.y + this.height; }

    /**
     * Inicia la breve animación de rebote vertical (Sección 2.3.4).
     */
    triggerBounce() {
        if (this._bouncing) return;
        this._bouncing   = true;
        this.isBouncing  = true;
        this._bounceTime = 0;
    }

    /**
     * Acción de golpe desde abajo: marca uso y dispara animación/callback.
     */
    hitFromBelow() {
        this.used       = true;
        this.resolved   = true;
        this.isBouncing = true;
        this.triggerBounce();
        if (typeof this.onHit === 'function') {
            this.onHit(this);
        }
    }

    /**
     * Actualiza la animación de rebote.
     * @param {number} dt
     */
    update(dt) {
        if (!this._bouncing) return;

        this._bounceTime += dt;
        const t = this._bounceTime / this._bounceDuration;

        if (t >= 1) {
            /* Fin del rebote: volver a la posición original */
            this.y           = this.baseY;
            this._bouncing   = false;
            this.isBouncing  = false;
            this._bounceTime = 0;
        } else {
            /* Parábola de rebote: subir y bajar */
            const offset = Math.sin(t * Math.PI) * this._bounceHeight;
            this.y = this.baseY - offset;
        }
    }

    /**
     * Comprueba si un clic en coordenadas del mundo cae sobre este cuadro.
     * @param {number} worldX
     * @param {number} worldY
     * @returns {boolean}
     */
    containsPoint(worldX, worldY) {
        return (
            worldX >= this.left  && worldX <= this.right &&
            worldY >= this.top   && worldY <= this.bottom
        );
    }

    /**
     * Dibuja el cuadro de habilidad respetando la proporción centrada en 44x44.
     * @param {CanvasRenderingContext2D} ctx
     * @param {Camera} camera
     */
    draw(ctx, camera) {
        const drawX = this.x - camera.x;
        if (drawX > CANVAS_W + 50 || drawX + this.width < -50) return;

        const sprite = this.sprite || AssetLoader.get('cuadroHabilidad');

        if (sprite && sprite.complete && sprite.naturalWidth > 0) {
            ctx.save();
            if (this.used || this.resolved) {
                /* Tono visual apagado para indicar que ya fue abierto */
                ctx.globalAlpha = 0.45;
            }

            // Proporción de IMG_0672.png centrada en caja de 44x44
            const aspect = sprite.naturalWidth / sprite.naturalHeight;
            let drawW = this.width;
            let drawH = this.height;
            if (aspect > 1) {
                drawH = Math.round(this.width / aspect);
            } else if (aspect < 1) {
                drawW = Math.round(this.height * aspect);
            }
            const offX = drawX + Math.round((this.width - drawW) / 2);
            const offY = this.y + Math.round((this.height - drawH) / 2);

            ctx.drawImage(sprite, offX, offY, drawW, drawH);
            ctx.restore();
        } else {
            /* Fallback: bloque "?" estilo retro */
            ctx.fillStyle = (this.used || this.resolved) ? '#8b7500' : '#e8b800';
            ctx.fillRect(drawX, this.y, this.width, this.height);
            ctx.strokeStyle = (this.used || this.resolved) ? '#665200' : '#b8860b';
            ctx.lineWidth = 2;
            ctx.strokeRect(drawX, this.y, this.width, this.height);

            /* Signo "?" */
            ctx.fillStyle = (this.used || this.resolved) ? '#a09060' : '#fff';
            ctx.font = 'bold 18px "Press Start 2P", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('?', drawX + this.width / 2, this.y + this.height / 2);
        }
    }

    render(ctx, camera) {
        this.draw(ctx, camera);
    }
}


/* ═══════════════════════════════════════════════════════════════════
   6. CLASE BounceBlock (Sección 2.3.4 — Trampolines/Resortes)
   Bloque especial retro que impulsa al jugador a 1.5× su salto.
   ═══════════════════════════════════════════════════════════════════ */

class BounceBlock {
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} [width=48]
     * @param {number} [height=24]
     * @param {string} [theme='default']
     */
    constructor(x, y, width = 48, height = 24, theme = 'default') {
        this.width  = width || 48;
        this.height = height || 24;
        this.x      = x;
        this.y      = y;
        this.theme  = theme;

        /* Animación de compresión al ser pisado */
        this._compressing     = false;
        this._compressTime    = 0;
        this._compressDuration = 0.15;  // s
    }

    /* ── AABB ── */
    get left()   { return this.x; }
    get right()  { return this.x + this.width; }
    get top()    { return this.y; }
    get bottom() { return this.y + this.height; }

    /**
     * Activa la animación de compresión.
     */
    triggerCompress() {
        this._compressing  = true;
        this._compressTime = 0;
    }

    update(dt) {
        if (!this._compressing) return;
        this._compressTime += dt;
        if (this._compressTime >= this._compressDuration) {
            this._compressing  = false;
            this._compressTime = 0;
        }
    }

    /**
     * Dibuja el bloque de rebote con estilo resorte rojo/amarillo arcade.
     * @param {CanvasRenderingContext2D} ctx
     * @param {Camera} camera
     */
    draw(ctx, camera) {
        const drawX = this.x - camera.x;
        if (drawX > CANVAS_W + 50 || drawX + this.width < -50) return;

        const squish = this._compressing
            ? Math.sin((this._compressTime / this._compressDuration) * Math.PI) * 6
            : 0;

        /* Cuerpo del resorte */
        ctx.fillStyle = '#e02020';
        ctx.fillRect(drawX, this.y + squish, this.width, this.height - squish);

        /* Franja superior amarilla (plataforma de impulso) */
        ctx.fillStyle = '#f0d020';
        ctx.fillRect(drawX, this.y + squish, this.width, 6);

        /* Espiral/zigzag decorativo del resorte */
        ctx.strokeStyle = '#ffee00';
        ctx.lineWidth = 2;
        const cx = drawX + this.width / 2;
        const topY = this.y + squish + 8;
        const botY = this.y + this.height - 4;
        const steps = 4;
        const stepH = (botY - topY) / steps;
        ctx.beginPath();
        ctx.moveTo(cx - 6, topY);
        for (let i = 0; i < steps; i++) {
            const xOff = (i % 2 === 0) ? 6 : -6;
            ctx.lineTo(cx + xOff, topY + stepH * (i + 1));
        }
        ctx.stroke();

        /* Borde */
        ctx.strokeStyle = '#a01010';
        ctx.lineWidth = 2;
        ctx.strokeRect(drawX, this.y + squish, this.width, this.height - squish);
    }
}


/* ═══════════════════════════════════════════════════════════════════
   7. CLASE LevelGoal (Sección 2.3.4 — Meta de final de nivel)
   Estructura de estandarte/portal arcade al extremo derecho.
   ═══════════════════════════════════════════════════════════════════ */

class LevelGoal {
    /**
     * @param {number} x – posición X en el mundo (≈ 3500)
     * @param {number} groundY – Y del suelo
     */
    constructor(x, groundY) {
        this.width   = 40;
        this.height  = 120;
        this.x       = x;
        this.y       = groundY - this.height;
        this.reached = false;

        this._flagWave = 0;   // animación de bandera
    }

    /* ── AABB ── */
    get left()   { return this.x; }
    get right()  { return this.x + this.width; }
    get top()    { return this.y; }
    get bottom() { return this.y + this.height; }

    update(dt) {
        this._flagWave += dt * 4;
    }

    /**
     * Dibuja el poste con bandera estilo arcade.
     * @param {CanvasRenderingContext2D} ctx
     * @param {Camera} camera
     */
    draw(ctx, camera) {
        const drawX = this.x - camera.x;
        if (drawX > CANVAS_W + 80 || drawX + this.width < -80) return;

        const poleX = drawX + this.width / 2;

        /* Poste */
        ctx.fillStyle = '#c0c0c0';
        ctx.fillRect(poleX - 3, this.y, 6, this.height);

        /* Esfera superior */
        ctx.fillStyle = '#f0e040';
        ctx.beginPath();
        ctx.arc(poleX, this.y, 6, 0, Math.PI * 2);
        ctx.fill();

        /* Bandera triangular con onda */
        const flagW = 30;
        const flagH = 24;
        const wave  = Math.sin(this._flagWave) * 3;

        ctx.fillStyle = '#40e040';
        ctx.beginPath();
        ctx.moveTo(poleX + 3, this.y + 6);
        ctx.lineTo(poleX + 3 + flagW, this.y + 6 + flagH / 2 + wave);
        ctx.lineTo(poleX + 3, this.y + 6 + flagH);
        ctx.closePath();
        ctx.fill();

        /* Estrella en la bandera */
        ctx.fillStyle = '#f0e040';
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('★', poleX + 3 + flagW / 2 - 2, this.y + 6 + flagH / 2 + 4 + wave);

        /* Base del poste */
        ctx.fillStyle = '#808080';
        ctx.fillRect(poleX - 10, this.y + this.height - 10, 20, 10);
    }
}


/* ═══════════════════════════════════════════════════════════════════
   8. BLOQUE SÓLIDO DE TERRENO (para plataformas, pilares, escalones)
   Bloque genérico utilizado por levels.js para construir el relieve.
   ═══════════════════════════════════════════════════════════════════ */

class TerrainBlock {
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} w      – ancho (por defecto BLOCK_SIZE)
     * @param {number} h      – alto  (por defecto BLOCK_SIZE)
     * @param {string} style  – estilo visual ('marble'|'brick'|'sand'|'ground')
     */
    constructor(x, y, w, h, style) {
        this.x      = x;
        this.y      = y;
        this.width  = w  || BLOCK_SIZE;
        this.height = h  || BLOCK_SIZE;
        this.style  = style || 'ground';
    }

    /* ── AABB ── */
    get left()   { return this.x; }
    get right()  { return this.x + this.width; }
    get top()    { return this.y; }
    get bottom() { return this.y + this.height; }

    /**
     * Dibuja el bloque según su estilo temático de nivel.
     * @param {CanvasRenderingContext2D} ctx
     * @param {Camera} camera
     */
    draw(ctx, camera) {
        const drawX = this.x - camera.x;
        if (drawX > CANVAS_W + 10 || drawX + this.width < -10) return;

        const colors = TerrainBlock.STYLES[this.style] || TerrainBlock.STYLES.ground;

        ctx.fillStyle = colors.fill;
        ctx.fillRect(drawX, this.y, this.width, this.height);

        /* Líneas de textura retro */
        ctx.strokeStyle = colors.line;
        ctx.lineWidth = 1;

        /* Rejilla interior de ladrillos/piedra */
        const bw = this.width >= 32 ? 16 : this.width;
        const bh = this.height >= 32 ? 16 : this.height;
        for (let bx = 0; bx < this.width; bx += bw) {
            ctx.beginPath();
            ctx.moveTo(drawX + bx, this.y);
            ctx.lineTo(drawX + bx, this.y + this.height);
            ctx.stroke();
        }
        for (let by = 0; by < this.height; by += bh) {
            ctx.beginPath();
            ctx.moveTo(drawX, this.y + by);
            ctx.lineTo(drawX + this.width, this.y + by);
            ctx.stroke();
        }

        /* Borde */
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 1;
        ctx.strokeRect(drawX, this.y, this.width, this.height);
    }
}

/** Paletas de colores temáticas para cada nivel */
TerrainBlock.STYLES = {
    ground: {
        fill: '#8b6914', line: '#6b5010', border: '#554010'
    },
    marble: {
        fill: '#e8e0d0', line: '#c8c0b0', border: '#a09880'
    },
    brick: {
        fill: '#b05030', line: '#883820', border: '#702810'
    },
    sand: {
        fill: '#d4a840', line: '#b89030', border: '#987020'
    }
};

class Platform extends TerrainBlock {
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} w
     * @param {number} h
     * @param {string} [style='ground']
     * @param {string} [subType='block']
     */
    constructor(x, y, w, h, style = 'ground', subType = 'block') {
        super(x, y, w, h, style);
        this.subType = subType;
    }
}


/* ═══════════════════════════════════════════════════════════════════
   9. MOTOR DE COLISIONES AABB  (CollisionEngine)
   Resolución de colisiones direccionales (Sección 2.3.4)
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Resuelve la colisión física AABB de los cuadros de habilidad con el jugador.
 * Prioriza el golpe desde abajo, permite aterrizar encima y bloquea lateralmente.
 *
 * @param {Player}     player
 * @param {SkillBox[]} skillBoxes
 * @returns {SkillBox|null} – el cuadro activado o null
 */
function resolvePlayerSkillBoxCollisions(player, skillBoxes) {
    if (!skillBoxes || !Array.isArray(skillBoxes)) return null;
    let hitBox = null;

    for (let i = 0; i < skillBoxes.length; i++) {
        const box = skillBoxes[i];

        // Superposición AABB
        const overlaps = (
            player.x < box.x + box.width &&
            player.x + player.width > box.x &&
            player.y < box.y + box.height &&
            player.y + player.height > box.y
        );
        if (!overlaps) continue;

        const prevY = (player.prevY !== undefined) ? player.prevY : player.y;
        const prevX = (player.prevX !== undefined) ? player.prevX : player.x;
        const horizOverlap = Math.min(player.x + player.width, box.x + box.width) - Math.max(player.x, box.x);

        // Golpe desde abajo (Prioridad cuando el jugador sube):
        if (player.vy < 0 && (prevY >= box.y + box.height - 16) && horizOverlap >= 8) {
            player.y = box.y + box.height;
            player.vy = 0;
            if (!box.used && !box.resolved) {
                box.hitFromBelow();
                hitBox = box;
            }
        }
        // Aterrizaje desde arriba:
        else if (player.vy >= 0 && (prevY + player.height <= box.y + 12)) {
            player.y = box.y - player.height;
            player.vy = 0;
            player.onGround = true;
        }
        // Bloqueo lateral:
        else {
            if (prevX + player.width <= box.x + 8) {
                player.x = box.x - player.width;
            } else if (prevX >= box.x + box.width - 8) {
                player.x = box.x + box.width;
            }
            player.vx = 0;
        }
    }

    return hitBox;
}

const CollisionEngine = {

    /**
     * Comprueba si dos cajas AABB se solapan.
     * @param {Object} a – { left, right, top, bottom }
     * @param {Object} b – { left, right, top, bottom }
     * @returns {boolean}
     */
    overlaps(a, b) {
        return (
            a.left   < b.right  &&
            a.right  > b.left   &&
            a.top    < b.bottom &&
            a.bottom > b.top
        );
    },

    /**
     * Resuelve colisiones entre el jugador y un array de bloques sólidos.
     * Devuelve el conjunto de eventos especiales detectados.
     *
     * @param {Player}  player
     * @param {Array}   blocks   – TerrainBlock[]
     * @param {number}  dt       – deltaTime en segundos
     * @returns {{ hitBelow: boolean }}
     */
    resolvePlayerVsBlocks(player, blocks, dt) {
        const result = { hitBelow: false };

        for (const block of blocks) {
            if (!this.overlaps(player, block)) continue;

            const prevBottom = (player.prevY !== undefined ? player.prevY : player.y) + player.height;
            const prevTop    = (player.prevY !== undefined ? player.prevY : player.y);
            const prevRight  = (player.prevX !== undefined ? player.prevX : player.x) + player.width;
            const prevLeft   = (player.prevX !== undefined ? player.prevX : player.x);

            // Tolerancia vertical calculada a partir de la velocidad
            const vTolerance = Math.max(14, Math.abs(player.vy * dt) + 6);

            // 1. Aterrizaje sólido desde arriba (pies estaban por encima del bloque y caía)
            if (player.vy >= 0 && prevBottom <= block.top + vTolerance) {
                player.y        = block.top - player.height;
                player.vy       = 0;
                player.onGround = true;
            }
            // 2. Golpe de bloque desde abajo (cabeza estaba debajo y saltaba hacia arriba)
            else if (player.vy < 0 && prevTop >= block.bottom - vTolerance) {
                player.y  = block.bottom;
                player.vy = 0;
                result.hitBelow = true;
            }
            // 3. Bloqueo horizontal lateral (pared, pilar o escalón)
            else {
                if (prevRight <= block.left + 16 || (player.vx > 0 && player.right > block.left)) {
                    player.x  = block.left - player.width;
                    player.vx = 0;
                } else if (prevLeft >= block.right - 16 || (player.vx < 0 && player.left < block.right)) {
                    player.x  = block.right;
                    player.vx = 0;
                }
            }
        }

        return result;
    },

    /**
     * Resuelve colisiones del jugador con bloques de rebote.
     * Al aterrizar sobre uno, impulsa al jugador a 1.5× altura de salto.
     *
     * @param {Player}       player
     * @param {BounceBlock[]} bounceBlocks
     * @returns {boolean} – true si se activó un rebote
     */
    resolvePlayerVsBounce(player, bounceBlocks) {
        for (const block of bounceBlocks) {
            if (!this.overlaps(player, block)) continue;

            const prevBottom = (player.prevY !== undefined ? player.prevY : player.y) + player.height;

            /* Solo se activa desde arriba (pisado) */
            if (player.vy >= 0 && prevBottom <= block.top + 18) {
                player.y        = block.top - player.height;
                player.vy       = BOUNCE_VELOCITY;  // 1.5× altura de salto
                player.onGround = false;
                block.triggerCompress();
                return true;
            }

            /* Si choca lateralmente, bloquear horizontalmente */
            if (player.vx > 0) {
                player.x = block.left - player.width;
                player.vx = 0;
            } else if (player.vx < 0) {
                player.x = block.right;
                player.vx = 0;
            }
        }
        return false;
    },

    /**
     * Resuelve colisiones del jugador con SkillBoxes (Sección 2.3.3).
     * Delegado a resolvePlayerSkillBoxCollisions.
     *
     * @param {Player}     player
     * @param {SkillBox[]} skillBoxes
     * @returns {SkillBox|null}
     */
    resolvePlayerVsSkillBoxes(player, skillBoxes) {
        return resolvePlayerSkillBoxCollisions(player, skillBoxes);
    },

    /**
     * Comprueba colisión del jugador con el obstáculo fijo (Sección 2.5.1).
     *
     * @param {Player}        player
     * @param {FixedObstacle} obstacle
     * @returns {{ collided: boolean, fromSide: string|null }}
     */
    resolvePlayerVsFixed(player, obstacle) {
        const triggered = checkFixedObstacleCollision(player, obstacle);
        return { collided: triggered, fromSide: 'obstacle' };
    },

    /**
     * Comprueba colisión del jugador con los obstáculos móviles.
     *
     * @param {Player}           player
     * @param {MobileObstacle[]} mobiles
     * @returns {MobileObstacle|null} – el obstáculo colisionado, o null
     */
    resolvePlayerVsMobiles(player, mobiles) {
        for (const mob of mobiles) {
            if (mob.resolved) continue;
            if (player.isImmune) continue;
            if (!this.overlaps(player, mob)) continue;

            /* Determinar dirección de la colisión */
            const overlapTop = player.bottom - mob.top;
            const overlapBot = mob.bottom    - player.top;
            const overlapL   = player.right  - mob.left;
            const overlapR   = mob.right     - player.left;
            const min = Math.min(overlapTop, overlapBot, overlapL, overlapR);

            if (min === overlapTop && player.vy >= 0) {
                /* Saltó encima: esquivado (Sección 2.3.3) — NO activa pregunta */
                player.y        = mob.top - player.height;
                player.vy       = JUMP_VELOCITY * 0.5;  // pequeño rebote
                player.onGround = false;
                return null;
            }

            /* Choque lateral o desde abajo: detener y pedir pregunta */
            if (min === overlapL) {
                player.x  = mob.left - player.width;
            } else if (min === overlapR) {
                player.x  = mob.right;
            }
            player.vx = 0;
            return mob;
        }
        return null;
    },

    /**
     * Comprueba si el jugador alcanza la meta del nivel.
     *
     * @param {Player}    player
     * @param {LevelGoal} goal
     * @returns {boolean}
     */
    checkGoal(player, goal) {
        if (!goal || goal.reached) return false;
        return this.overlaps(player, goal);
    }
};

/* ═══════════════════════════════════════════════════════════════════
   EXPORTACIÓN GLOBAL (Entities)
   ═══════════════════════════════════════════════════════════════════ */

const Entities = {
    Player,
    FixedObstacle,
    MobileObstacle,
    SkillBox,
    BounceBlock,
    LevelGoal,
    TerrainBlock,
    Platform,
    CollisionEngine,
    checkFixedObstacleCollision,
    resolvePlayerSkillBoxCollisions,
    resolvePlayerPlatformCollisions: function(player, blocks, dt) {
        return CollisionEngine.resolvePlayerVsBlocks(player, blocks, dt);
    }
};

window.Entities = Entities;
window.Platform = Platform;
window.checkFixedObstacleCollision = checkFixedObstacleCollision;
window.resolvePlayerSkillBoxCollisions = resolvePlayerSkillBoxCollisions;
