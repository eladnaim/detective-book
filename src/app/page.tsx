import Image from "next/image";
import { RegistrationForm } from "@/components/RegistrationForm";

export default function Home() {
    return (
        <main className="min-h-screen bg-black text-white selection:bg-white selection:text-black">
            <div className="container mx-auto px-4 py-12 md:py-20 max-w-6xl">
                <div className="flex flex-col md:flex-row items-center gap-12 md:gap-20">
                    {/* Image Section */}
                    <div className="w-full md:w-1/2 flex justify-center md:justify-end order-1 md:order-2">
                        <div className="relative w-[300px] h-[450px] md:w-[400px] md:h-[600px] shadow-[0_0_50px_rgba(255,255,255,0.1)] rounded-lg overflow-hidden transform md:rotate-3 transition-transform hover:rotate-0 duration-500">
                            <Image
                                src="/book-cover.png"
                                alt="כריכת הספר חוקר פרטי קואנטין"
                                fill
                                className="object-cover"
                                priority
                            />
                        </div>
                    </div>

                    {/* Content Section */}
                    <div className="w-full md:w-1/2 space-y-8 order-2 md:order-1 text-center md:text-right">
                        <div className="space-y-4">
                            <div className="inline-block bg-white/10 px-3 py-1 rounded-full text-sm font-medium border border-white/20 backdrop-blur-sm">
                                🎉 חוגגים 300,000 עוקבים בטיקטוק
                            </div>
                            <h1 className="text-4xl md:text-6xl font-black leading-tight tracking-tight">
                                חוקר פרטי
                                <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-l from-white to-neutral-500">
                                    קואנטין
                                </span>
                            </h1>
                            <p className="text-xl text-neutral-400 max-w-lg mx-auto md:mx-0 leading-relaxed">
                                לרגל ההגעה ליעד המטורף, החלטתי להעניק לכם את ספרי החדש
                                <span className="font-bold text-white mx-1">במתנה לגמרי!</span>
                                כל מה שצריך לעשות הוא למלא את הפרטים, והספר יישלח אליכם הביתה.
                            </p>
                        </div>

                        <div className="bg-neutral-950/50 p-6 rounded-2xl border border-neutral-900">
                            <RegistrationForm />
                        </div>

                        <div className="text-sm text-neutral-600">
                            מהדורה מוגבלת. כל הקודם זוכה.
                        </div>
                    </div>
                </div>
            </div>

            {/* Background Ambience */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-[-1] overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[100px]" />
            </div>
        </main>
    );
}
