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

            // 3. Insert with IP
            await sql`
                INSERT INTO users (name, phone, email, city, zip, address, ip_address)
                VALUES (${fullName}, ${phone}, ${email}, ${city}, ${zip}, ${address}, ${ip})
            `;

        } catch (dbError: any) {
            console.error("Database Error:", dbError);

            // Helpful error if column is missing (User hasn't run the SQL yet)
            if (dbError.message?.includes('column "ip_address" of relation "users" does not exist')) {
                return NextResponse.json({ error: "System Update Required: Missing Database Column" }, { status: 500 });
            }

            if (process.env.NODE_ENV === 'development') {
                console.log("Mocking successful submission for Dev (DB Error ignored)");
                return NextResponse.json({ success: true }, { status: 200 });
            }
            return NextResponse.json({ error: "Database error" }, { status: 500 });
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
