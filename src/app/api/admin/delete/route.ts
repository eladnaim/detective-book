import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { db } from "@/lib/firebase";
import { doc, deleteDoc } from "firebase/firestore";

// Helper for timeouts
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
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminPassword || password !== adminPassword) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!id && !pg_id) {
            return NextResponse.json({ error: "Missing ID" }, { status: 400 });
        }

        const deletePromises = [];

        // 1. Handle Firebase ID or merged ID
        if (id) {
            const stringId = String(id);
            if (stringId.startsWith('pg-')) {
                // It's a pure Postgres record
                const realId = stringId.replace('pg-', '');
                deletePromises.push(withTimeout(sql`DELETE FROM users WHERE id = ${realId}`, 8000));
            } else {
                // It's a Firebase record
                const userRef = doc(db, "quentin_subscribers", stringId);
                deletePromises.push(withTimeout(deleteDoc(userRef), 8000));
            }
        }

        // 2. Handle explicit Postgres ID (for merged records)
        if (pg_id) {
            deletePromises.push(withTimeout(sql`DELETE FROM users WHERE id = ${pg_id}`, 8000));
        }

        try {
            await Promise.allSettled(deletePromises);
            return NextResponse.json({ success: true }, { status: 200 });
        } catch (dbError: any) {
            console.error("Database Delete Error:", dbError);
            return NextResponse.json({
                error: "מחיקת המשתמש נכשלה חלקית או במלואה"
            }, { status: 500 });
        }

    } catch (error) {
        console.error("Internal Server Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
