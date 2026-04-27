'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { QuickCheckModal } from '@/components/vehicles/QuickCheckModal';

type Ctx = { openQuickCheck: () => void };

const QuickCheckContext = createContext<Ctx | null>(null);

export function useQuickCheck(): Ctx {
    const v = useContext(QuickCheckContext);
    if (!v) throw new Error('useQuickCheck must be used within QuickCheckProvider');
    return v;
}

export function QuickCheckProvider({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const openQuickCheck = useCallback(() => setOpen(true), []);
    const value = useMemo(() => ({ openQuickCheck }), [openQuickCheck]);

    return (
        <QuickCheckContext.Provider value={value}>
            {children}
            <QuickCheckModal open={open} onClose={() => setOpen(false)} />
        </QuickCheckContext.Provider>
    );
}
