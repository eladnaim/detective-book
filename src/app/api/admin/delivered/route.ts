import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

const withTimeout = (promise: Promise<any>, timeoutMs: number) => {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeoutMs))
    ]);
};

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { password, id, pg_id, delivered } = body;
        const adminPassword = process.env.ADMIN_PASSWORD || "07121979";

        if (password !== adminPassword) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const updatePromises = [];

        // 1. Ensure Postgres column exists (Migration) - Runs once or handles error
        try {
            await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS delivered BOOLEAN DEFAULT FALSE`;
        } catch (e) {
            // Might already exist or not supported, ignore
        }

        // 2. Handle primary ID (Firebase or pg- prefixed)
        if (id) {
            const stringId = String(id);
            if (stringId.startsWith('pg-')) {
                const realId = stringId.replace('pg-', '');
                updatePromises.push(withTimeout(sql`
                    UPDATE users 
                    SET delivered = ${delivered}
                    WHERE id = ${realId}
                `, 5000));
            } else {
                const userRef = doc(db, "quentin_subscribers", stringId);
                updatePromises.push(withTimeout(updateDoc(userRef, {
                    delivered: delivered
                }), 5000));
            }
        }

        // 3. Handle secondary Postgres ID for merged records
        if (pg_id) {
            updatePromises.push(withTimeout(sql`
                UPDATE users 
                SET delivered = ${delivered}
                WHERE id = ${pg_id}
            `, 5000));
        }

        await Promise.allSettled(updatePromises);
        return NextResponse.json({ success: true }, { status: 200 });

    } catch (error) {
        console.error("Delivery Toggle Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
