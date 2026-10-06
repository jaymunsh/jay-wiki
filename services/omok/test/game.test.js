import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyBoard,winningLine,chooseMove} from '../public/game.js';
for(const step of [1,15,16,14])test(`five in direction ${step}`,()=>{const b=emptyBoard();const start=step===14?14:0;for(let n=0;n<5;n++)b[start+n*step]=1;assert.equal(winningLine(b,start).length,5);});
test('row boundary cannot form a win',()=>{const b=emptyBoard();for(let i=13;i<18;i++)b[i]=1;assert.equal(winningLine(b,15),null);});
test('bot blocks immediate win and leaves board unchanged',()=>{const b=emptyBoard();for(let i=105;i<109;i++)b[i]=1;const copy=[...b];assert.equal(chooseMove(b),109);assert.deepEqual(b,copy);});
test('bot takes winning move before blocking',()=>{const b=emptyBoard();for(let i=105;i<109;i++)b[i]=1;for(let i=150;i<154;i++)b[i]=2;assert.equal(chooseMove(b),154);});
