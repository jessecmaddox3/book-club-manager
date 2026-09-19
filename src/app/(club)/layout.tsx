import {requireUser} from '@/lib/session';
import {getRuntime} from '@/lib/runtime/context';
import {getShell} from '@/lib/store/shell';
import {Nav} from '@/components/nav';
import {ActorProvider} from '@/components/actor-context';
export const dynamic='force-dynamic';

export default async function ClubLayout({children}:{children:React.ReactNode}){
 const user=await requireUser(),runtime=await getRuntime();
 const shell=await getShell(runtime.db,user);
 return <ActorProvider key={user.memberId} actorId={user.memberId}><div className="flex min-h-screen">
  <Nav user={{displayName:user.displayName,role:user.role}} clubName={runtime.club.name}
   surveyOpen={!!shell.openBallot} hasVotedOpenBallot={shell.hasVoted}/>
  <main className="flex-1 min-w-0 lg:ml-64 pt-14 lg:pt-0"><div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-8">
   {runtime.config.mode==='demo'&&<div className="mb-6 rounded-lg border border-amber/30 bg-amber/10 px-4 py-3 text-sm text-secondary"><strong className="text-amber">Local demo.</strong> Everything here is invented. Edits stay on this computer. Example calendar: {runtime.club.demoDate??'2035-04-01'}. <a href="/login" className="underline">Switch reader</a></div>}
   {children}
  </div></main>
 </div></ActorProvider>;
}
