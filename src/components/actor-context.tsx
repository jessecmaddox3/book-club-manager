'use client';
import {createContext,useContext} from 'react';
const ActorContext=createContext<string|null>(null);
export function ActorProvider({actorId,children}:{actorId:string;children:React.ReactNode}){return <ActorContext.Provider value={actorId}>{children}</ActorContext.Provider>;}
export function useActorId(){const id=useContext(ActorContext);if(!id)throw new Error('Open this form from a signed-in club page.');return id;}
