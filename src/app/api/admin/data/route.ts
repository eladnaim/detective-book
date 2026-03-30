import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

// Global timeout helper (Strict 5 seconds for admin)
const withTimeout = (promise: Promise<any>, timeoutMs: number = 5000) => {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeoutMs))
    ]);
};

export async function POST(request: Request) {
    try {
        const { password } = await request.json();
        const adminPassword = "07121979"; // Hardcoded for reliability on Netlify

        if (password !== adminPassword) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // ONLY Firebase for Netlify persistence
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

    } catch (error) {
        console.error("Admin Fetch Critical Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
