"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Player = { id:string; name:string; ready:boolean; nextReady:boolean; word:string|null };
type Answer = { id:string; name:string; word:string };
type HistoryItem = { round:number; prompt:string; answers:Answer[]; match:boolean };
type Room = {
  code:string; prompt:string; startMode:"topic"|"free"; round:number; matches:number;
  maxPlayers:number; meId:string|null; meRole:"player"|"spectator"|null; spectatorCount:number; players:Player[];
  timerSeconds:number; deadline:string|null; history:HistoryItem[];
};

const api = async (body:Record<string,unknown>) => {
  const res=await fetch("/api/game",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
  const data=await res.json();
  if(!res.ok) throw new Error(data.error||"网络开小差了，请再试一次");
  return data;
};

function token(){
  let value=localStorage.getItem("tongci-player-token");
  if(!value){
    value=typeof crypto.randomUUID==="function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem("tongci-player-token",value);
  }
  return value;
}

export default function Home(){
  const [screen,setScreen]=useState<"home"|"room">("home");
  const [name,setName]=useState("");
  const [joinCode,setJoinCode]=useState("");
  const [room,setRoom]=useState<Room|null>(null);
  const [word,setWord]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [copied,setCopied]=useState(false);
  const [timerSeconds,setTimerSeconds]=useState(30);
  const [startMode,setStartMode]=useState<"topic"|"free">("topic");
  const [maxPlayers,setMaxPlayers]=useState(2);
  const [nowMs,setNowMs]=useState(Date.now());

  const roomFull=!!room&&room.players.length===room.maxPlayers;
  const allSubmitted=roomFull&&!!room?.players.every(p=>p.ready);
  const me=useMemo(()=>room?.players.find(p=>p.id===room.meId)||null,[room]);
  const isSpectator=room?.meRole==="spectator";
  const secondsLeft=room?.timerSeconds===0?null
    : room?.deadline?Math.max(0,Math.ceil((new Date(room.deadline).getTime()-nowMs)/1000)):room?.timerSeconds;
  const raceProgress=room?.timerSeconds&&secondsLeft!==null
    ? Math.max(0,Math.min(1,1-secondsLeft/room.timerSeconds)):0;

  const refresh=useCallback(async(code:string)=>{
    try {
      const data=await api({action:"state",code,token:token()});
      setRoom(data.room);
    } catch(e){ setError((e as Error).message); }
  },[]);

  useEffect(()=>{
    const params=new URLSearchParams(location.search);
    const invite=params.get("room");
    if(invite){
      const code=invite.toUpperCase();
      setJoinCode(code);
      if(localStorage.getItem(`tongci-role-${code}`)){
        api({action:"state",code,token:token()}).then(data=>{setRoom(data.room);setScreen("room");}).catch(()=>{});
      }
    }
  },[]);

  useEffect(()=>{
    if(!room?.code) return;
    const id=window.setInterval(()=>refresh(room.code),1400);
    return()=>clearInterval(id);
  },[room?.code,refresh]);

  useEffect(()=>{ setWord(""); },[room?.round]);

  useEffect(()=>{
    if(!room?.deadline||allSubmitted) return;
    const id=window.setInterval(()=>setNowMs(Date.now()),250);
    return()=>clearInterval(id);
  },[room?.deadline,allSubmitted]);

  async function createRoom(){
    if(!name.trim()) return setError("先告诉大家怎么称呼你吧");
    setBusy(true);setError("");
    try{
      const data=await api({action:"create",name:name.trim(),token:token(),timerSeconds,startMode,maxPlayers});
      localStorage.setItem(`tongci-role-${data.room.code}`,data.playerId);
      setRoom(data.room);setScreen("room");
      history.replaceState({},"",`?room=${data.room.code}`);
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }

  async function joinRoom(){
    if(!name.trim()||joinCode.trim().length!==6) return setError("请输入昵称和 6 位房间码");
    setBusy(true);setError("");
    try{
      const data=await api({action:"join",name:name.trim(),code:joinCode.trim().toUpperCase(),token:token()});
      localStorage.setItem(`tongci-role-${data.room.code}`,data.playerId);
      setRoom(data.room);setScreen("room");
      history.replaceState({},"",`?room=${data.room.code}`);
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }

  async function submitWord(){
    if(!word.trim()||!room) return;
    setBusy(true);setError("");
    try{
      const data=await api({action:"submit",code:room.code,token:token(),word:word.trim()});
      setRoom(data.room);
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }

  async function nextRound(restart=false){
    if(!room) return;
    setBusy(true);setError("");
    try{
      const data=await api({action:restart?"restart":"ready_next",code:room.code,token:token()});
      setRoom(data.room);
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }

  function leaveRoom(){
    if(room) localStorage.removeItem(`tongci-role-${room.code}`);
    setRoom(null);setWord("");setJoinCode("");setError("");setCopied(false);setScreen("home");
    history.replaceState({},"",location.pathname);
  }

  async function copyRoomCode(){
    if(!room) return;
    await navigator.clipboard.writeText(room.code);
    setCopied(true);setTimeout(()=>setCopied(false),1600);
  }

  if(screen==="home") return(
    <main className="shell landing">
      <div className="orb orb-a"/><div className="orb orb-b"/>
      <header className="brand"><span className="brand-mark">同</span><span>同词相遇</span><i>多人默契挑战</i></header>
      <section className="hero">
        <div className="eyebrow"><span>●</span> 2–5 人远程同频挑战</div>
        <h1>我们会想到<br/><em>同一个词</em>吗？</h1>
        <p>隔着屏幕，同时写下脑海中的答案。不开麦、不提示，看看大家到底有多默契。</p>
        <div className="mini-demo" aria-hidden="true">
          <div><small>玩家 1</small><b>海边</b></div><span>✦</span><div><small>玩家 2</small><b>海边</b></div>
          <strong>同词相遇!</strong>
        </div>
      </section>
      <section className="entry-card">
        <label>你的昵称</label>
        <input value={name} onChange={e=>setName(e.target.value)} maxLength={12} placeholder="例如：小王"/>
        <div className="player-setting">
          <label>房间人数</label>
          <div>{[2,3,4,5].map(value=><button key={value} className={maxPlayers===value?"selected":""} onClick={()=>setMaxPlayers(value)}>{value} 人</button>)}</div>
        </div>
        <div className="mode-setting">
          <label>开局方式</label>
          <div>
            <button className={startMode==="topic"?"selected":""} onClick={()=>setStartMode("topic")}><b>提示主题</b><span>根据一个主题开始</span></button>
            <button className={startMode==="free"?"selected":""} onClick={()=>setStartMode("free")}><b>自由开局</b><span>直接各说一个词</span></button>
          </div>
        </div>
        <div className="timer-setting">
          <label>每轮时间</label>
          <div>{[15,30,45,60,0].map(value=><button key={value} className={timerSeconds===value?"selected":""} onClick={()=>setTimerSeconds(value)}>{value===0?"不限":`${value}s`}</button>)}</div>
        </div>
        <button className="primary" onClick={createRoom} disabled={busy}>{busy?"正在准备…":"创建默契房间"}<span>↗</span></button>
        <div className="divider"><span>或加入朋友的房间</span></div>
        <div className="join-row">
          <input className="code-input" value={joinCode} onChange={e=>setJoinCode(e.target.value.replace(/[^a-z0-9]/gi,"").toUpperCase().slice(0,6))} placeholder="输入 6 位房间码"/>
          <button onClick={joinRoom} disabled={busy}>加入</button>
        </div>
        {error&&<p className="error">{error}</p>}
        <p className="privacy">无需注册 · 答案只在全员完成后公开</p>
      </section>
      <footer><span>1 创建房间</span><b>→</b><span>2 分享给朋友</span><b>→</b><span>3 全员同时作答</span></footer>
    </main>
  );

  if(!room) return null;
  const last=room.history[0];
  const cueAnswers=room.round>1?room.history[0]?.answers:null;

  return(
    <main className="shell game">
      <header className="game-head">
        <div className="brand"><span className="brand-mark">同</span><span>同词相遇</span></div>
        <button className="room-code" onClick={copyRoomCode}><small>房间</small><b>{room.code}</b><span>{copied?"房间号已复制 ✓":"复制房间号"}</span></button>
      </header>

      <section className="room-overview">
        <div className="score-card"><small>默契值</small><strong>{room.matches}</strong><span>次相遇</span>{room.spectatorCount>0&&<em>◉ {room.spectatorCount} 人旁观</em>}</div>
        <div className="players-strip">
          {Array.from({length:room.maxPlayers},(_,index)=>{
            const player=room.players[index];
            return player?(
              <article key={player.id} className={player.id===room.meId?"me":""}>
                <span className={`avatar tone-${index%5}`}>{player.name.slice(0,1)}</span>
                <b>{player.name}{player.id===room.meId&&<em>我</em>}</b>
                <i className={player.ready?"ready":""}>{player.ready?"已写好":roomFull?"思考中":"已加入"}</i>
              </article>
            ):(
              <article key={index} className="empty-player"><span className="avatar">＋</span><b>等待加入</b><i>空位</i></article>
            );
          })}
        </div>
      </section>

      <section className="play-card">
        <div className="round-pill">ROUND {room.round}</div>
        {roomFull&&!allSubmitted&&room.timerSeconds>0&&<div role="status" className={`timer-control ${secondsLeft===0?"finished":""} ${secondsLeft!==null&&secondsLeft>0&&secondsLeft<=5?"urgent":""}`}>
          <div className="race-track" aria-hidden="true"><span className="runner" style={{left:`${raceProgress*78}%`}}>🏃</span><i>⚑</i></div>
          <span className="timer-readout"><small>{secondsLeft===0?"已跑完，请作答":"200 m"}</small>{`00:${String(secondsLeft??0).padStart(2,"0")}`}</span>
        </div>}

        {!roomFull?(
          <div className="waiting">
            <div className="pulse">{room.players.length}/{room.maxPlayers}</div>
            <h2>等待其他玩家加入</h2>
            <p>还差 {room.maxPlayers-room.players.length} 人，把房间号发给大家</p>
            <button className="primary compact" onClick={copyRoomCode}>{copied?"房间号已复制 ✓":"复制房间号"}</button>
          </div>
        ):allSubmitted?(
          <div className={`reveal ${last?.match?"matched":""}`}>
            <p className="prompt">{last?.prompt||room.prompt}</p>
            <div className="answer-grid">
              {room.players.map((player,index)=><div key={player.id}><small>{player.name}</small><strong>{player.word}</strong><span className={`dot tone-${index%5}`}/></div>)}
            </div>
            <h2>{last?.match?"同词相遇！":"还没相遇，继续靠近"}</h2>
            <p>{last?.match?"大家的脑电波成功连接了":`下一轮根据「${room.players.map(p=>p.word).join("、")}」再联想一个词`}</p>
            {last?.match?(
              isSpectator?<div className="spectator-actions"><p>本轮挑战已经完成</p><button className="exit-room" onClick={leaveRoom}>退出房间</button></div>:<div className="match-actions"><button className="primary compact" onClick={()=>nextRound(true)} disabled={busy}>再来一轮 <span>→</span></button><button className="exit-room" onClick={leaveRoom} disabled={busy}>退出房间</button></div>
            ):isSpectator?(
              <div className="spectator-actions"><p>旁观中 · 等待玩家准备下一轮</p><button className="exit-room" onClick={leaveRoom}>退出房间</button></div>
            ):(
              <div className="next-ready">
                <button className="primary compact" onClick={()=>nextRound()} disabled={busy||!!me?.nextReady}>{me?.nextReady?"我已准备好 ✓":"我准备好了"}</button>
                <div className="ready-status">{room.players.map(p=><span key={p.id} className={p.nextReady?"on":""}>{p.name} {p.nextReady?"✓":"…"}</span>)}</div>
                {me?.nextReady&&<p>等待所有人准备好后自动进入下一轮</p>}
              </div>
            )}
          </div>
        ):isSpectator?(
          <div className="waiting spectator-view"><div className="pulse">◉</div><h2>旁观中</h2>{cueAnswers?<><p>这一轮根据这些词继续联想</p><div className="cue-cloud">{cueAnswers.map(answer=><span key={answer.id}>{answer.word}</span>)}</div></>:room.startMode==="free"?<p className="spectator-prompt">自由开局 · 玩家正在写下脑海里的词</p>:<p className="spectator-prompt">{room.prompt}</p>}<p>所有玩家完成后，答案会同时揭晓</p><button className="exit-room spectator-exit" onClick={leaveRoom}>退出房间</button></div>
        ):me?.ready?(
          <div className="waiting"><div className="pulse">✓</div><h2>答案已锁定</h2><p>正在等待其他玩家写完，先忍住别提示大家</p><div className="typing"><i/><i/><i/></div></div>
        ):(
          <div className="question">
            {cueAnswers?<>
              <p className="prompt-label">根据上一轮的词，再联想一个新词</p>
              <div className="cue-cloud">{cueAnswers.map(answer=><span key={answer.id}>{answer.word}</span>)}</div>
              <h2 className="bridge-title">找一个能把这些词连起来的词</h2>
            </>:room.startMode==="free"?<><p className="prompt-label">自由开局</p><h2>直接写下你脑海里的一个词</h2></>:<><p className="prompt-label">根据提示主题，凭第一直觉写下一个词</p><h2>{room.prompt}</h2></>}
            <div className="word-box"><input autoFocus maxLength={10} value={word} onChange={e=>setWord(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submitWord()} placeholder="你的答案…"/><span>{word.length}/10</span></div>
            <button className="primary compact" onClick={submitWord} disabled={busy||!word.trim()}>{busy?"锁定中…":"锁定答案"}</button>
            <p className="hint">提交后不可修改，全员完成后揭晓</p>
          </div>
        )}
      </section>

      {room.history.length>0&&<section className="history"><h3>相遇记录 <span>{room.history.length} 轮</span></h3><div>{room.history.slice(0,5).map(item=><article key={item.round}><span className={item.match?"hit":"miss"}>{item.match?"♥":"·"}</span><p><small>第 {item.round} 轮 · {item.prompt}</small><b>{item.answers.map(a=>a.word).join(" × ")}</b></p>{item.match&&<em>同词</em>}</article>)}</div></section>}
      {error&&<div className="toast">{error}</div>}
    </main>
  );
}
