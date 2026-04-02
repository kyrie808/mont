import type { Config } from 'tailwindcss'

const config: Config = {
    content: [
        './src/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
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
                display: ['var(--font-playfair)', 'serif'],
                body: ['var(--font-dm-sans)', 'sans-serif'],
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
