
interface StatusBadgeProps {
    status: string
}

export default function StatusBadge({ status }: StatusBadgeProps) {
    const getStatusStyles = (status: string) => {
        switch (status.toLowerCase()) {
            case 'pendente':
                return 'bg-yellow-100 text-yellow-800 border-yellow-200'
            case 'confirmado':
                return 'bg-blue-100 text-blue-800 border-blue-200'
            case 'preparando':
                return 'bg-purple-100 text-purple-800 border-purple-200'
            case 'enviado':
                return 'bg-indigo-100 text-indigo-800 border-indigo-200'
            case 'entregue':
                return 'bg-green-100 text-green-800 border-green-200'
            case 'cancelado':
                return 'bg-red-100 text-red-800 border-red-200'
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200'
        }
    }

    return (
        <span
            className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusStyles(status)} uppercase tracking-wide`}
        >
            {status}
        </span>
    )
}
