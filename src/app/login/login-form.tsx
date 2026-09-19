"use client";
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';
import {Logo} from '@/components/logo';
import type {ClubConfig} from '@/lib/runtime/config';
export function LoginForm({club,mode,personas,nextPath}:{club:ClubConfig;mode:'demo'|'production';personas:{id:string;display_name:string;role:string}[];nextPath:string}){
 const [memberId,setMemberId]=useState(personas[0]?.id??''),[email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [error,setError]=useState(''),[loading,setLoading]=useState(false),router=useRouter();
 async function submit(e:React.FormEvent){
  e.preventDefault();setError('');setLoading(true);
  try{
   const res=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(mode==='demo'?{memberId}:{email,password})});
   const data=await res.json();if(!res.ok){setError(data.error??'Sign-in failed.');return;}
   router.push(nextPath);router.refresh();
  }catch{setError('Could not reach the club. Check that its terminal is still running.');}finally{setLoading(false);}
 }
 return <div className="min-h-screen flex items-center justify-center px-4 py-10"><div className="w-full max-w-md">
  <div className="text-center mb-10"><div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber/10 border border-amber/20 mb-6"><Logo className="w-9 h-9 text-amber"/></div>
   <h1 className="font-heading text-4xl font-bold text-foreground mb-2">{club.name}</h1><p className="text-secondary text-lg">{club.tagline}</p><p className="text-muted text-sm mt-1">Est. {club.foundedYear}</p>
  </div>
  <form onSubmit={submit} className="space-y-4">
   {mode==='demo'?<><div className="rounded-lg border border-amber/30 bg-amber/10 p-4 text-sm text-secondary"><strong className="text-amber">An invented club, on your computer.</strong><p className="mt-1">Choose a reader to explore. Organizers can manage ballots and members. Your edits survive a restart.</p></div>
    <label className="block text-sm text-secondary">Explore as<select className="mt-2 w-full h-12 rounded-lg border border-border bg-card px-3 text-foreground" value={memberId} onChange={e=>setMemberId(e.target.value)}>{personas.map(p=><option key={p.id} value={p.id}>{p.display_name}{p.role==='admin'?' (organizer)':''}</option>)}</select></label>
   </>:<><label className="block text-sm text-secondary">Email<Input className="mt-2 h-12" type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/></label>
    <label className="block text-sm text-secondary">Password<Input className="mt-2 h-12" type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label></>}
   {error&&<p role="alert" className="text-sm text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2">{error}</p>}
   <Button type="submit" size="lg" className="w-full" disabled={loading}>{loading?'Opening the door…':mode==='demo'?'Explore the club':'Sign in'}</Button>
  </form><p className="text-center text-muted text-xs mt-8">{mode==='demo'?'No account or provider connection is used in this demo.':'Use the account your organizer linked to your membership.'}</p>
 </div></div>;
}
