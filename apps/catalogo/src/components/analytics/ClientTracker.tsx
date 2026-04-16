'use client';

import { useEffect, useRef } from 'react';
import { pushEvent, TrackingEvent } from '@/lib/analytics/dataLayer';

interface ClientTrackerProps {
    eventData: TrackingEvent;
}

/**
 * Componente invisível usado para despachar trackings na primeira montagem 
 * do client-side de rotas SSR (como as páginas de produtos).
 */
export default function ClientTracker({ eventData }: ClientTrackerProps) {
    // Evitar disparos duplicados devido ao React Strict Mode
    const hasTracked = useRef(false);

    useEffect(() => {
        if (!hasTracked.current) {
            pushEvent(eventData);
            hasTracked.current = true;
        }
    }, [eventData]);

    return null; // Componente renderless
}
