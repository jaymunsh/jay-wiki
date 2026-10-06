const appRoot=new URL('.',import.meta.url);
import {emptyBoard,winningLine,chooseMove,validateMove,forbiddenMoves,forbiddenMessage,normalizeRule,ruleName,hasLegalMove} from './game.js';
const $=s=>document.querySelector(s);
const newId=()=>globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const storage={
 get(key,fallback){try{return JSON.parse(localStorage.getItem('omok:'+key))??fallback;}catch{return fallback;}},
 set(key,value){try{localStorage.setItem('omok:'+key,JSON.stringify(value));}catch{toast('브라우저 저장 공간을 사용할 수 없어 기록을 저장하지 못했습니다.');}},
 remove(key){try{localStorage.removeItem('omok:'+key);}catch{}}
};
// Session credentials belong to this tab; separate tabs can play each other.
const session={get(){try{return JSON.parse(sessionStorage.getItem('omok:session'));}catch{return null;}},set(value){try{sessionStorage.setItem('omok:session',JSON.stringify(value));}catch{toast('이 브라우저에서는 자동 재접속 정보를 저장할 수 없습니다.');}},clear(){try{sessionStorage.removeItem('omok:session');}catch{}}};
let board=emptyBoard(),turn=1,winner=0,line=null,last=null,history=[],mode='bot',socket=null,myColor=1,ready=true,code='',sound=false,audio;
let worker=null,aiTimer=null,aiWatchdog=null,aiId=0,reconnectTimer=null,reconnectAttempts=0,connecting=null,networkBusy=false,movePending=false;
let gameId=newId(),reason=null,players=[],deadline=null,serverOffset=0,remaining=0,seconds=0,rematch=[],review=null,connectionText='방을 만들거나 코드로 입장하세요.';
let savedBot=null,savedLocal=null,roomError='',networkAction=null,focusIndex=112;
let currentRule='renju',botRulePreference='renju',localRulePreference='renju',roomPreview=null,previewTimer=null,previewLoading=false;
let forbiddenCacheKey='',forbiddenCache=new Map();
let capacity=null,capacityLoading=false,capacityFailed=false,capacityController=null;
let waitingUntil=null,closeAt=null,graceSeconds=120,pendingLeave=null;
let latestRecord=null;
const prefs=storage.get('preferences',{});
$('#difficulty').value=['easy','normal','hard'].includes(prefs.difficulty)?prefs.difficulty:'normal';
$('#my-stone').value=['1','2','random'].includes(prefs.stone)?prefs.stone:'1';
$('#nickname').value=typeof prefs.name==='string'?prefs.name.slice(0,16):'';
sound=!!prefs.sound;
botRulePreference=normalizeRule(prefs.rule);$('#bot-rule').value=botRulePreference;$('#room-rule').value=normalizeRule(prefs.roomRule);
localRulePreference=normalizeRule(prefs.localRule);$('#local-rule').value=localRulePreference;
let appliedDifficulty=$('#difficulty').value,appliedStone=$('#my-stone').value;
function savePrefs(){storage.set('preferences',{difficulty:$('#difficulty').value,stone:$('#my-stone').value,name:$('#nickname').value.trim(),rule:botRulePreference,localRule:localRulePreference,roomRule:$('#room-rule').value,sound});}
const cells=[];
for(let i=0;i<225;i++){
 const b=document.createElement('button');b.className='intersection';b.style.left=`${i%15/14*100}%`;b.style.top=`${Math.floor(i/15)/14*100}%`;b.onclick=()=>move(i);
 b.onfocus=()=>{focusIndex=i;cells.forEach((cell,j)=>cell.tabIndex=j===i?0:-1);};
 b.onkeydown=e=>{const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-15,ArrowDown:15}[e.key];if(!delta)return;e.preventDefault();let next=i+delta;while(next>=0&&next<225){if(Math.abs(delta)===1&&Math.floor(next/15)!==Math.floor(i/15))break;if(!cells[next].disabled){cells[next].focus();break;}next+=delta;}};
 $('#board').append(b);cells.push(b);
}
for(const [x,y] of [[3,3],[3,11],[7,7],[11,3],[11,11]]){const s=document.createElement('i');s.className='star';s.style.left=`${x/14*100}%`;s.style.top=`${y/14*100}%`;$('#board').append(s);}
for(let n=0;n<15;n++)for(const axis of ['x','y']){const el=document.createElement('span');el.className='coordinate';el.textContent=axis==='x'?String.fromCharCode(65+n):15-n;el.style.left=axis==='x'?`${n/14*100}%`:'-4%';el.style.top=axis==='y'?`${n/14*100}%`:'104.5%';$('#board').append(el);}
function toast(msg){$('#toast').textContent=msg;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),4000);}
function confirmAction(title,message,{chooseRule=false,actionLabel}={}){
 return new Promise(resolve=>{
  const dialog=$('#confirm-dialog');$('#confirm-title').textContent=title;$('#confirm-message').textContent=message;
  $('#confirm-yes').textContent=actionLabel||(title.includes('기권')?'기권하기':title.includes('복기')?'나가서 복기':title.includes('방')?'방 나가기':'새 대국 시작');
  $('#new-game-rule-options').hidden=!chooseRule;$('#next-rule').value=mode==='local'?localRulePreference:botRulePreference;
  const done=answer=>{if(answer&&chooseRule){if(mode==='local')localRulePreference=$('#next-rule').value;else botRulePreference=$('#next-rule').value;savePrefs();}dialog.close();resolve(answer);};$('#confirm-yes').onclick=()=>done(true);$('#confirm-no').onclick=()=>done(false);dialog.oncancel=e=>{e.preventDefault();done(false);};dialog.showModal();
 });
}
function clickSound(){if(!sound)return;try{audio??=new AudioContext();void audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.connect(g);g.connect(audio.destination);o.frequency.setValueAtTime(500,audio.currentTime);o.frequency.exponentialRampToValueAtTime(130,audio.currentTime+.06);g.gain.setValueAtTime(.13,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.09);o.start();o.stop(audio.currentTime+.1);}catch{}}
function stopAI(){clearTimeout(aiTimer);clearTimeout(aiWatchdog);worker?.terminate();worker=null;aiId++;}
function startAI(){
 if(mode!=='bot'||winner||turn===myColor||review)return;
 stopAI();const id=aiId;
 const apply=index=>{if(id!==aiId||mode!=='bot'||winner||turn===myColor)return;stopAI();if(Number.isInteger(index)&&validateMove(board,index,turn,currentRule).legal)place(index);else{const fallback=chooseMove([...board],turn,'normal',currentRule);if(fallback!==undefined)place(fallback);else{winner=3;reason='no-legal-moves';persistOffline();recordGame();render();}}};
 aiTimer=setTimeout(()=>{
  try{
   worker=new Worker(new URL('ai-worker.js',appRoot),{type:'module'});
   worker.onmessage=({data})=>{if(data.id===id)apply(data.index);};
   worker.onerror=()=>apply(chooseMove([...board],turn,'normal',currentRule));
   worker.postMessage({id,board:[...board],color:turn,rule:currentRule,difficulty:$('#difficulty').value});
   aiWatchdog=setTimeout(()=>apply(chooseMove([...board],turn,'normal',currentRule)),6000);
  }catch{apply(chooseMove([...board],turn,'normal',currentRule));}
 },350);
}
function snapshotOffline(){return {board,turn,winner,line,last,history,myColor,gameId,reason,rule:currentRule,difficulty:$('#difficulty').value};}
function persistOffline(){
 if(review||mode==='online')return;
 const snapshot=structuredClone(snapshotOffline());
 if(mode==='local')savedLocal=snapshot;else savedBot=snapshot;
 storage.set(mode==='local'?'local':'bot',snapshot);
}
function validOffline(s){
 if(!s||!Array.isArray(s.history)||s.history.length>225||![1,2].includes(s.myColor)||![0,1,2,3].includes(s.winner)||typeof s.gameId!=='string')return false;
 const seen=new Set();return s.history.every(i=>Number.isInteger(i)&&i>=0&&i<225&&!seen.has(i)&&seen.add(i));
}
function loadOffline(s){
 currentRule=normalizeRule(s.rule,mode==='local'?'renju':'freestyle');$(mode==='local'?'#local-rule':'#bot-rule').value=currentRule;board=emptyBoard();history=[...s.history];history.forEach((i,n)=>board[i]=n%2+1);turn=history.length%2+1;winner=s.winner;last=history.at(-1)??null;line=last===null?null:winningLine(board,last,currentRule);myColor=s.myColor;gameId=s.gameId;reason=s.reason;
 if(mode==='bot'&&['easy','normal','hard'].includes(s.difficulty))$('#difficulty').value=s.difficulty;
 appliedDifficulty=$('#difficulty').value;
 ready=true;render();startAI();
}
function recordGame(){
 if(!winner||review)return;
 const records=storage.get('records',[]);if(!Array.isArray(records))return;
 const perspective=mode==='local'?null:myColor;
 if(records.some(r=>r.id===gameId&&r.mode===mode&&r.myColor===perspective))return;
 const opponent=mode==='local'?'둘이 대전':mode==='bot'?`봇 · ${{easy:'쉬움',normal:'보통',hard:'어려움'}[$('#difficulty').value]}`:players.find(p=>p.color!==myColor)?.name||'상대 플레이어';
 latestRecord={id:gameId,date:new Date().toISOString(),mode,opponent,myColor:perspective,winner,reason,rule:currentRule,history:[...history]};records.unshift(latestRecord);storage.set('records',records.slice(0,30));renderStats();
}
window.addEventListener('storage',event=>{
 if(event.key!=='omok:records')return;
 try{
  const records=JSON.parse(event.newValue);if(!Array.isArray(records))return;
  // Recover simultaneous writes from separate tabs without changing either seat's perspective.
  if(latestRecord&&!records.some(r=>r.id===latestRecord.id&&r.mode===latestRecord.mode&&r.myColor===latestRecord.myColor)){
   const merged=[...records,latestRecord].sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)||`${a.id}:${a.myColor}`.localeCompare(`${b.id}:${b.myColor}`)).slice(0,30);
   if(merged.includes(latestRecord))storage.set('records',merged);
  }
  renderStats();
 }catch{ /* Ignore invalid data written by another tab. */ }
});
function recordOutcome(record){
 if(record.winner===3)return '무승부';
 if(record.mode==='local')return record.winner===1?'흑돌 승리':'백돌 승리';
 return record.winner===record.myColor?'승리':'패배';
}
function renderStats(){
 const records=storage.get('records',[]);if(!Array.isArray(records))return;
 const personal=records.filter(r=>r.mode!=='local'),localCount=records.length-personal.length;
 const wins=personal.filter(r=>r.winner===r.myColor).length,draws=personal.filter(r=>r.winner===3).length;
 const summary=[];
 if(personal.length)summary.push(`${wins}승 ${personal.length-wins-draws}패 ${draws}무`);
 if(localCount)summary.push(`둘이 대전 ${localCount}국`);
 $('#stats-label').textContent=records.length?`최근 ${records.length}국 · ${summary.join(' · ')}`:'첫 대국의 기록을 기다리고 있어요.';
}
function render(){
 const visible=review?review.board:board;const shownLast=review?review.record.history[review.step-1]:last;
 const shownLine=review?(shownLast===undefined?null:winningLine(visible,shownLast,normalizeRule(review.record.rule,'freestyle'))):line;
 const showForbidden=!review&&!winner&&turn===1&&(mode==='local'||myColor===1)&&ready&&currentRule==='renju';
 const forbiddenKey=showForbidden?board.join(''):'';
 if(forbiddenKey!==forbiddenCacheKey){forbiddenCacheKey=forbiddenKey;forbiddenCache=showForbidden?forbiddenMoves(board,currentRule):new Map();}
 const bans=showForbidden?forbiddenCache:new Map();
 cells.forEach((el,i)=>{
  const value=visible[i];
  if(el.dataset.value!==String(value)){el.innerHTML=value?`<span class="stone ${value===1?'black':'white'}"></span>`:'';el.dataset.value=String(value);}
  el.firstElementChild?.classList.toggle('last',i===shownLast);el.firstElementChild?.classList.toggle('won',!!shownLine?.includes(i));
  el.classList.toggle('occupied',!!value);el.classList.toggle('forbidden',bans.has(i));el.title=bans.has(i)?forbiddenMessage(bans.get(i)):'';el.setAttribute('aria-label',`${String.fromCharCode(65+i%15)}${15-Math.floor(i/15)}, ${value===1?'흑돌':value===2?'백돌':bans.has(i)?forbiddenMessage(bans.get(i)):'빈 자리'}`);
  el.disabled=!!value||!!winner||!ready||(mode!=='local'&&turn!==myColor)||!!review||movePending;
 });
 if(cells[focusIndex].disabled)focusIndex=cells.findIndex(el=>!el.disabled);
 cells.forEach((el,i)=>el.tabIndex=i===focusIndex?0:-1);
 if(focusIndex<0)focusIndex=112;
 const finished=winner?(winner===3?'무승부입니다':`${winner===1?'흑돌':'백돌'} 승리!`):'';
 $('#turn-label').textContent=review?'지난 대국을 복기하고 있어요':finished||(mode==='local'?`${turn===1?'흑돌':'백돌'} 차례입니다. 한 수를 놓아주세요.`:!ready?connectionText:turn===myColor?'당신의 차례입니다. 한 수를 놓아보세요.':mode==='bot'?'봇이 다음 수를 생각하고 있어요…':'상대방의 차례입니다');
 $('#move-count').innerHTML=`${String(visible.filter(Boolean).length).padStart(2,'0')} <small>수</small>`;
 $('#match-status').textContent=review?'복기 중':winner?'대국 종료':mode==='online'&&code&&players.length===2&&!ready?'재접속 대기':!ready?'대기 중':'진행 중';
 for(const [color,name] of [[1,'black'],[2,'white']]){
  $(`#player-${name}`).classList.toggle('active',!winner&&ready&&!review&&turn===color);
  $(`#${name}-indicator`).textContent=!winner&&ready&&turn===color?(mode==='local'?'둘 차례':myColor===color?'내 차례':'생각 중'):'';
  $(`#${name}-name`).textContent=mode==='local'?`${color===1?'흑':'백'} 플레이어`:color===myColor?'나':mode==='bot'?'오목 봇':players.find(p=>p.color===color)?.name||'입장 대기 중';
 }
 $('#undo').disabled=mode==='online'||!history.length||!!winner||!!review||(mode==='bot'&&myColor===2&&history.length===1);
 $('#board-action-help').hidden=!!review||!!winner||(mode==='online'&&!code);
 $('#board-action-help').textContent=mode==='online'?'온라인에서는 무르기를 사용할 수 없어요. 기권하면 상대가 승리합니다.':mode==='local'?'무르기는 마지막 한 수를 되돌립니다. 흑백을 번갈아 놓으세요.':'무르기는 내 마지막 수와 봇의 응답을 함께 되돌립니다.';
 $('#undo').title=mode==='online'?'온라인 대국에서는 무르기를 지원하지 않습니다.':mode==='local'?'마지막 한 수 되돌리기':'내 마지막 수와 봇의 응답 되돌리기';
 $('#resign').disabled=!!winner||!ready||!!review||(mode==='online'&&!code);
 $('#new-game').hidden=mode==='online'||!!review;$('#new-game').disabled=!!review;
 $('#difficulty').disabled=!!review;$('#my-stone').disabled=!!review;$('#bot-rule').disabled=!!review||history.length>0;$('#local-rule').disabled=!!review||history.length>0;
 $('#room-code').hidden=!code;$('#room-code').textContent=code;$('#room-code').setAttribute('aria-label',`방 코드 ${code}, 복사하기`);$('#share-link').hidden=!code;$('#leave-room').hidden=!code;
 $('#connection-status').textContent=connectionText;
 $('#create-room').disabled=networkBusy||!!review||capacity?.available===false;$('#join-room').disabled=networkBusy||!!review||previewLoading;
 $('#leave-room').disabled=networkBusy||!!pendingLeave;
 $('#refresh-capacity').disabled=capacityLoading;
 $('#room-capacity').textContent=capacity?`사용 중인 방 ${capacity.rooms} / ${capacity.maxRooms}`:capacityFailed?'방 현황을 확인하지 못했어요.':'방 현황을 확인하고 있어요…';
 $('.capacity-row').dataset.full=String(capacity?.available===false);
 $('.capacity-row').hidden=!!code;$('#capacity-help').hidden=!!code;
 $('#capacity-help').textContent=capacity?.available===false?'현재 새 방을 만들 수 없습니다. 초대받은 기존 방에는 입장할 수 있어요.':capacityFailed?'다시 확인하거나 방 만들기·입장을 시도해 주세요.':'대기·진행·종료 후 남아 있는 방을 포함합니다. 한도에 도달해도 기존 방에는 입장할 수 있어요.';
 $('#result-card').hidden=!winner||!!review;
 $('#result-title').textContent=winner===3?'무승부':mode==='local'?`${winner===1?'흑':'백'} 플레이어의 승리!`:winner===myColor?'멋진 승리입니다!':'좋은 대국이었습니다.';
 $('#result-desc').textContent=({'no-legal-moves':'합법적으로 놓을 수 있는 자리가 없어 무승부입니다.',five:'다섯 개의 돌이 연결되었습니다.',draw:'모든 교차점이 채워졌습니다.',resign:'기권으로 대국이 종료되었습니다.',timeout:'착수 시간이 초과되었습니다.',disconnect:'재접속 대기 시간이 지났습니다.',leave:winner===myColor?'상대방이 방을 나가 승리했습니다.':'방을 나가 대국이 패배로 종료되었습니다.'})[reason]||'새로운 대국에 도전해 보세요.';
 $('#rematch').hidden=mode!=='online'||!winner||!code;$('#rematch').disabled=!ready||rematch.includes(myColor);
 $('#rematch').textContent=rematch.includes(myColor)?'상대의 동의를 기다리는 중…':rematch.length?'재대결 수락 ↗':'재대결 신청 ↗';
 $('#review-bar').hidden=!review;
 if(review){$('#review-label').textContent=`${review.step} / ${review.record.history.length}수`;$('#review-range').max=review.record.history.length;$('#review-range').value=review.step;$('#review-prev').disabled=review.step===0;$('#review-next').disabled=review.step===review.record.history.length;}
 $('#sound').setAttribute('aria-pressed',String(sound));$('#sound').setAttribute('aria-label',sound?'사운드 끄기':'사운드 켜기');$('#sound').title=sound?'사운드 끄기':'사운드 켜기';$('#sound use').setAttribute('href',sound?'#i-sound':'#i-muted');
 const lobby=mode==='online'&&!code&&!review&&!winner;
 $('.game-layout').dataset.lobby=String(lobby);$('.game-layout').dataset.waiting=String(mode==='online'&&!!code&&players.length<2&&!review);$('.game-layout').dataset.review=String(!!review);$('.game-layout').dataset.finished=String(!!winner&&!review);
 $('#board-empty').hidden=!lobby;$('#board').dataset.turn=turn;$('#board').setAttribute('aria-busy',String(mode==='bot'&&!winner&&turn!==myColor&&!review));
 $('.tiny-stone').classList.toggle('white',turn===2&&!review);
 $('#room-setup').hidden=!!code||!!winner;$('#room-details').hidden=!code;
 $('#bot-options').hidden=mode!=='bot'||!!review||!!winner;$('#local-options').hidden=mode!=='local'||!!review||!!winner;$('#online-options').hidden=mode!=='online'||!!review;
 $('.players').hidden=!!review||lobby;$('.secondary-actions').hidden=!!review||lobby||!!winner;$('#result-jump').hidden=!winner||!!review||lobby;
 $('#online-again').hidden=mode!=='online'||!!code||!winner;$('#review-summary').hidden=!review;$('#review-current').hidden=!winner;$('#review-opponent').textContent=review?`${review.record.opponent} · ${recordOutcome(review.record)}`:'';
 $('#game-label').textContent=review?'대국 복기':mode==='local'?'한 기기에서 둘이':mode==='bot'?'봇과 연습하기':'친구와 대국하기';
 $('#match-title').textContent=review?'한 수씩 돌아보기.':mode==='local'?'마주 앉아, 한 수씩.':mode==='bot'?'나만의 속도로.':winner?'한 판을 마쳤어요.':code?(ready?'함께하는 한 판.':players.length===2?'잠시 연결을 기다려요.':'친구를 기다려요.'):'친구와 한 판.';
 $('#match-desc').textContent=review?'놓쳤던 기회와 멋진 한 수를 찾아보세요.':mode==='local'?'같은 화면에서 함께 즐기는 작은 승부.':mode==='bot'?'부담 없이 연습하고 감각을 깨워보세요.':code?'흑돌이 먼저 시작하는 대국입니다.':'방을 만들거나 초대 코드로 입장하세요.';
 const shownRule=review?normalizeRule(review.record.rule,'freestyle'):mode==='online'&&!code&&!winner?$('#room-rule').value:currentRule;
 $('#rule-badge').textContent=ruleName(shownRule);$('#rule-badge').title=shownRule==='renju'?'렌주 금수 적용 · 대회 오프닝 생략':'흑백 모두 금수 없는 자유룰';
 $('#board-rule-note').textContent=shownRule==='renju'?'× 금수는 착수할 수 없어요 · 흑만 적용':'금수 없이 흑백 모두 5개 이상 연결하면 승리';
 $('#bot-rule-help').textContent=(currentRule==='renju'?'흑돌만 삼삼·사사·장목 금지.':'흑백 모두 금수 없이 5개 이상이면 승리.')+(history.length?' 규칙은 새 대국에서 바꿀 수 있어요.':'');
 $('#local-rule-help').textContent=(currentRule==='renju'?'흑돌만 삼삼·사사·장목 금지.':'흑백 모두 금수 없이 5개 이상이면 승리.')+(history.length?' 규칙은 새 대국에서 바꿀 수 있어요.':'');
 $('#room-rule-label').textContent=`${ruleName(currentRule)}${currentRule==='renju'?' · 흑 금수 적용':''} · ${seconds?`한 수 ${seconds}초`:'시간 무제한'}`;
 $('#room-preview').hidden=!roomPreview&&!previewLoading;
 $('#room-preview').textContent=previewLoading?'방의 규칙을 확인하고 있어요…':roomPreview?`${ruleName(roomPreview.rule)}${roomPreview.rule==='renju'?' · 흑 금수 적용':''} / ${roomPreview.seconds?`한 수 ${roomPreview.seconds}초`:'시간 무제한'} — 확인 후 입장하세요.`:'';
 $('#difficulty-help').textContent=({easy:'가볍게 시작하며 오목의 감각을 익혀보세요.',normal:'공격과 수비를 익히는 균형 잡힌 연습.',hard:'여러 수 앞을 읽는 봇. 신중한 한 수가 필요해요.'})[$('#difficulty').value];
 $('#room-error').hidden=!roomError;$('#room-error').textContent=roomError;$('#room-input').setAttribute('aria-invalid',String(!!roomError));
 $('#create-room').firstChild.textContent=networkBusy&&networkAction==='create'?'방을 만드는 중… ':'새로운 방 만들기 ';$('#join-room').textContent=networkBusy&&networkAction==='join'?'연결 중…':'입장';
 for(const name of ['bot','local','online']){$(`#${name}-mode`).setAttribute('aria-pressed',String(mode===name));$(`#${name}-mode`).classList.toggle('selected',mode===name);}
 updateClock();
}
function updateClock(){
 $('#clock-display').hidden=mode!=='online'||!seconds||!code||!!winner||!!review;
 const left=Math.max(0,Math.ceil((deadline?deadline-Date.now()-serverOffset:remaining)/1000));
 $('#clock-display').textContent=`${ready?'남은 착수 시간':'시간 일시정지'} · ${left}초`;$('#clock-display').classList.toggle('urgent',ready&&left<=10);
 if(mode==='online'&&code){
  const format=at=>{const s=Math.max(0,Math.ceil((at-Date.now()-serverOffset)/1000));return `${Math.floor(s/60)}분 ${String(s%60).padStart(2,'0')}초`;};
  $('#room-lifecycle').textContent=winner&&closeAt?`활동이 없으면 ${format(closeAt)} 후 방이 닫혀요. 기록은 최근 대국에 남습니다.`:players.length<2&&waitingUntil?`남은 대기 ${format(waitingUntil)} · 친구가 입장하면 시작됩니다.`:'대국 중 방을 나가면 내 패배로 기록되고 방이 닫힙니다.';
  if(!winner&&!ready&&players.length===2&&socket?.readyState===WebSocket.OPEN){const missing=players.filter(p=>!p.online&&p.disconnectedAt);if(missing.length){const until=Math.max(0,Math.ceil((Math.min(...missing.map(p=>p.disconnectedAt))+graceSeconds*1000-Date.now()-serverOffset)/1000));$('#connection-status').textContent=`상대 재접속 대기 · ${until}초 남음 · 대국 일시정지`;}}
 }
}
setInterval(updateClock,250);
async function refreshCapacity(){
 if(mode!=='online'||capacityLoading||document.hidden)return;
 capacityLoading=true;capacityController=new AbortController();const timeout=setTimeout(()=>capacityController?.abort(),5000);render();
 try{const response=await fetch(new URL('room-status',appRoot),{cache:'no-store',signal:capacityController.signal});if(!response.ok)throw Error('Unavailable');const value=await response.json();if(!Number.isInteger(value.rooms)||!Number.isInteger(value.maxRooms)||typeof value.available!=='boolean')throw Error('Invalid status');capacity=value;capacityFailed=false;}
 catch{capacity=null;capacityFailed=true;}
 finally{clearTimeout(timeout);capacityLoading=false;capacityController=null;render();}
}
setInterval(()=>void refreshCapacity(),15000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refreshCapacity();});
function resetOffline(){
 stopAI();currentRule=mode==='local'?localRulePreference:botRulePreference;$(mode==='local'?'#local-rule':'#bot-rule').value=currentRule;board=emptyBoard();turn=1;winner=0;line=null;last=null;history=[];reason=null;gameId=newId();ready=true;
 myColor=mode==='local'?1:$('#my-stone').value==='random'?(Math.random()<.5?1:2):Number($('#my-stone').value);persistOffline();render();startAI();
}
function place(i){
 const verdict=validateMove(board,i,turn,currentRule);if(!verdict.legal){toast(forbiddenMessage(verdict.reason));return;}board[i]=turn;history.push(i);last=i;line=verdict.line;winner=line?turn:board.every(Boolean)?3:0;reason=winner?(line?'five':'draw'):null;turn=3-turn;if(!winner&&!hasLegalMove(board,turn,currentRule)){winner=3;reason='no-legal-moves';}clickSound();persistOffline();recordGame();render();
}
function move(i){
 if(board[i]||winner||!ready||(mode!=='local'&&turn!==myColor)||review||movePending)return;
 const verdict=validateMove(board,i,turn,currentRule);if(!verdict.legal){toast(forbiddenMessage(verdict.reason));return;}
 if(mode==='online'){if(send({type:'move',index:i})){movePending=true;render();}return;}
 place(i);if(mode==='bot'&&!winner)startAI();
}
function send(message){if(socket?.readyState!==WebSocket.OPEN){toast('서버에 다시 연결하고 있습니다. 잠시 기다려 주세요.');return false;}socket.send(JSON.stringify(message));return true;}
function clearOnline(){session.clear();code='';players=[];deadline=null;remaining=0;seconds=0;rematch=[];movePending=false;waitingUntil=null;closeAt=null;}
function disconnect(explicit=true){
 clearTimeout(reconnectTimer);reconnectAttempts=0;
 const old=socket;socket=null;connecting=null;
 if(old){if(explicit&&old.readyState===WebSocket.OPEN)old.send(JSON.stringify({type:'leave'}));old.close();}
 clearOnline();
}
function leaveCopy(){
 return winner?{title:'대국을 마친 방을 나갈까요?',message:'방이 닫히고 상대도 나가게 됩니다. 대국 기록과 복기는 그대로 남습니다.',actionLabel:'방 나가기'}:players.length<2?{title:'대기 중인 방을 닫을까요?',message:'초대 코드가 만료됩니다. 대국 전이므로 승패는 기록되지 않습니다.',actionLabel:'대기 취소'}:{title:'대국을 끝내고 방을 나갈까요?',message:'내 패배로 기록되고 상대가 승리합니다. 방이 닫히며 대국 기록은 남습니다.',actionLabel:'패배 처리하고 나가기'};
}
async function confirmLeave(){const copy=leaveCopy();return confirmAction(copy.title,copy.message,{actionLabel:copy.actionLabel});}
async function leaveOnline(){
 if(!code)return true;if(pendingLeave)return false;
 if(socket?.readyState!==WebSocket.OPEN){toast('서버에 다시 연결한 뒤 방을 나가 주세요. 연결이 복구되면 다시 시도할 수 있어요.');return false;}
 networkBusy=true;networkAction='leave';render();
 return new Promise(resolve=>{
  const done=value=>{clearTimeout(pendingLeave?.timer);pendingLeave=null;networkBusy=false;networkAction=null;if(value)disconnect(false);render();resolve(value);};
  pendingLeave={done,timer:setTimeout(()=>{toast('퇴장 확인이 지연되고 있어요. 다시 연결한 뒤 확인해 주세요.');done(false);},5000)};
  if(!send({type:'leave'}))done(false);
 });
}
function modeUI(){
 roomError='';roomPreview=null;previewLoading=false;clearTimeout(previewTimer);
 for(const name of ['bot','local','online'])$(`#${name}-mode`).classList.toggle('selected',mode===name);
}
async function setMode(next,{restore=false}={}){
 if(mode===next)return;
 if(review)exitReview();
 if(pendingLeave)return;
 if(mode==='online'&&code&&!restore){if(!await confirmLeave()||!await leaveOnline())return;}
 if(mode!=='online')persistOffline();stopAI();disconnect();mode=next;modeUI();
 if(mode!=='online')storage.set('offline-mode',mode);
 if(next!=='online'){const saved=next==='local'?savedLocal:savedBot;if(validOffline(saved))loadOffline(saved);else resetOffline();}
 else{currentRule=$('#room-rule').value;board=emptyBoard();history=[];winner=0;line=null;last=null;turn=1;myColor=1;ready=false;connectionText='방을 만들거나 코드로 입장하세요.';render();void refreshCapacity();}
}
function scheduleReconnect(){
 if(mode!=='online'||!session.get())return;
 clearTimeout(reconnectTimer);const delay=Math.min(1000*2**reconnectAttempts++,10000);
 connectionText='연결이 끊겼습니다. 자동으로 재접속하고 있어요…';render();
 reconnectTimer=setTimeout(()=>connect().catch(()=>{}),delay);
}
async function connect(){
 if(socket?.readyState===WebSocket.OPEN)return socket;if(connecting)return connecting;
 const ws=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}${appRoot.pathname}`);socket=ws;
 let rejectConnect;
 connecting=new Promise((resolve,reject)=>{
  rejectConnect=reject;
  const timeout=setTimeout(()=>{reject(Error('연결 시간이 초과되었습니다.'));ws.close();},8000);
  ws.onopen=()=>{clearTimeout(timeout);if(socket!==ws){ws.close();return reject(Error('연결이 취소되었습니다.'));}connecting=null;reconnectAttempts=0;const stored=session.get();if(stored)ws.send(JSON.stringify({type:'resume',...stored}));resolve(ws);};
  ws.onerror=()=>{clearTimeout(timeout);reject(Error('서버에 연결할 수 없습니다.'));};
  ws.addEventListener('close',()=>clearTimeout(timeout));
 });
 ws.onmessage=event=>{
  if(socket!==ws)return;let m;try{m=JSON.parse(event.data);}catch{return;}
  if(m.type==='preview'){
   if(m.code!==$('#room-input').value.trim().toUpperCase()||mode!=='online'||code)return;
   previewLoading=false;roomPreview=m.available?{code:m.code,rule:normalizeRule(m.rule,'freestyle'),seconds:m.seconds}:null;
   roomError=m.available?'':'방을 찾을 수 없거나 이미 가득 찼습니다.';render();return;
  }
  networkBusy=false;movePending=false;
  if(m.type==='session'){session.set({code:m.code,token:m.token});return;}
  if(m.type==='error'){if(m.reason==='expired'){clearOnline();ready=false;connectionText=m.message;}if(!['double-three','double-four','overline'].includes(m.reason))roomError=m.message;if(m.reason==='capacity')void refreshCapacity();toast(m.message);render();return;}
  if(m.type==='replaced'){disconnect(false);ready=false;connectionText='다른 탭에서 이 대국에 접속했습니다.';render();return;}
  if(m.type==='closed'||m.type==='left'){const leaving=pendingLeave?.done;clearOnline();ready=false;connectionText=m.message||'방을 나갔습니다. 대국 기록은 최근 대국에서 볼 수 있어요.';if(leaving)leaving(true);toast(connectionText);render();void refreshCapacity();return;}
  if(m.type==='state'){
   const changedRoom=m.code!==code;
   roomError='';roomPreview=null;previewLoading=false;
   if(review&&m.id!==gameId&&!m.winner)review=null;
   if(m.last!==last&&m.last!==null)clickSound();
   currentRule=normalizeRule(m.rule,'freestyle');board=m.board;turn=m.turn;winner=m.winner;line=m.line;last=m.last;myColor=m.color;ready=m.ready;code=m.code;players=m.players||[];deadline=m.deadline;remaining=m.remaining;seconds=m.seconds||0;history=m.history||[];reason=m.reason;rematch=m.rematch||[];gameId=m.id;serverOffset=(m.serverTime||Date.now())-Date.now();
   waitingUntil=m.waitingUntil;closeAt=m.closeAt;graceSeconds=m.graceSeconds||120;
   connectionText=winner?'대국이 종료되었습니다. 재대결하거나 방을 나갈 수 있어요.':ready?'연결됨 · 실시간 대국':players.length<2?'초대 코드를 공유하고 친구를 기다려 주세요.':'상대의 재접속을 기다리고 있습니다.';
   recordGame();render();if(changedRoom)void refreshCapacity();
  }
 };
 ws.onclose=()=>{
  rejectConnect?.(Error('연결이 종료되었습니다.'));
  if(socket!==ws)return;previewLoading=false;socket=null;connecting=null;networkBusy=false;movePending=false;ready=false;if(deadline)remaining=Math.max(0,deadline-Date.now()-serverOffset);deadline=null;
  pendingLeave?.done(false);
  if(session.get())scheduleReconnect();else{connectionText='서버 연결이 종료되었습니다. 다시 입장해 주세요.';render();}
 };
 return connecting;
}
async function previewRoom(){
 const entered=$('#room-input').value.trim().toUpperCase();roomPreview=null;
 if(mode!=='online'||code||!/^[A-F0-9]{6}$/.test(entered)){previewLoading=false;render();return;}
 previewLoading=true;roomError='';render();
 try{await connect();if(mode==='online'&&!code&&entered===$('#room-input').value.trim().toUpperCase())send({type:'preview',code:entered});}
 catch(e){previewLoading=false;roomError=e.message;render();}
}
async function roomAction(type){
 if(networkBusy)return;
 const entered=$('#room-input').value.trim().toUpperCase();if(type==='join'&&!/^[A-F0-9]{6}$/.test(entered)){roomError='영문 A–F와 숫자로 된 6자리 코드를 입력해 주세요.';render();$('#room-input').focus();return;}
 if(type==='join'&&(!roomPreview||roomPreview.code!==entered)){await previewRoom();return;}
 if(code&&(!await confirmLeave()||!await leaveOnline()))return;
 savePrefs();networkBusy=true;networkAction=type;roomError='';render();
 try{await connect();send({type,code:entered,name:$('#nickname').value,rule:type==='create'?$('#room-rule').value:roomPreview.rule,seconds:Number($('#time-control').value)});}catch(e){networkBusy=false;roomError=e.message;toast(e.message);render();}
}
async function copy(text,message){try{await navigator.clipboard.writeText(text);toast(message);}catch{toast(text);}}
async function changeBotSetting(control){
 const requested=control.value;control.value=control.id==='difficulty'?appliedDifficulty:appliedStone;
 if(history.length&&!winner&&!await confirmAction('새 대국을 시작할까요?','설정을 바꾸면 현재 봇 대국이 초기화됩니다.')){render();return;}
 control.value=requested;appliedDifficulty=$('#difficulty').value;appliedStone=$('#my-stone').value;savePrefs();resetOffline();
}
function openRecords(){
 const list=$('#records-list');list.replaceChildren();const records=storage.get('records',[]);
 if(!Array.isArray(records)||!records.length){const empty=document.createElement('div');empty.className='empty-records';empty.innerHTML='<svg class="icon" aria-hidden="true"><use href="#i-book"/></svg><strong>첫 대국을 기다리고 있어요.</strong><p>대국을 마치면 이곳에서 다시 살펴볼 수 있어요.</p>';list.append(empty);}
 else for(const r of records){
  const row=document.createElement('div');row.className='record-row';const info=document.createElement('div'),title=document.createElement('strong'),sub=document.createElement('small'),button=document.createElement('button');
  title.textContent=`${recordOutcome(r)} · ${r.opponent}`;
  sub.textContent=`${new Date(r.date).toLocaleString('ko-KR')} · ${r.history.length}수 · ${ruleName(normalizeRule(r.rule,'freestyle'))}`;button.textContent='복기';button.disabled=mode==='online'&&!!code&&!winner;button.title=button.disabled?'온라인 대국을 마친 뒤 복기할 수 있습니다.':'대국 복기';button.onclick=()=>startReview(r);info.append(title,sub);row.append(info,button);list.append(row);
 }
 $('#export-records').hidden=!Array.isArray(records)||!records.length;
 if(mode==='online'&&code&&!winner){const note=document.createElement('p');note.textContent='현재 온라인 대국을 마친 뒤 복기할 수 있습니다.';list.prepend(note);}
 $('#records-dialog').showModal();
}
async function startReview(record){
 if(mode==='online'&&code){if(!winner){toast('대국을 마친 뒤 복기할 수 있습니다.');return;}if(!await confirmAction('방을 나가서 복기할까요?','방이 닫히고 상대도 나가게 됩니다. 기록은 그대로 남습니다.',{actionLabel:'나가서 복기'})||!await leaveOnline())return;ready=false;}
 stopAI();review={record,step:0,board:emptyBoard()};$('#records-dialog').close();render();$('.game-layout').scrollIntoView({behavior:'smooth'});
}
function reviewStep(delta){if(!review)return;review.step=Math.max(0,Math.min(review.record.history.length,review.step+delta));review.board=emptyBoard();review.record.history.slice(0,review.step).forEach((i,n)=>review.board[i]=n%2+1);render();}
function exitReview(){review=null;render();startAI();}
$('#local-mode').onclick=()=>setMode('local');$('#bot-mode').onclick=()=>setMode('bot');$('#online-mode').onclick=()=>setMode('online');
$('#new-game').onclick=async()=>{if(!await confirmAction('새 대국을 시작할까요?',history.length&&!winner?'현재 대국을 종료하고 선택한 규칙으로 새로 시작합니다.':'규칙을 선택하고 새 대국을 시작하세요.',{chooseRule:true}))return;resetOffline();};
$('#difficulty').onchange=()=>changeBotSetting($('#difficulty'));
$('#my-stone').onchange=()=>changeBotSetting($('#my-stone'));
$('#bot-rule').onchange=()=>{if(history.length){$('#bot-rule').value=currentRule;return;}botRulePreference=normalizeRule($('#bot-rule').value);savePrefs();resetOffline();};
$('#local-rule').onchange=()=>{if(history.length){$('#local-rule').value=currentRule;return;}localRulePreference=normalizeRule($('#local-rule').value);savePrefs();resetOffline();};
$('#room-rule').onchange=()=>{savePrefs();render();};
$('#nickname').onchange=savePrefs;
$('#undo').onclick=()=>{
 stopAI();const count=mode==='local'?1:turn===myColor?2:1;for(let n=0;n<count;n++){const i=history.pop();if(i!==undefined)board[i]=0;}
 turn=mode==='local'?history.length%2+1:myColor;last=history.at(-1)??null;winner=0;line=null;persistOffline();render();
};
$('#resign').onclick=async()=>{
 const resigningColor=mode==='local'?turn:myColor;
 const title=mode==='local'?`${resigningColor===1?'흑':'백'} 플레이어가 기권할까요?`:'이번 대국을 기권할까요?';
 if(!await confirmAction(title,`${resigningColor===1?'백':'흑'} 플레이어의 승리로 대국이 종료됩니다.`))return;
 if(winner||!ready||review)return;
 if(mode==='online')send({type:'resign'});
 else{stopAI();winner=3-resigningColor;reason='resign';persistOffline();recordGame();render();}
};
$('#create-room').onclick=()=>roomAction('create');$('#join-room').onclick=()=>roomAction('join');$('#room-input').onkeydown=e=>{if(e.key==='Enter')roomAction('join');};
$('#room-code').onclick=()=>copy(code,'방 코드를 복사했습니다.');
$('#share-link').onclick=()=>{const url=new URL(location.href);url.search='';url.searchParams.set('room',code);url.hash='';copy(url.href,'초대 링크를 복사했습니다. 친구에게 공유해 주세요.');};
$('#leave-room').onclick=async()=>{if(pendingLeave||!await confirmLeave()||!await leaveOnline())return;ready=false;connectionText='방을 나갔습니다. 새 대국에 참가해 보세요.';render();};
$('#refresh-capacity').onclick=()=>void refreshCapacity();
$('#rematch').onclick=()=>send({type:'rematch'});
$('#sound').onclick=()=>{sound=!sound;savePrefs();render();toast(sound?'착수 사운드를 켰습니다.':'착수 사운드를 껐습니다.');clickSound();};
$('#rules-nav').onclick=()=>$('#rules').showModal();$('#rules .close-dialog').onclick=$('.close-rules').onclick=()=>$('#rules').close();
for(const el of document.querySelectorAll('[data-close]'))el.onclick=()=>document.getElementById(el.dataset.close).close();
$('#result-jump').onclick=()=>{$('#result-card').scrollIntoView({behavior:'smooth',block:'center'});};
$('#settings-shortcut').onclick=()=>{$('#match-settings').scrollIntoView({behavior:'smooth',block:'start'});$('#match-settings').focus({preventScroll:true});};
$('#room-input').oninput=()=>{roomError='';roomPreview=null;previewLoading=false;clearTimeout(previewTimer);render();previewTimer=setTimeout(previewRoom,300);};
$('#play-nav').onclick=()=>$('#game').scrollIntoView({behavior:'smooth'});$('#open-records').onclick=openRecords;
$('#online-again').onclick=()=>{board=emptyBoard();history=[];winner=0;line=null;last=null;turn=1;ready=false;reason=null;connectionText='방을 만들거나 코드로 입장하세요.';render();};
$('#review-current').onclick=()=>{const perspective=mode==='local'?null:myColor;const record=storage.get('records',[]).find(r=>r.id===gameId&&r.myColor===perspective);if(record)startReview(record);};
$('#review-range').oninput=e=>reviewStep(Number(e.target.value)-review.step);
$('#review-prev').onclick=()=>reviewStep(-1);$('#review-next').onclick=()=>reviewStep(1);$('#review-exit').onclick=exitReview;
$('#export-records').onclick=()=>{const blob=new Blob([JSON.stringify(storage.get('records',[]),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='omok-games.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
window.addEventListener('online',()=>{if(mode==='online'&&session.get()&&socket?.readyState!==WebSocket.OPEN){clearTimeout(reconnectTimer);connect().catch(()=>{});}});
window.addEventListener('pagehide',()=>persistOffline());
window.addEventListener('beforeunload',e=>{if(mode==='online'&&code&&players.length===2&&!winner){e.preventDefault();e.returnValue='';}});
if(new URL(location.href).searchParams.get('from')==='works'){
 const back=$('#back-to-works');back.hidden=false;if(location.hostname==='localhost'||location.hostname.endsWith('.localhost'))back.href='http://blog.localhost:3000/works';
 back.onclick=async event=>{event.preventDefault();if(pendingLeave)return;if(mode==='online'&&code&&(!await confirmLeave()||!await leaveOnline()))return;location.assign(back.href);};
}
savedBot=storage.get('bot',null);savedLocal=storage.get('local',null);
const resume=session.get(),invite=new URL(location.href).searchParams.get('room');
if(resume){mode='online';ready=false;code=resume.code;connectionText='저장된 대국에 다시 연결하고 있습니다…';modeUI();render();connect().catch(()=>{});}
else if(invite&&/^[A-Fa-f0-9]{6}$/.test(invite)){mode='online';ready=false;$('#room-input').value=invite.toUpperCase();connectionText='초대받은 방 코드가 입력되었습니다. 입장을 눌러 주세요.';modeUI();render();previewTimer=setTimeout(previewRoom,0);}
else{mode=storage.get('offline-mode','bot')==='local'?'local':'bot';modeUI();const saved=mode==='local'?savedLocal:savedBot;if(validOffline(saved))loadOffline(saved);else resetOffline();}
renderStats();
if(mode==='online')void refreshCapacity();
