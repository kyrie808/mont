import React from 'react'
import { CheckCircle } from 'lucide-react'

interface WizardProgressProps {
    currentStep: number
    steps: { id: string; label: string; icon: React.ComponentType<{ className?: string }> }[]
}

export const WizardProgress: React.FC<WizardProgressProps> = ({ currentStep, steps }) => {
    return (
        <div className="w-full px-4 py-3 bg-card border-b border-border">
            <div className="flex items-center justify-between max-w-2xl mx-auto">
                {steps.map((step, index) => {
                    const Icon = step.icon
                    const isActive = index === currentStep
                    const isCompleted = index < currentStep

                    return (
                        <React.Fragment key={step.id}>
                            {/* Step Info */}
                            <div className="flex flex-col items-center flex-1 relative">
                                <div
                                    className={`
                    w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300
                    ${isActive ? 'bg-primary text-primary-foreground scale-110 shadow-lg shadow-primary/20' :
                                            isCompleted ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'}
                  `}
                                >
                                    {isCompleted ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                                </div>
                                <span
                                    className={`
                    mt-1.5 text-[10px] font-bold uppercase tracking-wider
                    ${isActive ? 'text-primary' : isCompleted ? 'text-success' : 'text-muted-foreground'}
                  `}
                                >
                                    {step.label}
                                </span>
                            </div>

                            {/* Progress Line */}
                            {index < steps.length - 1 && (
                                <div className="flex-1 h-[2px] mb-4 bg-muted relative overflow-hidden">
                                    <div
                                        className={`absolute inset-0 bg-success transition-all duration-500 ${isCompleted ? 'translate-x-0' : '-translate-x-full'}`}
                                    />
                                </div>
                            )}
                        </React.Fragment>
                    )
                })}
            </div>
        </div>
    )
}
