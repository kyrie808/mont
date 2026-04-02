'use client';

import React from 'react';

// Vari\u00E1veis const com escape Unicode para evitar quebra de encoding
const RATING_EMOJI = '\u2B50';
const RATING_VALUE = '4.9';
const RATING_DESC = 'Avalia\u00E7\u00E3o dos clientes';

const CHEESE_EMOJI = '\uD83E\uDDC0';
const CHEESE_VALUE = 'Canastra';
const CHEESE_DESC = 'Em todo produto, sem exce\u00E7\u00E3o';

const TRUCK_EMOJI = '\uD83D\uDE9A';
const TRUCK_VALUE = 'ABC';
const TRUCK_DESC = 'Entrega na sua regi\u00E3o';

export default function TrustBar() {
    return (
        <div className="w-full border-t border-mont-espresso/10 py-8 px-6 bg-transparent">
            <div className="flex flex-wrap justify-around items-center gap-6">
                {/* Item 1: Avalia\u00E7\u00E3o */}
                <div className="flex flex-col items-center text-center gap-1">
                    <span className="font-display text-2xl text-mont-espresso font-normal">
                        {RATING_EMOJI} {RATING_VALUE}
                    </span>
                    <span className="text-xs text-mont-espresso/50 max-w-[100px] text-center">
                        {RATING_DESC}
                    </span>
                </div>

                {/* Item 2: Canastra */}
                <div className="flex flex-col items-center text-center gap-1">
                    <span className="font-display text-2xl text-mont-espresso font-normal">
                        {CHEESE_EMOJI} {CHEESE_VALUE}
                    </span>
                    <span className="text-xs text-mont-espresso/50 max-w-[100px] text-center">
                        {CHEESE_DESC}
                    </span>
                </div>

                {/* Item 3: ABC */}
                <div className="flex flex-col items-center text-center gap-1">
                    <span className="font-display text-2xl text-mont-espresso font-normal">
                        {TRUCK_EMOJI} {TRUCK_VALUE}
                    </span>
                    <span className="text-xs text-mont-espresso/50 max-w-[100px] text-center">
                        {TRUCK_DESC}
                    </span>
                </div>
            </div>
        </div>
    );
}
