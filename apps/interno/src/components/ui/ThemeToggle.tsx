import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/contexts/ThemeContext"


export function ThemeToggle() {
    const { theme, setTheme } = useTheme()

    return (
        <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title="Alternar Tema"
        >
            <Sun className="h-6 w-6 rotate-0 scale-100 transition-transform duration-500 dark:-rotate-90 dark:scale-0 text-gray-800" />
            <Moon className="absolute h-6 w-6 rotate-90 scale-0 transition-transform duration-500 dark:rotate-0 dark:scale-100 text-gray-200" />
            <span className="sr-only">Alternar tema</span>
        </button>
    )
}
