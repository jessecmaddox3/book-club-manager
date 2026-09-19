import {requireUser} from '../session';
import {getRuntime} from '../runtime/context';
import {ReadRepository} from './reads';

export async function getRepository(){const actor=await requireUser();return new ReadRepository((await getRuntime()).db,actor);}
