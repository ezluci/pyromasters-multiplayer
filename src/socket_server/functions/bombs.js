'use strict';

const CONST = require('../consts')();

const { getShield } = require('./usefulSettersGetters');

function isPowerup(blockCode) {
   return 5 <= blockCode && blockCode <= 13
}


// this function doesn't check if there is a bomb at map[y][x].
function explodeBomb(x, y, bombLength, recursive, io, sok) {
   
   if (! sok.room)
      return;
   
   const roomStatus = sok.getRoomStatus();
   
   function breakLoop(blockCode)
      { return (blockCode === CONST.BLOCK.NORMAL || blockCode === CONST.BLOCK.PERMANENT || isPowerup(blockCode)); }
   
   let fires = [];

   fires.push({x, y, block: CONST.BLOCK.FIRE, oldBlock: sok.map[y][x]});
   sok.map[y][x] = CONST.BLOCK.NO;

   for (let yy = y-1; yy >= Math.max(0, y - bombLength); --yy) {
      if (sok.map[yy][x] === CONST.BLOCK.BOMB) {
         fires = fires.concat( explodeBomb(x, yy, bombLength, 1, io, sok) );
         break;
      }
      if (sok.map[yy][x] !== CONST.BLOCK.PERMANENT)
         fires.push({x: x, y: yy, block: CONST.BLOCK.FIRE, oldBlock: sok.map[yy][x]});
      if (breakLoop(sok.map[yy][x]))
         break;
   }

   for (let yy = y+1; yy <= Math.min(CONST.BLOCKS_VERTICALLY-1, y + bombLength); ++yy) {
      if (sok.map[yy][x] === CONST.BLOCK.BOMB) {
         fires = fires.concat( explodeBomb(x, yy, bombLength, 1, io, sok) );
         break;
      }
      if (sok.map[yy][x] !== CONST.BLOCK.PERMANENT)
         fires.push({x: x, y: yy, block: CONST.BLOCK.FIRE, oldBlock: sok.map[yy][x]});
      if (breakLoop(sok.map[yy][x]))
         break;
   }

   for (let xx = x-1; xx >= Math.max(0, x - bombLength); --xx) {
      if (sok.map[y][xx] === CONST.BLOCK.BOMB) {
         fires = fires.concat( explodeBomb(xx, y, bombLength, 1, io, sok) );
         break;
      }
      if (sok.map[y][xx] !== CONST.BLOCK.PERMANENT)
         fires.push({x: xx, y: y, block: CONST.BLOCK.FIRE, oldBlock: sok.map[y][xx]});
      if (breakLoop(sok.map[y][xx]))
         break;
   }

   for (let xx = x+1; xx <= Math.min(CONST.BLOCKS_HORIZONTALLY-1, x + bombLength); ++xx) {
      if (sok.map[y][xx] === CONST.BLOCK.BOMB) {
         fires = fires.concat( explodeBomb(xx, y, bombLength, 1, io, sok) );
         break;
      }
      if (sok.map[y][xx] !== CONST.BLOCK.PERMANENT)
         fires.push({x: xx, y: y, block: CONST.BLOCK.FIRE, oldBlock: sok.map[y][xx]});
      if (breakLoop(sok.map[y][xx]))
         break;
   }

   if (recursive)
      return fires;
   
   fires.forEach((fire) => {
      sok.map[fire.y][fire.x] = CONST.BLOCK.FIRE;
   });

   io.to(sok.roomname).emit('mapUpdates', fires);

   // kill people who are in fire
   ['white', 'black', 'orange', 'green'].forEach(color => {
      if (! sok.room[color].selected || sok.room[color].dead)
         return;
      
      if (sok.getRoomStatus() === CONST.ROOM_STATUS.RUNNING && !getShield(io, sok) && sok.onDeadlyBlockCheck(color)) {
         io.to(sok.roomname).emit('death', color);

         sok.room[color].dead = true;
         sok.room[color].coords = Object.assign(CONST.INEXISTENT_POS);

         if (sok.countNotDead() <= 1)
            sok.room.intervalIDS.add( setTimeout(sok.showEndScreen, CONST.END_SCREEN_TIMEOUT) );
      }
   });

   // removing fire
   const id2 = setTimeout(() => {
      if (! sok.room)
         return;
      
      if (sok.getRoomStatus() !== roomStatus)
         return;
      
      fires.forEach((fire) => {

         let newBlock = CONST.BLOCK.NO;

         if (fire.oldBlock === CONST.BLOCK.NORMAL)
         {
            const rand = Math.floor(Math.random() * 18);
            if (rand > 7) {
               const rand = Math.floor(Math.random() * 14);
               
               if (rand === 0 || rand === 1 || rand === 2 || rand === 3)
                  newBlock = CONST.BLOCK.POWER_BOMBLENGTH;
               else if (rand === 4)
                  newBlock = CONST.BLOCK.POWER_BOMBPLUS;
               else if (rand === 5)
                  newBlock = CONST.BLOCK.POWER_BOMBTIME;
               else if (rand === 6)
                  ;//newBlock = CONST.BLOCK.POWER_KICKBOMBS;
               else if (rand === 7 || rand === 8)
                  newBlock = CONST.BLOCK.POWER_SPEED;
               else if (rand === 9)
                  newBlock = CONST.BLOCK.POWER_SHIELD;
               else if (rand === 10)
                  newBlock = CONST.BLOCK.POWER_SWITCHPLAYER;
               else if (rand === 11)
                  newBlock = CONST.BLOCK.POWER_SICK;
               else if (rand === 12 || rand === 13)
                  newBlock = CONST.BLOCK.POWER_BONUS;
            }

            // collecting powerups
            ['white', 'black', 'orange', 'green'].forEach(color => {
               if (! sok.room[color].selected || sok.room[color].dead)
                  return;
               
               const xPlr = sok.room[color].coords.x;
               const yPlr = sok.room[color].coords.y;
               sok.collectPowerup(Math.floor(xPlr / CONST.BLOCK_SIZE), Math.floor(yPlr / CONST.BLOCK_SIZE));
               sok.collectPowerup(Math.ceil(xPlr / CONST.BLOCK_SIZE), Math.ceil(yPlr / CONST.BLOCK_SIZE));
            });
         }

         fire.block = newBlock;
         sok.map[fire.y][fire.x] = newBlock;

         if (fire.oldBlock === CONST.BLOCK.BOMB || fire.oldBlock === CONST.BLOCK.PERMANENT) {
            const x = fire.x;
            const y = fire.y;
            const color = sok.room.bombs.get(y*100 + x);

            if (! sok.room[color].selected || sok.room[color].dead)
               return;

            if (sok.room[color].bombs < 4) {
               sok.room[color].bombs ++;
            }

            sok.room.bombs.delete(y*100 + x);

            // check if player is sick
            if (sok.sick) {
               placeBomb(io, sok);
            }
         }
      });

      io.to(sok.roomname).emit('mapUpdates', fires);

   }, CONST.FIRE_TIME);
   sok.room.intervalIDS.add(id2);
}


function placeBomb(io, sok) {
   if (!sok.detailsOkCheck())
      return;
   
   if (sok.color === 'spectator')
      return sok.emit('error', 'tryPlaceBomb: You are a spectator.');
   if (sok.room[sok.color].dead)
      return sok.emit('error', 'tryPlaceBomb: You are \'dead\'');
   
   const x = Math.round(sok.room[sok.color].coords.x / CONST.BLOCK_SIZE);
   const y = Math.round(sok.room[sok.color].coords.y / CONST.BLOCK_SIZE);
   
   if ( !(0 <= x && x <= CONST.BLOCKS_HORIZONTALLY && 0 <= y && y <= CONST.BLOCKS_VERTICALLY) )
      return sok.emit('error', 'tryPlaceBomb: x or y out of range.');
   
   if (sok.map[y][x] === CONST.BLOCK.FIRE || sok.map[y][x] === CONST.BLOCK.BOMB || sok.map[y][x] === CONST.BLOCK.PERMANENT || sok.map[y][x] === CONST.BLOCK.NORMAL)
      return;
   
   if (sok.room[sok.color].bombs === 0)
      return; // no bombs left
   
   // placing the bomb
   io.to(sok.roomname).emit('mapUpdates', [{x, y, block: CONST.BLOCK.BOMB, details: {sick: sok.sick}}]);
   sok.map[y][x] = CONST.BLOCK.BOMB;
   sok.room.bombs.set(y*100 + x, sok.color);

   sok.room[sok.color].bombs --;

   const bombLength = sok.room[sok.color].bombLength;
   const roomStatus = sok.getRoomStatus();

   const id1 = setTimeout(() => {
      if (sok.getRoomStatus() !== roomStatus)
         return;
      if (sok.map[y][x] === CONST.BLOCK.BOMB)
         explodeBomb(x, y, bombLength, 0, io, sok);
   }, CONST.BOMB_TIMES[sok.room[sok.color].bombTimeIndex]);

   sok.room.intervalIDS.add(id1);
}


module.exports.explodeBomb = explodeBomb;
module.exports.placeBomb = placeBomb;