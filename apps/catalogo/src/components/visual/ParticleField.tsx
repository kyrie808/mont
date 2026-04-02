import React from 'react'

const PARTICLE_COUNT = 12

export function ParticleField() {
    // Generate deterministic values based on index to avoid hydration mismatch
    const particles = Array.from({ length: PARTICLE_COUNT }).map((_, i) => ({
        id: i,
        // Distribute horizontally 0-100%
        left: `${(i * 100 / PARTICLE_COUNT) + (i % 2 === 0 ? 5 : -5)}%`,
        // Vary starting vertical position
        top: `${(i * 70 / PARTICLE_COUNT) + 20}%`,
        // Stagger delays
        animationDelay: `${i * 1.5}s`,
        // Vary duration
        animationDuration: `${20 + (i % 5)}s`,
        // Vary size 2-4px
        size: 2 + (i % 3),
        // Slight horizontal drift
        drift: (i % 2 === 0 ? 20 : -20),
    }))

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-10" aria-hidden="true">
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes float {
                    0% { transform: translateY(0) translateX(0); opacity: 0; }
                    20% { opacity: 0.5; }
                    50% { transform: translateY(-60px) translateX(var(--drift)); opacity: 0.2; }
                    80% { opacity: 0.5; }
                    100% { transform: translateY(-120px) translateX(calc(var(--drift) * -1)); opacity: 0; }
                }
            `}} />

            {particles.map((p) => (
                <div
                    key={p.id}
                    className="absolute rounded-full bg-mont-cream"
                    style={{
                        left: p.left,
                        top: p.top,
                        width: `${p.size}px`,
                        height: `${p.size}px`,
                        opacity: 0.4,
                        animation: `float ${p.animationDuration} infinite ease-in-out`,
                        animationDelay: p.animationDelay,
                        ['--drift' as string]: `${p.drift}px`,
                    }}
                />
            ))}
        </div>
    )
}
