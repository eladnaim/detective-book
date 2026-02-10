import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

export async function POST(request: Request) {
    try {
        const { password } = await request.json();
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminPassword || password !== adminPassword) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const allUsers: any[] = [];
        const userIds = new Set();

        // 1. Fetch from Firebase
        try {
            const q = query(collection(db, "quentin_subscribers"), orderBy("created_at", "desc"));
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const user = { id: doc.id, ...data };
                allUsers.push(user);
                // Track phone+name to avoid visible duplicates if both DBs work
                userIds.add(`${data.phone}-${data.name}`);
            });
        } catch (fbError) {
            console.error("Firebase Admin Fetch Error:", fbError);
        }

        // 2. Fetch from Postgres
        try {
            const { rows } = await sql`SELECT * FROM users ORDER BY created_at DESC`;
            rows.forEach(row => {
                if (!userIds.has(`${row.phone}-${row.name}`)) {
                    allUsers.push({
                        ...row,
                        id: `pg-${row.id}`
                    });
                }
            });
        } catch (dbError: any) {
            console.error("Postgres Admin Fetch Error:", dbError);
        }

        return NextResponse.json({ users: allUsers }, { status: 200 });

    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
