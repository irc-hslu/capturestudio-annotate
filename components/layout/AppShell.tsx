"use client";

import { ReactNode, useState } from "react";
import { Header } from "./Header";
import { PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppShell({
                             sidebar,
                             children,
                             footer,
                             headerRight,
                         }: {
    sidebar: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
    headerRight?: ReactNode;
}) {
    const [open, setOpen] = useState(true);

    return (
        <div className="h-screen w-screen grid grid-rows-[auto,1fr,auto]">
            <Header right={headerRight} leftControl={
                <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)} title="Toggle sidebar">
                    <PanelLeft className="w-5 h-5" />
                </Button>
            }/>
            <div className="grid grid-cols-[auto,1fr] overflow-hidden">
                {open ? (
                    <aside className="w-[280px] border-r bg-background overflow-y-auto">{sidebar}</aside>
                ) : (
                    <aside className="w-0" />
                )}
                <main className="overflow-y-auto p-4">{children}</main>
            </div>
            <footer className="border-t bg-muted/40">
                {footer}
            </footer>
        </div>
    );
}