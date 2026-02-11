import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

// Global timeout helper (Strict 5 seconds for admin)
const withTimeout = (promise: Promise<any>, timeoutMs: number = 5000) => {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeoutMs))
    ]);
};

export async function POST(request: Request) {
    try {
        const { password } = await request.json();
        const adminPassword = process.env.ADMIN_PASSWORD || "12345";

        if (password !== adminPassword) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Parallel Fetch with STRICT TIMEOUTS to prevent hanging
        const [fbResult, pgResult] = await Promise.allSettled([
            withTimeout((async () => {
                const q = query(collection(db, "quentin_subscribers"), orderBy("created_at", "desc"));
                const querySnapshot = await getDocs(q);
                return querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    _source: 'firebase'
                }));
            })(), 4000),
            withTimeout((async () => {
                const { rows } = await sql`SELECT * FROM users ORDER BY created_at DESC`;
                return rows.map(row => ({
                    ...row,
                    id: `pg-${row.id}`,
                    _source: 'postgres'
                }));
            })(), 4000)
        ]);

        const mergedUsers = new Map();
        let fbTotal = 0;
        let pgTotal = 0;

        // Process Firebase
        if (fbResult.status === 'fulfilled') {
            fbResult.value.forEach((user: any) => {
                const key = `${user.phone}-${user.name}`;
                mergedUsers.set(key, {
                    ...user,
                    _sources: ['firebase']
                });
                fbTotal++;
            });
        } else {
            console.error("Firebase fetch failed or timed out:", fbResult.reason);
        }

        // Process Postgres
        if (pgResult.status === 'fulfilled') {
            pgResult.value.forEach((row: any) => {
                const key = `${row.phone}-${row.name}`;
                if (mergedUsers.has(key)) {
                    const existing = mergedUsers.get(key);
                    mergedUsers.set(key, {
                        ...existing,
                        pg_id: row.id,
                        _sources: [...existing._sources, 'postgres']
                    });
                } else {
                    mergedUsers.set(key, {
                        ...row,
                        _sources: ['postgres']
                    });
                }
                pgTotal++;
            });
        } else {
            console.error("Postgres fetch failed or timed out:", pgResult.reason);
        }

        const finalUsers = Array.from(mergedUsers.values()).sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        // Even if one failed, we return what we have (Resilience)
        return NextResponse.json({
            users: finalUsers,
            counts: {
                firebase: fbTotal,
                postgres: pgTotal,
                total_unique: finalUsers.length
            },
            status: {
                firebase: fbResult.status,
                postgres: pgResult.status
            }
        }, { status: 200 });

    } catch (error) {
        console.error("Admin Fetch Critical Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
