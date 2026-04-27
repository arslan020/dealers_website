'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useAddVehicle } from './AddVehicleProvider';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'type'> & {
    children: ReactNode;
};

/** Opens the Add Vehicle modal (registration → confirm → edit page). */
export function AddVehicleButton({ children, className, ...rest }: Props) {
    const { openAddVehicle } = useAddVehicle();
    return (
        <button type="button" onClick={openAddVehicle} className={className} {...rest}>
            {children}
        </button>
    );
}
