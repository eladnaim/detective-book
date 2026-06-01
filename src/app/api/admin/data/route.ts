import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function POST(request: Request) {
    try {
        const { password } = await request.json();
        const adminPassword = "07121979"; // Hardcoded admin password

        if (password !== adminPassword) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Fetch users from Vercel Postgres
        try {
            const { rows } = await sql`SELECT * FROM users ORDER BY created_at DESC`;
            return NextResponse.json({
                users: rows,
                counts: {
                    postgres: rows.length,
                    firebase: 0,
                    total_unique: rows.length
                }
            }, { status: 200 });
        } catch (dbError: any) {
            console.error("Database Error:", dbError);
            return NextResponse.json({ error: "Database error" }, { status: 500 });
        }

    } catch (error) {
        console.error("Admin Fetch Critical Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
