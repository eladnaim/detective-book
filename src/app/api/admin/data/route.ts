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

        const allUsers: any[] = [];
        const seenIds = new Set();
        let fbCount = 0;
        let pgCount = 0;

        // Process Firebase
        if (fbResult.status === 'fulfilled') {
            fbResult.value.forEach(user => {
                allUsers.push(user);
                seenIds.add(user.id);
                fbCount++;
            });
        }

        // Process Postgres
        if (pgResult.status === 'fulfilled') {
            pgResult.value.forEach(row => {
                if (!seenIds.has(row.id)) {
                    // Check for visual duplicate
                    const isDuplicate = allUsers.some(u => u.phone === (row as any).phone && u.name === (row as any).name);
                    allUsers.push({
                        ...row,
                        _is_duplicate: isDuplicate
                    });
                    pgCount++;
                }
            });
        }

        return NextResponse.json({
            users: allUsers,
            counts: { firebase: fbCount, postgres: pgCount }
        }, { status: 200 });

    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
