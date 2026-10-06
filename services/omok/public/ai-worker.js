import {chooseMove,chooseHardMove} from './game.js';
self.onmessage=({data:{board,color,difficulty,id,rule}})=>{
  try {
    const index=difficulty==='hard'?chooseHardMove(board,color,1600,rule):chooseMove(board,color,difficulty,rule);
    self.postMessage({id,index});
  }catch {self.postMessage({id,index:chooseMove(board,color,'normal',rule)});}
};
