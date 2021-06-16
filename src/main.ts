import { doing, stateScanner } from "./utils/utils";
import { ErrorMapper } from "./utils/ErrorMapper";
// import creepNumberListener from "./utils/creepController";
// import { creepApi } from "./utils/creepController";
import { creepSpawn } from "./utils/creepSpawn";
import mountWork from "./mount";

export const loop = ErrorMapper.wrapLoop(() => {
  if (Memory.showCost) console.log(`-------------------------- [${Game.time}] -------------------------- `);

  // 挂载拓展
  mountWork();
  // console.log(Game.rooms[roomName].init());

  // creep 数量控制
  // creepNumberListener();
  creepSpawn();

  // 所有建筑、creep、powerCreep 执行工作
  doing(Game.creeps);
  // if (Game.spawns["Happy Home"].work) {
  //   Game.spawns["Happy Home"].work();
  // }
  // type structureskey = keyof typeof Game.structures;
  for (const key in Game.structures) {
    const element = Game.structures[key];
    if (element.work) {
      element.work();
    }
  }

  // for (const name in Game.creeps) {
  //   Game.creeps[name].work();
  // }

  // 统计全局资源使用
  stateScanner();
});
