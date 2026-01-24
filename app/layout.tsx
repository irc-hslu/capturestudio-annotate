import './globals.css';

export const metadata = {
    title: 'Multicam Annotator',
    description: 'Annotate multicam frames',
};

export default function RootLayout({children}: { children: React.ReactNode }) {
    return (
        <html lang="en">
        <body className="min-h-screen">{children}</body>
        </html>
    );
}