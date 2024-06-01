

import Link from "next/link";
import { Button } from "@/components/ui/button"

const Page = function Records() {
    return (
        <main className="custom-min-h-dvh flex flex-col items-center justify-center">
            <div className="text-4xl relative z-[-1] flex place-items-center mb-6">
                Record
            </div>
            
            <Link href="/">
                <Button>
                    Cancel
                </Button>
            </Link>
        </main>
    );
};

export default Page
