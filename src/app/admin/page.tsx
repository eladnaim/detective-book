"use client";
import { useState, useEffect, useCallback } from "react";
import { Loader2, Download, Lock, Pencil, X, Save, Trash2, RefreshCcw, Archive, Users, ShieldCheck, CheckSquare, Truck, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface User {
    id: string | number;
    name: string;
    phone: string;
    email: string;
    city: string;
    address: string;
    zip: string;
    created_at: string;
    deleted_at?: string;
    _sources?: string[];
    _source?: string;
    pg_id?: number | string;
}

export default function AdminPage() {
    const [password, setPassword] = useState("");
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const [activeTab, setActiveTab] = useState<'subscribers' | 'archive' | 'delivery'>('subscribers');

    // Archive / Super Admin State
    const [isSuperAuthenticated, setIsSuperAuthenticated] = useState(false);
    const [superUser, setSuperUser] = useState("");
    const [superPass, setSuperPass] = useState("");
    const [archivedUsers, setArchivedUsers] = useState<User[]>([]);
    const [isArchiveLoading, setIsArchiveLoading] = useState(false);

    // Edit State
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Bulk Selection State
    const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    const fetchUsers = useCallback(async (currentPassword: string) => {
        if (!currentPassword) return;

        try {
            const res = await fetch("/api/admin/data", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: currentPassword }),
            });

            const data = await res.json();
            if (res.ok) {
                setUsers(data.users);
                setIsAuthenticated(true);
                setLastRefresh(new Date());
                localStorage.setItem("admin_pass", currentPassword);
            } else {
                if (isAuthenticated) {
                    setError("החיבור פג, אנא התחבר מחדש");
                    setIsAuthenticated(false);
                }
            }
        } catch (err) {
            console.error("Refresh failed");
        }
    }, [isAuthenticated]);

    const fetchArchive = async () => {
        if (!superUser || !superPass) return;
        setIsArchiveLoading(true);
        try {
            const res = await fetch("/api/admin/archive", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: superUser, password: superPass }),
            });
            const data = await res.json();
            if (res.ok) {
                setArchivedUsers(data.archive);
                setIsSuperAuthenticated(true);
            } else {
                alert("נכשל בחיבור לארכיון: פרטים שגויים");
            }
        } catch (err) {
            alert("שגיאת תקשורת");
        } finally {
            setIsArchiveLoading(false);
        }
    };

    // Auto-login & Auto-refresh
    useEffect(() => {
        const savedPass = localStorage.getItem("admin_pass");
        if (savedPass) {
            setPassword(savedPass);
            fetchUsers(savedPass);
        }

        const interval = setInterval(() => {
            const currentPass = localStorage.getItem("admin_pass");
            if (currentPass && activeTab === 'subscribers') fetchUsers(currentPass);
        }, 30000);

        return () => clearInterval(interval);
    }, [fetchUsers, activeTab]);

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setIsLoading(true);
        setError("");
        await fetchUsers(password);
        setIsLoading(false);
    }

    async function handleSaveUser(e: React.FormEvent) {
        e.preventDefault();
        if (!editingUser) return;
        setIsSaving(true);
        try {
            const res = await fetch("/api/admin/edit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    password,
                    ...editingUser
                }),
            });
            if (!res.ok) throw new Error("Update failed");
            setUsers(users.map(u => u.id === editingUser.id ? editingUser : u));
            setEditingUser(null);
        } catch (err) {
            alert("שגיאה בשמירת הנתונים");
        } finally {
            setIsSaving(false);
        }
    }

    async function handleDeleteUser() {
        if (!editingUser || !window.confirm("האם אתה בטוח שברצונך למחוק משתמש זה? הוא יועבר לארכיון.")) return;
        setIsDeleting(true);
        try {
            const res = await fetch("/api/admin/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    password,
                    id: editingUser.id,
                    pg_id: (editingUser as any).pg_id
                }),
            });
            if (!res.ok) throw new Error("Delete failed");
            setUsers(users.filter(u => u.id !== editingUser.id));
            setEditingUser(null);
        } catch (err) {
            alert("שגיאה במחיקת המשתמש");
        } finally {
            setIsDeleting(false);
        }
    }

    function toggleSelect(id: string | number) {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }

    function toggleSelectAll() {
        if (selectedIds.size === users.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(users.map(u => u.id)));
        }
    }

    async function handleBulkDelete() {
        if (selectedIds.size === 0) return;
        if (!window.confirm(`האם אתה בטוח שברצונך למחוק ${selectedIds.size} רשומות? הן יועברו לארכיון.`)) return;
        setIsBulkDeleting(true);
        try {
            const bulk = users.filter(u => selectedIds.has(u.id)).map(u => ({ id: u.id, pg_id: u.pg_id }));
            const res = await fetch("/api/admin/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password, bulk }),
            });
            if (!res.ok) throw new Error("Bulk delete failed");
            setUsers(users.filter(u => !selectedIds.has(u.id)));
            setSelectedIds(new Set());
        } catch (err) {
            alert("שגיאה במחיקה מרובה");
        } finally {
            setIsBulkDeleting(false);
        }
    }

    function downloadCSV(data: User[], label: string) {
        if (!data.length) return;
        const headers = ["שם מלא", "טלפון", "אימייל", "עיר", "כתובת", "מיקוד", label === 'archive' ? "תאריך מחיקה" : "תאריך הרשמה"];
        const csvContent = [
            headers.join(","),
            ...data.map((u) => [
                `"${u.name}"`, `"${u.phone}"`, `"${u.email}"`,
                `"${u.city}"`, `"${u.address}"`, `"${u.zip}"`,
                `"${new Date(label === 'archive' ? (u.deleted_at || '') : u.created_at).toLocaleString('he-IL')}"`,
            ].join(",")),
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `${label}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    const groupedByCity = users.reduce((acc, user) => {
        // Normalize city name: trim spaces and reduce multiple spaces to one
        const rawCity = user.city || "ללא עיר";
        const city = rawCity.trim().replace(/\s+/g, ' ');
        if (!acc[city]) acc[city] = [];
        acc[city].push(user);
        return acc;
    }, {} as Record<string, User[]>);

    const sortedCities = Object.keys(groupedByCity).sort((a, b) => a.localeCompare(b, 'he'));

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4" suppressHydrationWarning>
                <form onSubmit={handleLogin} className="w-full max-w-sm bg-neutral-900 p-8 rounded-xl border border-neutral-800 space-y-6">
                    <div className="text-center space-y-2">
                        <Lock className="w-12 h-12 text-white mx-auto" />
                        <h1 className="text-2xl font-bold text-white">כנסת מנהלים</h1>
                    </div>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="סיסמת ניהול"
                        className="w-full bg-black border border-neutral-700 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                    />
                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                    <button type="submit" disabled={isLoading} className="w-full bg-white text-black font-bold py-2 rounded-md hover:bg-neutral-200 transition-colors disabled:opacity-50">
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "כניסה"}
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white p-4 md:p-8" suppressHydrationWarning>
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header & Tabs */}
                <div className="flex flex-col md:flex-row justify-between items-center bg-neutral-900/50 p-6 rounded-2xl border border-neutral-800 gap-6">
                    <div className="flex items-center gap-6">
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            דשבורד ניהול
                        </h1>
                        <div className="flex bg-black p-1 rounded-lg border border-neutral-800">
                            <button
                                onClick={() => setActiveTab('subscribers')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${activeTab === 'subscribers' ? 'bg-white text-black font-bold' : 'text-neutral-400 hover:text-white'}`}
                            >
                                <Users className="w-4 h-4" />
                                נרשמים ({users.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('delivery')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${activeTab === 'delivery' ? 'bg-white text-black font-bold' : 'text-neutral-400 hover:text-white'}`}
                            >
                                <Truck className="w-4 h-4" />
                                צ'קליסט משלוחים
                            </button>
                            <button
                                onClick={() => setActiveTab('archive')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${activeTab === 'archive' ? 'bg-white text-black font-bold' : 'text-neutral-400 hover:text-white'}`}
                            >
                                <Archive className="w-4 h-4" />
                                ארכיון
                            </button>
                        </div>
                    </div>

                    {activeTab !== 'archive' && (
                        <div className="flex items-center gap-4 print:hidden">
                            <div className="text-right hidden sm:block">
                                <p className="text-xs text-neutral-500">עדכון אחרון: {lastRefresh.toLocaleTimeString()}</p>
                            </div>
                            <button onClick={() => fetchUsers(password)} className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-400">
                                <RefreshCcw className="w-5 h-5" />
                            </button>
                            {activeTab === 'delivery' ? (
                                <button onClick={() => window.print()} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-bold transition-colors">
                                    <Download className="w-4 h-4" /> ייצוא ל-PDF (הדפסה)
                                </button>
                            ) : (
                                <button onClick={() => downloadCSV(users, 'subscribers')} className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 px-4 py-2 rounded-lg text-sm transition-colors">
                                    <Download className="w-4 h-4" /> הורדה למחשב
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {activeTab === 'subscribers' ? (
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden print:hidden">
                        {/* Bulk Action Bar */}
                        <AnimatePresence>
                            {selectedIds.size > 0 && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-red-950/30 border-b border-red-900/30 px-4 py-3 flex items-center justify-between">
                                    <span className="text-sm text-red-400 font-bold">{selectedIds.size} רשומות נבחרו</span>
                                    <div className="flex gap-3">
                                        <button onClick={() => setSelectedIds(new Set())} className="text-xs text-neutral-400 hover:text-white">ביטול בחירה</button>
                                        <button onClick={handleBulkDelete} disabled={isBulkDeleting} className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold px-4 py-1.5 rounded-lg">
                                            {isBulkDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                            מחק {selectedIds.size} רשומות
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                        <div className="overflow-x-auto">
                            <table className="w-full text-right">
                                <thead className="bg-neutral-950 border-b border-neutral-800">
                                    <tr>
                                        <th className="p-4 w-10">
                                            <input type="checkbox" checked={selectedIds.size === users.length && users.length > 0} onChange={toggleSelectAll} className="w-4 h-4 rounded accent-white cursor-pointer" />
                                        </th>
                                        <th className="p-4 font-medium text-neutral-300">שם מלא</th>
                                        <th className="p-4 font-medium text-neutral-300">טלפון</th>
                                        <th className="p-4 font-medium text-neutral-300">עיר</th>
                                        <th className="p-4 font-medium text-neutral-300">כתובת</th>
                                        <th className="p-4 font-medium text-neutral-300">מיקוד</th>
                                        <th className="p-4 font-medium text-neutral-300">מקור</th>
                                        <th className="p-4 font-medium text-neutral-300">תאריך</th>
                                        <th className="p-4 font-medium text-neutral-300">פעולות</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-800">
                                    {users.map((user) => (
                                        <tr key={user.id} className={`transition-colors group ${selectedIds.has(user.id) ? 'bg-red-950/10' : 'hover:bg-neutral-900/50'}`}>
                                            <td className="p-4">
                                                <input type="checkbox" checked={selectedIds.has(user.id)} onChange={() => toggleSelect(user.id)} className="w-4 h-4 rounded accent-white cursor-pointer" />
                                            </td>
                                            <td className="p-4 font-medium">{user.name}</td>
                                            <td className="p-4 text-neutral-400">{user.phone}</td>
                                            <td className="p-4 text-neutral-400">{user.city}</td>
                                            <td className="p-4 text-neutral-400">{user.address}</td>
                                            <td className="p-4 text-neutral-400">{user.zip || '-'}</td>
                                            <td className="p-4">
                                                <div className="flex gap-1 flex-wrap">
                                                    {user._sources?.map(src => (
                                                        <span key={src} className={`text-[10px] px-2 py-0.5 rounded-full uppercase ${src === 'firebase' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'} border`}>
                                                            {src}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="p-4 text-neutral-400 text-xs font-mono">{new Date(user.created_at).toLocaleDateString('he-IL')}</td>
                                            <td className="p-4">
                                                <button onClick={() => setEditingUser(user)} className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-400"><Pencil className="w-4 h-4" /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : activeTab === 'delivery' ? (
                    <div className="space-y-8 print:text-black">
                        <style jsx global>{`
                            @media print {
                                body { background: white !important; color: black !important; }
                                .print\\:hidden { display: none !important; }
                                .bg-neutral-900 { background: white !important; }
                                .border-neutral-800 { border-color: #eee !important; }
                                .text-white { color: black !important; }
                                .text-neutral-400 { color: #666 !important; }
                                .bg-black { background: white !important; }
                                .rounded-2xl { border-radius: 0 !important; }
                                .shadow-2xl { box-shadow: none !important; }
                            }
                        `}</style>
                        {sortedCities.map(city => (
                            <div key={city} className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden print:border-b print:rounded-none">
                                <div className="bg-white/5 px-6 py-4 border-b border-neutral-800 flex justify-between items-center print:bg-neutral-100">
                                    <h2 className="text-xl font-bold flex items-center gap-2">
                                        {city} <span className="text-sm font-normal text-neutral-500">({groupedByCity[city].length} משלוחים)</span>
                                    </h2>
                                </div>
                                <div className="divide-y divide-neutral-800">
                                    {groupedByCity[city].map((user, idx) => (
                                        <div key={user.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors group">
                                            <div className="flex items-center gap-4 flex-1">
                                                <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-mono border border-neutral-700 print:border-black">
                                                    {idx + 1}
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="font-bold text-lg">{user.name}</p>
                                                    <p className="text-sm text-neutral-400 flex items-center gap-4">
                                                        <span>{user.address}</span>
                                                        <span className="font-mono">{user.phone}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 group-hover:opacity-100 opacity-60 transition-opacity print:opacity-100">
                                                <div className="w-6 h-6 border-2 border-neutral-600 rounded-md print:border-black print:w-5 print:h-5"></div>
                                                <span className="text-xs text-neutral-500 print:hidden">בוצע</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-6">
                        {!isSuperAuthenticated ? (
                            <div className="max-w-md mx-auto bg-neutral-900 border border-neutral-800 p-8 rounded-2xl space-y-6">
                                <div className="text-center space-y-2">
                                    <ShieldCheck className="w-12 h-12 text-blue-500 mx-auto" />
                                    <h2 className="text-xl font-bold">גישה לארכיון (Soft Delete)</h2>
                                    <p className="text-sm text-neutral-400">אזור המורשה למנהל מערכת ראשי בלבד</p>
                                </div>
                                <div className="space-y-4">
                                    <input
                                        value={superUser}
                                        onChange={e => setSuperUser(e.target.value)}
                                        placeholder="שם משתמש"
                                        className="w-full bg-black border border-neutral-700 rounded-md px-4 py-2"
                                    />
                                    <input
                                        type="password"
                                        value={superPass}
                                        onChange={e => setSuperPass(e.target.value)}
                                        placeholder="סיסמה"
                                        className="w-full bg-black border border-neutral-700 rounded-md px-4 py-2"
                                    />
                                    <button
                                        onClick={fetchArchive}
                                        disabled={isArchiveLoading}
                                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-md flex items-center justify-center gap-2"
                                    >
                                        {isArchiveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "אימות וכניסה"}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
                                <div className="p-4 border-b border-neutral-800 flex justify-between items-center bg-blue-900/10">
                                    <span className="text-sm font-bold text-blue-400 flex items-center gap-2">
                                        <ShieldCheck className="w-4 h-4" /> יומן רישומים מלא (פעילים + מחוקים)
                                    </span>
                                    <button onClick={() => downloadCSV(archivedUsers, 'full_audit_log')} className="text-xs bg-neutral-800 px-3 py-1 rounded border border-neutral-700">ייצוא לוג מלא למחשב</button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-right">
                                        <thead className="bg-neutral-950 text-neutral-300 text-sm">
                                            <tr>
                                                <th className="p-4">שם מלא</th>
                                                <th className="p-4">סטטוס</th>
                                                <th className="p-4">טלפון</th>
                                                <th className="p-4">עיר</th>
                                                <th className="p-4">תאריך</th>
                                                <th className="p-4">מקור</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-neutral-800">
                                            {archivedUsers.map((user) => (
                                                <tr key={user.id} className={`text-neutral-400 group ${(user as any)._is_deleted ? 'bg-red-950/10' : 'bg-green-950/5'}`}>
                                                    <td className="p-4 text-white font-medium">{user.name}</td>
                                                    <td className="p-4">
                                                        {(user as any)._is_deleted ? (
                                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">מחוק / בארכיון</span>
                                                        ) : (
                                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 border border-green-500/20">פעיל</span>
                                                        )}
                                                    </td>
                                                    <td className="p-4">{user.phone}</td>
                                                    <td className="p-4">{user.city}</td>
                                                    <td className="p-4 text-xs font-mono">
                                                        {(user as any)._is_deleted ? (
                                                            <div className="flex flex-col">
                                                                <span className="text-red-400">נמחק: {new Date(user.deleted_at || '').toLocaleDateString('he-IL')}</span>
                                                                <span className="text-[10px] opacity-50">נרשם: {new Date(user.created_at).toLocaleDateString('he-IL')}</span>
                                                            </div>
                                                        ) : (
                                                            <span>נרשם: {new Date(user.created_at).toLocaleDateString('he-IL')}</span>
                                                        )}
                                                    </td>
                                                    <td className="p-4">
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full border border-neutral-700 uppercase">
                                                            {(user as any)._source}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            <AnimatePresence>
                {editingUser && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold">עריכת פרטים</h2>
                                <button onClick={() => setEditingUser(null)} className="text-neutral-400 hover:text-white"><X className="w-5 h-5" /></button>
                            </div>
                            <form onSubmit={handleSaveUser} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-xs text-neutral-500">שם מלא</label><input value={editingUser.name} onChange={e => setEditingUser({ ...editingUser, name: e.target.value })} className="w-full bg-black border border-neutral-800 rounded px-3 py-2" /></div>
                                    <div><label className="text-xs text-neutral-500">טלפון</label><input value={editingUser.phone} onChange={e => setEditingUser({ ...editingUser, phone: e.target.value })} className="w-full bg-black border border-neutral-800 rounded px-3 py-2" /></div>
                                </div>
                                <div><label className="text-xs text-neutral-500">אימייל</label><input value={editingUser.email || ''} onChange={e => setEditingUser({ ...editingUser, email: e.target.value })} className="w-full bg-black border border-neutral-800 rounded px-3 py-2" /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-xs text-neutral-500">עיר</label><input value={editingUser.city} onChange={e => setEditingUser({ ...editingUser, city: e.target.value })} className="w-full bg-black border border-neutral-800 rounded px-3 py-2" /></div>
                                    <div><label className="text-xs text-neutral-500">מיקוד</label><input value={editingUser.zip || ''} onChange={e => setEditingUser({ ...editingUser, zip: e.target.value })} className="w-full bg-black border border-neutral-800 rounded px-3 py-2" /></div>
                                </div>
                                <div><label className="text-xs text-neutral-500">כתובת</label><input value={editingUser.address} onChange={e => setEditingUser({ ...editingUser, address: e.target.value })} className="w-full bg-black border border-neutral-800 rounded px-3 py-2" /></div>
                                <div className="flex gap-3 pt-6">
                                    <button type="button" onClick={handleDeleteUser} disabled={isDeleting} className="flex-1 bg-red-600/10 text-red-500 font-bold py-2.5 rounded-lg border border-red-600/20 hover:bg-red-600/20 flex items-center justify-center gap-2">
                                        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-4 h-4" /> מחק והעבר לארכיון</>}
                                    </button>
                                    <button type="submit" disabled={isSaving} className="flex-[2] bg-white text-black font-extrabold py-2.5 rounded-lg hover:bg-neutral-200 flex items-center justify-center gap-2">
                                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> שמור שינויים</>}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
