import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { rooms } from "../../../db/schema";

export const dynamic = "force-dynamic";

const PROMPTS = [
  "说一个夏天会想到的东西", "说一种圆形的食物", "说一个适合约会的地方", "说一种蓝色的东西",
  "说一个童年常玩的游戏", "说一种下雨天想做的事", "说一个熬夜时会想到的东西", "说一种便利店必买的东西",
  "说一个让人放松的声音", "说一种冬天会吃的食物", "说一个看到大海会想到的词", "说一种会飞的动物",
  "说一个旅行时最怕忘带的东西", "说一种很甜的水果", "说一个周末最想做的事", "说一种适合送人的花",
  "说一个关于校园的词", "说一种深夜最想吃的食物", "说一个代表好运的东西", "说一种红色的食物"
];

type StoredPlayer = { id:string; token:string; name:string; word:string|null; ready:boolean; nextReady:boolean };
type StoredSpectator = { id:string; token:string; name:string };
type Answer = { id:string; name:string; word:string };
type HistoryItem = { round:number; prompt:string; answers:Answer[]; match:boolean };
type RoomRow = typeof rooms.$inferSelect;

const clean = (s:unknown,max=12) => String(s??"").trim().slice(0,max);
const nextPrompt = (avoid?:string) => {
  const list=PROMPTS.filter(x=>x!==avoid);
  return list[Math.floor(Math.random()*list.length)];
};
const newCode = () => Math.random().toString(36).slice(2,8).toUpperCase();
const newPlayerId = () => Math.random().toString(36).slice(2,10);
const normalize = (s:string) => s.replace(/[\s，。！？、,.!?]/g,"").toLowerCase();
const startDeadline = (seconds:number) => seconds>0 ? new Date(Date.now()+seconds*1000).toISOString() : null;

function roomPlayers(room:RoomRow):StoredPlayer[]{
  try {
    const parsed=JSON.parse(room.players||"[]") as StoredPlayer[];
    if(Array.isArray(parsed)&&parsed.length) return parsed;
  } catch {}
  const legacy:StoredPlayer[]=[{
    id:"p1",token:room.player1Token,name:room.player1Name,
    word:room.player1Word,ready:room.player1Ready,nextReady:room.player1NextReady
  }];
  if(room.player2Token&&room.player2Name) legacy.push({
    id:"p2",token:room.player2Token,name:room.player2Name,
    word:room.player2Word,ready:room.player2Ready,nextReady:room.player2NextReady
  });
  return legacy;
}

function roomSpectators(room:RoomRow):StoredSpectator[]{
  try {
    const parsed=JSON.parse(room.spectators||"[]") as StoredSpectator[];
    return Array.isArray(parsed)?parsed:[];
  } catch { return []; }
}

function roomHistory(room:RoomRow,players:StoredPlayer[]):HistoryItem[]{
  try {
    const parsed=JSON.parse(room.history||"[]") as Array<HistoryItem&{p1?:string;p2?:string}>;
    if(!Array.isArray(parsed)) return [];
    return parsed.flatMap(item=>{
      if(Array.isArray(item.answers)) return item.answers.some(a=>a.word==="未作答") ? [] : [item];
      if(!item.p1||!item.p2||item.p1==="未作答"||item.p2==="未作答") return [];
      return [{
        round:item.round,prompt:item.prompt,match:item.match,
        answers:[
          {id:players[0]?.id||"p1",name:players[0]?.name||"玩家 1",word:item.p1},
          {id:players[1]?.id||"p2",name:players[1]?.name||"玩家 2",word:item.p2}
        ]
      }];
    });
  } catch { return []; }
}

const isFull = (room:RoomRow,players:StoredPlayer[]) => players.length>=room.maxPlayers;
const allSubmitted = (room:RoomRow,players:StoredPlayer[]) => isFull(room,players)&&players.every(p=>p.ready&&p.word);

function publicRoom(room:RoomRow,viewerToken?:string){
  const players=roomPlayers(room);
  const spectators=roomSpectators(room);
  const history=roomHistory(room,players);
  const reveal=allSubmitted(room,players);
  const player=players.find(p=>p.token===viewerToken);
  const spectator=spectators.find(p=>p.token===viewerToken);
  return {
    code:room.code,prompt:room.prompt,startMode:room.startMode,round:room.round,matches:room.matches,
    maxPlayers:room.maxPlayers,meId:player?.id||spectator?.id||null,
    meRole:player?"player":spectator?"spectator":null,spectatorCount:spectators.length,
    players:players.map(p=>({id:p.id,name:p.name,ready:p.ready,nextReady:p.nextReady,word:reveal?p.word:null})),
    timerSeconds:room.timerSeconds,deadline:room.deadline,
    history
  };
}

async function getRoom(code:string){
  const [room]=await getDb().select().from(rooms).where(eq(rooms.code,code)).limit(1);
  return room;
}

async function normalizeLegacyRoom(room:RoomRow){
  let players=roomPlayers(room);
  const history=roomHistory(room,players);
  let changed=room.players==="[]"||room.isPaused;
  players=players.map(player=>{
    if(player.ready&&player.word==="未作答"){
      changed=true;
      return {...player,word:null,ready:false};
    }
    return player;
  });
  if(changed||JSON.stringify(history)!==room.history){
    await getDb().update(rooms).set({
      players:JSON.stringify(players),history:JSON.stringify(history),
      isPaused:false,pausedRemaining:null,
      deadline:room.isPaused?startDeadline(Math.max(1,room.pausedRemaining||room.timerSeconds)):room.deadline,
      updatedAt:new Date().toISOString()
    }).where(eq(rooms.code,room.code));
    return (await getRoom(room.code))!;
  }
  return room;
}

async function finalizeRound(room:RoomRow){
  const players=roomPlayers(room);
  if(!allSubmitted(room,players)) return room;
  const history=roomHistory(room,players);
  if(history.some(h=>h.round===room.round)) return room;
  const answers=players.map(p=>({id:p.id,name:p.name,word:p.word!}));
  const match=new Set(answers.map(a=>normalize(a.word))).size===1;
  const cue=room.round===1||!history[0]
    ? (room.startMode==="free"?"自由开局":room.prompt)
    : history[0].answers.map(a=>a.word).join(" ＋ ");
  history.unshift({round:room.round,prompt:cue,answers,match});
  await getDb().update(rooms).set({
    history:JSON.stringify(history.slice(0,30)),matches:room.matches+(match?1:0),
    deadline:null,updatedAt:new Date().toISOString()
  }).where(eq(rooms.code,room.code));
  return (await getRoom(room.code))!;
}

export async function POST(req:Request){
  try {
    const body=await req.json() as Record<string,unknown>;
    const action=clean(body.action,20),playerToken=clean(body.token,80),roomCode=clean(body.code,6).toUpperCase();
    const db=getDb(),now=new Date().toISOString();

    if(action==="create"){
      const name=clean(body.name);
      if(!name||!playerToken) return Response.json({error:"昵称不能为空"},{status:400});
      const requestedTimer=Number(body.timerSeconds);
      const timerSeconds=[0,15,30,45,60].includes(requestedTimer)?requestedTimer:30;
      const requestedPlayers=Number(body.maxPlayers);
      const maxPlayers=[2,3,4,5].includes(requestedPlayers)?requestedPlayers:2;
      const startMode=body.startMode==="free"?"free":"topic";
      let code=newCode(); while(await getRoom(code)) code=newCode();
      const creator:StoredPlayer={id:newPlayerId(),token:playerToken,name,word:null,ready:false,nextReady:false};
      await db.insert(rooms).values({
        code,prompt:startMode==="free"?"自由开局":nextPrompt(),startMode,maxPlayers,
        players:JSON.stringify([creator]),player1Token:playerToken,player1Name:name,
        timerSeconds,createdAt:now,updatedAt:now
      });
      const room=(await getRoom(code))!;
      return Response.json({room:publicRoom(room,playerToken),playerId:creator.id},{status:201});
    }

    let current=await getRoom(roomCode);
    if(!current) return Response.json({error:"没有找到这个房间，请检查房间码"},{status:404});
    current=await normalizeLegacyRoom(current);

    if(action==="state") return Response.json({room:publicRoom(current,playerToken)});

    if(action==="join"){
      const name=clean(body.name);
      if(!name||!playerToken) return Response.json({error:"昵称不能为空"},{status:400});
      const players=roomPlayers(current);
      const existing=players.find(p=>p.token===playerToken);
      if(existing) return Response.json({room:publicRoom(current,playerToken),playerId:existing.id});
      const spectators=roomSpectators(current);
      const existingSpectator=spectators.find(p=>p.token===playerToken);
      if(existingSpectator) return Response.json({room:publicRoom(current,playerToken),playerId:existingSpectator.id,role:"spectator"});
      if(players.length>=current.maxPlayers){
        const spectator:StoredSpectator={id:newPlayerId(),token:playerToken,name};
        spectators.push(spectator);
        await db.update(rooms).set({spectators:JSON.stringify(spectators),updatedAt:now}).where(eq(rooms.code,roomCode));
        const updated=(await getRoom(roomCode))!;
        return Response.json({room:publicRoom(updated,playerToken),playerId:spectator.id,role:"spectator"});
      }
      const player:StoredPlayer={id:newPlayerId(),token:playerToken,name,word:null,ready:false,nextReady:false};
      players.push(player);
      const deadline=players.length===current.maxPlayers?startDeadline(current.timerSeconds):null;
      await db.update(rooms).set({players:JSON.stringify(players),deadline,updatedAt:now}).where(eq(rooms.code,roomCode));
      const updated=(await getRoom(roomCode))!;
      return Response.json({room:publicRoom(updated,playerToken),playerId:player.id,role:"player"});
    }

    let players=roomPlayers(current);
    const playerIndex=players.findIndex(p=>p.token===playerToken);
    if(playerIndex<0) return Response.json({error:"你不是这个房间的玩家"},{status:403});

    if(action==="submit"){
      if(!isFull(current,players)) return Response.json({error:"等房间满员后再开始"},{status:409});
      if(players[playerIndex].ready) return Response.json({error:"你的答案已经锁定"},{status:409});
      const word=clean(body.word,10);
      if(!word) return Response.json({error:"答案不能为空"},{status:400});
      players[playerIndex]={...players[playerIndex],word,ready:true};
      await db.update(rooms).set({players:JSON.stringify(players),updatedAt:now}).where(eq(rooms.code,roomCode));
      const updated=await finalizeRound((await getRoom(roomCode))!);
      return Response.json({room:publicRoom(updated,playerToken)});
    }

    if(action==="ready_next"){
      const history=roomHistory(current,players);
      if(!allSubmitted(current,players)) return Response.json({error:"等所有人都完成后再进入下一轮"},{status:409});
      if(history[0]?.match) return Response.json({error:"你们已经同词相遇，可以开始新局"},{status:409});
      players[playerIndex]={...players[playerIndex],nextReady:true};
      if(players.every(p=>p.nextReady)){
        players=players.map(p=>({...p,word:null,ready:false,nextReady:false}));
        await db.update(rooms).set({
          round:current.round+1,players:JSON.stringify(players),deadline:startDeadline(current.timerSeconds),updatedAt:now
        }).where(eq(rooms.code,roomCode));
      } else {
        await db.update(rooms).set({players:JSON.stringify(players),updatedAt:now}).where(eq(rooms.code,roomCode));
      }
      const updated=(await getRoom(roomCode))!;
      return Response.json({room:publicRoom(updated,playerToken)});
    }

    if(action==="restart"){
      const history=roomHistory(current,players);
      if(!history[0]?.match) return Response.json({error:"继续联想，直到你们说出同一个词"},{status:409});
      players=players.map(p=>({...p,word:null,ready:false,nextReady:false}));
      await db.update(rooms).set({
        prompt:current.startMode==="free"?"自由开局":nextPrompt(current.prompt),round:1,
        history:"[]",players:JSON.stringify(players),deadline:startDeadline(current.timerSeconds),updatedAt:now
      }).where(eq(rooms.code,roomCode));
      const updated=(await getRoom(roomCode))!;
      return Response.json({room:publicRoom(updated,playerToken)});
    }

    return Response.json({error:"未知操作"},{status:400});
  } catch(error){
    console.error(error);
    return Response.json({error:"服务器开小差了，请稍后重试"},{status:500});
  }
}
