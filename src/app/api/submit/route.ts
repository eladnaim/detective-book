import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { headers } from "next/headers";

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

        try {
            // 1. IP Check (Limit 1 per IP)
            if (ip !== "unknown" && process.env.NODE_ENV !== 'development') {
                const { rows: ipRows } = await sql`
                    SELECT id FROM users WHERE ip_address = ${ip} LIMIT 1
                 `;
                if (ipRows.length > 0) {
                    return NextResponse.json({ error: "ההרשמה מוגבלת לפעם אחת מכל מכשיר/כתובת IP" }, { status: 400 });
                }
            }

            // 2. Data Duplicate Check (Email OR Address+Name)
            if (email) {
                const { rows: emailRows } = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
                if (emailRows.length > 0) return NextResponse.json({ error: "אימייל זה כבר רשום במערכת" }, { status: 400 });
            }

            const { rows: addressRows } = await sql`
                SELECT id FROM users WHERE name = ${fullName} AND address = ${address} LIMIT 1
            `;
            if (addressRows.length > 0) {
                return NextResponse.json({ error: "משתמש עם שם וכתובת זהים כבר רשום" }, { status: 400 });
            }

            try {
                // Attempt the insert first
                await sql`
                INSERT INTO users (name, phone, email, city, zip, address, ip_address)
                VALUES (${fullName}, ${phone}, ${email}, ${city}, ${zip}, ${address}, ${ip})
            `;
            } catch (dbError: any) {
                console.error("Database Error, attempting auto-fix:", dbError);

                // If table or column is missing, create it and retry
                if (
                    dbError.message?.includes('relation "users" does not exist') ||
                    dbError.message?.includes('column "ip_address" of relation "users" does not exist')
                ) {
                    console.log("Fixing database schema...");
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

                    // If it was just the column missing from an existing table
                    if (dbError.message?.includes('column "ip_address"')) {
                        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS ip_address TEXT;`;
                    }

                    // Retry the insert
                    await sql`
                    INSERT INTO users (name, phone, email, city, zip, address, ip_address)
                    VALUES (${fullName}, ${phone}, ${email}, ${city}, ${zip}, ${address}, ${ip})
                `;
                } else {
                    if (process.env.NODE_ENV === 'development') {
                        return NextResponse.json({ success: true }, { status: 200 });
                    }
                    throw dbError;
                }
            }

            return NextResponse.json({ success: true }, { status: 200 });
        } catch (error) {
            console.error("Submission error:", error);
            return NextResponse.json(
                { error: "Internal server error" },
                { status: 500 }
            );
        }
    }
