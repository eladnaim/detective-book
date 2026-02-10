import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { headers } from "next/headers";
import { db } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";

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
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        let savedToPostgres = false;
        let savedToFirebase = false;

        // 1. Firebase Backup (Primary for reliability now)
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
            console.error("Firebase Backup Error:", fbError);
        }

        // 2. Vercel Postgres (Attempt with auto-fix)
        try {
            await sql`
                INSERT INTO users (name, phone, email, city, zip, address, ip_address)
                VALUES (${fullName}, ${phone}, ${email}, ${city}, ${zip}, ${address}, ${ip})
            `;
            savedToPostgres = true;
        } catch (dbError: any) {
            console.error("Postgres Error, attempting auto-fix:", dbError);

            if (
                dbError.message?.includes('relation "users" does not exist') ||
                dbError.message?.includes('column "ip_address"')
            ) {
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
                    if (dbError.message?.includes('column "ip_address"')) {
                        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS ip_address TEXT;`;
                    }
                    await sql`
                        INSERT INTO users (name, phone, email, city, zip, address, ip_address)
                        VALUES (${fullName}, ${phone}, ${email}, ${city}, ${zip}, ${address}, ${ip})
                    `;
                    savedToPostgres = true;
                } catch (retryError) {
                    console.error("Postgres Retry failed:", retryError);
                }
            }
        }

        if (savedToFirebase || savedToPostgres) {
            return NextResponse.json({ success: true, backup: savedToFirebase }, { status: 200 });
        }

        return NextResponse.json({ error: "אירעה שגיאה בשמירת הנתונים" }, { status: 500 });
    } catch (error) {
        console.error("Submission error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
