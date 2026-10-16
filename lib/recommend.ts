import type {Song} from './music';
import {songKey} from './music';

export type RatingSignal={owner:string;song:string;value:number};
export type RecommendationContext={userId:string;songs:Song[];ratings:RatingSignal[];mine?:Song[]};
type Opinion={value:number;song:Song};
type Profile=Map<string,Opinion>;

const sentiment=(value:number)=>value===3?1:value===0?-1:0;
const clamp=(value:number,min=-1,max=1)=>Math.max(min,Math.min(max,value));
const overlap=(left:Song,right:Song)=>{
 if(!left.tags.length||!right.tags.length)return .35;
 const common=left.tags.filter(tag=>right.tags.includes(tag)).length;
 return common? .25+.75*common/new Set([...left.tags,...right.tags]).size:0;
};

function profilesFor(context:RecommendationContext){
 const byId=new Map(context.songs.map(song=>[song.id,song]));
 const profiles=new Map<string,Profile>();
 const profile=(user:string)=>{let found=profiles.get(user);if(!found){found=new Map();profiles.set(user,found)}return found};
 // Recommending a song is a weak positive signal. Explicit ratings always win.
 for(const song of context.songs){
  if(song.owner==='editorial')continue;
  profile(song.owner).set(songKey(song),{song,value:.25});
 }
 for(const rating of context.ratings){
  const song=byId.get(rating.song);
  if(!song||![0,1,3].includes(rating.value))continue;
  profile(rating.owner).set(songKey(song),{song,value:sentiment(rating.value)});
 }
 // The caller already has these ratings; this also supports fresh submissions that
 // have not yet appeared in the collaborative snapshot.
 const own=profile(context.userId);
 for(const song of context.mine||[])if(!own.has(songKey(song)))own.set(songKey(song),{song,value:.25});
 return profiles;
}

function localSimilarity(a:Profile,b:Profile,candidate:Song){
 let agreement=0,evidence=0;
 for(const [key,opinion] of a){
  const other=b.get(key);if(!other)continue;
  const relevance=overlap(opinion.song,candidate);
  if(!relevance)continue;
  const strength=Math.min(Math.abs(opinion.value),Math.abs(other.value));
  if(!strength)continue;
  const weight=relevance*strength;
  agreement+=weight*Math.sign(opinion.value*other.value);
  evidence+=weight;
 }
 // A single coincidentally shared song never creates a strong link.
 return evidence?agreement/(evidence+1)*Math.min(1,evidence/2):0;
}

function collaborative(song:Song,context:RecommendationContext,profiles:Map<string,Profile>,similarity:(a:string,b:string,song:Song)=>number){
 const key=songKey(song);
 const direct=new Map<string,number>();
 for(const [user] of profiles){
  if(user===context.userId)continue;
  direct.set(user,similarity(context.userId,user,song));
 }
 const bridgeUsers=[...direct.entries()].filter(([,value])=>value>0).sort((a,b)=>b[1]-a[1]).slice(0,12);
 let total=0,weighted=0,bestDirect=0,bestIndirect=0;
 for(const [user,profile] of profiles){
  if(user===context.userId)continue;
  const opinion=profile.get(key);if(!opinion||!opinion.value)continue;
  const first=direct.get(user)||0;
  let bridge=0;
  // Two positive, context-specific links A–B and B–C can provide a weaker
  // A–C hint. A direct disagreement between A and C vetoes that hint.
  if(first>=0){
   for(const [middle,ab] of bridgeUsers){
    if(middle===user)continue;
    const bc=similarity(middle,user,song);
    if(bc>0)bridge=Math.max(bridge,ab*bc*.35);
   }
  }
  const affinity=clamp(first+bridge);
  if(!affinity)continue;
  total+=Math.abs(affinity);
  weighted+=affinity*opinion.value;
  bestDirect=Math.max(bestDirect,first*opinion.value);
  bestIndirect=Math.max(bestIndirect,bridge*opinion.value);
 }
 return {score:total?weighted/(total+1.5):0,direct:bestDirect,indirect:bestIndirect};
}

function contentScore(song:Song,profile:Profile){
 let score=0,weight=0;
 for(const {song:known,value} of profile.values()){
  if(!value)continue;
  const related=overlap(song,known)+(song.artist&&known.artist&&song.artist===known.artist?.6:0);
  if(!related)continue;
  score+=related*value;
  weight+=related;
 }
 return weight?clamp(score/(weight+1)):0;
}

function diversityPenalty(a:Song,b:Song){
 const common=a.tags.filter(tag=>b.tags.includes(tag)).length;
 const union=new Set([...a.tags,...b.tags]).size;
 return (a.artist&&a.artist===b.artist?.65:0)+(union?common/union*.2:0);
}

export function pickSongs(pool:Song[],history:Song[],random=Math.random,context?:RecommendationContext):Song[]{
 if(!pool.length)return [];
 const profiles=context?profilesFor(context):new Map<string,Profile>();
 const cache=new Map<string,number>();
 const similarity=(a:string,b:string,song:Song)=>{
  const key=[a,b].sort().join('\u0000')+'|'+[...song.tags].sort().join(',');
  let score=cache.get(key);
  if(score===undefined){score=localSimilarity(profiles.get(a)||new Map(),profiles.get(b)||new Map(),song);cache.set(key,score)}
  return score;
 };
 const own=context?profiles.get(context.userId)||new Map<string,Opinion>():new Map<string,Opinion>();
 if(!context)for(const song of history)if(song.rating!==undefined)own.set(songKey(song),{song,value:sentiment(song.rating)});
 const scored=pool.map(song=>{
  const content=contentScore(song,own);
  const social=context?collaborative(song,context,profiles,similarity):{score:0,direct:0,indirect:0};
  return {...song,score:content*.65+social.score*1.1,content,social,tie:random()};
 });
 const ordered=scored.sort((a,b)=>b.score-a.score||b.tie-a.tie);
 const first=ordered[0];
 const second=ordered.slice(1).sort((a,b)=>(b.score-diversityPenalty(first,b))-(a.score-diversityPenalty(first,a))||b.tie-a.tie)[0];
 const chosen=[first,...(second?[second]:[])];
 const remaining=ordered.filter(song=>!chosen.some(selected=>selected.id===song.id));
 // Exploration considers promising but less certain songs and avoids strong
 // negatives. The random draw keeps the slot from becoming another top pick.
 const viable=remaining.filter(song=>song.score>=-.25).slice(0,Math.max(5,Math.ceil(remaining.length/2)));
 const exploration=viable.length?viable[Math.floor(random()*viable.length)]:remaining[0];
 if(exploration)chosen.push(exploration);
 return chosen.map((song,index)=>({
  ...song,
  reason:index===2?'留一点意外，发现新声音':song.social.direct>.08?'与你品味相近的人喜欢':song.social.indirect>.02?'通过音乐同好发现':song.content>0?'与你喜欢的声音相近':'为你开启音乐探索'
 }));
}
