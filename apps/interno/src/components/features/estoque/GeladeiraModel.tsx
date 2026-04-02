import { useEffect } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

interface GeladeiraModelProps {
    rotation: [number, number, number]
    scale: number
}

export function GeladeiraModel({ rotation, scale }: GeladeiraModelProps) {
    const { scene } = useGLTF('/geladeira.glb')

    // Aplicar material plástico brilhante em todos os meshes
    useEffect(() => {
        scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh
                mesh.material = new THREE.MeshStandardMaterial({
                    color: 'white',
                    roughness: 0.1,
                    metalness: 0.05
                })
                mesh.castShadow = true
                mesh.receiveShadow = true
            }
        })
    }, [scene])

    return (
        <primitive
            object={scene}
            scale={scale}
            position={[0, -1.6, 0]}
            rotation={rotation}
        />
    )
}

// Preload do modelo
useGLTF.preload('/geladeira.glb')
