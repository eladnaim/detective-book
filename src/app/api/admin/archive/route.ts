import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

export async function POST(request: Request) {
    try {
        const { username, password } = await request.json();

        const superUser = process.env.SUPER_ADMIN_USER || "eladn";
        const superPw = process.env.SUPER_ADMIN_PASSWORD || "6919043";

        if (username !== superUser || password !== superPw) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Parallel Fetch for ACTIVE and ARCHIVED
        const [fbActive, pgActive, fbArchived, pgArchived] = await Promise.allSettled([
            // Active Firebase
            (async () => {
                const q = query(collection(db, "quentin_subscribers"), orderBy("created_at", "desc"));
                const snap = await getDocs(q);
                return snap.docs.map(doc => ({ id: doc.id, ...doc.data(), _source: 'firebase', _is_deleted: false }));
            })(),
            // Active Postgres
            (async () => {
                const { rows } = await sql`SELECT * FROM users ORDER BY created_at DESC`;
                return rows.map(r => ({ ...r, id: `pg-${r.id}`, _source: 'postgres', _is_deleted: false }));
            })(),
            // Archived Firebase
            (async () => {
                const q = query(collection(db, "quentin_archive"), orderBy("deleted_at", "desc"));
                const snap = await getDocs(q);
                return snap.docs.map(doc => ({ id: doc.id, ...doc.data(), _source: 'firebase', _is_deleted: true }));
            })(),
            // Archived Postgres
            (async () => {
                try {
                    const { rows } = await sql`SELECT * FROM archive_users ORDER BY deleted_at DESC`;
                    return rows.map(r => ({ ...r, id: `arch-pg-${r.id}`, _source: 'postgres', _is_deleted: true }));
                } catch (e) { return []; }
            })()
        ]);

        const allRecords: any[] = [];
        const processResults = (res: any) => {
            if (res.status === 'fulfilled') allRecords.push(...res.value);
        };

        [fbActive, pgActive, fbArchived, pgArchived].forEach(processResults);

        // Sort by date (either deleted_at or created_at)
        allRecords.sort((a, b) => {
            const dateA = new Date(a.deleted_at || a.created_at).getTime();
            const dateB = new Date(b.deleted_at || b.created_at).getTime();
            return dateB - dateA;
        });

        return NextResponse.json({ archive: allRecords }, { status: 200 });
    } catch (error) {
        console.error("Master Archive Fetch Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
