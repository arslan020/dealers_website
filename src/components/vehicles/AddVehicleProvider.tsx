'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { AddVehicleModal } from '@/components/vehicles/AddVehicleModal';

type Ctx = { openAddVehicle: () => void };

const AddVehicleContext = createContext<Ctx | null>(null);

export function useAddVehicle(): Ctx {
    const v = useContext(AddVehicleContext);
    if (!v) throw new Error('useAddVehicle must be used within AddVehicleProvider');
    return v;
}

export function AddVehicleProvider({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const openAddVehicle = useCallback(() => setOpen(true), []);
    const value = useMemo(() => ({ openAddVehicle }), [openAddVehicle]);

    return (
        <AddVehicleContext.Provider value={value}>
            {children}
            <AddVehicleModal open={open} onClose={() => setOpen(false)} />
        </AddVehicleContext.Provider>
    );
}
