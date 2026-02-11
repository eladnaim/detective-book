import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

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
            const stringId = String(id);

            if (stringId.startsWith('pg-')) {
                // Postgres Update
                const realId = stringId.replace('pg-', '');
                await sql`
                    UPDATE users 
                    SET name = ${name}, 
                        phone = ${phone}, 
                        email = ${email}, 
                        city = ${city}, 
                        address = ${address}, 
                        zip = ${zip}
                    WHERE id = ${realId}
                `;
            } else {
                // Firebase Update
                const userRef = doc(db, "quentin_subscribers", stringId);
                await updateDoc(userRef, {
                    name,
                    phone,
                    email: email || "",
                    city,
                    address,
                    zip: zip || ""
                });
            }

            return NextResponse.json({ success: true }, { status: 200 });
        } catch (dbError) {
            console.error("Database Update Error:", dbError);
            return NextResponse.json({ error: "Database update failed" }, { status: 500 });
        }

    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
