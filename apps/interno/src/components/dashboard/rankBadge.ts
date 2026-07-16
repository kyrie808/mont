// Cores do badge de posição e da medalha por rank (ouro/prata/bronze tokenizados).
// Usado nos rankings desktop (Indicações e Compras).

export function rankBadge(rank: number): string {
    switch (rank) {
        case 1: return 'bg-accent/20 text-foreground ring-1 ring-accent/50'
        case 2: return 'bg-muted text-muted-foreground ring-1 ring-border'
        case 3: return 'bg-warning-strong/15 text-warning-strong ring-1 ring-warning-strong/40'
        default: return 'bg-muted text-muted-foreground'
    }
}

export function medalColor(rank: number): string {
    return rank === 1 ? 'text-accent' : rank === 2 ? 'text-muted-foreground' : 'text-warning-strong'
}
