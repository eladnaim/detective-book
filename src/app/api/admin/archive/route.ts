import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

export async function POST(request: Request) {
    try {
        const { username, password } = await request.json();

        const superUser = process.env.SUPER_ADMIN_USER;
        const superPw = process.env.SUPER_ADMIN_PASSWORD;

        if (!superUser || !superPw || username !== superUser || password !== superPw) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const [fbArchive, pgArchive] = await Promise.allSettled([
            (async () => {
                const q = query(collection(db, "quentin_archive"), orderBy("deleted_at", "desc"));
                const snap = await getDocs(q);
                return snap.docs.map(doc => ({ id: doc.id, ...doc.data(), _source: 'firebase' }));
            })(),
            (async () => {
                const { rows } = await sql`SELECT * FROM archive_users ORDER BY deleted_at DESC`;
                return rows.map(r => ({ ...r, id: `arch-pg-${r.id}`, _source: 'postgres' }));
            })()
        ]);

        const allArchived = [];
        if (fbArchive.status === 'fulfilled') allArchived.push(...fbArchive.value);
        if (pgArchive.status === 'fulfilled') allArchived.push(...pgArchive.value);

        // Sort by deleted_at
        allArchived.sort((a: any, b: any) =>
            new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime()
        );

        return NextResponse.json({ archive: allArchived }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
