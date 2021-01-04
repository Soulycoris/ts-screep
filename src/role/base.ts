// import { ROOM_TRANSFER_TASK, minerHervesteLimit } from "../utils/setting";
// import { getRoomTransferTask, transferTaskOperations } from "./advanced";

/**
 * 初级房间运维角色组
 * 本角色组包括了在没有 Storage 和 Link 的房间内运维所需的角色
 */
const roles = {
  /**
   * 采集者
   * 从指定 source 中获取能量 > 将能量存放到身下的 container 中
   */
  harvester: (data: CreepData): ICreepConfig => ({
    // 向 container 或者 source 移动
    // 在这个阶段中，targetId 是指 container 或 conatiner 的工地或 source
    prepare: creep => {
      let target: StructureContainer | Source | ConstructionSite | null = null;
      // 如果有缓存的话就获取缓存
      if (creep.memory.targetId) target = Game.getObjectById(creep.memory.sourceId as Id<StructureContainer | Source>);
      const source = Game.getObjectById(data.sourceId as Id<Source>);

      // 没有缓存或者缓存失效了就重新获取
      if (!target && source) {
        // 先尝试获取 container
        const containers = source.pos.findInRange<StructureContainer>(FIND_STRUCTURES, 1, {
          filter: { structureType: STRUCTURE_CONTAINER }
        });

        // 找到了就把 container 当做目标
        if (containers.length > 0) target = containers[0];
      }

      // 还没找到就找 container 的工地
      if (!target && source) {
        const constructionSite = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, {
          filter: { structureType: STRUCTURE_CONTAINER }
        });

        if (constructionSite.length > 0) target = constructionSite[0];
      }

      // 如果还是没找到的话就用 source 当作目标
      // console.log(target,source);

      if (!target && source) {
        target = source;
        return true;
      } else if (target) {
        creep.memory.targetId = target.id;

        // 设置移动范围并进行移动（source 走到附近、container 和工地就走到它上面）
        const range = target instanceof Source ? 1 : 0;
        // creep.goTo(target.pos, range);
        creep.moveTo(target.pos);

        // 抵达位置了就准备完成
        if (creep.pos.inRangeTo(target.pos, range)) return true;
      }
      return false;
    },
    // 因为 prepare 准备完之后会先执行 source 阶段，所以在这个阶段里对 container 进行维护
    // 在这个阶段中，targetId 仅指 container
    source: creep => {
      creep.say("🚧");

      // 没有能量就进行采集，因为是维护阶段，所以允许采集一下工作一下
      const sourceId = Game.getObjectById(data.sourceId as Id<Source>);
      if (creep.store[RESOURCE_ENERGY] <= 0 && sourceId) {
        creep.getEngryFrom(sourceId);
        return false;
      }

      // 获取 prepare 阶段中保存的 targetId
      const target = Game.getObjectById(creep.memory.targetId as Id<StructureContainer>);

      // 存在 container，把血量修满
      if (target && target instanceof StructureContainer) {
        creep.repair(target);
        // 血修满了就正式进入采集阶段
        return target.hits >= target.hitsMax;
      }

      // 不存在 container，开始新建，首先尝试获取工地缓存，没有缓存就新建工地
      let constructionSite: ConstructionSite | null = null;
      if (!creep.memory.constructionSiteId) creep.pos.createConstructionSite(STRUCTURE_CONTAINER);
      else constructionSite = Game.getObjectById(creep.memory.constructionSiteId as Id<ConstructionSite>);

      // 没找到工地缓存或者工地没了，重新搜索
      if (!constructionSite) {
        const res = creep.pos.lookFor(LOOK_CONSTRUCTION_SITES).find(s => s.structureType === STRUCTURE_CONTAINER);
        if (res) {
          constructionSite = res;
        }
      }

      // 还没找到就说明有可能工地已经建好了，进行搜索
      if (!constructionSite) {
        const container = creep.pos.lookFor(LOOK_STRUCTURES).find(s => s.structureType === STRUCTURE_CONTAINER);

        // 找到了造好的 container 了，添加进房间
        if (container) {
          creep.room.registerContainer(container as StructureContainer);
          return true;
        }

        // 还没找到，等下个 tick 会重新新建工地
        return false;
      } else {
        // 找到了就缓存 id
        creep.memory.constructionSiteId = constructionSite.id;
      }

      creep.build(constructionSite);
      return false;
    },
    // 采集阶段会无脑采集，过量的能量会掉在 container 上然后被接住存起来
    target: creep => {
      const target = Game.getObjectById(data.sourceId as Id<Source>);
      if (target) {
        creep.getEngryFrom(target);
      }
      // 快死了就把身上的能量丢出去，这样就会存到下面的 container 里，否则变成墓碑后能量无法被 container 自动回收
      if (creep.ticksToLive && creep.ticksToLive < 2) creep.drop(RESOURCE_ENERGY);
      return false;
    },
    bodys: "harvester"
  }),

  /**
   * 收集者
   * 从指定 source 中获取资源 > 将资源转移到指定建筑中
   */
  collector: (data: CreepData): ICreepConfig => ({
    prepare: creep => {
      // 已经到附近了就准备完成
      const target = Game.getObjectById(data.sourceId as Id<StructureContainer>);
      if (target) {
        if (creep.pos.isNearTo(target.pos)) return true;
        // 否则就继续移动
        else {
          // creep.goTo(target.pos);
          creep.moveTo(target.pos);
          return false;
        }
      }

      return false;
    },
    source: creep => {
      if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) return true;

      const source = Game.getObjectById(data.sourceId as Id<Source>);
      if (!source) {
        creep.say("目标找不到!");
        return false;
      }

      const actionResult = creep.harvest(source);

      // if (actionResult === ERR_NOT_IN_RANGE) creep.goTo(source.pos);
      if (actionResult === ERR_NOT_IN_RANGE) creep.moveTo(source.pos);
      else if (actionResult === ERR_NOT_ENOUGH_RESOURCES) {
        // 如果满足下列条件就重新发送 regen_source 任务
        // if (
        //   // creep 允许重新发布任务
        //   (!creep.memory.regenSource || creep.memory.regenSource < Game.time) &&
        //   // source 上没有效果
        //   (!source.effects || !source.effects[PWR_REGEN_SOURCE])
        // ) {
        //   // 并且房间内的 pc 支持这个任务
        //   if (creep.room.memory.powers && creep.room.memory.powers.split(" ").includes(String(PWR_REGEN_SOURCE))) {
        //     // 添加 power 任务，设置重新尝试时间
        //     creep.room.addPowerTask(PWR_REGEN_SOURCE);
        //     creep.memory.regenSource = Game.time + 300;
        //   } else creep.memory.regenSource = Game.time + 1000;
        // }
      }

      // 快死了就把能量移出去
      if (creep.ticksToLive && creep.ticksToLive <= 3) return true;
      return false;
    },
    target: creep => {
      const target = Game.getObjectById(data.targetId as Id<StructureContainer>);
      // 找不到目标了，自杀并重新运行发布规划
      if (!target) {
        creep.say("目标找不到!");
        // creep.room.releaseCreep("harvester");
        creep.suicide();
        return false;
      }

      if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(target.pos);
        // creep.goTo(target.pos);
      }

      if (creep.store.getUsedCapacity() === 0) return true;
      return false;
    },
    bodys: "worker"
  }),

  /**
   * 矿工
   * 从房间的 mineral 中获取资源 > 将资源转移到指定建筑中(默认为 terminal)
   */
  miner: (data: CreepData): ICreepConfig => ({
    // 检查矿床里是不是还有矿
    isNeed: room => {
      return false;
    },
    prepare: creep => {
      return false;
    },
    source: creep => {
      return false;
    },
    target: creep => {
      return false;
    },
    bodys: "worker"
  }),

  /**
   * 填充单位
   * 从 container 中获取能量 > 执行房间物流任务
   * 在空闲时间会尝试把能量运输至 storage
   */
  filler: (data: CreepData): ICreepConfig => ({
    // 能量来源（container）没了就自觉放弃
    isNeed: room => {
      if (room.sourceContainers) {
        return !!room.sourceContainers.find(container => container.id === data.sourceId);
      }
      return false;
    },
    // 一直尝试从 container 里获取能量，不过拿到了就走
    source: creep => {
      if (creep.store[RESOURCE_ENERGY] > 0) return true;

      // 获取源 container
      let source: StructureContainer | StructureStorage | null | undefined = Game.getObjectById(
        data.sourceId as Id<StructureContainer>
      );
      // container 没能量了就尝试从 storage 里获取能量执行任务
      // 原因是有了 sourceLink 之后 container 会有很长一段时间没人维护（直到 container 耐久掉光）
      // 如果没有这个判断的话 filler 会在停止孵化之前有好几辈子都呆在空 container 前啥都不干
      if (!source || source.store[RESOURCE_ENERGY] <= 0) {
        source = creep.room.storage;
      }
      if (source) {
        creep.getEngryFrom(source);
      }
      return false;
    },
    // 维持房间能量填充
    target: creep => {
      if (creep.store[RESOURCE_ENERGY] <= 0) {
        return true;
      }
      const target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: structure => {
          return (
            (structure.structureType === STRUCTURE_EXTENSION ||
              structure.structureType === STRUCTURE_SPAWN ||
              structure.structureType === STRUCTURE_TOWER) &&
            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
          );
        }
      });

      if (target) {
        if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, {
            visualizePathStyle: { stroke: "#ffffff" }
          });
        }
        return false;
      }
      // 空闲时间会尝试把能量存放到 storage 里
      if (!creep.room.storage) return false;

      const source = Game.getObjectById(data.sourceId as Id<StructureContainer>);
      // source container 还有 harvester 维护时才会把能量转移至 storage
      // 否则结合 source 阶段，filler 会在 container 等待老化时在 storage 旁边无意义举重
      if (source && source.store[RESOURCE_ENERGY] > 0) {
        creep.transferTo(creep.room.storage, RESOURCE_ENERGY);
      } else {
        creep.say("💤");
      }

      return false;
    },
    bodys: "manager"
  }),

  /**
   * 升级者
   * 不会采集能量，只会从指定目标获取能量
   * 从指定建筑中获取能量 > 升级 controller
   */
  upgrader: (data: CreepData): ICreepConfig => ({
    source: creep => {
      // 因为只会从建筑里拿，所以只要拿到了就去升级
      if (creep.store[RESOURCE_ENERGY] > 0) return true;

      const source = Game.getObjectById(data.sourceId as Id<StructureTerminal | StructureStorage | StructureContainer>);
      if (source) {
        // 如果来源是 container 的话就等到其中能量大于指定数量再拿（优先满足 filler 的能量需求）
        if (source.structureType === STRUCTURE_CONTAINER && source.store[RESOURCE_ENERGY] <= 500) return false;

        // 获取能量
        const result = creep.getEngryFrom(source);
        // 但如果是 Container 或者 Link 里获取能量的话，就不会重新运行规划
        if (
          (result === ERR_NOT_ENOUGH_RESOURCES || result === ERR_INVALID_TARGET) &&
          (source instanceof StructureTerminal || source instanceof StructureStorage)
        ) {
          // 如果发现能量来源（建筑）里没有能量了，就自杀并重新运行 upgrader 发布规划
          // creep.room.releaseCreep("upgrader");
          creep.suicide();
        }
      }
      return false;
    },
    target: creep => {
      if (creep.upgrade() === ERR_NOT_ENOUGH_RESOURCES) return true;
      return false;
    },
    bodys: "upgrader"
  }),

  /**
   * 建筑者
   * 只有在有工地时才会生成
   * 从指定结构中获取能量 > 查找建筑工地并建造
   *
   * @param spawnRoom 出生房间名称
   * @param sourceId 要挖的矿 id
   */
  builder: (data: CreepData): ICreepConfig => ({
    // 工地都建完就就使命完成
    isNeed: room => {
      const targets: ConstructionSite[] = room.find(FIND_MY_CONSTRUCTION_SITES);
      return targets.length > 0 ? true : false;
    },
    // 把 data 里的 sourceId 挪到外边方便修改
    prepare: creep => {
      creep.memory.sourceId = data.sourceId;
      return true;
    },
    // 根据 sourceId 对应的能量来源里的剩余能量来自动选择新的能量来源
    source: creep => {
      if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) return true;

      // 获取有效的能量来源
      let source;
      if (!creep.memory.sourceId) {
        source = creep.room.getAvailableSource();
        if (source) {
          creep.memory.sourceId = source.id;
        }
      } else {
        source = Game.getObjectById(creep.memory.sourceId as Id<Source>);
      }

      // 之前用的能量来源没能量了就更新来源（如果来源已经是 source 的话就不改了）
      if (source && creep.getEngryFrom(source) === ERR_NOT_ENOUGH_RESOURCES && source instanceof Structure)
        delete creep.memory.sourceId;
      return false;
    },
    target: creep => {
      // 有新墙就先刷新墙
      if (creep.memory.fillWallId) creep.steadyWall();
      else if (creep.buildStructure() !== ERR_NOT_FOUND) {
        // 没有就建其他工地
      } else if (creep.upgrade()) {
        // 工地也没了就去升级
      }

      if (creep.store.getUsedCapacity() === 0) return true;
      return false;
    },
    bodys: "worker"
  }),

  /**
   * 维修者
   * 从指定结构中获取能量 > 维修房间内的建筑
   * 注：目前维修者只会在敌人攻城时使用
   *
   * @param spawnRoom 出生房间名称
   * @param sourceId 要挖的矿 id
   */
  repairer: (data: CreepData): ICreepConfig => ({
    // 根据敌人威胁决定是否继续生成
    isNeed: room => {
      return false;
    },
    source: creep => {
      return false;
    },
    // 一直修墙就完事了
    target: creep => {
      return false;
    },
    bodys: "worker"
  })
};
export default roles;
