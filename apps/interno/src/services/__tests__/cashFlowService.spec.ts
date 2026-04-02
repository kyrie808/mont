import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { addDays, subDays } from 'date-fns';
import { processAlertasFinanceiros } from '../cashFlowService';

describe('cashFlowService - processAlertasFinanceiros', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2023-10-15T12:00:00Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should categorize a past due sale as "atrasado"', () => {
        const pastDate = subDays(new Date('2023-10-15T12:00:00Z'), 2).toISOString();
        const vendas = [
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            { id: 'v1', total: 100, data_prevista_pagamento: pastDate } as unknown as any
        ];

        const result = processAlertasFinanceiros(vendas);

        expect(result.alertas.length).toBe(1);
        expect(result.alertas[0].status).toBe('atrasado');
        expect(result.totalAtrasado).toBe(100);
    });

    it('should categorize a sale due today as "hoje"', () => {
        const todayDate = new Date('2023-10-15T12:00:00Z').toISOString();
        const vendas = [
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            { id: 'v2', total: 200, data_prevista_pagamento: todayDate } as unknown as any
        ];

        const result = processAlertasFinanceiros(vendas);

        expect(result.alertas.length).toBe(1);
        expect(result.alertas[0].status).toBe('hoje');
        expect(result.totalHoje).toBe(200);
    });

    it('should categorize a sale due in 2 days as "proximo"', () => {
        const nearFutureDate = addDays(new Date('2023-10-15T12:00:00Z'), 2).toISOString();
        const vendas = [
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            { id: 'v3', total: 300, data_prevista_pagamento: nearFutureDate } as unknown as any
        ];

        const result = processAlertasFinanceiros(vendas);

        expect(result.alertas.length).toBe(1);
        expect(result.alertas[0].status).toBe('proximo');
        expect(result.totalProximo).toBe(300);
    });

    it('should ignore a sale due far in the future', () => {
        const farFutureDate = addDays(new Date('2023-10-15T12:00:00Z'), 10).toISOString();
        const vendas = [
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            { id: 'v4', total: 400, data_prevista_pagamento: farFutureDate } as unknown as any
        ];

        const result = processAlertasFinanceiros(vendas);

        expect(result.alertas.length).toBe(0);
    });

    it('should aggregate all categories correctly', () => {
        const vendas = [
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            { id: 'v1', total: 50, data_prevista_pagamento: subDays(new Date('2023-10-15T12:00:00Z'), 1).toISOString() } as unknown as any,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            { id: 'v2', total: 100, data_prevista_pagamento: new Date('2023-10-15T12:00:00Z').toISOString() } as unknown as any,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            { id: 'v3', total: 200, data_prevista_pagamento: addDays(new Date('2023-10-15T12:00:00Z'), 1).toISOString() } as unknown as any,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            { id: 'v4', total: 400, data_prevista_pagamento: addDays(new Date('2023-10-15T12:00:00Z'), 20).toISOString() } as unknown as any,
        ];

        const result = processAlertasFinanceiros(vendas);

        expect(result.totalAtrasado).toBe(50);
        expect(result.totalHoje).toBe(100);
        expect(result.totalProximo).toBe(200);
        expect(result.alertas.length).toBe(3);
    });
});
