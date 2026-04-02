import { Clock } from 'lucide-react'
import { Card, Button, Input } from '../../ui'

interface ConfiguracaoCicloProps {
    cicloB2C: number
    setCicloB2C: (val: number) => void
    cicloB2B: number
    setCicloB2B: (val: number) => void
}

export function ConfiguracaoCiclo({
    cicloB2C,
    setCicloB2C,
    cicloB2B,
    setCicloB2B
}: ConfiguracaoCicloProps) {
    return (
        <Card>
            <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Ciclos de Recompra</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Dias até alerta de recompra</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="ciclo-b2c" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Pessoa Física (B2C)
                        </label>
                        <div className="flex items-stretch gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCicloB2C(Math.max(1, cicloB2C - 1))}
                                className="px-2"
                            >
                                −
                            </Button>
                            <Input
                                id="ciclo-b2c"
                                type="number"
                                min={1}
                                max={90}
                                value={cicloB2C}
                                onChange={(e) => setCicloB2C(Number(e.target.value))}
                                className="w-16 text-center"
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCicloB2C(Math.min(90, cicloB2C + 1))}
                                className="px-2"
                            >
                                +
                            </Button>
                            <span className="text-sm text-gray-500 dark:text-gray-400 self-center ml-1">dias</span>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="ciclo-b2b" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Pessoa Jurídica (B2B)
                        </label>
                        <div className="flex items-stretch gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCicloB2B(Math.max(1, cicloB2B - 1))}
                                className="px-2"
                            >
                                −
                            </Button>
                            <Input
                                id="ciclo-b2b"
                                type="number"
                                min={1}
                                max={90}
                                value={cicloB2B}
                                onChange={(e) => setCicloB2B(Number(e.target.value))}
                                className="w-16 text-center"
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCicloB2B(Math.min(90, cicloB2B + 1))}
                                className="px-2"
                            >
                                +
                            </Button>
                            <span className="text-sm text-gray-500 dark:text-gray-400 self-center ml-1">dias</span>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    )
}
