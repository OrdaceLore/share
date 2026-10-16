export type Song={id:string;owner:string;title:string;artist:string;url:string;tags:string[];note:string;created:number;rating?:number;reason?:string};
export const tags=['独立','流行','民谣','摇滚','电子','爵士','氛围','治愈','夜晚','轻快','浪漫','纯音乐'];
const entries=[['夜空中最亮的星','逃跑计划','摇滚,治愈','留一点光，给还在路上的自己。'],['City of Stars','Ryan Gosling & Emma Stone','爵士,浪漫,夜晚','适合和城市一起慢下来的夜晚。'],['Mystery of Love','Sufjan Stevens','民谣,独立,浪漫','像夏天的一封手写信。'],['晚风','陈婧霏','独立,夜晚,浪漫','让晚风把今天轻轻带走。'],['Day 1 ◑','HONNE','电子,轻快,浪漫','把日常调成明亮的颜色。'],['Bloom','The Paper Kites','民谣,治愈','一把吉他，一点阳光。'],['Intro','The xx','电子,氛围,夜晚','没有歌词，也有很多故事。'],['海浪','Deca Joins','独立,摇滚,夜晚','在声音里，去一趟海边。'],['Weightless','Marconi Union','氛围,纯音乐,治愈','给忙碌的脑袋放一个假。'],['Sunset Lover','Petit Biscuit','电子,氛围,轻快','收藏这一刻的落日。'],['那些花儿','朴树','民谣,治愈','送给记忆里的老朋友。'],['L-O-V-E','Nat King Cole','爵士,浪漫,轻快','今天也值得一点摇摆。']];
export const seeds:Song[]=entries.map((e,i)=>({id:`seed-${i}`,owner:'editorial',title:e[0],artist:e[1],url:'https://music.youtube.com/search?q='+encodeURIComponent(e[0]+' '+e[1]),tags:e[2].split(','),note:e[3],created:0}));
export {pickSongs} from './recommend';

export function songKey(s:Pick<Song,'title'|'artist'>){return (s.title+'|'+s.artist).normalize('NFKC').toLowerCase().replace(/\s/g,'')};
export function eligibleSongs(all:Song[],mine:Song[],received:Song[],uid:string){const seen=new Set([...mine,...received].map(songKey));return all.filter(s=>{const key=songKey(s);if(s.owner===uid||seen.has(key))return false;seen.add(key);return true})};
