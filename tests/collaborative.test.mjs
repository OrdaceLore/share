import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pickSongs} from '../lib/music.ts';
const song=(id,tags=['爵士'])=>({id,owner:'editorial',title:id,artist:id,url:'',tags,note:'',created:0});
const rating=(owner,song,value)=>({owner,song,value});
const source=[song('x'),song('y'),song('z'),song('candidate'),song('plain'),song('other'),song('extra')];
const twoHop=[rating('A','x',3),rating('A','y',3),rating('B','x',3),rating('B','y',3),rating('B','z',3),rating('C','z',3),rating('C','candidate',3)];
const run=(ratings,songs=source,pool=songs.slice(3))=>pickSongs(pool,songs.slice(0,2).map(s=>({...s,rating:3})),()=>.5,{userId:'A',songs,ratings});
test('uses a damped A-B-C preference chain where A and C lack overlap',()=>{
 const out=run(twoHop);
 assert.equal(out[0].id,'candidate');
 assert.match(out[0].reason,/音乐同好/);
});
test('chain evidence stays local to the candidate style',()=>{
 const songs=[...source.slice(0,3),song('candidate',['金属']),...source.slice(4)];
 const out=run(twoHop,songs);
 assert.notEqual(out[0].reason,'通过音乐同好发现');
});
test('one weak shared preference cannot dominate strong personal dislikes',()=>{
 const songs=[song('x'),song('candidate',['摇滚']),song('plain',['爵士']),song('other',['爵士']),song('extra',['爵士'])];
 const ratings=[rating('A','x',0),rating('B','x',0),rating('B','candidate',3)];
 const out=pickSongs(songs.slice(1),[{...songs[0],rating:0}],()=>.5,{userId:'A',songs,ratings});
 assert.notEqual(out[0].reason,'与你品味相近的人喜欢');
});
test('does not infer a chain through a disliked bridge',()=>{
 const ratings=[rating('A','x',3),rating('B','x',0),rating('B','z',3),rating('C','z',3),rating('C','candidate',3)];
 const out=run(ratings);
 assert.notEqual(out[0].reason,'通过音乐同好发现');
});
