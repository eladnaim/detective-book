"use client";

import { useState } from "react";
import { Loader2, Download, Lock, Pencil, X, Save } from "lucide-react";

interface User {
    id: number;
    name: string;
    phone: string;
    email: string;
    city: string;
    address: string;
    zip: string;
    created_at: string;
}

export default function AdminPage() {
    const [password, setPassword] = useState("");
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    // Edit State
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const res = await fetch("/api/admin/data", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Login failed");
            }

            setUsers(data.users);
            setIsAuthenticated(true);
        } catch (err: any) {
            setError("סיסמה שגויה או שגיאת שרת");
        } finally {
            setIsLoading(false);
        }
    }

    async function handleSaveUser(e: React.FormEvent) {
        e.preventDefault();
        if (!editingUser) return;

        setIsSaving(true);

        try {
            const res = await fetch("/api/admin/edit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password, ...editingUser }),
            });

            if (!res.ok) throw new Error("Update failed");

            // Update local state
            setUsers(users.map(u => u.id === editingUser.id ? editingUser : u));
            setEditingUser(null);
        } catch (err) {
            alert("שגיאה בשמירת הנתונים");
        } finally {
            setIsSaving(false);
        }
    }

    function downloadCSV() {
        if (!users.length) return;

        const headers = ["שם מלא", "טלפון", "אימייל", "עיר", "כתובת", "מיקוד", "תאריך הרשמה"];
        const csvContent = [
            headers.join(","),
            ...users.map((u) =>
                [
                    `"${u.name}"`,
                    `"${u.phone}"`,
                    `"${u.email}"`,
                    `"${u.city}"`,
                    `"${u.address}"`,
                    `"${u.zip}"`,
                    `"${new Date(u.created_at).toLocaleString('he-IL')}"`,
                ].join(",")
            ),
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `subscribers_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <form onSubmit={handleLogin} className="w-full max-w-sm bg-neutral-900 p-8 rounded-xl border border-neutral-800 space-y-6">
                    <div className="text-center space-y-2">
                        <Lock className="w-12 h-12 text-white mx-auto" />
                        <h1 className="text-2xl font-bold text-white">כנסת מנהלים</h1>
                    </div>
                    <div>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="סיסמת ניהול"
                            className="w-full bg-black border border-neutral-700 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                        />
                    </div>
                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-white text-black font-bold py-2 rounded-md hover:bg-neutral-200 transition-colors disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "כניסה"}
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold">רשימת נרשמים</h1>
                        <p className="text-neutral-400">סה"כ נרשמים: {users.length}</p>
                    </div>

                    <button
                        onClick={downloadCSV}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors"
                    >
                        <Download className="w-4 h-4" />
                        הורד CSV
                    </button>
                </div>

                <div className="border border-neutral-800 rounded-lg overflow-hidden bg-neutral-900/50">
                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-sm">
                            <thead className="bg-neutral-900 border-b border-neutral-800">
                                <tr>
                                    <th className="p-4 font-medium text-neutral-300">שם מלא</th>
                                    <th className="p-4 font-medium text-neutral-300">טלפון</th>
                                    <th className="p-4 font-medium text-neutral-300">אימייל</th>
                                    <th className="p-4 font-medium text-neutral-300">עיר</th>
                                    <th className="p-4 font-medium text-neutral-300">כתובת</th>
                                    <th className="p-4 font-medium text-neutral-300">מיקוד</th>
                                    <th className="p-4 font-medium text-neutral-300">תאריך</th>
                                    <th className="p-4 font-medium text-neutral-300">פעולות</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-800">
                                {users.map((user) => (
                                    <tr key={user.id} className="hover:bg-neutral-900/50 transition-colors">
                                        <td className="p-4 font-medium">{user.name}</td>
                                        <td className="p-4 text-neutral-400">{user.phone}</td>
                                        <td className="p-4 text-neutral-400">{user.email}</td>
                                        <td className="p-4 text-neutral-400">{user.city}</td>
                                        <td className="p-4 text-neutral-400">{user.address}</td>
                                        <td className="p-4 text-neutral-400">{user.zip}</td>
                                        <td className="p-4 text-neutral-400 font-mono text-xs">
                                            {new Date(user.created_at).toLocaleDateString('he-IL')}
                                        </td>
                                        <td className="p-4">
                                            <button
                                                onClick={() => setEditingUser(user)}
                                                className="text-neutral-400 hover:text-white transition-colors"
                                                title="ערוך"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {users.length === 0 && (
                        <div className="p-12 text-center text-neutral-500">
                            אין עדיין נרשמים.
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Modal */}
            {editingUser && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 w-full max-w-lg space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold">עריכת פרטים</h2>
                            <button onClick={() => setEditingUser(null)} className="text-neutral-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveUser} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-neutral-400 mb-1">שם מלא</label>
                                    <input
                                        value={editingUser.name}
                                        onChange={e => setEditingUser({ ...editingUser, name: e.target.value })}
                                        className="w-full bg-black border border-neutral-700 rounded px-3 py-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-neutral-400 mb-1">טלפון</label>
                                    <input
                                        value={editingUser.phone}
                                        onChange={e => setEditingUser({ ...editingUser, phone: e.target.value })}
                                        className="w-full bg-black border border-neutral-700 rounded px-3 py-2"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm text-neutral-400 mb-1">אימייל</label>
                                <input
                                    value={editingUser.email || ''}
                                    onChange={e => setEditingUser({ ...editingUser, email: e.target.value })}
                                    className="w-full bg-black border border-neutral-700 rounded px-3 py-2"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-neutral-400 mb-1">עיר</label>
                                    <input
                                        value={editingUser.city}
                                        onChange={e => setEditingUser({ ...editingUser, city: e.target.value })}
                                        className="w-full bg-black border border-neutral-700 rounded px-3 py-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-neutral-400 mb-1">מיקוד</label>
                                    <input
                                        value={editingUser.zip || ''}
                                        onChange={e => setEditingUser({ ...editingUser, zip: e.target.value })}
                                        className="w-full bg-black border border-neutral-700 rounded px-3 py-2"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm text-neutral-400 mb-1">כתובת</label>
                                <input
                                    value={editingUser.address}
                                    onChange={e => setEditingUser({ ...editingUser, address: e.target.value })}
                                    className="w-full bg-black border border-neutral-700 rounded px-3 py-2"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSaving}
                                className="w-full bg-white text-black font-bold py-2 rounded hover:bg-neutral-200 flex items-center justify-center gap-2"
                            >
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> שמור שינויים</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
