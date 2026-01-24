import { redirect } from 'next/navigation';

export default function Page() {
    const session = process.env.NEXT_PUBLIC_SESSION_PATH;
    if (session && session.length > 0) {
        redirect(`/annotate?session=${encodeURIComponent(session)}`);
    }
    redirect('/annotate');
}