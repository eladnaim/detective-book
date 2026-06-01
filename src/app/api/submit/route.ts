import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, getDocs } from "firebase/firestore";

// Simple Rate Limiting
const rateLimitMap = new Map<string, { count: number, lastReset: number }>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000;
const MAX_REQUESTS = 5;

export async function POST(request: Request) {
    try {
        const headersList = await headers();
        const ip = headersList.get("x-forwarded-for")?.split(',')[0] || "unknown";
        const now = Date.now();
        const userLimit = rateLimitMap.get(ip) || { count: 0, lastReset: now };

        if (now - userLimit.lastReset > RATE_LIMIT_WINDOW) {
            userLimit.count = 0;
            userLimit.lastReset = now;
        }
        if (userLimit.count >= MAX_REQUESTS) {
            return NextResponse.json({ error: "חורג ממכסת הרישומים לשעה זו." }, { status: 429 });
        }
        userLimit.count++;
        rateLimitMap.set(ip, userLimit);

        const body = await request.json();
        const { fullName, phone: rawPhone, email: rawEmail, city, address, zip } = body;
        const phone = String(rawPhone || "").replace(/\D/g, "");
        const email = String(rawEmail || "").trim().toLowerCase();

        if (!fullName || !phone || !city || !address) {
            return NextResponse.json({ error: "חסרים שדות חובה" }, { status: 400 });
        }

        const usersRef = collection(db, "quentin_subscribers");

        // Duplicate Check (Firestore)
        try {
            const qPhone = query(usersRef, where("phone", "==", phone));
            const snapPhone = await getDocs(qPhone);
            if (!snapPhone.empty) {
                return NextResponse.json({ error: "מספר טלפון זה כבר רשום" }, { status: 409 });
            }
        } catch (dbError) {
            console.error("DB Check Error:", dbError);
        }

        // Save to Firestore
        try {
            await addDoc(usersRef, {
                name: fullName,
                phone,
                email: email || "",
                city,
                zip: zip || "",
                address,
                ip_address: ip,
                created_at: new Date().toISOString()
            });
        } catch (dbError: any) {
            console.error("DB Insert Error:", dbError);
            return NextResponse.json({ error: "שגיאת שמירה במסד נתונים" }, { status: 500 });
        }

        return NextResponse.json({ success: true }, { status: 200 });

    } catch (error) {
        console.error("Submit Error:", error);
        return NextResponse.json({ error: "שגיאת מערכת" }, { status: 500 });
    }
}
