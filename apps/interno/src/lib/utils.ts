// Shim para componentes vindos de registries shadcn (Watermelon/ReUI).
// Eles importam `cn` de "@/lib/utils"; a nossa fonte única é @mont/shared.
// Mantém um só `cn` no projeto (re-export, não cópia).
export { cn } from '@mont/shared'
