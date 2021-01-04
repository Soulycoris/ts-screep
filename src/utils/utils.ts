// import { object } from "lodash";

/**
 * 根据身体配置生成完成的身体数组
 * cpu 消耗: 0.028 左右
 *
 * @param bodySet 身体部件配置对象
 */
export function calcBodyPart(bodySet: BodySet): BodyPartConstant[] {
  // 把身体配置项拓展成如下形式的二维数组
  // { [TOUGH]: 1, [WORK]: 2, [MOVE]: 3 }
  // [ [ TOUGH ], [ WORK, WORK ], [ MOVE, MOVE, MOVE ] ]
  const bodys = Object.keys(bodySet).map(type => {
    return Array(bodySet[type as BodyPartConstant]).fill(type) as BodyPartConstant[];
  });

  // 把二维数组展平
  return ([] as BodyPartConstant[]).concat(...bodys);
}

export const getCreepAmount = (type: string): Creep[] => {
  return _.filter(Game.creeps, creep => creep.memory.role === type);
};

export const pathFinder = (
  origin: RoomPosition,
  goals:
    | RoomPosition
    | {
        pos: RoomPosition;
        range: number;
      }
    | (
        | RoomPosition
        | {
            pos: RoomPosition;
            range: number;
          }
      )[]
): RoomPosition => {
  const ret = PathFinder.search(origin, goals, {
    // 我们需要把默认的移动成本设置的更高一点
    // 这样我们就可以在 roomCallback 里把道路移动成本设置的更低
    plainCost: 2,
    swampCost: 10,

    roomCallback(roomName) {
      const room = Game.rooms[roomName];
      // 在这个示例中，`room` 始终存在
      // 但是由于 PathFinder 支持跨多房间检索
      // 所以你要更加小心！
      if (!room) return false;
      const costs = new PathFinder.CostMatrix();

      room.find(FIND_STRUCTURES).forEach(function (struct) {
        if (struct.structureType === STRUCTURE_ROAD) {
          // 相对于平原，寻路时将更倾向于道路
          costs.set(struct.pos.x, struct.pos.y, 1);
        } else if (
          struct.structureType !== STRUCTURE_CONTAINER &&
          (struct.structureType !== STRUCTURE_RAMPART || !struct.my)
        ) {
          // 不能穿过无法行走的建筑
          costs.set(struct.pos.x, struct.pos.y, 0xff);
        }
      });

      // 躲避房间中的 creep
      room.find(FIND_CREEPS).forEach(function (creep) {
        costs.set(creep.pos.x, creep.pos.y, 0xff);
      });

      return costs;
    }
  });

  return ret.path[0];
};
export const gotoSources = (creep: Creep): void => {
  const res = creep.pos.findClosestByPath(FIND_SOURCES, {
    filter: structure => {
      return structure[RESOURCE_ENERGY] > 50;
    }
  });
  if (res && creep.harvest(res) === ERR_NOT_IN_RANGE) {
    creep.moveTo(res, { visualizePathStyle: { stroke: "#ffaa00" } });
  }
};

export const gotoHome = (creep: Creep): void => {
  const target = creep.pos.findClosestByRange(FIND_MY_SPAWNS);
  if (target) {
    creep.moveTo(target, {
      visualizePathStyle: { stroke: "#ffffff" }
    });
  }
};

/**
 * 把 obj2 的原型合并到 obj1 的原型上
 * 如果原型的键以 Getter 结尾，则将会把其挂载为 getter 属性
 * @param obj1 要挂载到的对象
 * @param obj2 要进行挂载的对象
 */
export const assignPrototype = (target: { [key: string]: any }, source: { [key: string]: any }): void => {
  for (const key of Reflect.ownKeys(source)) {
    if (key !== "constructor" && key !== "prototype" && key !== "name") {
      const desc = Object.getOwnPropertyDescriptor(source, key);
      if (desc) {
        Object.defineProperty(target, key, desc);
      }
    }
  }
};
/**
 * 执行 Hash Map 中子元素对象的 work 方法
 *
 * @param hashMap 游戏对象的 hash map。如 Game.creeps、Game.spawns 等
 * @param showCpu [可选] 传入指定字符串来启动该 Map 的数量统计
 */
export function doing(creepData: { [creepName: string]: Creep }): void {
  for (const name in creepData) {
    creepData[name].work();
  }
}

/**
 * 全局日志
 *
 * @param content 日志内容
 * @param prefixes 前缀中包含的内容
 * @param color 日志前缀颜色
 * @param notify 是否发送邮件
 */
export function log(content: string, prefixes: string[] = [], color: Colors = "blue", notify = false): OK {
  // 有前缀就组装在一起
  let prefix = prefixes.length > 0 ? `【${prefixes.join(" ")}】 ` : "";
  // 指定了颜色
  prefix = colorful(prefix, color, true);

  const logContent = `${prefix}${content}`;
  console.log(logContent);
  // 转发到邮箱
  if (notify) Game.notify(logContent);

  return OK;
}

/**
 * 在绘制控制台信息时使用的颜色
 */
const colors: { [name in Colors]: string } = {
  red: "#ef9a9a",
  green: "#6b9955",
  yellow: "#c5c599",
  blue: "#8dc5e3"
};

/**
 * 给指定文本添加颜色
 *
 * @param content 要添加颜色的文本
 * @param colorName 要添加的颜色常量字符串
 * @param bolder 是否加粗
 */
export function colorful(content: string, colorName: Colors = "blue", bolder = false): string {
  const colorStyle = colorName ? `color: ${colors[colorName]};` : "";
  const bolderStyle = bolder ? "font-weight: bolder;" : "";

  return `<text style="${[colorStyle, bolderStyle].join(" ")}">${content}</text>`;
}

/**
 * 全局统计信息扫描器
 * 负责搜集关于 cpu、memory、GCL、GPL 的相关信息
 * 详情见 ./doc/Grafana 统计信息.md
 */
export function stateScanner(): void {
  if (Game.time % 20) return;

  if (!Memory.stats) Memory.stats = { rooms: {} };

  // 统计 GCL / GPL 的升级百分比和等级
  Memory.stats.gcl = (Game.gcl.progress / Game.gcl.progressTotal) * 100;
  Memory.stats.gclLevel = Game.gcl.level;
  Memory.stats.gpl = (Game.gpl.progress / Game.gpl.progressTotal) * 100;
  Memory.stats.gplLevel = Game.gpl.level;
  // CPU 的当前使用量
  Memory.stats.cpu = Game.cpu.getUsed();
  // bucket 当前剩余量
  Memory.stats.bucket = Game.cpu.bucket;
  // 统计剩余钱数
  Memory.stats.credit = Game.market.credits;
}

/**
 * 给房间内添加跳转链接
 *
 * @param roomName 添加调整链接的房间名
 * @returns 打印在控制台上后可以点击跳转的房间名
 */
export function createRoomLink(roomName: string): string {
  return createLink(roomName, `https://screeps.com/a/#!/room/${Game.shard.name}/${roomName}`, false);
}

/**
 * 生成控制台链接
 * @param content 要显示的内容
 * @param url 要跳转到的 url
 * @param newTab 是否在新标签页打开
 */
export function createLink(content: string, url: string, newTab = true): string {
  return `<a href="${url}" target="${newTab ? "_blank" : "_self"}">${content}</a>`;
}

/**
 * 获取一些格式固定，但是在多处调用的名字
 * 便于维护
 */
export const getName = {
  flagBaseCenter: (roomName: string): string => `${roomName} center`
};

/**
 * 获取Creep数量
 */
export const getCreepCount = (type: string): number => {
  return _.filter(Game.creeps, creep => creep.memory.role === type).length;
};

/**
 * 获取指定方向的相反方向
 *
 * @param direction 目标方向
 */
export const getOppositeDirection = (direction: DirectionConstant): DirectionConstant => {
  return (((direction + 3) % 8) + 1) as DirectionConstant;
};

/**
 * 判断是否为白名单玩家
 *
 * @param creep 要检查的 creep
 * @returns 是否为白名单玩家
 */
export const whiteListFilter = (creep: Creep): boolean => {
  if (!Memory.whiteList) return true;
  // 加入白名单的玩家单位不会被攻击，但是会被记录
  if (creep.owner.username in Memory.whiteList) {
    Memory.whiteList[creep.owner.username] += 1;
    return false;
  }

  return true;
};
