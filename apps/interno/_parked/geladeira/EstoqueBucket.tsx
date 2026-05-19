

interface EstoqueBucketProps {
    position: [number, number, number]
    rotation: [number, number, number]
    scale: [number, number, number]
    radius: number
    height: number
    color: string
}

export function EstoqueBucket({ position, rotation, scale, radius, height, color }: EstoqueBucketProps) {
    return (
        <mesh 
            position={position} 
            rotation={rotation} 
            scale={scale} 
            castShadow
            receiveShadow
        >
            <cylinderGeometry args={[radius, radius, height, 32]} />
            <meshStandardMaterial 
                color={color} 
                roughness={0.4} 
                metalness={0.1} 
            />
        </mesh>
    )
}
