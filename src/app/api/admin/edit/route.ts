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
        const { password, id, name, phone, email, city, address, zip } = body;
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
                // Postgres Update
                const realId = stringId.replace('pg-', '');
                await withTimeout(sql`
                    UPDATE users 
                    SET name = ${name}, 
                        phone = ${phone}, 
                        email = ${email}, 
                        city = ${city}, 
                        address = ${address}, 
                        zip = ${zip}
                    WHERE id = ${realId}
                `, 8000);
            } else {
                // Firebase Update
                const userRef = doc(db, "quentin_subscribers", stringId);
                await withTimeout(updateDoc(userRef, {
                    name,
                    phone,
                    email: email || "",
                    city,
                    address,
                    zip: zip || ""
                }), 8000);
            }

            return NextResponse.json({ success: true }, { status: 200 });
        } catch (dbError: any) {
            console.error("Database Update Error:", dbError);
            return NextResponse.json({
                error: dbError.message === "Timeout" ? "המערכת איטית, אנא נסה שוב" : "פעולת העדכון נכשלה"
            }, { status: 500 });
        }

    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
