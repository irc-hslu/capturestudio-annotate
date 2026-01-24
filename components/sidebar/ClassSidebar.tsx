"use client";

import { useState } from "react";
import { useClasses } from "@/store/useClasses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ClassColorSwatch } from "./ClassColorSwatch";
import { Trash2, Plus, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function ClassSidebar() {
    const { classes, activeClassId, addClass, setActiveClass } = useClasses();
    const [newName, setNewName] = useState("");

    return (
        <div className="h-full flex flex-col gap-3 p-3">
            <div className="px-1">
                <h3 className="text-sm font-semibold">Classes</h3>
                <p className="text-xs text-muted-foreground">Add or pick a class to annotate</p>
            </div>

            <div className="flex gap-2 px-1">
                <Input
                    placeholder="New class name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && newName.trim()) {
                            addClass(newName.trim());
                            setNewName("");
                        }
                    }}
                />
                <Button
                    variant="default"
                    onClick={() => {
                        if (!newName.trim()) return;
                        addClass(newName.trim());
                        setNewName("");
                    }}
                >
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                </Button>
            </div>

            <Separator />

            <ScrollArea className="flex-1">
                <div className="flex flex-col gap-2 pr-2">
                    {classes.map((c) => {
                        const active = c.id === activeClassId;
                        return (
                            <div
                                key={c.id}
                                className={cn(
                                    "group flex items-center justify-between rounded-lg border p-2 cursor-pointer hover:bg-accent",
                                    active && "ring-2 ring-primary"
                                )}
                                onClick={() => setActiveClass(c.id)}
                            >
                                <div className="flex items-center gap-2">
                                    <ClassColorSwatch color={c.color} />
                                    <div>
                                        <div className="text-sm font-medium">{c.name}</div>
                                        <div className="text-[10px] text-muted-foreground">id: {c.id}</div>
                                    </div>
                                </div>
                                {active ? (
                                    <CheckCircle2 className="w-4 h-4 text-primary" />
                                ) : (
                                    <Trash2 className="w-4 h-4 opacity-0 group-hover:opacity-100" />
                                )}
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>
        </div>
    );
}