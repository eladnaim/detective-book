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

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { password, id, pg_id } = body;
        const adminPassword = process.env.ADMIN_PASSWORD || "12345";

        if (password !== adminPassword) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const archivePromises = [];

        // 1. Handle Firebase ID
        if (id && !String(id).startsWith('pg-')) {
            const stringId = String(id);
            const userRef = doc(db, "quentin_subscribers", stringId);
            const archiveRef = doc(db, "quentin_archive", stringId);

            archivePromises.push((async () => {
                const snap = await getDoc(userRef);
                if (snap.exists()) {
                    await setDoc(archiveRef, {
                        ...snap.data(),
                        deleted_at: new Date().toISOString(),
                        deleted_by: 'admin'
                    });
                    await deleteDoc(userRef);
                }
            })());
        }

        // 2. Handle Postgres ID (either via pg_id or prefixed id)
        const postgresId = pg_id || (String(id).startsWith('pg-') ? String(id).replace('pg-', '') : null);

        if (postgresId) {
            archivePromises.push((async () => {
                // Ensure archive table exists
                await sql`CREATE TABLE IF NOT EXISTS archive_users (
                    id SERIAL PRIMARY KEY,
                    original_id INTEGER,
                    name TEXT, phone TEXT, email TEXT,
                    city TEXT, zip TEXT, address TEXT,
                    ip_address TEXT, created_at TIMESTAMP,
                    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )`;

                // Copy to archive
                await sql`
                    INSERT INTO archive_users (original_id, name, phone, email, city, zip, address, ip_address, created_at)
                    SELECT id, name, phone, email, city, zip, address, ip_address, created_at
                    FROM users WHERE id = ${postgresId}
                `;

                // Delete from main
                await sql`DELETE FROM users WHERE id = ${postgresId}`;
            })());
        }

        await withTimeout(Promise.allSettled(archivePromises), 10000);

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error("Delete & Archive Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
