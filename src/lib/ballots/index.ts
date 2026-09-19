import {cache} from 'react';
import {requireUser} from '../session';
import {getRuntime} from '../runtime/context';
import {BallotRepository} from '../store/ballots';
import type {BallotView} from './types';
export type {BallotView,BallotBookView} from './types';
export async function getBallotRepository(){const actor=await requireUser();return new BallotRepository((await getRuntime()).db,actor);}
export const getActiveBallot=cache(async()=> (await getBallotRepository()).current());
export function toActiveBallot(ballot:BallotView){return {id:ballot.id,surveyId:ballot.surveyId,revision:ballot.revision,status:ballot.status,bookIds:ballot.books.map(b=>b.id),dateIds:ballot.dateOptions.map(d=>d.id)};}
