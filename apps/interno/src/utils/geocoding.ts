export interface Coordinates {
    lat: number
    lng: number
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getCoordinates(_address: string): Promise<Coordinates | null> {
    try {
        // [CORS FIX] Geocoding client-side is blocked by browsers.
        // We would need a backend proxy (e.g. Supabase Edge Function) for this.
        return null;
    } catch {
        return null;
    }
}
