'use strict';

const CONST = require('./consts')();
const TICK_ACTIONS = require('./tick-actions');

class Ticks {
   
   // the tick loop is not started on object construction
   constructor(io, sok) {
      this.io = io;
      this.sok = sok;
      this.TPS = 16;
      this.tick = null; // the tick to be processed
      this.tickActions = null;
      this.intervalId = null;
   }

   startTickLoop() {
      if (this.intervalId) {
         console.log('tick loop already started, ignoring request');
         return;
      }

      this.tick = 0;
      this.tickActions = {};
      this.lastTickTime = new Date();

      this.runNextTick();
      this.intervalId = setInterval(() => {
         this.runNextTick();
      }, this.TPS); // 62.5 ticks per second
   }

   endTickLoop() {
      if (this.intervalId === null) {
         console.log('tick loop already ended, ignoring request');
      }
      
      clearInterval(this.intervalId);
      this.tick = null;
      this.tickActions = null;
      this.intervalId = null;
   }

   runNextTick = () => {
      this.tickActions[this.tick]?.forEach(action => {
         this.processAction(action);
      })

      // send coordinates to everyone
      const coords = [];
      ['white', 'black', 'orange', 'green'].forEach(color => {
         if (!this.sok.room[color]) {
            coords.push([CONST.INEXISTENT_POS.x, CONST.INEXISTENT_POS.y, CONST.ANIMATION.IDLE]);
         } else {
            coords.push([this.sok.room[color].coords.x, this.sok.room[color].coords.y, this.sok.room[color].animState]);
         }
      });
      this.io.to(this.sok.roomname).emit('C', coords);

      const tickTime = new Date();
      if (tickTime - this.lastTickTime >= this.TPS * 2) {
         console.error(`${new Date()}  62.5tps loop running at ${Math.floor(1000 / (tickTime - this.lastTickTime))}tps!`);
      }
      this.lastTickTime = tickTime;
      this.tick ++;
   };


   // 'action' is formed of {'name': a number from TICK_ACTIONS and 'sok': the player for which the action is (optional)}

   processAction = (action) => {
      if (action.name === TICK_ACTIONS.SHIELD_FALSE) {
         this.sok.room[action.sok.color].setShieldFalse();
      } else if (action.name === TICK_ACTIONS.SICK_FALSE) {
         this.sok.room[action.sok.color].setSickFalse();
      }
   };

   // adds this action to 'ticks_after' ticks from now; this action is for sok (optional).
   addAction = (action, ticks_after, sok = '') => {
      if (!this.tickActions) {
         return;
      }
      if (ticks_after < 0) {
         console.error('trying to add an action to a past tick');
         return;
      }

      if (this.tickActions[this.tick + ticks_after] === undefined) {
         this.tickActions[this.tick + ticks_after] = [];
      }
      this.tickActions[this.tick + ticks_after].push({ name: action, sok: sok });
   };

   removeAction = (action, tick, sok = '') => {
      if (!this.tickActions) {
         return;
      }
      const lastLength = this.tickActions[tick]?.length;
      this.tickActions[tick] = this.tickActions[tick].filter(action1 => action1.name === action.name && action1.sok === action.sok);
      if (this.tickActions[tick] === undefined || lastLength === this.tickActions[tick].length) {
         console.error('trying to remove inexistent action');
      }
   }
};

module.exports = (io, sok) => {
   return new Ticks(io, sok);
}