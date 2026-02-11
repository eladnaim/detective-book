import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { headers } from "next/headers";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, getDocs } from "firebase/firestore";

// Helper for timeouts
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

        // Normalize phone for comparison
        const phone = String(rawPhone || "").replace(/\D/g, "");

        const headersList = await headers();
        const ip = headersList.get("x-forwarded-for")?.split(',')[0] || "unknown";

        if (!fullName || !phone || !city || !address) {
            return NextResponse.json({ error: "חסרים שדות חובה" }, { status: 400 });
        }

        // 1. DUPLICATE CHECK - Run in parallel but respond as soon as we find a match
        try {
            const checkResults = await Promise.all([
                (async () => {
                    const q = query(collection(db, "quentin_subscribers"), where("phone", "==", phone));
                    const snap = await getDocs(q);
                    return !snap.empty;
                })(),
                (async () => {
                    try {
                        const res = await sql`SELECT id FROM users WHERE phone = ${phone} LIMIT 1`;
                        return res.rows.length > 0;
                    } catch (e) { return false; }
                })()
            ]);

            if (checkResults.some(r => r === true)) {
                return NextResponse.json({ error: "מספר טלפון זה כבר רשום במערכת" }, { status: 409 });
            }
        } catch (e) {
            console.error("Check error, continuing to save anyway to avoid blocking user");
        }

        // 2. SAVE OPERATION - Parallel execution
        const firebaseSave = async () => {
            const usersRef = collection(db, "quentin_subscribers");
            await addDoc(usersRef, {
                name: fullName,
                phone,
                email: email || "",
                city,
                zip: zip || "",
                address,
                ip_address: ip,
                created_at: new Date().toISOString()
            });
            return "firebase";
        };

        const postgresSave = async () => {
            try {
                await sql`
                    INSERT INTO users (name, phone, email, city, zip, address, ip_address)
                    VALUES (${fullName}, ${phone}, ${email}, ${city}, ${zip}, ${address}, ${ip})
                `;
            } catch (dbError: any) {
                if (dbError.message?.includes('relation "users" does not exist')) {
                    await sql`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT, phone TEXT, email TEXT, city TEXT, zip TEXT, address TEXT, ip_address TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);`;
                    await sql`INSERT INTO users (name, phone, email, city, zip, address, ip_address) VALUES (${fullName}, ${phone}, ${email}, ${city}, ${zip}, ${address}, ${ip});`;
                } else throw dbError;
            }
            return "postgres";
        };

        // THE MAGIC: Use Promise.any to respond as soon as the FIRST database succeeds
        // This makes the registration feel "instant" to the user.
        try {
            const fastestSuccess = await Promise.any([
                withTimeout(firebaseSave(), 5000),
                withTimeout(postgresSave(), 5000)
            ]);

            const duration = Date.now() - startTime;
            console.log(`Lightning Fast Registration: Responsive in ${duration}ms via ${fastestSuccess}`);

            return NextResponse.json({
                success: true,
                fastest: fastestSuccess,
                performance: `${duration}ms`
            }, { status: 200 });

        } catch (allErrors) {
            console.error("All storage providers failed/timed out", allErrors);
            return NextResponse.json({ error: "שגיאה בשמירת הנתונים. המערכת תחת עומס." }, { status: 500 });
        }

    } catch (error) {
        console.error("Fatal API Error:", error);
        return NextResponse.json({ error: "שגיאת מערכת" }, { status: 500 });
    }
}
