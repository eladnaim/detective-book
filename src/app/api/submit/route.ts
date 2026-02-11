import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { headers } from "next/headers";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, getDocs, or } from "firebase/firestore";

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
        const { fullName, phone: rawPhone, email: rawEmail, city, zip, address } = body;

        // Normalize phone for comparison
        const phone = String(rawPhone || "").replace(/\D/g, "");
        const email = String(rawEmail || "").trim().toLowerCase();

        const headersList = await headers();
        const ip = headersList.get("x-forwarded-for")?.split(',')[0] || "unknown";

        if (!fullName || !phone || !city || !address) {
            return NextResponse.json({ error: "חסרים שדות חובה" }, { status: 400 });
        }

        // 1. IMPROVED DUPLICATE CHECK - Check Phone OR Email
        try {
            const checkResults = await Promise.all([
                // Check Firebase for Phone or Email
                (async () => {
                    const usersRef = collection(db, "quentin_subscribers");

                    // Check phone first
                    const qPhone = query(usersRef, where("phone", "==", phone));
                    const snapPhone = await getDocs(qPhone);
                    if (!snapPhone.empty) return "phone_exists";

                    // Check email if provided
                    if (email) {
                        const qEmail = query(usersRef, where("email", "==", email));
                        const snapEmail = await getDocs(qEmail);
                        if (!snapEmail.empty) return "email_exists";
                    }
                    return null;
                })(),
                // Check Postgres for Phone or Email
                (async () => {
                    try {
                        // Check phone
                        const resPhone = await sql`SELECT id FROM users WHERE phone = ${phone} LIMIT 1`;
                        if (resPhone.rows.length > 0) return "phone_exists";

                        // Check email
                        if (email) {
                            const resEmail = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
                            if (resEmail.rows.length > 0) return "email_exists";
                        }
                        return null;
                    } catch (e) { return null; }
                })()
            ]);

            const reason = checkResults.find(r => r !== null);
            if (reason === "phone_exists") {
                return NextResponse.json({ error: "מספר טלפון זה כבר רשום במערכת" }, { status: 409 });
            }
            if (reason === "email_exists") {
                return NextResponse.json({ error: "כתובת אימייל זו כבר רשומה במערכת" }, { status: 409 });
            }
        } catch (e) {
            console.error("Check error:", e);
        }

        // 2. SAVE OPERATION
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

        try {
            const fastestSuccess = await Promise.any([
                withTimeout(firebaseSave(), 5000),
                withTimeout(postgresSave(), 5000)
            ]);

            const duration = Date.now() - startTime;
            return NextResponse.json({
                success: true,
                fastest: fastestSuccess,
                performance: `${duration}ms`
            }, { status: 200 });

        } catch (allErrors) {
            console.error("All storage failed", allErrors);
            return NextResponse.json({ error: "שגיאה בשמירת הנתונים." }, { status: 500 });
        }

    } catch (error) {
        console.error("Fatal API Error:", error);
        return NextResponse.json({ error: "שגיאת מערכת" }, { status: 500 });
    }
}
