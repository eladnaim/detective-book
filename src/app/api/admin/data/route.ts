import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

export async function POST(request: Request) {
    try {
        const { password } = await request.json();
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminPassword || password !== adminPassword) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Parallel Fetch for maximum speed
        const [fbResult, pgResult] = await Promise.allSettled([
            (async () => {
                const q = query(collection(db, "quentin_subscribers"), orderBy("created_at", "desc"));
                const querySnapshot = await getDocs(q);
                return querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    _source: 'firebase'
                }));
            })(),
            (async () => {
                const { rows } = await sql`SELECT * FROM users ORDER BY created_at DESC`;
                return rows.map(row => ({
                    ...row,
                    id: `pg-${row.id}`,
                    _source: 'postgres'
                }));
            })()
        ]);

        const mergedUsers = new Map();
        let fbTotal = 0;
        let pgTotal = 0;

        // Process Firebase (Prioritize Firebase IDs as base)
        if (fbResult.status === 'fulfilled') {
            fbResult.value.forEach((user: any) => {
                const key = `${user.phone}-${user.name}`;
                mergedUsers.set(key, {
                    ...user,
                    _sources: ['firebase']
                });
                fbTotal++;
            });
        }

        // Process Postgres and Merge
        if (pgResult.status === 'fulfilled') {
            pgResult.value.forEach((row: any) => {
                const key = `${row.phone}-${row.name}`;
                if (mergedUsers.has(key)) {
                    // Update existing record with Postgres ID and source
                    const existing = mergedUsers.get(key);
                    mergedUsers.set(key, {
                        ...existing,
                        pg_id: row.id, // Store Postgres ID for cross-reference
                        _sources: [...existing._sources, 'postgres']
                    });
                } else {
                    // Add new unique record from Postgres
                    mergedUsers.set(key, {
                        ...row,
                        _sources: ['postgres']
                    });
                }
                pgTotal++;
            });
        }

        const finalUsers = Array.from(mergedUsers.values()).sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        return NextResponse.json({
            users: finalUsers,
            counts: {
                firebase: fbTotal,
                postgres: pgTotal,
                total_unique: finalUsers.length
            }
        }, { status: 200 });

    } catch (error) {
        console.error("Admin Fetch Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
