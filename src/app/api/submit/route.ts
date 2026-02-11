import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { headers } from "next/headers";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, getDocs } from "firebase/firestore";

export async function POST(request: Request) {
    const startTime = Date.now();
    try {
        const body = await request.json();
        const { fullName, phone, email, city, zip, address } = body;

        const headersList = await headers();
        const forwardedFor = headersList.get("x-forwarded-for");
        const ip = forwardedFor ? forwardedFor.split(',')[0] : "unknown";

        // 1. Validation
        if (!fullName || !phone || !city || !address) {
            return NextResponse.json({ error: "חסרים שדות חובה" }, { status: 400 });
        }

        // 2. Parallel Duplicate Check (Maximum Speed)
        const [fbDuplicate, pgDuplicate] = await Promise.all([
            (async () => {
                try {
                    const q = query(collection(db, "quentin_subscribers"), where("phone", "==", phone));
                    const snap = await getDocs(q);
                    return !snap.empty;
                } catch (e) {
                    console.error("FB Check Error:", e);
                    return false;
                }
            })(),
            (async () => {
                try {
                    const res = await sql`SELECT id FROM users WHERE phone = ${phone} LIMIT 1`;
                    return res.rows.length > 0;
                } catch (e) {
                    if ((e as any).message?.includes('relation "users" does not exist')) return false;
                    console.error("PG Check Error:", e);
                    return false;
                }
            })()
        ]);

        if (fbDuplicate || pgDuplicate) {
            return NextResponse.json({ error: "מספר טלפון זה כבר רשום במערכת" }, { status: 409 });
        }

        // 3. Parallel Save (Highest Reliability)
        const results = await Promise.allSettled([
            // Firebase Save
            (async () => {
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
        ]);

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

        // If both failed
        console.error("Critical: All storage providers failed", results);
        return NextResponse.json({ error: "אירעה שגיאה בשמירת הנתונים. המהנדסים עודכנו." }, { status: 500 });

    } catch (error) {
        console.error("Fatal API Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
