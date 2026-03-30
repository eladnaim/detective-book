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

        // Duplicate Check (Firebase only)
        const usersRef = collection(db, "quentin_subscribers");
        const qPhone = query(usersRef, where("phone", "==", phone));
        const snapPhone = await getDocs(qPhone);
        if (!snapPhone.empty) {
            return NextResponse.json({ error: "מספר טלפון זה כבר רשום" }, { status: 409 });
        }

        // Save to Firebase
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

        return NextResponse.json({ success: true }, { status: 200 });

    } catch (error) {
        console.error("Submit Error:", error);
        return NextResponse.json({ error: "שגיאת מערכת" }, { status: 500 });
    }
}
