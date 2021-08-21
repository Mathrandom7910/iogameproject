const express = require("express"),
app = express();

const http = require("http"),
  fs = require("fs"),
  type = {
    js: "application/javascript",
    html: "text/html",
    css: "text/css",
    png: "image/png",
    txt: "text/text"
  },
  dirF = `${__dirname}/public/`

var sends = {
  script: null,
  msgpack: null,
  html: null
}

function readFile(file, cb = function () { return null; }) {
  fs.readFile(file, function (er, data) {
    if (er) console.log(`Error reading file ${er}`);
    return cb(data);
  });
}


readFile(`${dirF}script.js`, function (data) {
  sends.script = data;
});

readFile(`${dirF}msgpack.js`, function (data) {
  sends.msgpack = data;
});

readFile(`${dirF}index.html`, function (data) {
  sends.html = data;
});

app.get("/", function(req, res){
  if(sends.script == null || sends.msgpack == null || sends.html == null) res.end("server still loading!");//only one is needed
    res.writeHead(200, { "Content-Type": type.html });
    res.write(sends.html);
    res.end();
});

app.get("/msgpack.js", function(req, res){
  res.writeHead(200, { "Content-Type": type.js });
  res.write(sends.msgpack);
  res.end();
});

app.get("/script.js", function(req, res){
  res.writeHead(200, { "Content-Type": type.js });
  res.write(sends.script);
  res.end();
});

app.listen(5000, function(err){
  if (err) return console.log("Error in server setup", err);
  console.log("Server listening on Port", 5000);
})

//add
const WebSocket = require("ws");
const msgpack = require("msgpack-lite");
const port = 5001;
const msupdate = 100;
const max_players = 100;
const ip_limit = 3;
const gridlen = 30;
const max_grid = Math.pow(gridlen, 2);
const normal_speed = 0.3;
const genwholemap = [true, 400];
const body_size = 33;
const base_speed = msupdate / 10 + 2,
  speedMin = 5;

const buildinf = [
    {
      id: 0,
      name: "tree",
      type: 1
    },
    {
      id: 0,
      name: "sword",
      type: 0,
      animtime: 450,
      range: 60,
      damage: 40,
      heal: 0,
      spmult: 3,
      use: false
    },
    {
      id: 1,
      type: 0,
      name: "apple",
      animtime: null,
      heal: 20,
      spmult: normal_speed,
      use: true,
      place: false
    },
    {
      id: 2,
      type: 0,
      name: "wall",
      animtime: null,
      heal: 0,
      spmult: normal_speed,
      use: true,
      place: true
    },
    {
      id: 1,
      name: "Wall",
      type: 1
    },
    {
      id: 3,
      type: 0,
      name: "pistol",
      animtime: 1500,
      heal: 0,
      spmult: 1,
      use: false,
      shoot: true
    }
  ],
  projectiles = [
    {
      id: 0,
      name: "pistol bullet",
      speed: 100,
      damage: 50,
      time: 1000
    }
  ];

var clients = [];

var pldat = {
  allow: clients.length <= max_players,
  players: clients.length,
  maxplayers: max_players
};

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

function sendtoall(m) {
  clients.forEach(client => client[0].send(msgpack.encode(m)));
}

function genid() {
  var allids = [];
  if (clients.length >= max_players) return -1;
  if (clients.length) {
    for (var i = 0; i < clients.length; i++) {
      let index = clients[i];
      allids.push(index[1]);
    }
    for (var i = 0; i < allids.length; i++) {
      if (!allids.includes(i)) {
        return i;
      }
    }
    return allids.length;
  } else {
    return 0;
  }
}

function genProjId() {
  var allids = [];
  if (projectilesActive.length) {
    for (let i = 0; i < projectilesActive.length; i++) {
      let index = projectilesActive[i];
      allids.push(index.id);
    }
    for (let i = 0; i < allids.length; i++) {
      if (!allids.includes(i)) {
        return i;
      }
    }
    return allids.length;
  } else {
    return 0;
  }
}

function finditem(id, t) {
  for (let i = 0; i < buildinf.length; i++) {
    let index = buildinf[i];
    if (index.id == id && index.type == t) return index;
  }
}

const radmult = Math.PI / 180;

function torad(deg) {
  return deg * radmult;
}

function time() {
  return Date.now();
}

function getangle(fr, to) {
  const xdir = to.x - fr.x;
  const ydir = to.y - fr.y;
  const theta = Math.atan2(ydir, xdir);
  return theta;
}

function genformap() {
  return rndm() > 0.5 ? rndm(-max_grid) : rndm(max_grid);
}

function getdist(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2);
}

function getProjectile(id) {
  for (let i = 0; i < projectiles.length; i++) {
    let index = projectiles[i];

    if (index.id == id) return index;
  }
}

function addProjectile(type, x, y, dir) {
  const id = genProjId();
  projectilesActive.push({
    x: x,
    y: y,
    type: type,
    dir: dir,
    timeLeft: getProjectile(type).time,
    id: id
  });
  sendtoall([pack.projectile, type, x, y, dir, id]);
}

var projectilesActive = [],
  loop;

const wsServer = new WebSocket.Server({ port: port });

wsServer.on("connection", function(socket, req) {
  try {
    var speed = 0;
    var spmult;
    const id = genid();
    var connections = 0;
    if (id == -1) {
      pldat = {
        allow: clients.length <= max_players,
        players: clients.length,
        maxplayers: max_players
      };
      kickclient("too many players");
    }
    //socket.terminate();
    console.log("new client", id);
    var player = {
      x: genwholemap[0] ? genformap() : rndm(genwholemap[1]),
      y: genwholemap[0] ? genformap() : rndm(genwholemap[1]),
      id: id,
      dir: 0,
      mdir: null,
      health: 100,
      isadmin: false,
      isattack: false,
      ping: null,
      ip: req.headers["x-forwarded-for"],
      weapon: 0,
      nextatk: 0,
      isprimary: true,
      avweps: [0, 3],
      avobj: [1],
      left: false,
      lastpacket: time(),
      lmdir: null,
      buildcount: 0,
      speed: 0,
      lastDirUpdate: 0
    };
    
                      spmult = base_speed * finditem(player.weapon, 0).spmult;

    var op = {
      dir: 0,
      x: 0,
      y: 0
    };

    for (let i = 0; i < clients.length; i++) {
      let index = clients[i];
      if (index[2].ip == player.ip) connections++;
    }
    if (connections >= ip_limit) kickclient("over ip limit");

    var updateInt = setInterval(updateplayers, msupdate);

    function updateplayers() {
      if (player.left == true) return;
      //update dir
      if (player.dir !== op.dir) {
        sendtoall([pack.dir, player.id, player.dir]);
        op.dir = player.dir;
      }
      //update pos
      if (player.mdir !== null) {
        op.x = player.x;
        op.y = player.y;
        player.speed += 4;
        if (player.speed > spmult) player.speed = spmult;
        player.x = Math.cos(player.mdir) * player.speed + player.x;
        player.y = Math.sin(player.mdir) * player.speed + player.y;
        //reduce calculations per tick
        if (player.x > max_grid) player.x = max_grid;
        if (player.y > max_grid) player.y = max_grid;
        if (player.x < -max_grid) player.x = -max_grid;
        if (player.y < -max_grid) player.y = -max_grid;
        for (let i = 0; i < clients.length; i++) {
          let index = clients[i];
          if (player.id !== index[1]) {
            //if not current player to prevent from being unable to move
            const plind = index[2];
            if (getdist(player.x, player.y, plind.x, plind.y) < body_size * 2) {
              //close enough to contact player
              const toAngle = getangle(player, plind);
              
              plind.speed = player.speed;
              plind.lmdir = toAngle;
              
          /*    plind.x = Math.cos(toAngle) * player.speed + plind.x;
              plind.y = Math.sin(toAngle) * player.speed + plind.y;
                      if (plind.x > max_grid) player.x = max_grid;
        if (plind.y > max_grid) player.y = max_grid;
        if (plind.x < -max_grid) player.x = -max_grid;
        if (plind.y < -max_grid) player.y = -max_grid;
              updatepos(plind.id, plind.x, plind.y, plind.dir, plind.mdir, player.speed, toAngle);*/
            }

          }
        }
        /* for (let i = 0; i < builds.length; i++) {
        let index = builds[i];
        if (getdist(player.x, player.y, index[1], index[2]) < 60) {
          player.x = op.x;
          player.y = op.y;
        }
      }*/
        //sendtoall([pack.pos, [player.id, player.x, player.y, player.dir]]);
        updatepos();
        for (let i = 0; i < clients.length; i++) {
          let index = clients[i];
          if (index[1] == player.id) {
            index[2] = player;
            clients[i] = index;
            break;
          }
        }
      } else if (player.speed > 0) {
        player.speed -= speedMin;
        if(player.speed > 0){
                if (player.x > max_grid) player.x = max_grid;
        if (player.y > max_grid) player.y = max_grid;
        if (player.x < -max_grid) player.x = -max_grid;
        if (player.y < -max_grid) player.y = -max_grid;
        player.x = (Math.cos(player.lmdir) * player.speed + player.x);
        player.y = (Math.sin(player.lmdir) * player.speed + player.y);
          
         /* for(let i = 0; i < clients.length; i++){
            let index = clients[i],
            plind = index[2];
            
            if(plind.id !== player.id){
              if(getdist(player.x, player.y, plind.x, plind.y) < body_size){
                const toAngle = getangle(player, plind),
                calcPos = calcvec(plind.x, plind.y, toAngle, player.speed);
                
                plind.x = calcPos[0];
                plind.y = calcPos[1];
                
                updatepos(plind.id, plind.x, plind.dir, plind.mdir, plind.speed, plind.lmdir);
                
                index[2] = plind;
                clients[i] = index;
              }
            }
          }
          */
        }
        updatepos();
        //sendtoall([pack.pos, [player.id, player.x, player.y, player.dir]]);
      }
      //update atk
      const playerwepi = finditem(player.weapon, 0);
      if (player.isattack && time() >= player.nextatk) {
        sendtoall([pack.attack, player.id]);
        const wepanimtime = playerwepi.animtime;
        player.nextatk = time() + wepanimtime + Math.sqrt(wepanimtime) * 3;
        const playerwr = playerwepi.range;
        for (let i = 0; i < clients.length; i++) {
          let index = clients[i];
          let plind = index[2];
          if (plind.id !== player.id) {
            if (
              getdist(plind.x, plind.y, player.x, player.y) <=
              playerwr + 64 + playerwr / 4
            ) {
              //if in range
              plind.anglto = getangle(player, plind);
              if (Math.abs(player.dir - plind.anglto) <= torad(playerwr) * 2) {
                plind.lmdir = plind.anglto;
                plind.speed += 0.2;
                plind.health -= playerwepi.damage;
                if (plind.health <= 0) {
                  sendtoall([pack.death, plind.id]);
                 // sendtoall([pack.debug, "death of " + plind.id])
                  plind.x = genformap();
                  plind.y = genformap();
                  plind.health = 100;
                  updatepos(plind.id, plind.x, plind.y, plind.dir, plind.mdir, plind.speed, plind.lmdir);
                  //sendtoall([pack.pos, [plind.id, plind.x, plind.y, plind.dir]]);
                  sendtoall([pack.health, plind.id, plind.health]);
                  spmult = base_speed * finditem(player.weapon, 0).spmult;
                }
                index[2] = plind;
                clients[i] = index;
                sendtoall([pack.health, plind.id, plind.health]);
              }
            }
          }
        }
        if (playerwepi.shoot) {
          addProjectile(0, player.x, player.y, player.dir, player.id);
        }
      }
      if (time() >= player.lastpacket + 10000)
        kickclient("no packets sent in 10 sec");
    }

    function updatepos(
      id = player.id,
      x = player.x,
      y = player.y,
      dir = player.dir,
       mdir = player.mdir,
       speed = player.speed,
       lmdir = player.lmdir
    ) {
      sendtoall([pack.pos, [id, x, y, dir, mdir, speed, lmdir]]);
    }

    send([pack.id, player.id, msupdate, max_grid]);
    builds.forEach(bu => send([pack.build, bu]));

    clients.forEach(pl =>
      socket.send(//sends to this player
        msgpack.encode([pack.newplayer, pl[1], pl[2].x, pl[2].y, pl[2].dir, pl[2].health, pl[2].weapon])
      )
    );

  //  clients.forEach(pl => send([pack.health, pl[1], pl[2].health]));

    clients.push([socket, player.id, player]);
    sendtoall([pack.newplayer, player.id, player.x, player.y, player.dir, player.health, player.weapon]);
    updatepos();
    //sendtoall([pack.pos, [player.id, player.x, player.y]]);

    function send(m) {
      socket.send(msgpack.encode(m));
    }

    function kickclient(r) {
      if (r !== "client closed") return;
      for (let i2 = 0; i2 < builds.length; i2++) {
        for (let i = 0; i < builds.length; i++) {
          let index = builds[i];
          if (index[6] == player.id) builds.splice(i, 1);
        }
      }
      clearInterval(updateInt);
      player.left = true;
      updateplayers();
      console.log("kicking", player.id, "for", arguments);
      send([pack.close]);
      socket.close();
      for (let i = 0; i < clients.length; i++) {
        let index = clients[i];
        if (index[1] == player.id) {
          clients.splice(i, 1);
          sendtoall([pack.playerleave, player.id]);
          pldat = {
            allow: clients.length <= max_players,
            players: clients.length,
            maxplayers: max_players
          };
          socket.close();
        }
      }
      return;
    }

    socket.on("message", function(m) {
      player.lastpacket = time();
      try {
        const data = msgpack.decode(m);
       // console.log(data)
        switch (data[0]) {
          case pack.move:
            player.mdir = data[1];
            if (data[1] !== null) player.lmdir = data[1];
            break;
          case pack.close:
            send([pack.close]);
            socket.close();
            break;
          case pack.dir:
          /*  if (time() - player.lastDirUpdate < 50)
              kickclient("Sending too many direction packets");*/
            if (data[1] < torad(360) && data[1] > torad(-360)) {
              player.dir = data[1];
              player.lastDirUpdate = time();
            } else kickclient("improper direction");

            break;
          case pack.chat:
            data[1] = String(data[1]);
            if (
              (data[1].startsWith("/") && player.admin) ||
              data[1].startsWith("/login")
            ) {
              if (data[1] == "/wsclose") {
                socket.close();
              } else if (data[1].split(" ")[0] == "/speed") {
                spmult = data[1].split(" ")[1];
              } else if (data[1].split(" ")[0] == "/resc") {
                console.log("restarting");
                process.exit(1);
              } else if (data[1].split(" ")[0] == "/health") {
                player.health = eval(data[1].split(" ")[1]);
                sendtoall([pack.health, player.id, player.health]);
              } else if (data[1].split(" ")[0] == "/login") {
                if (data[1].split(" ")[1] == process.env.adminpass) {
                  player.admin = true;
                  send([pack.chat, player.id, "you are now admin"]);
                }
              } else if (data[1].split(" ")[0] == "/tp") {
                player.x = data[1].split(" ")[1];
                player.y = data[1].split(" ")[2];
                updatepos();
                /*sendtoall([
                pack.pos,
                [player.id, player.x, player.y, player.dir]
              ]);*/
                for (let i = 0; i < clients.length; i++) {
                  let index = clients[i];
                  if (index[1] == player.id) {
                    const health = index[2].health;
                    index[2] = player;
                    clients[i] = index;
                    break;
                  }
                }
              }
            } else sendtoall([pack.chat, player.id, data[1]]);
            break;
          case pack.attack:
            if (player.isattack == data[1])
              kickclient("same attack packet as current");
            player.isattack = data[1];
            if (data[1]) {
              if (data[2] !== undefined) player.dir = data[2];
              var playerwepi = finditem(player.weapon, 0);
              if (playerwepi.use) {
                if (playerwepi.heal && player.health < 100) {
                  player.health += playerwepi.heal;
                  sendtoall([pack.health, player.id, player.health]);
                }
                if (playerwepi.place && player.buildcount < 10) {
                  player.buildcount++;
                  sortbuilds();
                  const finalbuild = builds[builds.length - 1];
                  const buildat = [
                    finalbuild[0] + 1,
                    player.x,
                    player.y,
                    playerwepi.id,
                    0,
                    player.dir,
                    player.id
                  ];
                  builds.push(buildat);
                  sendtoall([pack.build, buildat]);
                }
                /* player.weapon = player.lastwep;
                            sendtoall([pack.weapon, player.id, player.weapon]);*/
              }
            }
            break;
          case pack.ping:
            if (!data[1]) {
              send([pack.ping]);
            } else player.ping = data[1];
            break;

          case pack.weapon:
             if(finditem(data[1], 0) == undefined && finditem(data[1], 1) == undefined) return;
            player.iswep = data[1] == 0;
            if (!player.iswep) player.lastwep = player.weapon;
            player.weapon = data[1];
            player.isprimary = player.weapon == 0;
            sendtoall([pack.weapon, player.id, player.weapon]);
            spmult = base_speed * finditem(player.weapon, 0).spmult;
            break;

          default:
            kickclient("unkown packet");
            break;
        }
      } catch (er) {
        console.log(er)
        kickclient("invalid packet (attempt server restart)", er);
      }
    });
    socket.on("close", function() {
      kickclient("client closed");
      console.log("client disconnected", player.id);
      return;
    });
  } catch (e) {
    console.log(e)
   // socket.close();
  }
});

var builds = [];

function rndm(m = 1) {
  return Math.random() * m;
}

function genthings(c) {
  for (let i = 0; i < c / 2; i++) {
    builds.push([i, genformap(), genformap(), 0, 1]);
    // id, x, y, type
  }
}

function sortbuilds() {
  const bl = builds.length;
  for (let i = 0; i < bl; i++) {
    for (let i = 0; i < bl; i++) {
      let index = builds[i];
      if (i + 1 < bl) {
        let index1 = builds[i + 1];
        if (index[0] > index1[0]) {
          builds[i + 1] = index;
          builds[i] = index1;
        }
      }
    }
  }
}

genthings(gridlen / 3);

var lastCheck = Date.now();

function calcvec(x, y, d, s) {
  let ex = Math.cos(d) * s + x;
  let ey = Math.sin(d) * s + y;
  return [ex, ey];
}

setInterval(function() {
  const msTime = Date.now() - lastCheck;

  //  if(projectilesActive.length) console.log(projectilesActive.length)

  for (let i = 0; i < projectilesActive.length; i++) {
    let index = projectilesActive[i],
      projInd = getProjectile(index.type);
    //  console.log(index)
    index.timeLeft -= 100;

    const pos = calcvec(index.x, index.y, index.dir, projInd.speed);

    index.x = pos[0];

    index.y = pos[1];

    //   console.log(msTime);

    if (index.timeLeft <= 0) {
      removeProj(i, index.id);
      return;
    } else projectilesActive[i] = index;

    for (let i1 = 0; i1 < clients.length; i1++) {
      let index1 = clients[i1],
        plind = index1[2];

      if (getdist(plind.x, plind.y, index.x, index.y) < body_size * 2) {
        //hit
        removeProj(i, index.id);
        plind.health -= projInd.damage;
        sendtoall([pack.health, plind.id, plind.health]);
        toSet.push([plind.id, "health", plind.health]);
        if (plind.health <= 0) plind.die = true;

        if (plind.health <= 0) {
          sendtoall([pack.death, plind.id]);
          plind.x = genformap();
          plind.y = genformap();
          plind.health = 100;
          updatepos(plind.id, plind.x, plind.y, plind.dir, plind.mdir, plind.speed, plind.lmdir);
          //sendtoall([pack.pos, [plind.id, plind.x, plind.y, plind.dir]]);
          sendtoall([pack.health, plind.id, plind.health]);
        }

        index1[2] = plind;
        clients[i1] = index1;
      }
    }
  }
}, 100);

function updatepos(id, x, y, dir, mdir, speed, lmdir) {
  sendtoall([pack.pos, [id, x, y, dir, mdir, speed, lmdir]]);
}

function removeProj(ind, id) {
  projectilesActive.splice(ind, 1);
  sendtoall([pack.rmvProj, id]);
}

var toSet = [];
console.log(`server listening on port ${port}`);
