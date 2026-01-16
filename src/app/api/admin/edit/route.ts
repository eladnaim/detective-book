import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        // Validate admin password
        const { password, id, name, phone, email, city, address, zip } = body;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminPassword || password !== adminPassword) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!id) {
            return NextResponse.json({ error: "Missing ID" }, { status: 400 });
        }

        try {
            await sql`
        UPDATE users 
        SET name = ${name}, 
            phone = ${phone}, 
            email = ${email}, 
            city = ${city}, 
            address = ${address}, 
            zip = ${zip}
        WHERE id = ${id}
        `;

            return NextResponse.json({ success: true }, { status: 200 });
        } catch (dbError) {
            console.error("Database Update Error:", dbError);
            // Dev fallback
            if (process.env.NODE_ENV === 'development') {
                return NextResponse.json({ success: true }, { status: 200 });
            }
            return NextResponse.json({ error: "Database update failed" }, { status: 500 });
        }

    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
