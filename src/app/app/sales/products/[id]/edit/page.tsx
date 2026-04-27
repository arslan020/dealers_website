'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import ProductForm from '../../_form';

export default function EditProductPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const [initial, setInitial] = useState<Record<string, any> | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchProduct = useCallback(async () => {
        try {
            const res = await fetch(`/api/products/${id}`);
            const data = await res.json();
            if (!data.ok) { toast.error('Product not found'); return; }
            setInitial(data.product);
        } catch { toast.error('Failed to load'); } finally { setLoading(false); }
    }, [id]);

    useEffect(() => { fetchProduct(); }, [fetchProduct]);

    async function handleSave(body: Record<string, any>) {
        const res = await fetch(`/api/products/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error?.message ?? data.error ?? 'Failed to save');
        toast.success('Product updated');
        router.push('/app/sales/products');
    }

    if (loading) return <div className="flex items-center justify-center h-64 text-slate-400 text-[13px]">Loading…</div>;
    if (!initial) return <div className="flex items-center justify-center h-64 text-slate-400 text-[13px]">Product not found.</div>;

    return (
        <ProductForm
            title="Edit Product"
            breadcrumb="Edit Product"
            submitLabel="Save Product"
            initial={initial}
            onSave={handleSave}
        />
    );
}
