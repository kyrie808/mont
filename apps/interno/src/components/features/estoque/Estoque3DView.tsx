import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import { useControls, folder, Leva } from 'leva'
import { GeladeiraModel } from './GeladeiraModel'
import { EstoqueBucket } from './EstoqueBucket'
import type { DomainProduto } from '../../../types/domain'

// Cores do design system
const COLORS = {
    primary: '#7C3AED', // Roxo - 4kg
    accent: '#F97316',  // Laranja - 1kg
}

// Interface para Zona de Armazenamento
interface ShelfZone {
    position: [number, number, number]
    dimensions: [number, number, number] // width, height, depth
}

// Função de Bin Packing: Calcula posições automaticamente
function calculateBucketPositions(
    zone: ShelfZone,
    bucketRadius: number,
    bucketHeight: number,
    quantity: number,
    padding: number
): [number, number, number][] {
    const positions: [number, number, number][] = []
    const [zoneX, zoneY, zoneZ] = zone.position
    const [width, height, depth] = zone.dimensions

    const bucketDiameter = bucketRadius * 2
    const spacingX = bucketDiameter + padding
    const spacingZ = bucketDiameter + padding
    const spacingY = bucketHeight + padding * 0.5

    const bucketsPerRow = Math.max(1, Math.floor(width / spacingX))
    const bucketsPerDepth = Math.max(1, Math.floor(depth / spacingZ))
    const bucketsPerHeight = Math.max(1, Math.floor(height / spacingY))

    const maxCapacity = bucketsPerRow * bucketsPerDepth * bucketsPerHeight
    const actualQuantity = Math.min(quantity, maxCapacity)

    const startX = zoneX - (width / 2) + (bucketDiameter / 2) + (padding / 2)
    const startZ = zoneZ - (depth / 2) + (bucketDiameter / 2) + (padding / 2)
    const startY = zoneY - (height / 2) + (bucketHeight / 2)

    for (let i = 0; i < actualQuantity; i++) {
        const col = i % bucketsPerRow
        const layer = Math.floor(i / bucketsPerRow) % bucketsPerDepth
        const row = Math.floor(i / (bucketsPerRow * bucketsPerDepth))

        positions.push([
            startX + col * spacingX + (Math.random() * 0.01 - 0.005),
            startY + row * spacingY,
            startZ + layer * spacingZ + (Math.random() * 0.01 - 0.005)
        ])
    }

    return positions
}

function ZoneVisualizer({ zone, color }: { zone: ShelfZone; color: string }) {
    return (
        <mesh position={zone.position}>
            <boxGeometry args={zone.dimensions} />
            <meshBasicMaterial color={color} wireframe />
        </mesh>
    )
}

interface Estoque3DViewProps {
    produtos: DomainProduto[]
}

export default function Estoque3DView({ produtos }: Estoque3DViewProps) {
    const isDev = import.meta.env.DEV

    const controls = useControls({
        Geladeira: folder({
            fridgeRotY: { value: -90, min: -360, max: 360, step: 15, label: 'Rotação Y' },
            fridgeScale: { value: 0.5, min: 0.1, max: 5, step: 0.1, label: 'Escala' }
        }),
        'Baldes 1kg': folder({
            bucketScale_1kg: { value: 5.1, min: 0.1, max: 10, step: 0.1, label: 'Escala' },
            bucket1kgRadius: { value: 0.12, min: 0.01, max: 1, step: 0.01, label: 'Raio' },
            bucket1kgHeight: { value: 0.25, min: 0.05, max: 2, step: 0.01, label: 'Altura' },
            rotX_1kg: { value: 180, min: 0, max: 360, step: 15, label: 'Rotação X' }
        }),
        'Baldes 4kg': folder({
            bucketScale_4kg: { value: 2.8, min: 0.1, max: 10, step: 0.1, label: 'Escala' },
            bucket4kgRadius: { value: 0.35, min: 0.01, max: 1, step: 0.01, label: 'Raio' },
            bucket4kgHeight: { value: 0.65, min: 0.05, max: 2, step: 0.01, label: 'Altura' },
            rotX_4kg: { value: 180, min: 0, max: 360, step: 15, label: 'Rotação X' }
        }),
        'Espaçamento': folder({
            padding_1kg: { value: 1.08, min: 0, max: 2, step: 0.01, label: 'Baldes 1kg' },
            padding_4kg: { value: 1.28, min: 0, max: 2, step: 0.01, label: 'Baldes 4kg' }
        }),
        showZones: { value: false, label: 'Mostrar Zonas' }
    })

    const produtos1kg = produtos.filter(p => p.nome.toLowerCase().includes('1kg') || p.codigo.includes('1KG'))
    const produtos4kg = produtos.filter(p => p.nome.toLowerCase().includes('4kg') || p.codigo.includes('4KG'))

    const total1kg = produtos1kg.reduce((acc, p) => acc + (p.estoqueAtual || 0), 0)
    const total4kg = produtos4kg.reduce((acc, p) => acc + (p.estoqueAtual || 0), 0)

    const zone1: ShelfZone = { position: [0, 0.85, -7.1], dimensions: [10, 3.4, 6.4] }
    const zone2: ShelfZone = { position: [0, -3.65, -6.75], dimensions: [10, 3.3, 6.4] }
    const zone3: ShelfZone = { position: [0, -6.65, -6.4], dimensions: [10, 3.3, 6.1] }
    const zone4: ShelfZone = { position: [0, -11.4, -5], dimensions: [10, 4, 5] }

    const calcCapacity = (w: number, h: number, d: number, r: number, bh: number, p: number) => {
        const sx = (r * 2) + p
        const sz = (r * 2) + p
        const sy = bh + p * 0.5
        return Math.floor(w / sx) * Math.floor(d / sz) * Math.floor(h / sy)
    }

    const cap1_z1 = calcCapacity(10, 3.4, 6.4, controls.bucket1kgRadius, controls.bucket1kgHeight, controls.padding_1kg)
    const cap1_z2 = calcCapacity(10, 3.3, 6.4, controls.bucket1kgRadius, controls.bucket1kgHeight, controls.padding_1kg)
    const cap4_z3 = calcCapacity(10, 3.3, 6.1, controls.bucket4kgRadius, controls.bucket4kgHeight, controls.padding_4kg)
    const cap4_z4 = calcCapacity(10, 4, 5, controls.bucket4kgRadius, controls.bucket4kgHeight, controls.padding_4kg)

    const qty1_z1 = Math.min(total1kg, cap1_z1)
    const qty1_z2 = Math.min(total1kg - qty1_z1, cap1_z2)
    const qty4_z3 = Math.min(total4kg, cap4_z3)
    const qty4_z4 = Math.min(total4kg - qty4_z3, cap4_z4)

    const potes1kg = [
        ...calculateBucketPositions(zone1, controls.bucket1kgRadius, controls.bucket1kgHeight, qty1_z1, controls.padding_1kg),
        ...calculateBucketPositions(zone2, controls.bucket1kgRadius, controls.bucket1kgHeight, qty1_z2, controls.padding_1kg)
    ]
    const potes4kg = [
        ...calculateBucketPositions(zone3, controls.bucket4kgRadius, controls.bucket4kgHeight, qty4_z3, controls.padding_4kg),
        ...calculateBucketPositions(zone4, controls.bucket4kgRadius, controls.bucket4kgHeight, qty4_z4, controls.padding_4kg)
    ]

    return (
        <div className="w-full h-full relative">
            {isDev && <Leva hidden={false} />}
            <Canvas shadows camera={{ position: [0, 0, 22], fov: 45 }}>
                <ambientLight intensity={0.6} />
                <directionalLight position={[5, 10, 5]} intensity={1.5} castShadow />
                <pointLight position={[0, 3, 3]} intensity={0.5} />
                <Environment preset="city" />

                <Suspense fallback={null}>
                    <GeladeiraModel
                        rotation={[0, controls.fridgeRotY * (Math.PI / 180), 0]}
                        scale={controls.fridgeScale}
                    />
                </Suspense>

                {controls.showZones && (
                    <>
                        <ZoneVisualizer zone={zone1} color="#ff6b00" />
                        <ZoneVisualizer zone={zone2} color="#ff9900" />
                        <ZoneVisualizer zone={zone3} color="#9900ff" />
                        <ZoneVisualizer zone={zone4} color="#6600cc" />
                    </>
                )}

                {potes1kg.map((pos: [number, number, number], i) => (
                    <EstoqueBucket
                        key={`1kg-${i}`}
                        position={pos}
                        rotation={[controls.rotX_1kg * (Math.PI / 180), 0, 0]}
                        scale={[controls.bucketScale_1kg, controls.bucketScale_1kg, controls.bucketScale_1kg]}
                        radius={controls.bucket1kgRadius}
                        height={controls.bucket1kgHeight}
                        color={COLORS.accent}
                    />
                ))}

                {potes4kg.map((pos: [number, number, number], i) => (
                    <EstoqueBucket
                        key={`4kg-${i}`}
                        position={pos}
                        rotation={[controls.rotX_4kg * (Math.PI / 180), 0, 0]}
                        scale={[controls.bucketScale_4kg, controls.bucketScale_4kg, controls.bucketScale_4kg]}
                        radius={controls.bucket4kgRadius}
                        height={controls.bucket4kgHeight}
                        color={COLORS.primary}
                    />
                ))}

                <OrbitControls
                    makeDefault
                    enableZoom={true}
                    enablePan={false}
                    minDistance={5}
                    maxDistance={35}
                    minPolarAngle={Math.PI / 6}
                    maxPolarAngle={Math.PI / 2}
                />
            </Canvas>
        </div>
    )
}
