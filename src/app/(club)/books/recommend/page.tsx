import {requireUser} from '@/lib/session';
import {runtimeConfig} from '@/lib/runtime/config';
import BookRecommend from './book-recommend';
export default async function Page(){await requireUser();const config=runtimeConfig();return <BookRecommend aiEnabled={config.aiEnabled} demo={config.mode==='demo'}/>;}
