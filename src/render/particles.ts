/**
 * Particules : copeaux de bois, éclats de pierre, gouttes vertes des mutants.
 *
 * Quelques pastilles colorées projetées depuis ce qui est heurté — c'est ce
 * qui fait « sentir » le coup. Chaque particule est un disque plein, comme
 * toutes les formes du jeu, qui rapetisse en fin de vie ; elle a une
 * vitesse, une gravité, une durée de vie. Les couleurs viennent de la
 * palette (`main.ts` les choisit). Le `Graphics` est redessiné à chaque
 * frame : il n'y en a jamais plus de quelques dizaines.
 */

import { Container, Graphics } from 'pixi.js';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Millisecondes restantes, et durée de vie totale. */
  life: number;
  total: number;
  radius: number;
  color: number;
}

const GRAVITY = 0.0009;

export class ParticleLayer {
  public readonly container = new Container();

  private readonly graphics = new Graphics();
  private readonly particles: Particle[] = [];

  public constructor() {
    this.container.addChild(this.graphics);
    // Au-dessus de tout ce qui a des coordonnées monde.
    this.container.zIndex = Number.MAX_SAFE_INTEGER;
  }

  /** Projette `count` particules depuis (x, y), en piochant dans `colors`. */
  public burst(x: number, y: number, colors: readonly number[], count = 6, speed = 0.09): void {
    for (let i = 0; i < count; i += 1) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2;
      const velocity = speed * (0.5 + Math.random());
      const life = 350 + Math.random() * 250;

      this.particles.push({
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 8,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life,
        total: life,
        radius: 1.6 + Math.random() * 1.6,
        color: colors[Math.floor(Math.random() * colors.length)] ?? 0xffffff,
      });
    }
  }

  public update(deltaMs: number): void {
    const graphics = this.graphics;

    graphics.clear();

    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const particle = this.particles[i]!;

      particle.life -= deltaMs;

      if (particle.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      particle.vy += GRAVITY * deltaMs;
      particle.x += particle.vx * deltaMs;
      particle.y += particle.vy * deltaMs;

      graphics.circle(particle.x, particle.y, particle.radius * Math.min(1, (particle.life / particle.total) * 2)).fill(particle.color);
    }
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}
