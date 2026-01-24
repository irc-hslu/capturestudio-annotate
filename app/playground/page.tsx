'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function ApiLandingPage() {
    const [sessionPath, setSessionPath] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const openSession = async () => {
        if (!sessionPath) {
            toast.error('Enter a session path.');
            return;
        }
        setLoading(true);
        try {
            const res = await fetch('/api/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionPath }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error ?? 'Failed');
            setResult(data);
            toast.success('Session opened.');
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
                    <CardTitle>API Playground — Open Session</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-3">
                        <Input
                            value={sessionPath}
                            onChange={(e) => setSessionPath(e.target.value)}
                            placeholder="/path/to/session"
                        />
                        <Button onClick={openSession} disabled={loading}>
                            {loading ? 'Opening...' : 'Open Session'}
                        </Button>
                    </div>
                    {result && (
                        <pre className="text-sm bg-muted p-3 rounded-lg overflow-auto max-h-[50vh]">
              {JSON.stringify(result, null, 2)}
            </pre>
                    )}
                </CardContent>
            </Card>
        </main>
    );
}