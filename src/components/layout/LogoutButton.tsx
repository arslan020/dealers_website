'use client';

export function LogoutButton() {
    async function handleLogout() {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login';
    }

    return (
        <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-900 border border-gray-200 px-3 py-1.5 rounded-md shadow-sm transition-colors"
        >
            Logout
        </button>
    );
}
