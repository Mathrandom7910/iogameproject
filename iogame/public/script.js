//fix new player packet init with health and wep
let canv = document.getElementById("gamecanvas");
let ctx = canv.getContext("2d");
/*ctx.turndeg = 0;
ctx.turn = function(d, a){
  if(a){
    ctx.turndeg = d
  } else ctx.turndeg += d
}

ctx.movestep = function(s){
  calcvec()
}*/
//0.9999902065507035
const scale = 32;
const pi = Math.PI;
var ws;
var builds = [];
var text = document.getElementById("maintxtbx");
var atkstart;
var serversetting;
var pingtime;
var setping;
const playerhanddist = 40;
var gridlen;
var sqrgrid;
var ispressed = {
  w: false,
  a: false,
  s: false,
  d: false,
  ArrowRight: false,
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false
};
var attacking = false;
var discres = "Disconnected",
  setSend = WebSocket.prototype.send;

connecttoserver();

const pack = {
  move: "m",
  pos: "p",
  newplayer: "n",
  id: "i",
  close: "c",
  playerleave: "l",
  dir: "d",
  build: "b",
  chat: "ch",
  attack: "a",
  health: "h",
  ping: "pi",
  death: "de",
  weapon: "w",
  debug: "u",
  projectile: "pr",
  rmvProj: "rp"
};

var mp = {
  x: null,
  y: null,
  width: window.innerWidth,
  height: window.innerHeight,
  cw: 0,
  ch: 0,
  d: 0,
  od: null
};

var myPlayer = {
  x: 0,
  y: 0,
  id: null,
  availablewep: [0, 3],
  availableobj: [1, 2]
};

const buildinf = [
  {
    id: 0,
    name: "tree",
    draw: function(x, y) {
      const msc = scale * 2.5;
      ctx.save();
      ctx.strokeStyle = "#2ea300";
      circle(x, y, msc, "#08840D");
      ctx.restore();
    },
    type: 1
  },
  {
    id: 0,
    name: "sword",
    draw: function(x, y, d) {
      let temp = calcweppos(x, y, d - torad(155));
      let temp1 = calcweppos(x, y, d + torad(155));
      //temp = calcvec(temp[0], temp[1], d + 90)
      let pos = {
        x: temp[0],
        y: temp[1],
        ex: temp1[0],
        ey: temp1[1]
      };
      // console.log(pos)
      //handle
      ctx.save();
      ctx.lineCap = "square";
      ctx.beginPath();
      ctx.strokeStyle = "#868686";
      ctx.moveTo(pos.ex, pos.ey);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      //end handle
      let temp2 = calcvec(pos.x, pos.y, d + torad(90), 60);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.strokeStyle = "#454545";
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(temp2[0], temp2[1]);
      ctx.stroke();
      ctx.restore();
      //left blade guard
    },
    type: 0,
    animtime: 450,
    range: 60,
    damage: 40,
    heal: 0
  },
  {
    id: 1,
    type: 0,
    name: "apple",
    draw: function(x, y, d) {
      let temp = calcweppos(x, y, d - torad(180));
      circle(temp[0], temp[1], scale / 2, "#F21313", 5);
    },
    animtime: null
  },
  {
    id: 2,
    type: 0,
    name: "wall",
    animtime: null,
    heal: 0,
    draw: function(x, y, d) {
      const ofd = d - torad(180);
      let temp = calcweppos(x, y, d - torad(155)); // right
      let temp1 = calcweppos(x, y, d + torad(155)); // left
      let temp2 = calcvec(temp1[0], temp1[1], d - torad(30), 30);
      let temp3 = calcvec(temp2[0], temp2[1], d + torad(30), 30);
      let temp4 = calcvec(temp3[0], temp3[1], d + torad(90), 30);
      let temp5 = calcvec(temp4[0], temp4[1], d + torad(150), 30);
      let temp6 = calcvec(temp5[0], temp5[1], d + torad(210), 30);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(temp[0], temp[1]);
      ctx.lineTo(temp1[0], temp1[1]);
      ctx.lineTo(temp2[0], temp2[1]);
      ctx.lineTo(temp3[0], temp3[1]);
      ctx.lineTo(temp4[0], temp4[1]);
      ctx.lineTo(temp5[0], temp5[1]);
      ctx.lineTo(temp6[0], temp6[1]);
      ctx.fillStyle = "#E1AF04";
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  },
  {
    id: 3,
    type: 0,
    name: "pistol",
    animtime: null,
    heal: 0,
    draw: function(x, y, d) {
      const ofd = d - torad(180);
      const temp = calcvec(x, y, d, scale + scale / 4),
        temp1 = calcvec(x, y, d, scale * 2);
      ctx.save();
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(temp[0], temp[1]);
      ctx.lineTo(temp1[0], temp1[1]);
      ctx.stroke();
      ctx.restore();
    },
    shoot: true,
    changeHands: function(x, y, dir) {
      const temp = calcvec(x, y, dir + torad(20), scale + scale / 2.4),
        temp1 = calcvec(x, y, dir - torad(15), scale + scale / 4);
      return [temp, temp1];
    }
  }
];

var players = [];

mp.cw = mp.width / 2;
mp.ch = mp.height / 2;
resizecanv();

canv.addEventListener(
  "mousemove",
  function(e) {
    mp.x = e.clientX;
    mp.y = e.clientY;
   if(!locked) mp.d = getangle();
  },
  false
);
var lastSent = 0,
    sendTime = 350;
setInterval(function() {
  if (mp.od !== mp.d && lastSent - time() < sendTime)
    send([pack.dir, mp.d]), (mp.od = mp.d), (lastSent = time());
}, 10);

function gameTick() {
  if (myPlayer.id !== null) {
    render();
  } else disconected_screen();
}

window.onresize = (resizecanvfull);

function resizecanvfull() {
  mp.width = window.innerWidth;
  mp.height = window.innerHeight;
  resizecanv();
}

function resizecanv(w = mp.width, h = mp.height) {
  mp.cw = w / 2;
  mp.ch = h / 2;
  canv.width = w - w / 100;
  canv.height = h - h / 130;
}

function getangle() {
  const xdir = mp.x - mp.cw;
  const ydir = mp.y - mp.ch;
  const theta = Math.atan2(ydir, xdir);
  return theta;
}

function getdir(fromx, fromy, tox, toy){
    const xdir = tox - fromx;
  const ydir = toy - fromy;
  const theta = Math.atan2(ydir, xdir);
  return theta;
}

const radmult = pi / 180;

function torad(deg) {
  return deg * radmult;
}

const maxturnrad = 1.5;

function circle(x, y, r, c = false, f = 10) {
  ctx.save();
  ctx.lineWidth = f;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, pi * 3);
  if (c !== false) (ctx.fillStyle = c), ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function player(x, y, d, w, changeHand) {
  const rad35 = torad(playerhanddist);
  const width = 8,
    hands = changeHand
      ? changeHand(x, y, d)
      : [
          [Math.cos(d + rad35) * scale + x, Math.sin(d + rad35) * scale + y],
          [Math.cos(d - rad35) * scale + x, Math.sin(d - rad35) * scale + y]
        ];
  circle(hands[0][0], hands[0][1], scale / 2.5, "#B36304", width);
  circle(hands[1][0], hands[1][1], scale / 2.5, "#B36304", width);
  circle(x, y, scale, "#B36304", width);
  drawweapon(w, x, y, d);
}

function render() {
  if (ws.isclosed) return;
  ctx.clearRect(0, 0, mp.width, mp.height);
  ctx.save();
 /* ctx.fillStyle = "#7eff57";
  ctx.fillRect(0, 0, mp.width, mp.height);*/
  ctx.translate(mp.cw, mp.ch);
  ctx.lineWidth = scale / 3;

  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 2;
  for (let i = -sqrgrid + 1; i < sqrgrid; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 100 - myPlayer.x, gridlen - myPlayer.y);
    ctx.lineTo(i * 100 - myPlayer.x, -gridlen - myPlayer.y);
    ctx.stroke();
  }
  for (let i = sqrgrid - 1; i > -sqrgrid; i--) {
    ctx.beginPath();
    ctx.moveTo(gridlen - myPlayer.x, i * 100 - myPlayer.y);
    ctx.lineTo(-gridlen - myPlayer.x, i * 100 - myPlayer.y);
    ctx.stroke();
  }
  ctx.restore();

  drawallplayers();
  
    for(let i = 0; i < projectiles.length; i++){
    let index = projectiles[i],
        pos = calcvec(index.x, index.y, index.dir, 10);
    
    index.x = pos[0];
    index.y = pos[1];
    
    circle(index.x - myPlayer.x, index.y - myPlayer.y, 4)
    
    projectiles[i] = index;
  }

  //does buildings
  for (let i = 0; i < builds.length; i++) {
    let index = builds[i];
    building(index[1], index[2], index[3], index[4], index[5]);
  }
  ctx.restore();
  ctx.save();
  ctx.translate(mp.cw - mp.cw / 4, mp.ch / 12);
  ctx.font = `${scale - scale / 5}px Georgia`;
  ctx.globalAlpha = 1;
  ctx.fillText(pingtime ? `ping ${pingtime}` : "Connecting...", 0, 0);
  ctx.restore();
  

}

function avg(n1, n2) {
  return (n1 + n2) / 2;
}

function building(x, y, t, rt, d) {
  for (let i = 0; i < buildinf.length; i++) {
    let index = buildinf[i];
    if (index.id == t && index.type == rt)
      index.draw(x - myPlayer.x, y - myPlayer.y, d);
  }
}

function disconected_screen() {
  //setInterval(function() {
  // ctx.clearRect(0, 0, mp.width, mp.height);
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.fillRect(0, 0, mp.width, mp.height);
  ctx.font = `${scale * 3}px Georgia`;
  ctx.globalAlpha = 0.7;
  ctx.fillText(discres, mp.cw / 2, mp.ch);
  ctx.restore();
  // }, 10);
}

function healthbar(x, y, health, isenemy) {
  if (health * 100 < 1) return;
  //work on isenemy later
  ctx.save();
  const scdiv = scale / 3;
  const stx = x - scale;
  const etx = scale / 10;
  const yp = y + scdiv;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.strokeStyle = "#00FF00";
  //bar bg (but just bar 4 now)
  ctx.moveTo(stx, yp);
  //ctx.lineTo(x - scdiv, y - scdiv);
  ctx.lineTo(stx + 65 * health, yp);
  ctx.stroke();

  /*//actual bar
  
  ctx.beginPath();
  ctx.moveTo(stx + etx, yp);
  ctx.strokeStye = "#55FF33"
  ctx.lineTo(x + scale, yp);
  ctx.stroke();
  //ctx.closePath();*/
  ctx.restore();
}

function calcweppos(x, y, d) {
  return calcvec(x, y, d, -scale * 1.5);
  /* let ex = Math.cos(d) * -scale * 2 + x;
  let ey = Math.sin(d) * -scale * 2 + y;
  return [ex, ey];*/
}

function calcvec(x, y, d, s) {
  let ex = Math.cos(d) * s + x;
  let ey = Math.sin(d) * s + y;
  return [ex, ey];
}

function drawweapon(id, x, y, d) {
  const thiswep = finditem(id, 0);
  if (thiswep !== false) thiswep.draw(x, y, d);
}

function finditem(id, t) {
  for (let i = 0; i < buildinf.length; i++) {
    let index = buildinf[i];
    if (index.id == id && index.type == t) return index;
  }
  return false;
}

function findplayer(id) {
  for (let i = 0; i < players.length; i++) {
    let index = players[i];
    if (index[0] == id) return index;
  }
  return -1;
}

function findplayerindex(id) {
  for (let i = 0; i < players.length; i++) {
    let index = players[i];
    if (index[0] == id) return i;
  }
}

function lerp(startval, value, stage) {
  return startval + (value - startval) * stage;
}

Math.lerpAngle = function(e, t, n) {
  var S = Math.PI,
    T = 2 * S;
  Math.abs(t - e) > S && (e > t ? (t += T) : (e += T));
  var i = t + (e - t) * n;
  return i >= 0 && i <= T ? i : i % T;
};

Math.lerp = function(e, t, n) {
  return e + (t - e) * n;
};

function updatemove() {
  var mdir = null;
  if (ispressed.w || ispressed.ArrowUp) {
    mdir = torad(270);
    if (ispressed.a || ispressed.ArrowLeft) {
      mdir = torad(225);
      send([pack.move, mdir]);
      return;
    }
    send([pack.move, mdir]);
  }
  if (ispressed.a || ispressed.ArrowLeft) {
    mdir = torad(180);
    if (ispressed.s || ispressed.ArrowDown) mdir = torad(135);
    send([pack.move, mdir]);
    return;
  }
  if (ispressed.s || ispressed.ArrowDown) {
    mdir = torad(90);
    if (ispressed.d || ispressed.ArrowRight) mdir = torad(45);
    send([pack.move, mdir]);
    return;
  }
  if (ispressed.d || ispressed.ArrowRight) {
    mdir = 0;
    if (ispressed.w || ispressed.ArrowUp) mdir = torad(315);
    send([pack.move, mdir]);
    return;
  }
}

function drawallplayers() {
  for (let i = 0; i < players.length; i++) {
    let index = players[i];
    //             id,       x,      y,    dir chat  health
    var thisplayer = {
      id: index[0],
      x: index[1],
      y: index[2],
      dir: index[3],
      chat: index[4],
      health: index[5],
      isatk: index[7],
      weapon: index[6],
      wepindex: finditem(index[6], 0),
      dpcount: index[8],
      isme: index[0] == myPlayer.id,
      lastdir: index[9],
      chattimer: index[10],
      angletick: index[11],
      lastx: index[12],
      lasty: index[13],
      postick: index[14],
      mDir: index[15],
      speed: index[16],
      lmdir: index[17]
    };
    /*
    thisplayer.mdir2 = (thisplayer.x == thisplayer.lastx && thisplayer.y == thisplayer.lasty) ? null : getdir(thisplayer.lastx, thisplayer.lasty, thisplayer.x, thisplayer.y)
    //document.title = thisplayer.mdir2
    
   if(thisplayer.mdir2 !== null){
      let calcPos = calcvec(thisplayer.lastx, thisplayer.lasty, thisplayer.mdir2, thisplayer.speed);
            thisplayer.x = calcPos[0];
      thisplayer.y = calcPos[1];
      if(thisplayer.isme){
        myplayer.x = thisplayer.x;
        myplayer.y = thisplayer.y;
      }
    } */
    if(thisplayer.speed > 0){
      let calcPos = calcvec(thisplayer.x, thisplayer.y, thisplayer.lmdir, thisplayer.speed / 10);
      thisplayer.x = calcPos[0];
      thisplayer.y = calcPos[1];
      if(thisplayer.isme){
        myPlayer.x = thisplayer.x;
        myPlayer.y = thisplayer.y;
      }
    }

    thisplayer.rx = thisplayer.x - myPlayer.x;
    thisplayer.ry = thisplayer.y - myPlayer.y;

    if (thisplayer.dir !== thisplayer.lastdir) thisplayer.angletick = 0;
    if (thisplayer.angletick < 1) thisplayer.angletick += 0.1;
    thisplayer.dir = Math.lerpAngle(
      thisplayer.dir,
      thisplayer.lastdir,
      thisplayer.angletick
    );
    thisplayer.chattimer =
      thisplayer.chattimer > 10 ? thisplayer.chattimer - 10 : 0;
    /*if(!thisplayer.isme){
        const xdir = thisplayer.x - myplayer.x 
  const ydir = thisplayer.y - myplayer.y;
  const theta = Math.atan2(ydir, xdir);
      send([pack.dir, theta]);
      send([pack.move, theta]);
    }*/
    // console.log(thisplayer.isatk, thisplayer.atktime)
    /* ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(thisplayer.rx, thisplayer.ry);
    ctx.stroke();*/
    let indexf = findplayer(thisplayer.id);
    const plfi = findplayerindex(thisplayer.id);
    if (thisplayer.isatk) {
      thisplayer.dpcount -= torad(4);
    } else if (thisplayer.dpcount < 0) thisplayer.dpcount += torad(4);
    const playerabsdir =
      (thisplayer.isme ? mp.d : (thisplayer.dir + thisplayer.lastdir) / 2) +
      thisplayer.dpcount;
    
    if(thisplayer.isme){
      myPlayer.weapon = thisplayer.weapon;
      sendTime = finditem(myPlayer.weapon, 0) && attacking ? 50 : 350;
    }

    player(
      thisplayer.rx,
      thisplayer.ry,
      playerabsdir,
      thisplayer.weapon,
      thisplayer.wepindex.changeHands
    );
    thisplayer.lastx = thisplayer.x;
    thisplayer.lasty = thisplayer.y;
    thisplayer.lastdir = thisplayer.dir;
    indexf[1] = thisplayer.x;
    indexf[2] = thisplayer.y;
    indexf[8] = thisplayer.dpcount;
    indexf[9] = thisplayer.lastdir;
    indexf[10] = thisplayer.chattimer;
    indexf[11] = thisplayer.angletick;
    indexf[12] = thisplayer.lastx;
    indexf[13] = thisplayer.lasty;
    index[14] = thisplayer.postick;
    if (thisplayer.chattimer == 0) {
      thisplayer.chat = null;
      indexf[4] = thisplayer.chat;
    }
    players[plfi] = indexf;

    //does healthbar
    healthbar(
      thisplayer.rx,
      thisplayer.ry + scale * 2,
      thisplayer.health / 100
    );

    //does chat
    if (thisplayer.chat !== null) {
      ctx.font = "30px Georgia";
      ctx.fillText(
        thisplayer.chat,
        thisplayer.rx,
        thisplayer.y - (myPlayer.y + scale * 2)
      );
    }
    ctx.font = "30px Georgia";
    ctx.fillText(
      `[${thisplayer.id}]`,
      thisplayer.x - (myPlayer.x + scale + scale / 2),
      thisplayer.y - (myPlayer.y + scale * 2)
    );

    //end of player loop
  }
}

document.addEventListener("keydown", function(e) {
  if (
    document.getElementById("maintxtbx").style.display == "block" &&
    e.keyCode !== 13
  )
    return;
  ispressed[e.key] = true;
  updatemove();
  switch (e.keyCode) {
    case 13:
      if (text.style.display == "block") {
        //if shown
        send([pack.chat, text.value]);
        text.value = "";
        text.style.display = "none";
        send([pack.move, null]);
      } else text.style.display = "block";
      break;
    case 49:
      send([pack.weapon, myPlayer.availablewep[0]]);
      break;
    case 50:
      send([pack.weapon, myPlayer.availableobj[0]]);
      break;
    case 81:
      send([pack.weapon, myPlayer.availableobj[0]]);
      break;
    case 51:
      send([pack.weapon, myPlayer.availableobj[1]]);
      break;
    case 52:
      send([pack.weapon, myPlayer.availablewep[1]]);
      break;
    case 32:
      if (!attacking) {
        send([pack.attack, true, mp.d]);
        attacking = true;
      }
      break;

      case 69:
        
        attacking = !attacking;
  send([pack.attack, attacking]);
  break;

  case 88:
  locked = !locked;
  if(!locked) mp.d = getangle();
  break;
  }
});

document.addEventListener("keyup", function(e) {
  const k = e.keyCode;
  ispressed[e.key] = false;
  updatemove();
  if (
    ispressed.w == false &&
    ispressed.s == false &&
    ispressed.a == false &&
    ispressed.d == false &&
    ispressed.ArrowUp == false &&
    ispressed.ArrowDown == false &&
    ispressed.ArrowLeft == false &&
    ispressed.ArrowRight == false
  )
    send([pack.move, null]);
  switch (e.keyCode) {
    case 32:
      if (attacking) {
        send([pack.attack, false]);
        attacking = false;
      }
      break;
  }
});

var locked = false;

canv.addEventListener(
  "mousedown",
  function(e) {
    if (!attacking) {
      send([pack.attack, true]);
      attacking = true;
    }
  },
  false
);

canv.addEventListener(
  "mouseup",
  function(e) {
    if (attacking) {
      send([pack.attack, false]);
      attacking = false;
    }
  },
  false
);

function send(m) {
  if (!ws.isclosed) ws.send(msgpack.encode(m));
}
var isBlur = false;
window.onblur = function() {
  isBlur = true;
};

window.onfocus = function() {
  isBlur = true;
};
function connecttoserver(e = "ws://scrappypi:5001/") {
  ws = new WebSocket(e);
  ws.binaryType = "arraybuffer";
  ws.isclosed = true;
  ws.kicked = false;
  var isOpen = false;
  ws.onopen = function() {
    isOpen = true;
    discres = "Disconnected";
    ws.isclosed = false;
    send([pack.ping]);
    setping = time();
    ws.onmessage = function(m) {
      const data = msgpack.decode(new Uint8Array(m.data));
      console.log(data)
      const thisplayer = {
        data: findplayer(data[1]) || null,
        ind: findplayerindex(data[1]) || null
      };
      switch (data[0]) {
        case pack.pos:
      //   console.log(data)
          const pos = data[1];
          for (let i = 0; i < players.length; i++) {
            let index = players[i];
            if (index[0] == pos[0]) {
              players[i][1] = pos[1];
              players[i][2] = pos[2];
              players[i][15] = pos[4];
              players[i][16] = pos[5];
              players[i][17] = pos[6];
              if (pos[0] == myPlayer.id) {
                myPlayer.x = pos[1];
                myPlayer.y = pos[2];
                myPlayer.mdir = pos[4];
                myPlayer.speed = pos[5];
                myPlayer.lmDir = pos[6];
              }
            }
          }

          //console.log(players);
          break;
        case pack.id:
          myPlayer.id = data[1];
          serversetting = data[2];
          gridlen = data[3];
          sqrgrid = Math.sqrt(gridlen) / 3;
          //document.title = myplayer.id;
          break;
        case pack.newplayer:
          //             0id,       1x,      2y, 3dir 4chat 5health 6weapon 7is_firing 8dpluscounter 9lastdir 10chattimer 11angle tick 12 last x 13 last y 14 pos tick 15: movedir 16: speed 17: lmdir
          players.push([
            data[1],
            data[2],
            data[3],
            data[4],
            null,
            data[5],
            data[6] == undefined ? 0 : data[6],
            false,
            0,
            0,
            0,
            0,
            data[2],
            data[3],
            0,
            null,
            0,
            null
          ]);
          //console.log(players);
          break;
        case pack.close:
          discres = data[1] || "Disconnected";
          ws.kicked = true;
          ws.close();
          console.log("kicked", discres);
          break;
        case pack.playerleave:
          //removes player
          for (let i = 0; i < players.length; i++) {
            let index = players[i];
            if (index[0] == data[1]) players.splice(i, 1);
          }
          //removes all players builds
          for (let i = 0; i < builds.length; i++) {
            let index = builds[i];
            if (index[6] == data[1]) builds.splice(i, 1);
          }
          //console.log(players)
          break;
        case pack.dir:
          for (let i = 0; i < players.length; i++) {
            let index = players[i];
            if (index[0] == data[1]) {
              //if id
              index[3] = data[2]; // data 2 is payload(dir)
              players[i] = index;
            }
          }

          break;
        case pack.build:
          builds.push(data[1]);
          //console.log(data[])
          break;
        case pack.chat:
          for (let i = 0; i < players.length; i++) {
            let index = players[i];
            if (index[0] == data[1]) {
              //if id
              index[4] = data[2]; // data 2 is payload(dir)
              index[10] = 1000;
              players[i] = index;
            }
          }
          break;
        case pack.attack:
          if (finditem(thisplayer.data[6], 0).animtime) {
            thisplayer.data[7] = true;
            players[thisplayer.ind] = thisplayer.data;
            setTimeout(function() {
              thisplayer.data[7] = false;
              players[thisplayer.ind] = thisplayer.data;
            }, finditem(thisplayer.data[6], 0).animtime / 2);
          }
          break;

        case pack.health:
          let fpl = findplayer(data[1]);
          const fpli = findplayerindex(data[1]);
          fpl[5] = data[2];
          players[fpli] = fpl;
          break;
        case pack.ping:
          pingtime = time() - setping;
          send([pack.ping, pingtime]);
          break;

        case pack.death:
          if (data[1] == myPlayer.id) {
            myPlayer.availablewep = [0, 3];
            myPlayer.availableobj = [1, 2];
          }
          break;

        case pack.weapon:
          thisplayer.data[6] = data[2];
          players[thisplayer.ind] = thisplayer.data;
          break;

        case pack.debug:
          pingtime = data[1];
          break;

        case pack.projectile:
          //console.log(data)
          projectiles.push({type: data[1], x: data[2], y: data[3], dir: data[4], id: data[5]});
          break;
          
        case pack.rmvProj:
          for(let i = 0; i < projectiles.length; i++){
            if(projectiles[i].id == data[1]) return projectiles.splice(i, 1);
          }
          pingtime = `could not find projectile with id ${data[1]}`;
          console.log(projectiles);
          break;

        default:
          console.log("bad packet:", data);
          ws.kicked = true;
          pingtime = `recieved bad packet "${
            data[0]
          }" check console for more info`;
          send([pack.close]);
          return;
          break;
      }
    };
    setInterval(function() {
      send([pack.ping]);
      setping = time();
    }, 5000);
    setInterval(gameTick, 10);
  };
  ws.onclose = function() {
    console.log("Socket closed");
    ws.isclosed = true;
    disconected_screen();
    if (!ws.kicked) location.reload();
    return;
  };
  ws.onerror = function(e) {
    window.alert(`error connecting to server ${e}`);
   // location.reload();
  };
}

function time() {
  return Date.now();
}

setInterval(function() {
  if (WebSocket.prototype.send !== setSend) send([pack.close]);
}, 10000);

var projectiles = [];