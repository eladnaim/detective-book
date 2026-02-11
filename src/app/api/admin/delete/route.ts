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
        const { password, id } = body;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminPassword || password !== adminPassword) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!id) {
            return NextResponse.json({ error: "Missing ID" }, { status: 400 });
        }

        try {
            const stringId = String(id);

            if (stringId.startsWith('pg-')) {
                // Postgres Delete
                const realId = stringId.replace('pg-', '');
                await withTimeout(sql`DELETE FROM users WHERE id = ${realId}`, 8000);
            } else {
                // Firebase Delete
                const userRef = doc(db, "quentin_subscribers", stringId);
                await withTimeout(deleteDoc(userRef), 8000);
            }

            return NextResponse.json({ success: true }, { status: 200 });
        } catch (dbError: any) {
            console.error("Database Delete Error:", dbError);
            return NextResponse.json({
                error: dbError.message === "Timeout" ? "המערכת איטית, אנא נסה שוב" : "פעולת המחיקה נכשלה"
            }, { status: 500 });
        }

    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
