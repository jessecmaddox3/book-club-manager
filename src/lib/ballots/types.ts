import type {Week,DateOptionView} from './dates';
export type BallotBookView={id:string;bookId:string;title:string;subtitle:string|null;author:string;coverImage:string|null;goodreadsRating:number|null;pages:number|null;audiobookLength:string|null;description:string;whyLike:string;whyNot:string};
export type PreviousBook={meetingId:string;bookId:string;title:string;author:string;verdict:{status:'read'|'did_not_read'|'did_not_attend'|'unrated';rating:number|null;revision:number}};
export type SurveyResponseView={revision:number;ratings:Record<string,number>;datePreferences:Record<string,string>;willingToHost:boolean;willingToBringBourbon:boolean};
export type BallotView={source:'db';id:string;surveyId:string;meetingNumber:number;status:'draft'|'open'|'closed';revision:number;responsesRevision:number;books:BallotBookView[];dateOptions:DateOptionView[];weeks:Week[];previousBook:PreviousBook|null;existingResponse:SurveyResponseView|null};
