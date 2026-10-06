export const SIZE = 15;
export const emptyBoard = () => Array(SIZE * SIZE).fill(0);
export const RULES = Object.freeze({RENJU:'renju', FREESTYLE:'freestyle'});
export const normalizeRule = (rule, fallback=RULES.RENJU) => Object.values(RULES).includes(rule) ? rule : fallback;
export const ruleName = rule => rule === RULES.RENJU ? '렌주' : '자유룰';
export const forbiddenMessage = reason => ({
  'double-three':'삼삼 금수입니다. 흑돌은 열린 삼을 동시에 두 개 만들 수 없어요.',
  'double-four':'사사 금수입니다. 흑돌은 사를 동시에 두 개 만들 수 없어요.',
  overline:'장목 금수입니다. 흑돌은 6개 이상 연속으로 이을 수 없어요.'
})[reason] || '이 자리에는 놓을 수 없어요.';
const DIRECTIONS = [[1,0],[0,1],[1,1],[1,-1]];

function offset(index, [dx,dy], n) {
  const x=index%SIZE+dx*n, y=Math.floor(index/SIZE)+dy*n;
  return x>=0&&x<SIZE&&y>=0&&y<SIZE ? y*SIZE+x : -1;
}
function linesThrough(board,index) {
  const color=board[index];
  if(!color)return [];
  return DIRECTIONS.map(direction=>{
    const line=[index];
    for(const sign of [-1,1])for(let n=1;n<SIZE;n++){
      const at=offset(index,direction,n*sign);
      if(at<0||board[at]!==color)break;
      line.push(at);
    }
    return line;
  });
}
// The legacy default preserves existing freestyle callers and saved replays.
export function winningLine(board,index,rule=RULES.FREESTYLE) {
  return linesThrough(board,index).find(line=>rule===RULES.RENJU&&board[index]===1 ? line.length===5 : line.length>=5)||null;
}

// A four is identified by its four stones, not by its winning endpoints.
// This counts a straight four once and distinct broken fours on one axis separately.
function fourGroups(board,index) {
  const groups=new Set();
  DIRECTIONS.forEach((direction,axis)=>{
    for(let start=-4;start<=0;start++){
      const cells=Array.from({length:5},(_,n)=>offset(index,direction,start+n));
      if(cells.some(i=>i<0||board[i]===2))continue;
      const stones=cells.filter(i=>board[i]===1);
      if(stones.length!==4)continue;
      if(board[offset(index,direction,start-1)]===1||board[offset(index,direction,start+5)]===1)continue;
      groups.add(`${axis}:${stones.sort((a,b)=>a-b).join(',')}`);
    }
  });
  return groups.size;
}

function threeCandidates(board,index) {
  const groups=new Map();
  DIRECTIONS.forEach((direction,axis)=>{
    for(let start=-3;start<=0;start++){
      const cells=Array.from({length:4},(_,n)=>offset(index,direction,start+n));
      if(cells.some(i=>i<0||board[i]===2))continue;
      const stones=cells.filter(i=>board[i]===1);
      if(stones.length!==3)continue;
      const left=offset(index,direction,start-1),right=offset(index,direction,start+4);
      if(left<0||right<0||board[left]!==0||board[right]!==0)continue;
      // Both ends must complete exactly five, rather than an overline.
      if(board[offset(index,direction,start-2)]===1||board[offset(index,direction,start+5)]===1)continue;
      const key=`${axis}:${stones.sort((a,b)=>a-b).join(',')}`;
      if(!groups.has(key))groups.set(key,new Set());
      groups.get(key).add(cells.find(i=>board[i]===0));
    }
  });
  return groups;
}

// RIF 9.2/9.3: a simultaneous exact five takes precedence. A three only
// counts if it can become a straight four via a legal non-winning black move.
// Recursion adds a stone each time and memoizes the resulting position; there
// is no arbitrary depth cutoff that would silently turn a false three into a ban.
function blackForbidden(board,index,memo) {
  const key=`${index}:${board.join('')}`;
  if(memo.has(key))return memo.get(key);
  const lines=linesThrough(board,index);
  let result=null;
  if(lines.some(line=>line.length===5))result=null;
  else if(lines.some(line=>line.length>5))result='overline';
  else if(fourGroups(board,index)>=2)result='double-four';
  else {
    const groups=threeCandidates(board,index);
    if(groups.size>=2){
      let realThrees=0;
      for(const extensions of groups.values()){
        let real=false;
        for(const next of extensions){
          board[next]=1;
          try {real=!winningLine(board,next,RULES.RENJU)&&!blackForbidden(board,next,memo);}
          finally {board[next]=0;}
          if(real)break;
        }
        if(real&&++realThrees>=2){result='double-three';break;}
      }
    }
  }
  memo.set(key,result);
  return result;
}

export function validateMove(board,index,color,rule=RULES.RENJU,memo=new Map()) {
  if(!Number.isInteger(index)||index<0||index>=SIZE*SIZE||![1,2].includes(color))return {legal:false,reason:'invalid',line:null};
  if(board[index]!==0)return {legal:false,reason:'occupied',line:null};
  board[index]=color;
  try {
    const line=winningLine(board,index,rule);
    const reason=rule===RULES.RENJU&&color===1 ? blackForbidden(board,index,memo) : null;
    return {legal:!reason,reason,line:reason?null:line};
  } finally {board[index]=0;}
}
export function forbiddenMoves(board,rule=RULES.RENJU) {
  const result=new Map();
  if(rule!==RULES.RENJU||board.filter(v=>v===1).length<4)return result;
  const memo=new Map();
  board.forEach((v,i)=>{if(!v){const verdict=validateMove(board,i,1,rule,memo);if(!verdict.legal)result.set(i,verdict.reason);}});
  return result;
}
export function hasLegalMove(board,color,rule=RULES.RENJU) {
  const memo=new Map();
  return board.some((v,i)=>v===0&&validateMove(board,i,color,rule,memo).legal);
}

export function chooseMove(board, color=2, difficulty='normal', rule=RULES.FREESTYLE) {
  const occupied=board.flatMap((v,i)=>v?[i]:[]);
  if(!occupied.length) return 112;
  let candidates=board.flatMap((v,i)=>!v&&occupied.some(j=>Math.abs(i%15-j%15)<=2&&Math.abs(Math.floor(i/15)-Math.floor(j/15))<=2)?[i]:[]);
  const memo=new Map();
  candidates=candidates.filter(i=>validateMove(board,i,color,rule,memo).legal);
  if(!candidates.length)candidates=board.flatMap((v,i)=>!v&&validateMove(board,i,color,rule,memo).legal?[i]:[]);
  for(const c of [color,3-color])for(const i of candidates){
    const verdict=validateMove(board,i,c,rule,memo);if(verdict.legal&&verdict.line)return i;
  }
  function score(i,c) {
    let total=0; const x=i%15,y=Math.floor(i/15);
    for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1]]) {
      let count=1,open=0;
      for(const s of [-1,1]) for(let n=1;n<6;n++) {
        const nx=x+dx*n*s,ny=y+dy*n*s;
        if(nx<0||nx>=15||ny<0||ny>=15)break;
        const v=board[ny*15+nx]; if(v===c)count++;else {if(v===0)open++;break;}
      }
      total+=([0,1,12,110,1600,100000][Math.min(count,5)])*(open===2?4:open===1?1:0);
    }
    return total;
  }
  return candidates.map(i=>({i,s:score(i,color)+(validateMove(board,i,3-color,rule,memo).legal?score(i,3-color)*1.15:0)+(14-Math.abs(i%15-7)-Math.abs(Math.floor(i/15)-7))*.5+Math.random()*(difficulty==='easy'?180:2)})).sort((a,b)=>b.s-a.s)[0]?.i;
}

// Threat-aware, bounded alpha-beta search used only inside the AI worker.
export function chooseHardMove(board, color=2, budgetMs=1600, rule=RULES.FREESTYLE) {
  const deadline=performance.now()+budgetMs;
  const directions=[[1,0],[0,1],[1,1],[1,-1]];
  const candidates=()=>{
    const nearby=new Set();
    board.forEach((v,i)=>{if(v)for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
      const x=i%15+dx,y=Math.floor(i/15)+dy;
      if(x>=0&&x<15&&y>=0&&y<15&&!board[y*15+x])nearby.add(y*15+x);
    }});
    return nearby.size?[...nearby]:board[112]===0?[112]:[];
  };
  function threat(i,c) {
    let score=0,fours=0,threes=0;
    const x=i%15,y=Math.floor(i/15);
    for(const [dx,dy] of directions){
      let str='';
      for(let n=-5;n<=5;n++){
        const nx=x+dx*n,ny=y+dy*n;
        str+=n===0?'X':nx<0||nx>=15||ny<0||ny>=15?'#':board[ny*15+nx]===c?'X':board[ny*15+nx]===0?'.':'#';
      }
      if(str.includes('XXXXX'))return 10000000;
      if(str.includes('.XXXX.')){score+=500000;fours++;}
      else if(['XXXX.','.XXXX','XXX.X','XX.XX','X.XXX'].some(p=>str.includes(p))){score+=35000;fours++;}
      else if(['.XXX.','.XX.X.','.X.XX.'].some(p=>str.includes(p))){score+=6500;threes++;}
      else if(['.XX.','.X.X.'].some(p=>str.includes(p)))score+=300;
    }
    if(fours>=2||fours&&threes)score+=350000;
    if(threes>=2)score+=45000;
    return score;
  }
  function ranked(c,limit){
    const memo=new Map();
    const moves=candidates().flatMap(i=>{
      const own=validateMove(board,i,c,rule,memo);if(!own.legal)return [];
      const opponent=validateMove(board,i,3-c,rule,memo);
      return [{i,attack:own.line?10000000:threat(i,c),defense:opponent.legal?(opponent.line?10000000:threat(i,3-c)):0}];
    });
    const win=moves.filter(m=>m.attack>=10000000);
    if(win.length)return win;
    const block=moves.filter(m=>m.defense>=10000000);
    if(block.length)return block;
    return moves.sort((a,b)=>(b.attack+b.defense*1.15)-(a.attack+a.defense*1.15)).slice(0,limit);
  }
  let nodes=0;
  function search(c,depth,alpha,beta,lastMove){
    if((++nodes&31)===0&&performance.now()>deadline)throw new Error('deadline');
    if(lastMove!==null&&winningLine(board,lastMove,rule))return -100000000-depth*1000;
    const moves=ranked(c,depth>1?8:6);
    if(!moves.length)return 0;
    if(depth===0){
      const own=moves.map(m=>m.attack).sort((a,b)=>b-a),opp=moves.map(m=>m.defense).sort((a,b)=>b-a);
      return own[0]+(own[1]||0)*.2-opp[0]*1.1-(opp[1]||0)*.2;
    }
    let best=-Infinity;
    for(const m of moves){
      board[m.i]=c;let value;
      try{value=-search(3-c,depth-1,-beta,-alpha,m.i);}finally{board[m.i]=0;}
      best=Math.max(best,value);alpha=Math.max(alpha,value);if(alpha>=beta)break;
    }
    return best;
  }
  const roots=ranked(color,12);
  if(!roots.length)return chooseMove(board,color,'normal',rule);
  if(roots[0].attack>=10000000)return roots[0].i;
  if(roots.length===1)return roots[0].i;
  let best=roots[0].i;
  for(let depth=2;depth<=4;depth++){
    let candidate=best,value=-Infinity;
    try{
      for(const m of roots){
        if(performance.now()>deadline)throw new Error('deadline');
        board[m.i]=color;let score;
        try{score=-search(3-color,depth-1,-Infinity,Infinity,m.i);}finally{board[m.i]=0;}
        if(score>value){value=score;candidate=m.i;}
      }
      best=candidate;
      roots.sort((a,b)=>Number(b.i===best)-Number(a.i===best));
    }catch{break;}
  }
  return best;
}
