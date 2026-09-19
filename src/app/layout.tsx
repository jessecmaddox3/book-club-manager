import type {Metadata} from 'next';
import './globals.css';
import {Toaster} from 'sonner';
export const metadata:Metadata={title:'Book Club Manager',description:'A reading group workspace. Built for personal use, ready to make your own.',robots:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="en"><body className="antialiased">{children}<Toaster theme="dark" toastOptions={{style:{background:'var(--color-card)',border:'1px solid var(--color-border)',color:'var(--color-foreground)'}}}/></body></html>;
}
