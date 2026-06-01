import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

export async function POST(request: Request) {
    try {
        const { password } = await request.json();
        const adminPassword = "07121979"; // Hardcoded admin password

        if (password !== adminPassword) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Fetch users from Firestore
        try {
            const q = query(collection(db, "quentin_subscribers"), orderBy("created_at", "desc"));
            const querySnapshot = await getDocs(q);
            const users = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                _source: 'firebase',
                _sources: ['firebase'],
                delivered: !!(doc.data() as any).delivered
            }));
            
            return NextResponse.json({
                users: users,
                counts: {
                    firebase: users.length,
                    postgres: 0,
                    total_unique: users.length
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
