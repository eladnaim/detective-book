import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function POST(request: Request) {
    try {
        const { password } = await request.json();
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminPassword || password !== adminPassword) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Fetch users
        try {
            const { rows } = await sql`SELECT * FROM users ORDER BY created_at DESC`;
            return NextResponse.json({ users: rows }, { status: 200 });
        } catch (dbError) {
            // Fallback for dev/no-db
            console.error("Database Error:", dbError);
            if (process.env.NODE_ENV === 'development') {
                return NextResponse.json({
                    users: [
                        { id: 1, name: "דוגמה ישראל", phone: "050-0000000", email: "test@test.com", city: "תל אביב", address: "הרצל 1", zip: "123456", created_at: new Date().toISOString() }
                    ]
                }, { status: 200 });
            }
            return NextResponse.json({ error: "Database error" }, { status: 500 });
        }

    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
