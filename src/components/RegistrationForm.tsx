"use client";

import { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

export function RegistrationForm() {
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState("");

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsLoading(true);
        setError("");

        const formData = new FormData(event.currentTarget);
        const data = Object.fromEntries(formData);

        try {
            const response = await fetch("/api/submit", {
                method: "POST",
                body: JSON.stringify(data),
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                throw new Error("שגיאה בשליחת הטופס, אנא נסו שנית");
            }

            setIsSuccess(true);
        } catch (err) {
            setError("אירעה שגיאה, אנא נסו שוב מאוחר יותר");
        } finally {
            setIsLoading(false);
        }
    }

    if (isSuccess) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-neutral-900 border border-neutral-800 rounded-xl p-8 text-center space-y-4"
            >
                <div className="flex justify-center">
                    <CheckCircle2 className="w-16 h-16 text-green-500" />
                </div>
                <h3 className="text-2xl font-bold text-white">תודה שנרשמתם!</h3>
                <p className="text-neutral-400">
                    הפרטים נקלטו בהצלחה. הספר יישלח אליכם בהקדם.
                </p>
            </motion.div>
        );
    }

    return (
        <form onSubmit={onSubmit} className="space-y-4 w-full max-w-md mx-auto">
            <div className="space-y-4">
                <div>
                    <label htmlFor="fullName" className="block text-sm font-medium text-neutral-300 mb-1">
                        שם מלא
                    </label>
                    <input
                        id="fullName"
                        name="fullName"
                        type="text"
                        required
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/20 transition-all placeholder:text-neutral-600"
                        placeholder="ישראל ישראלי"
                    />
                </div>

                <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-neutral-300 mb-1">
                        טלפון נייד
                    </label>
                    <input
                        id="phone"
                        name="phone"
                        type="tel"
                        required
                        pattern="[0-9-]*"
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/20 transition-all placeholder:text-neutral-600"
                        placeholder="050-0000000"
                    />
                </div>

                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-neutral-300 mb-1">
                        כתובת אימייל (אופציונלי)
                    </label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/20 transition-all placeholder:text-neutral-600"
                        placeholder="example@email.com"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="city" className="block text-sm font-medium text-neutral-300 mb-1">
                            עיר
                        </label>
                        <input
                            id="city"
                            name="city"
                            type="text"
                            required
                            className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/20 transition-all placeholder:text-neutral-600"
                            placeholder="תל אביב"
                        />
                    </div>
                    <div>
                        <label htmlFor="zip" className="block text-sm font-medium text-neutral-300 mb-1">
                            מיקוד (אופציונלי)
                        </label>
                        <input
                            id="zip"
                            name="zip"
                            type="text"
                            className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/20 transition-all placeholder:text-neutral-600"
                            placeholder="7575757"
                        />
                    </div>
                </div>

                <div>
                    <label htmlFor="address" className="block text-sm font-medium text-neutral-300 mb-1">
                        כתובת ומספר בית
                    </label>
                    <input
                        id="address"
                        name="address"
                        type="text"
                        required
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/20 transition-all placeholder:text-neutral-600"
                        placeholder="רחוב הרצל 1, דירה 5"
                    />
                </div>
            </div>

            {error && (
                <p className="text-red-400 text-sm bg-red-900/20 p-2 rounded-md border border-red-900/50">
                    {error}
                </p>
            )}

            <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-white text-black font-bold py-3 px-4 rounded-md hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 mt-6"
            >
                {isLoading ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        שולח...
                    </>
                ) : (
                    "שמרו לי עותק!"
                )}
            </button>

            <p className="text-xs text-neutral-500 text-center mt-4">
                * הפרטים ישמשו אותנו למשלוח הספר בלבד.
            </p>
        </form>
    );
}
