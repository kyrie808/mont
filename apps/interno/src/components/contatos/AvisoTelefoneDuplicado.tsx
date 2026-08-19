import { AlertTriangle } from 'lucide-react'

/**
 * Avisa, ainda durante a digitação, que o WhatsApp já pertence a alguém.
 *
 * Nasceu de um caso real (19/08/2026): o Gilmar preencheu o cadastro inteiro da "Najla"
 * e só descobriu no clique final que o número já era do contato "♡ Cadonhoto ♡" — nome
 * que a secretária de WhatsApp havia gravado a partir do push name do aparelho, e que
 * ele não tinha como reconhecer.
 *
 * É aviso, não bloqueio: o banco é quem recusa de fato (3 índices únicos de telefone).
 * Aqui o objetivo é só não deixar o operador descobrir tarde.
 */
export function AvisoTelefoneDuplicado({ nome }: { nome: string }) {
    return (
        <p
            role="status"
            className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-warning/20 bg-warning/10 px-2 py-1.5 text-xs font-medium text-warning-strong"
        >
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
            <span>
                Este WhatsApp já é do contato <strong className="font-bold">{nome}</strong>.
            </span>
        </p>
    )
}
