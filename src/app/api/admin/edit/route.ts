import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

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
        const { password, id, pg_id, name, phone, email, city, address, zip } = body;
        const adminPassword = process.env.ADMIN_PASSWORD || "12345";

        if (password !== adminPassword) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!id && !pg_id) {
            return NextResponse.json({ error: "Missing ID" }, { status: 400 });
        }

        const updatePromises = [];

        // 1. Handle primary ID (Firebase or pg- prefixed)
        if (id) {
            const stringId = String(id);
            if (stringId.startsWith('pg-')) {
                const realId = stringId.replace('pg-', '');
                updatePromises.push(withTimeout(sql`
                    UPDATE users 
                    SET name = ${name}, phone = ${phone}, email = ${email}, 
                        city = ${city}, address = ${address}, zip = ${zip}
                    WHERE id = ${realId}
                `, 8000));
            } else {
                const userRef = doc(db, "quentin_subscribers", stringId);
                updatePromises.push(withTimeout(updateDoc(userRef, {
                    name, phone, email: email || "", city, address, zip: zip || ""
                }), 8000));
            }
        }

        // 2. Handle secondary Postgres ID for merged records
        if (pg_id) {
            updatePromises.push(withTimeout(sql`
                UPDATE users 
                SET name = ${name}, phone = ${phone}, email = ${email}, 
                    city = ${city}, address = ${address}, zip = ${zip}
                WHERE id = ${pg_id}
            `, 8000));
        }

        try {
            await Promise.allSettled(updatePromises);
            return NextResponse.json({ success: true }, { status: 200 });
        } catch (dbError: any) {
            console.error("Database Update Error:", dbError);
            return NextResponse.json({
                error: "העדכון נכשל בחלקו או במלואו"
            }, { status: 500 });
        }

    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
