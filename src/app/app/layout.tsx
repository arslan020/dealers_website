import { Topbar } from '@/components/layout/Topbar';
import { AddVehicleProvider } from '@/components/vehicles/AddVehicleProvider';
import { QuickCheckProvider } from '@/components/vehicles/QuickCheckProvider';
import { getSession } from '@/lib/session';
import { ReactNode } from 'react';

export default async function AppLayout({ children }: { children: ReactNode }) {
    const session = await getSession();
    const role = session?.role || 'EMPLOYEE';

    return (
        <AddVehicleProvider>
            <QuickCheckProvider>
                <div className="h-screen flex bg-slate-50 overflow-hidden text-slate-900">
                    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                        <Topbar role={role} />
                        <main className="flex-1 bg-slate-100/40 overflow-y-auto p-4 lg:p-6">
                            {children}
                        </main>
                    </div>
                </div>
            </QuickCheckProvider>
        </AddVehicleProvider>
    );
}
