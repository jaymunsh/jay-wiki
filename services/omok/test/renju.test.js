import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyBoard,validateMove,winningLine,forbiddenMoves,chooseMove,chooseHardMove} from '../public/game.js';
const at=(x,y)=>y*15+x;
const position=(black=[],white=[])=>{const b=emptyBoard();black.forEach(([x,y])=>b[at(x,y)]=1);white.forEach(([x,y])=>b[at(x,y)]=2);return b;};
const cross=[[6,7],[8,7],[7,6],[7,8]];
function verdict(b,x=7,y=7,color=1,rule='renju'){const copy=[...b];const result=validateMove(b,at(x,y),color,rule);assert.deepEqual(b,copy,'validation must restore every hypothetical stone');return result;}
test('black double-three is forbidden; same shape is allowed for white and freestyle',()=>{
 assert.equal(verdict(position(cross)).reason,'double-three');
 assert.equal(verdict(position([],cross),7,7,2).legal,true);
 assert.equal(verdict(position(cross),7,7,1,'freestyle').legal,true);
});
test('closed three is not a real three',()=>assert.equal(verdict(position(cross,[[7,5],[7,9]])).legal,true));
test('board edge blocks a three',()=>assert.equal(verdict(position([[0,1],[2,1],[1,0],[1,2]]),1,1).legal,true));
test('broken open threes count',()=>assert.equal(verdict(position([[5,7],[8,7],[7,5],[7,8]])).reason,'double-three'));
test('black double-four is forbidden',()=>assert.equal(verdict(position([[5,7],[6,7],[8,7],[7,5],[7,6],[7,8]])).reason,'double-four'));
test('straight four with two winning ends counts once',()=>assert.equal(verdict(position([[5,7],[6,7],[8,7]])).legal,true));
test('two distinct fours on the same axis count twice',()=>assert.equal(verdict(position([[3,7],[5,7],[6,7],[9,7]]),7,7).reason,'double-four'));
test('black overline is forbidden; white and freestyle win',()=>{
 const stones=[[2,7],[3,7],[4,7],[5,7],[6,7]];
 assert.equal(verdict(position(stones)).reason,'overline');
 assert.equal(verdict(position([],stones),7,7,2).line.length,6);
 assert.equal(verdict(position(stones),7,7,1,'freestyle').line.length,6);
});
test('exact five wins even when a double-three is created simultaneously',()=>{
 const b=position([...cross,[5,5],[6,6],[8,8],[9,9]]);const result=verdict(b);assert.equal(result.legal,true);assert.equal(result.line.length,5);
});
test('simultaneous exact five takes precedence over overline per RIF 9.2',()=>{
 const b=position([[2,7],[3,7],[4,7],[5,7],[6,7],[7,3],[7,4],[7,5],[7,6]]);assert.equal(verdict(b).line.length,5);
});
test('three extensions that make overlines do not count',()=>{
 const extra=[5,9].flatMap(x=>[4,5,6,8,9].map(y=>[x,y]));assert.equal(verdict(position([...cross,...extra])).legal,true);
});
test('three extensions that make double-fours do not count',()=>{
 const extra=[5,9].flatMap(x=>[5,6,8].map(y=>[x,y]));assert.equal(verdict(position([...cross,...extra])).legal,true);
});
test('recursive forbidden double-three extensions do not count',()=>{
 const extra=[[5,6],[5,8],[4,6],[6,8],[9,6],[9,8],[8,8],[10,6]];
 assert.equal(verdict(position([...cross,...extra])).legal,true);
});
test('forbidden map agrees with move validation and leaves board unchanged',()=>{
 const b=position(cross),copy=[...b];const points=forbiddenMoves(b);assert.equal(points.get(at(7,7)),'double-three');assert.deepEqual(b,copy);assert.equal(forbiddenMoves(b,'freestyle').size,0);
});
test('winningLine distinguishes black overline from exact five',()=>{
 const b=position([[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]]);assert.equal(winningLine(b,at(3,7),'renju'),null);assert.equal(winningLine(b,at(3,7),'freestyle').length,6);
});
for(const difficulty of ['easy','normal','hard'])test(`${difficulty} black bot avoids forbidden points`,()=>{
 const b=position(cross,[[3,3],[4,3],[5,3]]),copy=[...b];const move=difficulty==='hard'?chooseHardMove(b,1,200,'renju'):chooseMove(b,1,difficulty,'renju');assert.equal(validateMove(b,move,1,'renju').legal,true);assert.deepEqual(b,copy);
});
