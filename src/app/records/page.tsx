

import Link from "next/link";
import { Button } from "@/components/ui/button"

export default function Home() {
    return (
        <main className="flex min-h-dvh flex-col items-center justify-center">
        <div className="text-4xl relative z-[-1] flex place-items-center mb-6">
            $ Bookkeeping
        </div>
        <Link href="/record">
            <Button>
                Add Record
            </Button>
        </Link>
        </main>
    );
}
