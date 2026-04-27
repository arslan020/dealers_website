'use client';

import { useAddVehicle } from '@/components/vehicles/AddVehicleProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Legacy route: opens the Add Vehicle modal and returns to inventory.
 * Bookmarks to /app/vehicles/add still work.
 */
export default function AddVehicleLegacyPage() {
    const router = useRouter();
    const { openAddVehicle } = useAddVehicle();

    useEffect(() => {
        openAddVehicle();
        router.replace('/app/vehicles');
    }, [openAddVehicle, router]);

    return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-slate-500">
            <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-sm font-medium">Opening add vehicle…</p>
        </div>
    );
}
