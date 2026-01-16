import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { password, id } = body;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminPassword || password !== adminPassword) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!id) {
            return NextResponse.json({ error: "Missing ID" }, { status: 400 });
        }

        try {
            await sql`DELETE FROM users WHERE id = ${id}`;
            return NextResponse.json({ success: true }, { status: 200 });
        } catch (dbError) {
            console.error("Database Delete Error:", dbError);
            // Dev fallback
            if (process.env.NODE_ENV === 'development') {
                return NextResponse.json({ success: true }, { status: 200 });
            }
            return NextResponse.json({ error: "Database delete failed" }, { status: 500 });
        }

    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
