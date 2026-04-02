import React from 'react'
import ScrollWrapper from './ScrollWrapper'
import HeroCopy from './HeroCopy'
import FloatingPaes from './FloatingPaes'
import PaoDeQueijo from './PaoDeQueijo'
import DiveOverlay from './DiveOverlay'
import HeroBackground from './HeroBackground'


export default function ImmersiveHero() {
    return (
        <ScrollWrapper>
            <HeroBackground />
            <HeroCopy />
            <FloatingPaes />
            <PaoDeQueijo />
            <DiveOverlay />
        </ScrollWrapper>
    )
}

