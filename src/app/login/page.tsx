import {runtimeConfig,loadClubConfig,safeRedirect} from '@/lib/runtime/config';
import {getRuntime} from '@/lib/runtime/context';
import {LoginForm} from './login-form';
export const dynamic='force-dynamic';
export default async function LoginPage({searchParams}:{searchParams:Promise<{redirect?:string}>}){
 const config=runtimeConfig(),club=await loadClubConfig();
 const personas=config.mode==='demo'?await(await getRuntime()).db.query<{id:string;display_name:string;role:string}>("SELECT id,display_name,role FROM members WHERE role<>'former' ORDER BY CASE WHEN role='admin' THEN 0 ELSE 1 END,display_name,id"):[];
 return <LoginForm club={club} mode={config.mode} personas={personas} nextPath={safeRedirect((await searchParams).redirect)}/>;
}
