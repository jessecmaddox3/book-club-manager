import {getRepository} from '@/lib/store';
import {runtimeConfig} from '@/lib/runtime/config';
import BookSubmit from './book-submit';
export default async function Page(){
 const nominations=await(await getRepository()).myPendingNominations();
 return <><BookSubmit aiEnabled={runtimeConfig().aiEnabled}/><section className="mt-10 border-t border-border pt-8" aria-labelledby="your-queue">
  <h2 id="your-queue" className="font-heading text-2xl font-bold">Your pending nominations</h2>
  <p className="mt-2 text-sm text-secondary">Your suggestions stay here until the organizer completes their ballot. Other readers cannot see your pending list.</p>
  {nominations.length?<ul className="mt-4 space-y-3">{nominations.map(n=><li key={n.id} className="rounded-xl border border-border bg-card p-4">
   <p className="font-semibold">{n.title}</p><p className="text-sm text-secondary">{n.author}</p>
   <p className="mt-2 text-xs text-amber">{n.status==='on_ballot'?`On the ballot${n.meetingNumber?` for meeting ${n.meetingNumber}`:''}`:'Waiting for a ballot'}</p>
   {n.notes&&<p className="mt-2 whitespace-pre-wrap text-sm text-secondary">{n.notes}</p>}
  </li>)}</ul>:<p className="mt-4 text-sm text-muted">No pending nominations yet. Add a book above whenever you find something worth sharing.</p>}
 </section></>;
}
