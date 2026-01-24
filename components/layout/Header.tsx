"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePathname, useRouter } from "next/navigation";

export function Header() {
    const router = useRouter();
    const pathname = usePathname();
    const current = pathname?.startsWith("/annotate") ? "annotate" : "home";
    return (
        <div className="border-b bg-background">
            <div className="h-12 max-w-7xl mx-auto flex items-center justify-between px-4">
                <div className="font-semibold">Multicam Annotator</div>
                <Tabs
                    value={current}
                    onValueChange={(v) => {
                        router.push(v === "annotate" ? "/annotate" : "/");
                    }}
                >
                    <TabsList>
                        <TabsTrigger value="home">Home</TabsTrigger>
                        <TabsTrigger value="annotate">Annotate</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>
        </div>
    );
}