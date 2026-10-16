import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pickSongs,seeds,eligibleSongs} from '../lib/music.ts';
test('returns three distinct songs with an exploration slot',()=>{const out=pickSongs(seeds,[],()=>.5);assert.equal(out.length,3);assert.equal(new Set(out.map(s=>s.id)).size,3);assert.match(out[2].reason,/意外/)});
test('likes influence top ranked choices',()=>{const sample={...seeds[0],rating:3};const out=pickSongs(seeds,[sample],()=>.5);assert.equal(out[0].id,sample.id)});
test('dislikes reduce matching preferences',()=>{const out=pickSongs(seeds,[{...seeds[0],rating:0}],()=>.5);assert.notEqual(out[0].id,seeds[0].id);assert.notEqual(out[1].id,seeds[0].id)});

test('filters own and previously received recordings across submitters',()=>{const original=seeds[0],duplicate={...original,id:'duplicate',owner:'someone'};const available=eligibleSongs([original,duplicate,...seeds.slice(1)],[original],[],'me');assert.equal(available.length,seeds.length-1);assert(!available.some(s=>s.title===original.title));});
