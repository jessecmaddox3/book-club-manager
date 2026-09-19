import {z} from 'zod';
import {isCalendarDate} from '../ballots/dates';
const inputSchema=z.object({instanceId:z.uuid(),meetingId:z.uuid(),revision:z.number().int().positive(),title:z.string().max(1000),description:z.string().max(20000),location:z.string().max(500),date:z.string().refine(isCalendarDate),time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),timeZone:z.string(),minutes:z.number().int().min(15).max(1440),url:z.url()});
type CalendarInput=z.infer<typeof inputSchema>;
function timestamp(y:number,m:number,d:number,h:number,minute:number,second=0){const result=new Date(0);result.setUTCFullYear(y,m-1,d);result.setUTCHours(h,minute,second,0);return result.getTime();}
export function meetingInstant(date:string,time:string,timeZone:string):Date{
 if(!isCalendarDate(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw new Error('Use a calendar date and a 24-hour meeting time.');
 const formatter=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 const parts=(value:number)=>Object.fromEntries(formatter.formatToParts(value).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
 const [year,month,day]=date.split('-').map(Number),[hour,minute]=time.split(':').map(Number),naive=timestamp(year,month,day,hour,minute),offsets=new Set<number>();
 for(let hours=-48;hours<=48;hours+=6){const instant=naive+hours*3600000,p=parts(instant);offsets.add(timestamp(p.year,p.month,p.day,p.hour,p.minute,p.second)-instant);}
 const matches=[...offsets].map(offset=>naive-offset).filter(instant=>{const p=parts(instant);return p.year===year&&p.month===month&&p.day===day&&p.hour===hour&&p.minute===minute;});
 if(!matches.length)throw new Error('This meeting time does not exist because the clocks change. Choose a different time.');
 if(matches.length!==1)throw new Error('This meeting time is ambiguous because the clocks change. Choose a time outside the repeated hour.');
 return new Date(matches[0]);
}
const escape=(text:string)=>text.replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
function fold(line:string){let output='',current='',bytes=0;for(const char of line){const size=Buffer.byteLength(char);if(bytes+size>75){output+=current+'\r\n';current=' ';bytes=1;}current+=char;bytes+=size;}return output+current;}
const utc=(date:Date)=>date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
export function calendarFile(value:CalendarInput,now=new Date()):string{
 const input=inputSchema.parse(value),url=new URL(input.url);
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('The meeting link must be an HTTP(S) URL without credentials.');
 const start=meetingInstant(input.date,input.time,input.timeZone),end=new Date(start.getTime()+input.minutes*60000);
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Book Club Manager//Meeting Export//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',
  `UID:${input.instanceId}.${input.meetingId}@book-club-manager.invalid`,`DTSTAMP:${utc(now)}`,`SEQUENCE:${input.revision}`,`DTSTART:${utc(start)}`,`DTEND:${utc(end)}`,
  `SUMMARY:${escape(input.title)}`,`DESCRIPTION:${escape(input.description)}`,`LOCATION:${escape(input.location)}`,`URL:${escape(url.href)}`,'END:VEVENT','END:VCALENDAR'].map(fold).join('\r\n')+'\r\n';
}
