import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { headers } from "next/headers";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, getDocs } from "firebase/firestore";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { fullName, phone, email, city, zip, address } = body;

        const headersList = await headers();
        const forwardedFor = headersList.get("x-forwarded-for");
        const ip = forwardedFor ? forwardedFor.split(',')[0] : "unknown";

        // Basic validation
        if (!fullName || !phone || !city || !address) {
            return NextResponse.json(
                { error: "חסרים שדות חובה" },
                { status: 400 }
            );
        }

        // --- DUPLICATE CHECK ---
        // 1. Check Firebase
        try {
            const usersRef = collection(db, "quentin_subscribers");
            const q = query(usersRef, where("phone", "==", phone));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                return NextResponse.json(
                    { error: "מספר טלפון זה כבר רשום במערכת" },
                    { status: 409 }
                );
            }
        } catch (fbCheckError) {
            console.error("Firebase Check Error:", fbCheckError);
        }

        // 2. Check Postgres
        try {
            const result = await sql`SELECT id FROM users WHERE phone = ${phone} LIMIT 1`;
            if (result.rows.length > 0) {
                return NextResponse.json(
                    { error: "מספר טלפון זה כבר רשום במערכת" },
                    { status: 409 }
                );
            }
        } catch (pgCheckError) {
            console.error("Postgres Check Error:", pgCheckError);
        }

        let savedToPostgres = false;
        let savedToFirebase = false;

        // --- DATA SAVING ---
        // 1. Firebase (Primary Backup)
        try {
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
            savedToFirebase = true;
        } catch (fbError) {
            console.error("Firebase Save Error:", fbError);
        }

        // 2. Vercel Postgres
        try {
            await sql`
                INSERT INTO users (name, phone, email, city, zip, address, ip_address)
                VALUES (${fullName}, ${phone}, ${email}, ${city}, ${zip}, ${address}, ${ip})
            `;
            savedToPostgres = true;
        } catch (dbError: any) {
            console.error("Postgres Save Error:", dbError);

            // Auto-recovery for table issues
            if (dbError.message?.includes('relation "users" does not exist')) {
                try {
                    await sql`
                        CREATE TABLE IF NOT EXISTS users (
                            id SERIAL PRIMARY KEY,
                            name TEXT NOT NULL,
                            phone TEXT NOT NULL,
                            email TEXT,
                            city TEXT NOT NULL,
                            zip TEXT,
                            address TEXT NOT NULL,
                            ip_address TEXT,
                            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                        );
                    `;
                    await sql`
                        INSERT INTO users (name, phone, email, city, zip, address, ip_address)
                        VALUES (${fullName}, ${phone}, ${email}, ${city}, ${zip}, ${address}, ${ip})
                    `;
                    savedToPostgres = true;
                } catch (recoveryError) {
                    console.error("Postgres Recovery failed:", recoveryError);
                }
            }
        }

        if (savedToFirebase || savedToPostgres) {
            return NextResponse.json({
                success: true,
                source: savedToPostgres ? "postgres" : "firebase"
            }, { status: 200 });
        }

        return NextResponse.json({ error: "אירעה שגיאה בשמירת הנתונים. אנא נסה שנית." }, { status: 500 });
    } catch (error) {
        console.error("Critical submission error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
