import './globals.css';

export const metadata = {
    title: 'HSLU Capturestudio Annotator',
    description: 'Annotate multiview frames from HSLU Capturestudio',
};

export default function RootLayout({children}: { children: React.ReactNode }) {
    return (
        <html lang="en">
        <body className="min-h-screen">{children}</body>
        </html>
    );
}