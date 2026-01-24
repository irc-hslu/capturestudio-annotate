'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function HomePage() {
    const router = useRouter();
    const [sessionPath, setSessionPath] = useState('');
    const [loading, setLoading] = useState(false);

    const openSession = async () => {
        if (!sessionPath) {
            toast.error('Enter a session path.');
            return;
        }
        setLoading(true);
        try {
            // Validate the session on the backend first
            const res = await fetch('/api/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionPath }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error ?? 'Failed to open session');

            toast.success('Session opened.');
            router.push(`/annotate?session=${encodeURIComponent(sessionPath)}`);
        } catch (e: any) {
            toast.error(String(e?.message ?? e));
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
            <Card className="w-full max-w-3xl">
                <CardHeader>
                    <CardTitle>Annotate Session</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <form
                        className="flex gap-3"
                        onSubmit={(e) => {
                            e.preventDefault();
                            void openSession();
                        }}
                    >
                        <Input
                            value={sessionPath}
                            onChange={(e) => setSessionPath(e.target.value)}
                            placeholder="/path/to/session"
                        />
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Opening...' : 'Open Session'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </main>
    );
}