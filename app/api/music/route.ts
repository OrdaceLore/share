import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {seeds,pickSongs,eligibleSongs,tags, type Song} from '../../../lib/music';
export const dynamic='force-dynamic';
const balanceSQL=`(SELECT COUNT(*) FROM songs WHERE owner = ?)+(SELECT COALESCE(SUM(r.value),0) FROM ratings r JOIN songs s ON s.id=r.song WHERE s.owner=?)-(SELECT COUNT(*) FROM exchanges WHERE owner=?)`;
async function state(uid:string){
 const db=env.DB!;
 const results=await db.batch([db.prepare('SELECT * FROM songs ORDER BY created DESC'),db.prepare('SELECT song,value FROM ratings WHERE owner=?').bind(uid),db.prepare('SELECT song FROM receipts WHERE owner=? ORDER BY created DESC').bind(uid),db.prepare(`SELECT ${balanceSQL} AS balance`).bind(uid,uid,uid),db.prepare('SELECT r.value, s.title,r.created FROM ratings r JOIN songs s ON s.id=r.song WHERE s.owner=? ORDER BY r.created DESC LIMIT 30').bind(uid)]);
 const all:Song[]=[...results[0].results.map((s:any)=>({...s,tags:JSON.parse(s.tags)})),...seeds] as Song[];
 const rated=new Map(results[1].results.map((r:any)=>[r.song,r.value]));
 const received=results[2].results.map((r:any)=>{const s=all.find(s=>s.id===r.song);return s?{...s,rating:rated.get(s.id)}:null}).filter(Boolean) as Song[];
 return {all,received,mine:all.filter(s=>s.owner===uid),balance:Number((results[3].results[0] as {balance:number}).balance),activity:results[4].results};
}
export async function GET(){try{const user=await getChatGPTUser();if(!user)return Response.json({all:seeds,received:[],mine:[],balance:0,activity:[],signedIn:false});if(!env.DB)throw Error('数据库尚未就绪');return Response.json({...await state(user.userId),signedIn:true});}catch{return Response.json({error:'暂时无法加载音乐，请稍后重试'},{status:503});}}
export async function POST(req:Request){
 try{
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return Response.json({error:'请求来源无效'},{status:403});
 const user=await getChatGPTUser();if(!user)return Response.json({error:'请先登录，再分享和交换音乐'},{status:401});
 if(!env.DB)throw Error('数据库尚未就绪');const db=env.DB,uid=user.userId;const raw=await req.json();if(!raw||typeof raw!=='object')return Response.json({error:'请求格式无效'},{status:400});const b=raw as {action?:string;title?:string;artist?:string;url?:string;note?:string;tags?:string[];value:number;song:string};const now=Date.now();
 if(b.action==='submit'){
 const title=String(b.title||'').trim(),artist=String(b.artist||'').trim(),url=String(b.url||'').trim(),note=String(b.note||'').trim();
 if(!title||title.length>100||artist.length>100||note.length>300||url.length>2000)return Response.json({error:'请填写歌曲名称，并保持内容在长度限制内'},{status:400});
 if(url){try{if(!['http:','https:'].includes(new URL(url).protocol))throw Error();}catch{return Response.json({error:'请填写有效的 http 或 https 音乐链接'},{status:400});}}
 const selected=Array.isArray(b.tags)?[...new Set(b.tags.filter((t:string)=>tags.includes(t)))].slice(0,3):[];
 const fp=(title+'|'+artist).normalize('NFKC').toLowerCase().replace(/\s/g,'');
 const result=await db.prepare('INSERT OR IGNORE INTO songs(id,owner,title,artist,url,tags,note,fingerprint,created) VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),uid,title,artist,url,JSON.stringify(selected),note,fp,now).run();
 if(!result.meta.changes)return Response.json({error:'你已经推荐过这首歌，试试另一首吧'},{status:409});
 }else if(b.action==='exchange'){
 const s=await state(uid);const pool=eligibleSongs(s.all,s.mine,s.received,uid);
 if(s.balance<1)return Response.json({error:'交换资格不足，先推荐一首喜欢的歌吧'},{status:409});
 if(pool.length<3)return Response.json({error:'暂时不足三首新音乐，不会扣除资格。等更多人分享后再来吧'},{status:409});
 const selected=pickSongs(pool,s.received),id=crypto.randomUUID();
 const result=await db.batch([db.prepare(`INSERT INTO exchanges(id,owner,created) SELECT ?,?,? WHERE (${balanceSQL})>0`).bind(id,uid,now,uid,uid,uid),...selected.map(song=>db.prepare('INSERT INTO receipts(id,owner,song,exchange,created) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM exchanges WHERE id=?)').bind(crypto.randomUUID(),uid,song.id,id,now,id))]);
 if(!result[0].meta.changes)return Response.json({error:'交换资格不足，请刷新后重试'},{status:409});
 return Response.json({...await state(uid),signedIn:true,newSongs:selected});
 }else if(b.action==='rate'){
 if(![0,1,3].includes(b.value)||typeof b.song!=='string')return Response.json({error:'评价无效'},{status:400});
 const result=await db.prepare('INSERT OR IGNORE INTO ratings(id,owner,song,value,created) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM receipts WHERE owner=? AND song=?) AND NOT EXISTS(SELECT 1 FROM songs WHERE id=? AND owner=?)').bind(crypto.randomUUID(),uid,b.song,b.value,now,uid,b.song,b.song,uid).run();
 if(!result.meta.changes)return Response.json({error:'只能评价交换获得的歌曲，且每首只能评价一次'},{status:409});
 }else return Response.json({error:'未知操作'},{status:400});
 return Response.json({...await state(uid),signedIn:true});
 }catch(e){console.error('Music operation failed',e instanceof Error?e.message:'unknown');return Response.json({error:'操作未完成，请刷新后重试；重复操作不会重复发放资格'},{status:503});}
}
