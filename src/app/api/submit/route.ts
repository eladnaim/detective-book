import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { headers } from "next/headers";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, getDocs } from "firebase/firestore";

// Helper for timeouts to avoid hanging requests
const withTimeout = (promise: Promise<any>, timeoutMs: number) => {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeoutMs))
    ]);
};

export async function POST(request: Request) {
    const startTime = Date.now();
    try {
        const body = await request.json().catch(() => ({}));
        const { fullName, phone: rawPhone, email, city, zip, address } = body;

        // Normalize phone: remove all non-digit characters
        const phone = String(rawPhone || "").replace(/\D/g, "");

        const headersList = await headers();
        const forwardedFor = headersList.get("x-forwarded-for");
        const ip = forwardedFor ? forwardedFor.split(',')[0] : "unknown";

        // 1. Validation
        if (!fullName || !phone || !city || !address) {
            return NextResponse.json({ error: "חסרים שדות חובה או מספר טלפון לא תקין" }, { status: 400 });
        }

        // 2. Parallel Duplicate Check (with 5s Timeout)
        let isDuplicate = false;
        try {
            const results = await Promise.allSettled([
                // Firebase Check
                (async () => {
                    const q = query(collection(db, "quentin_subscribers"), where("phone", "==", phone));
                    const snap = await getDocs(q);
                    return !snap.empty;
                })(),
                // Postgres Check
                (async () => {
                    const res = await sql`SELECT id FROM users WHERE phone = ${phone} LIMIT 1`;
                    return res.rows.length > 0;
                })()
            ]);

            isDuplicate = results.some(r => r.status === "fulfilled" && (r as PromiseFulfilledResult<boolean>).value === true);
        } catch (checkError) {
            console.error("Duplicate check error (ignoring and proceeding):", checkError);
        }

        if (isDuplicate) {
            return NextResponse.json({ error: "מספר טלפון זה כבר רשום במערכת" }, { status: 409 });
        }

        // 3. Parallel Save (Highest Reliability)
        const savePromises = [
            // Firebase Save
            (async () => {
                const usersRef = collection(db, "quentin_subscribers");
                await addDoc(usersRef, {
                    name: fullName,
                    phone: phone, // Save normalized phone
                    email: email || "",
                    city,
                    zip: zip || "",
                    address,
                    ip_address: ip,
                    created_at: new Date().toISOString()
                });
                return "firebase";
            })(),
            // Postgres Save
            (async () => {
                try {
                    await sql`
                        INSERT INTO users (name, phone, email, city, zip, address, ip_address)
                        VALUES (${fullName}, ${phone}, ${email}, ${city}, ${zip}, ${address}, ${ip})
                    `;
                } catch (dbError: any) {
                    if (dbError.message?.includes('relation "users" does not exist')) {
                        await sql`
                            CREATE TABLE IF NOT EXISTS users (
                                id SERIAL PRIMARY KEY,
                                name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT,
                                city TEXT NOT NULL, zip TEXT, address TEXT NOT NULL,
                                ip_address TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                            );
                        `;
                        await sql`
                            INSERT INTO users (name, phone, email, city, zip, address, ip_address)
                            VALUES (${fullName}, ${phone}, ${email}, ${city}, ${zip}, ${address}, ${ip})
                        `;
                    } else throw dbError;
                }
                return "postgres";
            })()
        ];

        // Wait for at least one to succeed or both to fail/timeout (within 8 seconds)
        const results = await Promise.allSettled(savePromises.map(p => withTimeout(p, 8000)));

        const successfulSaves = results
            .filter(r => r.status === "fulfilled")
            .map(r => (r as PromiseFulfilledResult<string>).value);

        const duration = Date.now() - startTime;
        console.log(`Registration processed in ${duration}ms. Saved to: ${successfulSaves.join(", ")}`);

        if (successfulSaves.length > 0) {
            return NextResponse.json({
                success: true,
                sources: successfulSaves,
                performance: `${duration}ms`
            }, { status: 200 });
        }

        const errors = results.filter(r => r.status === "rejected");
        console.error("All storage providers failed/timed out:", errors);

        return NextResponse.json({
            error: "אירעה שגיאה בשמירת הנתונים. המערכת תחת עומס, אנא נסה שנית."
        }, { status: 500 });

    } catch (error) {
        console.error("Fatal API Error:", error);
        return NextResponse.json({ error: "שגיאת מערכת פנימית" }, { status: 500 });
    }
}
