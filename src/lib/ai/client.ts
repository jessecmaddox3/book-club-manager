import Anthropic from '@anthropic-ai/sdk';
import {runtimeConfig} from '../runtime/config';
import {ApiError} from '../api';
export function getAnthropic(){
 if(!runtimeConfig().aiEnabled)throw new ApiError('AI suggestions are off. You can enter a book manually.',503);
 if(!process.env.ANTHROPIC_API_KEY||!process.env.BOOKCLUB_AI_MODEL)throw new ApiError('The organizer has not finished optional AI setup.',503);
 return new Anthropic({apiKey:process.env.ANTHROPIC_API_KEY});
}
