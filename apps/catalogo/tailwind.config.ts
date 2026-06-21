import type { Config } from 'tailwindcss'

const config: Config = {
    content: [
        './src/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                // Tokens semânticos do catálogo (/lab) — resolvem CSS vars de .lab-theme.
                // Independentes do mont-* (produção). Ver globals.css.
                background: 'hsl(var(--background) / <alpha-value>)',
                card: 'hsl(var(--card) / <alpha-value>)',
                muted: 'hsl(var(--muted) / <alpha-value>)',
                foreground: 'hsl(var(--foreground) / <alpha-value>)',
                'muted-foreground': 'hsl(var(--muted-foreground) / <alpha-value>)',
                primary: {
                    DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
                    foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
                },
                accent: {
                    DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
                    light: 'hsl(var(--accent-light) / <alpha-value>)',
                    strong: 'hsl(var(--accent-strong) / <alpha-value>)',
                },
                border: 'hsl(var(--border) / <alpha-value>)',
                'border-strong': 'hsl(var(--border-strong) / <alpha-value>)',
                destructive: 'hsl(var(--destructive) / <alpha-value>)',
                ring: 'hsl(var(--ring) / <alpha-value>)',
                // Chrome (nav/menu/footer) — superfícies art-directed por tema.
                'nav-fg': 'hsl(var(--nav-fg) / <alpha-value>)',
                'menu-bg': 'hsl(var(--menu-bg) / <alpha-value>)',
                'footer-bg': 'hsl(var(--footer-bg) / <alpha-value>)',
                mont: {
                    cream: '#FAF7F2',
                    espresso: '#2C1810',
                    gold: '#C8963E',
                    'gold-light': '#E8C876',
                    'warm-gray': '#8B7E74',
                    gray: '#8B7E74',
                    orange: '#E8601C',
                    'orange-dark': '#C43E1A',
                    line: '#E5DDD4',
                    surface: '#F5F0E8',
                    white: '#FFFDF9',
                    success: '#5B8C5A',
                    warning: '#D4A039',
                    danger: '#C44536',
                },
            },
            fontFamily: {
                // Famílias dirigidas por tema: --font-heading/--font-text flipam em .tema-copa.
                // padrão = Playfair/DM Sans · copa = Nunito. (Ver globals.css.)
                display: ['var(--font-heading)', 'ui-serif', 'serif'],
                body: ['var(--font-text)', 'ui-sans-serif', 'sans-serif'],
                mono: ['var(--font-jetbrains)', 'monospace'],
            },
            fontSize: {
                hero: 'clamp(2.5rem, 8vw, 5rem)',
                display: 'clamp(2rem, 5vw, 3.5rem)',
                heading: 'clamp(1.5rem, 3vw, 2rem)',
                subhead: 'clamp(1.125rem, 2vw, 1.375rem)',
            },
        },
    },
    plugins: [],
}
export default config
