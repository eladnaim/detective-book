import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";

const withTimeout = (promise: Promise<any>, timeoutMs: number) => {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeoutMs))
    ]);
};

// Archive & Delete a single record
async function archiveAndDelete(id: string | number, pg_id?: string | number) {
    const promises = [];

    // Firebase
    if (id && !String(id).startsWith('pg-')) {
        const stringId = String(id);
        const userRef = doc(db, "quentin_subscribers", stringId);
        const archiveRef = doc(db, "quentin_archive", stringId);
        promises.push((async () => {
            const snap = await getDoc(userRef);
            if (snap.exists()) {
                await setDoc(archiveRef, { ...snap.data(), deleted_at: new Date().toISOString(), deleted_by: 'admin' });
                await deleteDoc(userRef);
            }
        })());
    }

    // Postgres
    const postgresId = pg_id || (String(id).startsWith('pg-') ? String(id).replace('pg-', '') : null);
    if (postgresId) {
        promises.push((async () => {
            await sql`CREATE TABLE IF NOT EXISTS archive_users (
                id SERIAL PRIMARY KEY, original_id INTEGER,
                name TEXT, phone TEXT, email TEXT,
                city TEXT, zip TEXT, address TEXT,
                ip_address TEXT, created_at TIMESTAMP,
                deleted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )`;
            await sql`INSERT INTO archive_users (original_id, name, phone, email, city, zip, address, ip_address, created_at)
                SELECT id, name, phone, email, city, zip, address, ip_address, created_at FROM users WHERE id = ${postgresId}`;
            await sql`DELETE FROM users WHERE id = ${postgresId}`;
        })());
    }

    await Promise.allSettled(promises);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { password, id, pg_id, bulk } = body;
        const adminPassword = process.env.ADMIN_PASSWORD || "07121979";

        if (password !== adminPassword) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Bulk delete mode
        if (bulk && Array.isArray(bulk)) {
            const batchSize = 5; // Process 5 at a time to avoid overload
            for (let i = 0; i < bulk.length; i += batchSize) {
                const batch = bulk.slice(i, i + batchSize);
                await withTimeout(
                    Promise.allSettled(batch.map((item: any) => archiveAndDelete(item.id, item.pg_id))),
                    15000
                );
            }
            return NextResponse.json({ success: true, deleted: bulk.length }, { status: 200 });
        }

        // Single delete mode
        await withTimeout(archiveAndDelete(id, pg_id), 10000);
        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error("Delete & Archive Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
