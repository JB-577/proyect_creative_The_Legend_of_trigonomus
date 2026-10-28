/**
 * ============================================================================
 * THE LEGEND OF TRIGONOMUS - ENTITIES.JS (FASE 3)
 * Clases de Entidades, Físicas de Plataformas, Colisiones AABB y Mecánicas
 * Especificación Técnica: Secciones 2.1, 2.2, 2.3, 2.5 y 2.6
 * ============================================================================
 */

(function (window) {
  'use strict';

  // ==========================================================================
  // 1. CLASE PLAYER (JUGADOR RETRO)
  // ==========================================================================
  class Player {
    /**
     * @param {number} x - Posición inicial horizontal
     * @param {number} y - Posición inicial vertical
     * @param {string} [characterId] - ID del personaje ('Pitagoras', 'HugoPolanco', 'AlbertEinstein')
     */
    constructor(x, y, characterId) {
      // Coordenadas y dimensiones del sprite en pantalla (proporción nítida retro)
      this.x = x || 60;
      this.y = y || 380;
      this.prevX = this.x;
      this.prevY = this.y;
      this.width = 48;
      this.height = 64;

      // Velocidades cinemáticas (píxeles por segundo)
      this.vx = 0;
      this.vy = 0;
      this.speed = 260; // Velocidad de carrera horizontal suave y reactiva

      // Orientación del personaje ('right' o 'left')
      this.facing = 'right';

      // ======================================================================
      // FÍSICAS DE SALTO PARABÓLICO EXACTO (Sección 2.1)
      // "alcanza exactamente el doble de píxeles de altura del sprite (128px),
      // después de 0.3s de haber subido, crea desplazamiento inverso (0.5s-0.6s total)"
      // ======================================================================
      this.jumpHeight = this.height * 2; // 128 píxeles
      this.timeToApex = 0.3;             // 0.3 segundos para alcanzar el ápice

      // Gravedad requerida para alcanzar jumpHeight en timeToApex:
      // h = 0.5 * g * t^2 => g = (2 * h) / (t^2)
      this.gravity = (2 * this.jumpHeight) / (this.timeToApex * this.timeToApex); // ~2844.44 px/s²

      // Velocidad inicial de salto vertical hacia arriba:
      // v0 = -sqrt(2 * g * h) => ~ -853.33 px/s
      this.jumpVelocity = -Math.sqrt(2 * this.gravity * this.jumpHeight);

      // Velocidad inicial para Bloques de Rebote (1.5 veces la altura normal = 192px):
      // h_bounce = 1.5 * jumpHeight => v0_bounce = -sqrt(2 * g * (1.5 * h)) => ~ -1045.12 px/s
      this.bounceVelocity = -Math.sqrt(2 * this.gravity * (this.jumpHeight * 1.5));

      // Límite de velocidad terminal de caída
      this.maxFallSpeed = 920;

      // Estados de control y suelo
      this.onGround = false;
      this.isJumping = false;
      this.jumpTime = 0;

      // Bloqueo de movimiento cuando el jugador enfrenta un obstáculo o habilidad (Sección 2.3.1)
      this.inputLocked = false;

      // Estado de Inmunidad temporal (Sección 2.6 - 1.1)
      this.isImmune = false;
      this.immunityTimer = 0;

      // Configuración de personaje activo
      this.characterId = characterId || (window.GAME_CONFIG ? window.GAME_CONFIG.getSelectedCharacterId() : 'Pitagoras');
      this.updateCharacterData();
    }

    /**
     * Actualiza la información y sprites del personaje según la selección
     */
    updateCharacterData(charId) {
      if (charId) this.characterId = charId;
      if (window.GAME_CONFIG && window.GAME_CONFIG.CHARACTERS) {
        this.charData = window.GAME_CONFIG.CHARACTERS[this.characterId] || window.GAME_CONFIG.CHARACTERS.Pitagoras;
      } else {
        this.charData = null;
      }
    }

    /**
     * Ejecuta el salto normal si el personaje está en el suelo y no está bloqueado
     */
    jump() {
      if (this.onGround && !this.inputLocked) {
        this.vy = this.jumpVelocity;
        this.onGround = false;
        this.isJumping = true;
        this.jumpTime = 0;
      }
    }

    /**
     * Impulso automático de Bloque de Rebote (1.5x salto normal, Sección 2.3.4)
     */
    bounce() {
      this.vy = this.bounceVelocity;
      this.onGround = false;
      this.isJumping = true;
      this.jumpTime = 0;
    }

    /**
     * Activa la inmunidad temporal de 10 segundos
     */
    activateImmunity(durationSeconds) {
      this.isImmune = true;
      this.immunityTimer = durationSeconds || 10;
    }

    /**
     * Actualización física frame a frame basada en deltaTime (dt en segundos)
     */
    update(dt, inputState) {
      // Guardar posición previa para resolución precisa de colisiones AABB
      this.prevX = this.x;
      this.prevY = this.y;

      // Actualizar temporizador de inmunidad
      if (this.isImmune) {
        this.immunityTimer -= dt;
        if (this.immunityTimer <= 0) {
          this.isImmune = false;
          this.immunityTimer = 0;
        }
      }

      // Procesamiento de entrada de teclado / controles
      if (this.inputLocked) {
        // En desafíos o modales se niega todo movimiento horizontal (Sección 2.3.1)
        this.vx = 0;
      } else if (inputState) {
        if (inputState.left && !inputState.right) {
          this.vx = -this.speed;
          this.facing = 'left';
        } else if (inputState.right && !inputState.left) {
          this.vx = this.speed;
          this.facing = 'right';
        } else {
          this.vx = 0;
        }

        if (inputState.jump) {
          this.jump();
        }
      } else {
        this.vx = 0;
      }

      // Aplicar gravedad vertical continua
      this.vy += this.gravity * dt;
      if (this.vy > this.maxFallSpeed) {
        this.vy = this.maxFallSpeed;
      }

      // Actualizar posición estimada previa a colisiones
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // El estado onGround se verificará y restablecerá en la rutina de colisiones
      this.onGround = false;

      // Límite izquierdo del mundo (no puede retroceder más allá de x = 0)
      if (this.x < 0) {
        this.x = 0;
      }
    }

    /**
     * Renderizado en el contexto 2D del Canvas
     */
    render(ctx, cameraX) {
      const renderX = Math.round(this.x - cameraX);
      const renderY = Math.round(this.y);

      // No renderizar si está fuera de pantalla
      if (renderX + this.width < -50 || renderX > 1000) return;

      ctx.save();

      // Efecto visual de Inmunidad: aura dorada y parpadeo de invencibilidad (Sección 2.6 - 1.1)
      if (this.isImmune) {
        const pulse = (Math.sin(Date.now() * 0.015) + 1) * 0.5; // Entre 0 y 1
        ctx.shadowColor = '#f1c40f';
        ctx.shadowBlur = 10 + pulse * 14;

        // Parpadeo sutil de inmunidad
        ctx.globalAlpha = 0.75 + pulse * 0.25;

        // Aura de chispas de inmunidad
        ctx.strokeStyle = '#ffee55';
        ctx.lineWidth = 2;
        ctx.strokeRect(renderX - 3, renderY - 3, this.width + 6, this.height + 6);
      }

      // Obtener imagen del sprite según orientación
      let spriteImg = null;
      if (window.GAME_CONFIG && window.GAME_CONFIG.AssetLoader && this.charData) {
        const key = this.facing === 'left' ? this.charData.imageKeys.left : this.charData.imageKeys.right;
        spriteImg = window.GAME_CONFIG.AssetLoader.getImage(key);
      }

      // Dibujar imagen pixelada del personaje
      if (spriteImg && spriteImg.complete && spriteImg.naturalWidth > 0) {
        ctx.drawImage(spriteImg, renderX, renderY, this.width, this.height);
      } else {
        // Fallback visual retro mientras cargan las imágenes
        ctx.fillStyle = this.characterId === 'Pitagoras' ? '#3498db' : (this.characterId === 'HugoPolanco' ? '#e67e22' : '#9b59b6');
        ctx.fillRect(renderX, renderY, this.width, this.height);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(renderX, renderY, this.width, this.height);

        // Ojos direccionales en el fallback
        ctx.fillStyle = '#ffffff';
        const eyeX = this.facing === 'right' ? renderX + 30 : renderX + 10;
        ctx.fillRect(eyeX, renderY + 14, 8, 8);
        ctx.fillStyle = '#000000';
        ctx.fillRect(this.facing === 'right' ? eyeX + 4 : eyeX, renderY + 16, 4, 4);
      }

      ctx.restore();
    }
  }

  // ==========================================================================
  // 2. FÍSICAS DE PLATAFORMAS Y BLOQUES (Sección 2.3.4)
  // ==========================================================================

  /**
   * Plataforma / Bloque sólido base
   */
  class Platform {
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @param {string} [theme] - 'grecia', 'ciudad', 'desierto', 'bounce'
     * @param {string} [subType] - 'ground', 'floating', 'pillar', 'step'
     */
    constructor(x, y, width, height, theme = 'grecia', subType = 'floating') {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      this.theme = theme;
      this.subType = subType;
      this.isBounce = false;
    }

    render(ctx, cameraX) {
      const rx = Math.round(this.x - cameraX);
      const ry = Math.round(this.y);

      // Optimización de recorte fuera de pantalla
      if (rx + this.width < -100 || rx > 1050) return;

      ctx.save();

      // Paleta retro de bloques según el nivel (Secciones 4.1.1, 4.2.1, 4.3.1)
      if (this.theme === 'grecia') {
        // Bloques de mármol blanco/crema y pilares clásicos
        ctx.fillStyle = this.subType === 'ground' ? '#d8d3c5' : '#eae5d9';
        ctx.fillRect(rx, ry, this.width, this.height);

        // Bordes biselados pixelados estilo templo griego
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(rx, ry, this.width, 3); // Borde superior claro

        ctx.strokeStyle = '#a8a294';
        ctx.strokeRect(rx, ry + this.height - 3, this.width, 3); // Borde inferior sombreado

        // Patrón de columnas o baldosas
        ctx.fillStyle = '#bfb9ab';
        for (let bx = rx + 16; bx < rx + this.width - 4; bx += 32) {
          ctx.fillRect(bx, ry + 3, 2, this.height - 6);
        }
      } else if (this.theme === 'ciudad') {
        // Ladrillos urbanos retro, asfalto y vigas metálicas
        if (this.subType === 'ground') {
          ctx.fillStyle = '#2c3e50'; // Asfalto
          ctx.fillRect(rx, ry, this.width, this.height);
          ctx.fillStyle = '#7f8c8d';
          ctx.fillRect(rx, ry, this.width, 6); // Acera superior
        } else {
          ctx.fillStyle = '#962d00'; // Ladrillo urbano
          ctx.fillRect(rx, ry, this.width, this.height);
          ctx.strokeStyle = '#e67e22';
          ctx.lineWidth = 2;
          ctx.strokeRect(rx, ry, this.width, 2);

          // Patrón de junta de ladrillos
          ctx.fillStyle = '#4d1700';
          for (let bx = rx + 24; bx < rx + this.width; bx += 24) {
            ctx.fillRect(bx, ry + 2, 2, this.height - 4);
          }
        }
      } else if (this.theme === 'desierto') {
        // Piedra arenisca dorada/ocre y bloques piramidales
        ctx.fillStyle = this.subType === 'ground' ? '#c29b38' : '#d4af37';
        ctx.fillRect(rx, ry, this.width, this.height);

        ctx.strokeStyle = '#f9e79f';
        ctx.lineWidth = 2;
        ctx.strokeRect(rx, ry, this.width, 3); // Borde superior iluminado

        ctx.fillStyle = '#937220';
        ctx.fillRect(rx, ry + this.height - 4, this.width, 4);

        // Textura arenosa retro
        ctx.fillStyle = '#7d6018';
        for (let bx = rx + 20; bx < rx + this.width; bx += 28) {
          ctx.fillRect(bx, ry + 4, 3, this.height - 8);
        }
      }

      ctx.restore();
    }
  }

  /**
   * Bloque Especial de Rebote (Trampolín/Resorte arcade, Sección 2.3.4)
   * Impulsa automáticamente al jugador a 1.5 veces su altura normal de salto
   */
  class BounceBlock extends Platform {
    constructor(x, y, width = 48, height = 24, theme = 'grecia') {
      super(x, y, width, height, theme, 'bounce');
      this.isBounce = true;
      this.compressAnimation = 0; // Para animación visual al pisar
    }

    triggerBounce() {
      this.compressAnimation = 0.2; // 0.2 segundos de rebote
    }

    update(dt) {
      if (this.compressAnimation > 0) {
        this.compressAnimation -= dt;
        if (this.compressAnimation < 0) this.compressAnimation = 0;
      }
    }

    render(ctx, cameraX) {
      const rx = Math.round(this.x - cameraX);
      const ry = Math.round(this.y);

      if (rx + this.width < -60 || rx > 1020) return;

      ctx.save();

      // Base del bloque trampolín
      ctx.fillStyle = '#111122';
      ctx.fillRect(rx, ry + 12, this.width, this.height - 12);

      // Color distintivo retro (amarillo neón y rojo arcade)
      const isCompressed = this.compressAnimation > 0;
      const springHeight = isCompressed ? 6 : 14;
      const springY = ry + (this.height - springHeight);

      // Resorte
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(rx + 6, springY, this.width - 12, springHeight);

      // Superficie de rebote (Almohadilla amarilla)
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(rx + 2, isCompressed ? ry + 8 : ry, this.width - 4, 6);

      // Borde retro
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(rx + 2, isCompressed ? ry + 8 : ry, this.width - 4, 6);

      ctx.restore();
    }
  }

  // ==========================================================================
  // 3. CUADRO DE HABILIDAD (IMG_0672.png, Secciones 2.3.3 y 4)
  // ==========================================================================
  class SkillBox {
    /**
     * @param {number} x
     * @param {number} y
     * @param {Function} onHitCallback - Callback disparado al activarlo
     */
    constructor(x, y, onHitCallback) {
      this.x = x;
      this.y = y;
      this.width = 44;
      this.height = 44;
      this.onHit = onHitCallback || null;

      this.used = false;          // True cuando ya fue abierto
      this.isBouncing = false;    // Animación de rebote al golpearlo
      this.bounceTimer = 0;
      this.bounceDuration = 0.22; // Duración del rebote vertical
      this.bounceOffset = 0;      // Desplazamiento hacia arriba en píxeles
    }

    /**
     * Activación al golpearlo desde abajo mediante salto (Sección 2.3.3)
     */
    hitFromBelow() {
      if (this.used) return false;
      this.used = true;
      this.isBouncing = true;
      this.bounceTimer = this.bounceDuration;

      if (typeof this.onHit === 'function') {
        this.onHit(this);
      }
      return true;
    }

    /**
     * Activación mediante clic directo en el canvas (Sección 2.3.3)
     */
    checkClick(worldX, worldY) {
      if (this.used) return false;
      if (worldX >= this.x && worldX <= this.x + this.width &&
          worldY >= this.y && worldY <= this.y + this.height) {
        return this.hitFromBelow();
      }
      return false;
    }

    update(dt) {
      if (this.isBouncing) {
        this.bounceTimer -= dt;
        if (this.bounceTimer <= 0) {
          this.isBouncing = false;
          this.bounceOffset = 0;
        } else {
          // Animación de subida y bajada sinusoidal
          const progress = 1 - (this.bounceTimer / this.bounceDuration);
          this.bounceOffset = Math.sin(progress * Math.PI) * 14;
        }
      }
    }

    render(ctx, cameraX) {
      const rx = Math.round(this.x - cameraX);
      const ry = Math.round(this.y - this.bounceOffset);

      if (rx + this.width < -60 || rx > 1020) return;

      ctx.save();

      let boxImg = null;
      if (window.GAME_CONFIG && window.GAME_CONFIG.AssetLoader) {
        boxImg = window.GAME_CONFIG.AssetLoader.getImage('CUADRO_HABILIDAD');
      }

      if (boxImg && boxImg.complete && boxImg.naturalWidth > 0) {
        if (this.used) {
          ctx.filter = 'grayscale(100%) brightness(0.7)';
        }
        ctx.drawImage(boxImg, rx, ry, this.width, this.height);
      } else {
        // Fallback gráfico del bloque de habilidad estilo bloque "?" de Mario
        ctx.fillStyle = this.used ? '#7f8c8d' : '#f39c12';
        ctx.fillRect(rx, ry, this.width, this.height);

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.strokeRect(rx, ry, this.width, this.height);

        // Signo de interrogación o bloque inactivo
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.used ? '·' : '?', rx + this.width / 2, ry + this.height / 2);
      }

      ctx.restore();
    }
  }

  // ==========================================================================
  // 4. OBSTÁCULOS (FIJO Y MÓVIL, Sección 2.5)
  // ==========================================================================

  /**
   * Obstáculo Fijo del Mapa (obstaculo_del_mapa.png, Sección 2.5.1)
   * Actúa como barrera vertical infranqueable a la mitad del nivel.
   */
  class FixedObstacle {
    /**
     * @param {number} x - Mitad del nivel
     * @param {number} y - Apoyado en el suelo
     * @param {Function} onTriggerCallback - Al tocarlo sin inmunidad
     */
    constructor(x, y, onTriggerCallback) {
      this.x = x;
      this.y = y;
      this.width = 68;
      this.height = 110;
      this.onTrigger = onTriggerCallback || null;
      this.resolved = false; // Se marca true al superar o penalizar el desafío
    }

    render(ctx, cameraX) {
      const rx = Math.round(this.x - cameraX);
      const ry = Math.round(this.y);

      if (rx + this.width < -80 || rx > 1050) return;

      ctx.save();

      let obsImg = null;
      if (window.GAME_CONFIG && window.GAME_CONFIG.AssetLoader) {
        obsImg = window.GAME_CONFIG.AssetLoader.getImage('OBSTACULO_FIJO');
      }

      if (this.resolved) {
        // Una vez resuelto, se vuelve traslúcido para indicar paso permitido
        ctx.globalAlpha = 0.35;
      }

      if (obsImg && obsImg.complete && obsImg.naturalWidth > 0) {
        ctx.drawImage(obsImg, rx, ry, this.width, this.height);
      } else {
        // Fallback visual de pilar / barrera
        ctx.fillStyle = this.resolved ? '#27ae60' : '#c0392b';
        ctx.fillRect(rx, ry, this.width, this.height);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.strokeRect(rx, ry, this.width, this.height);

        ctx.fillStyle = '#ffffff';
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(this.resolved ? 'PASO' : 'ALTO', rx + this.width / 2, ry + 25);
      }

      ctx.restore();
    }
  }

  /**
   * Obstáculo Móvil (obstaculo_movible.png, Sección 2.5.2)
   * Patrulla autónomamente estilo Goomba; se puede esquivar saltando por encima.
   */
  class MobileObstacle {
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} minX - Límite izquierdo de patrulla
     * @param {number} maxX - Límite derecho de patrulla
     * @param {Function} onTriggerCallback - Al colisionar con el jugador
     */
    constructor(x, y, minX, maxX, onTriggerCallback) {
      this.x = x;
      this.y = y;
      this.width = 44;
      this.height = 44;
      this.minX = minX;
      this.maxX = maxX;
      this.vx = 75; // Velocidad de patrulla
      this.onTrigger = onTriggerCallback || null;
      this.resolved = false;
    }

    update(dt) {
      if (this.resolved) return;

      this.x += this.vx * dt;

      // Rebotar en los extremos de su patrulla
      if (this.x <= this.minX) {
        this.x = this.minX;
        this.vx = Math.abs(this.vx);
      } else if (this.x >= this.maxX) {
        this.x = this.maxX;
        this.vx = -Math.abs(this.vx);
      }
    }

    render(ctx, cameraX) {
      const rx = Math.round(this.x - cameraX);
      const ry = Math.round(this.y);

      if (rx + this.width < -60 || rx > 1020) return;

      ctx.save();

      if (this.resolved) {
        ctx.globalAlpha = 0.3;
      }

      let mobImg = null;
      if (window.GAME_CONFIG && window.GAME_CONFIG.AssetLoader) {
        mobImg = window.GAME_CONFIG.AssetLoader.getImage('OBSTACULO_MOVIBLE');
      }

      if (mobImg && mobImg.complete && mobImg.naturalWidth > 0) {
        // Si se mueve a la izquierda, podemos reflejar horizontalmente
        if (this.vx < 0) {
          ctx.translate(rx + this.width, ry);
          ctx.scale(-1, 1);
          ctx.drawImage(mobImg, 0, 0, this.width, this.height);
        } else {
          ctx.drawImage(mobImg, rx, ry, this.width, this.height);
        }
      } else {
        // Fallback visual de enemigo móvil retro
        ctx.fillStyle = this.resolved ? '#7f8c8d' : '#8e44ad';
        ctx.fillRect(rx, ry, this.width, this.height);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(rx, ry, this.width, this.height);

        // Ojos amenazantes
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(rx + 8, ry + 12, 8, 8);
        ctx.fillRect(rx + 28, ry + 12, 8, 8);
      }

      ctx.restore();
    }
  }

  // ==========================================================================
  // 5. META DEL NIVEL (LevelGoal, Sección 2.3.4)
  // Ubicada a x ≈ 3500px, portal/estandarte que completa el nivel
  // ==========================================================================
  class LevelGoal {
    constructor(x, y, onReachCallback) {
      this.x = x || 3500;
      this.y = y || 240;
      this.width = 64;
      this.height = 220;
      this.onReach = onReachCallback || null;
      this.reached = false;
    }

    render(ctx, cameraX) {
      const rx = Math.round(this.x - cameraX);
      const ry = Math.round(this.y);

      if (rx + this.width < -80 || rx > 1050) return;

      ctx.save();

      // Mástil / Pilar de la meta
      ctx.fillStyle = '#d4af37'; // Dorado
      ctx.fillRect(rx + 24, ry, 16, this.height);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(rx + 24, ry, 16, this.height);

      // Remate superior del mástil (esfera dorada)
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.arc(rx + 32, ry, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Bandera / Estandarte animado retro
      const wave = Math.sin(Date.now() * 0.006) * 4;
      ctx.fillStyle = '#2ecc71';
      ctx.beginPath();
      ctx.moveTo(rx + 40, ry + 15);
      ctx.lineTo(rx + 80 + wave, ry + 35);
      ctx.lineTo(rx + 40, ry + 60);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Letras de GOAL en la bandera
      ctx.fillStyle = '#ffffff';
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillText('META', rx + 44, ry + 40);

      ctx.restore();
    }
  }

  // ==========================================================================
  // 6. MOTOR DE COLISIONES DIRECCIONALES AABB (Sección 2.3.4)
  // ==========================================================================

  /**
   * Resuelve colisiones AABB completas (Aterrizaje, Golpe inferior y Bloqueo lateral)
   * entre el jugador y todas las plataformas/bloques del nivel.
   */
  function resolvePlayerPlatformCollisions(player, platforms) {
    if (!player || !platforms || !platforms.length) return;

    for (let i = 0; i < platforms.length; i++) {
      const block = platforms[i];

      // Verificación rápida de superposición AABB
      const isOverlapping = (
        player.x < block.x + block.width &&
        player.x + player.width > block.x &&
        player.y < block.y + block.height &&
        player.y + player.height > block.y
      );

      if (!isOverlapping) continue;

      // Calcular penetración en cada eje
      const overlapLeft = (player.x + player.width) - block.x;
      const overlapRight = (block.x + block.width) - player.x;
      const overlapTop = (player.y + player.height) - block.y;
      const overlapBottom = (block.y + block.height) - player.y;

      // Determinar el eje de menor penetración para resolver
      const minOverlapX = Math.min(overlapLeft, overlapRight);
      const minOverlapY = Math.min(overlapTop, overlapBottom);

      if (minOverlapY < minOverlapX) {
        // COLISIÓN VERTICAL

        // 1. Aterrizaje desde arriba (Sección 2.3.4)
        if (overlapTop < overlapBottom && player.vy >= 0 && (player.prevY + player.height) <= block.y + 12) {
          player.y = block.y - player.height;
          player.vy = 0;
          player.onGround = true;

          // Si es Bloque de Rebote, impulsar al jugador automáticamente (Sección 2.3.4)
          if (block.isBounce) {
            block.triggerBounce();
            player.bounce();
            if (window.AudioManager && typeof window.AudioManager.playSFX === 'function') {
              window.AudioManager.playSFX('SFX_VICTORIA');
            }
          }
        }
        // 2. Golpe desde abajo (Golpe de bloque, Sección 2.3.4)
        else if (overlapBottom < overlapTop && player.vy < 0) {
          player.y = block.y + block.height;
          player.vy = 0;

          // Si es Cuadro de Habilidad, activar animación de rebote y evento de pregunta
          if (block instanceof SkillBox) {
            block.hitFromBelow();
          }
        }
      } else {
        // 3. Colisión lateral (Muros, pilares, cajas y escalones, Sección 2.3.4)
        if (overlapLeft < overlapRight) {
          // Golpeando por la izquierda del bloque
          player.x = block.x - player.width;
          player.vx = 0;
        } else {
          // Golpeando por la derecha del bloque
          player.x = block.x + block.width;
          player.vx = 0;
        }
      }
    }
  }

  /**
   * Resuelve la interacción con el Obstáculo Fijo (Sección 2.5.1 y 2.3.3)
   */
  function checkFixedObstacleCollision(player, fixedObstacle) {
    if (!player || !fixedObstacle || fixedObstacle.resolved) return;

    // Con Inmunidad activa, el jugador pasa libremente sin abrir desafío (Sección 2.6 - 1.1)
    if (player.isImmune) return;

    // El obstáculo fijo actúa como una barrera vertical completa (no se salta por encima sin inmunidad)
    const touchesHorizontally = (
      player.x + player.width >= fixedObstacle.x &&
      player.x <= fixedObstacle.x + fixedObstacle.width
    );

    // Si coincide en X y no está por debajo del suelo
    if (touchesHorizontally && player.y + player.height > fixedObstacle.y - 120) {
      // Detener al jugador exactamente antes del obstáculo
      if (player.x < fixedObstacle.x) {
        player.x = fixedObstacle.x - player.width;
      } else {
        player.x = fixedObstacle.x + fixedObstacle.width;
      }
      player.vx = 0;

      // Disparar evento de desafío si aún no se ha abierto
      if (typeof fixedObstacle.onTrigger === 'function') {
        fixedObstacle.onTrigger(fixedObstacle);
      }
    }
  }

  /**
   * Resuelve la colisión con los Obstáculos Móviles (Sección 2.5.2 y 2.3.3)
   */
  function checkMobileObstaclesCollision(player, mobileObstacles) {
    if (!player || !mobileObstacles || !mobileObstacles.length) return;

    for (let i = 0; i < mobileObstacles.length; i++) {
      const mob = mobileObstacles[i];
      if (mob.resolved) continue;

      // Con Inmunidad activa pasa libremente
      if (player.isImmune) continue;

      // Colisión AABB estándar contra la hitbox del obstáculo móvil
      const overlap = (
        player.x < mob.x + mob.width &&
        player.x + player.width > mob.x &&
        player.y < mob.y + mob.height &&
        player.y + player.height > mob.y
      );

      if (overlap) {
        // Si el jugador está cayendo claramente por encima, se esquiva sin abrir pregunta
        const isStomping = (player.vy > 0 && (player.prevY + player.height) <= mob.y + 10);
        if (isStomping) {
          // Rebote ligero al esquivarlo por arriba
          player.vy = player.jumpVelocity * 0.7;
          continue;
        }

        // De lo contrario choca contra su hitbox y activa el desafío (Sección 2.5.2)
        player.vx = 0;
        if (typeof mob.onTrigger === 'function') {
          mob.onTrigger(mob);
        }
        break; // Detener en el primer contacto
      }
    }
  }

  /**
   * Verifica llegada a la meta del nivel (Sección 2.3.4)
   */
  function checkLevelGoal(player, goal) {
    if (!player || !goal || goal.reached) return false;

    const touched = (
      player.x + player.width >= goal.x &&
      player.x <= goal.x + goal.width &&
      player.y + player.height >= goal.y
    );

    if (touched) {
      goal.reached = true;
      if (typeof goal.onReach === 'function') {
        goal.onReach(goal);
      }
      return true;
    }
    return false;
  }

  // ==========================================================================
  // EXPORTACIÓN AL OBJETO GLOBAL window.GameEntities
  // ==========================================================================
  window.GameEntities = {
    Player,
    Platform,
    BounceBlock,
    SkillBox,
    FixedObstacle,
    MobileObstacle,
    LevelGoal,
    resolvePlayerPlatformCollisions,
    checkFixedObstacleCollision,
    checkMobileObstaclesCollision,
    checkLevelGoal
  };

})(window);
