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

        const allUsers: any[] = [];
        const seenIds = new Set();
        let fbCount = 0;
        let pgCount = 0;

        // 1. Fetch from Firebase
        try {
            const q = query(collection(db, "quentin_subscribers"), orderBy("created_at", "desc"));
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const user = {
                    id: doc.id,
                    ...data,
                    _source: 'firebase'
                };
                allUsers.push(user);
                seenIds.add(doc.id);
                fbCount++;
            });
        } catch (fbError) {
            console.error("Firebase Admin Fetch Error:", fbError);
        }

        // 2. Fetch from Postgres
        try {
            const { rows } = await sql`SELECT * FROM users ORDER BY created_at DESC`;
            rows.forEach(row => {
                const pgId = `pg-${row.id}`;
                if (!seenIds.has(pgId)) {
                    // Check if we already have this phone/name from Firebase to avoid visual clutter
                    const isDuplicate = allUsers.some(u => u.phone === row.phone && u.name === row.name);

                    allUsers.push({
                        ...row,
                        id: pgId,
                        _source: 'postgres',
                        _is_duplicate: isDuplicate
                    });
                    pgCount++;
                }
            });
        } catch (dbError: any) {
            console.error("Postgres Admin Fetch Error:", dbError);
        }

        console.log(`Admin Fetch: ${fbCount} from Firebase, ${pgCount} from Postgres. Total unique: ${allUsers.length}`);

        return NextResponse.json({
            users: allUsers,
            counts: { firebase: fbCount, postgres: pgCount }
        }, { status: 200 });

    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
