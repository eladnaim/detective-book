import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { db } from "@/lib/firebase";
import { doc, deleteDoc } from "firebase/firestore";

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
                await sql`DELETE FROM users WHERE id = ${realId}`;
            } else {
                // Firebase Delete
                const userRef = doc(db, "quentin_subscribers", stringId);
                await deleteDoc(userRef);
            }

            return NextResponse.json({ success: true }, { status: 200 });
        } catch (dbError) {
            console.error("Database Delete Error:", dbError);
            return NextResponse.json({ error: "Database delete failed" }, { status: 500 });
        }

    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
