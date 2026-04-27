'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import ProductForm from '../_form';

export default function AddProductPage() {
    const router = useRouter();

    async function handleSave(body: Record<string, any>) {
        const res = await fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error?.message ?? data.error ?? 'Failed to create');
        toast.success('Product created');
        router.push('/app/sales/products');
    }

    return (
        <ProductForm
            title="Add Product"
            breadcrumb="Add Product"
            submitLabel="Add Product"
            onSave={handleSave}
        />
    );
}
