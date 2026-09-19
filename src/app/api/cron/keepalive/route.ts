import {NextResponse} from 'next/server';
import {timingSafeEqual} from 'node:crypto';
import {runtimeConfig} from '@/lib/runtime/config';
import {getRuntime} from '@/lib/runtime/context';
export async function GET(request:Request){
 const config=runtimeConfig(),secret=process.env.CRON_SECRET;
 if(config.mode!=='production'||!secret)return new NextResponse(null,{status:404});
 const actual=Buffer.from(request.headers.get('authorization')??''),expected=Buffer.from('Bearer '+secret);
 if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return new NextResponse(null,{status:401});
 try{await(await getRuntime()).db.query('SELECT 1');return NextResponse.json({ok:true});}
 catch{return NextResponse.json({ok:false},{status:503});}
}
