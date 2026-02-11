import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { headers } from "next/headers";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, getDocs } from "firebase/firestore";

// Helper for timeouts - Strict 4 seconds for checks, 6 seconds for saves
const withTimeout = (promise: Promise<any>, timeoutMs: number) => {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeoutMs))
    ]);
};

// Simple Rate Limiting (In-memory - resets on server restart/redeploy)
const rateLimitMap = new Map<string, { count: number, lastReset: number }>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 5; // 5 registrations per hour per IP

export async function POST(request: Request) {
    const startTime = Date.now();
    try {
        const headersList = await headers();
        const ip = headersList.get("x-forwarded-for")?.split(',')[0] || "unknown";

        // Rate Limit Check
        const now = Date.now();
        const userLimit = rateLimitMap.get(ip) || { count: 0, lastReset: now };

        if (now - userLimit.lastReset > RATE_LIMIT_WINDOW) {
            userLimit.count = 0;
            userLimit.lastReset = now;
        }

        if (userLimit.count >= MAX_REQUESTS) {
            return NextResponse.json({ error: "חורג ממכסת הרישומים לשעה זו. נסה שוב מאוחר יותר." }, { status: 429 });
        }

        userLimit.count++;
        rateLimitMap.set(ip, userLimit);

        const body = await request.json().catch(() => ({}));
        const { fullName, phone: rawPhone, email: rawEmail, city, zip, address } = body;

        const phone = String(rawPhone || "").replace(/\D/g, "");
        const email = String(rawEmail || "").trim().toLowerCase();

        if (!fullName || !phone || !city || !address) {
            return NextResponse.json({ error: "חסרים שדות חובה" }, { status: 400 });
        }

        // 1. Parallel Duplicate Check with TIMEOUTS
        // If checks hang, we skip them to allow saving (better to have a duplicate than a blocked user)
        try {
            const checkResults = await Promise.allSettled([
                withTimeout((async () => {
                    const usersRef = collection(db, "quentin_subscribers");
                    const qPhone = query(usersRef, where("phone", "==", phone));
                    const snapPhone = await getDocs(qPhone);
                    if (!snapPhone.empty) return "phone_exists";

                    if (email) {
                        const qEmail = query(usersRef, where("email", "==", email));
                        const snapEmail = await getDocs(qEmail);
                        if (!snapEmail.empty) return "email_exists";
                    }
                    return null;
                })(), 3000), // 3s timeout for FB check
                withTimeout((async () => {
                    try {
                        const resPhone = await sql`SELECT id FROM users WHERE phone = ${phone} LIMIT 1`;
                        if (resPhone.rows.length > 0) return "phone_exists";

                        if (email) {
                            const resEmail = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
                            if (resEmail.rows.length > 0) return "email_exists";
                        }
                        return null;
                    } catch (e) { return null; }
                })(), 3000) // 3s timeout for PG check
            ]);

            const reason = checkResults
                .filter(r => r.status === 'fulfilled')
                .map(r => (r as PromiseFulfilledResult<string | null>).value)
                .find(v => v !== null);

            if (reason === "phone_exists") {
                return NextResponse.json({ error: "מספר טלפון זה כבר רשום במערכת" }, { status: 409 });
            }
            if (reason === "email_exists") {
                return NextResponse.json({ error: "כתובת אימייל זו כבר רשומה במערכת" }, { status: 409 });
            }
        } catch (e) {
            console.error("Duplicate check skipped due to error or timeout");
        }

        // 2. Parallel Save
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

        // Use Promise.any - first one to succeed wins. If both fail/timeout, we error.
        try {
            const fastestSuccess = await Promise.any([
                withTimeout(firebaseSave(), 6000),
                withTimeout(postgresSave(), 6000)
            ]);

            const duration = Date.now() - startTime;
            return NextResponse.json({
                success: true,
                fastest: fastestSuccess,
                performance: `${duration}ms`
            }, { status: 200 });

        } catch (allErrors) {
            console.error("Critical: All storage failed or timed out", allErrors);
            return NextResponse.json({ error: "המערכת תחת עומס. הרישום נכשל, אנא נסה שוב בעוד דקה." }, { status: 500 });
        }

    } catch (error) {
        console.error("Fatal API Error:", error);
        return NextResponse.json({ error: "שגיאת מערכת" }, { status: 500 });
    }
}
