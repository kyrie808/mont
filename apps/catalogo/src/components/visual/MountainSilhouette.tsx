import { cn } from '@mont/shared'

interface MountainSilhouetteProps {
    className?: string
    opacity?: number
    inverted?: boolean // For CTA section at bottom
}

export function MountainSilhouette({ className, opacity = 0.15, inverted = false }: MountainSilhouetteProps) {
    return (
        <div
            className={cn('w-full relative z-0 pointer-events-none select-none', className)}
            style={{ opacity }}
            aria-hidden="true"
        >
            <svg
                viewBox="0 0 1440 320"
                className={cn('w-full h-auto', inverted ? 'rotate-180' : '')}
                preserveAspectRatio="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <defs>
                    <linearGradient id="mountainGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#E8601C" />
                        <stop offset="40%" stopColor="#8B2E1A" />
                        <stop offset="100%" stopColor="#6B6560" />
                    </linearGradient>
                </defs>
                {/* Smooth M-like shape */}
                <path
                    fill="url(#mountainGradient)"
                    d="M0,320L48,309.3C96,299,192,277,288,229.3C384,181,480,107,576,90.7C672,75,768,117,864,149.3C960,181,1056,203,1152,192C1248,181,1344,139,1392,117.3L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
                ></path>
            </svg>
        </div>
    )
}
