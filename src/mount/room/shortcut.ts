/* eslint-disable no-underscore-dangle */
/**
 * 获取并缓存建筑
 *
 * @param room 目标房间
 * @param privateKey 建筑缓存在目标房间的键
 * @param memoryKey 建筑 id 在房间内存中对应的字段名
 * @returns 对应的建筑
 */
// const getStructure = function (room: Room, privateKey: RoomPrivateKey, memoryKey: string): any {
//   const res = room[privateKey];
//   if (res) {
//     return res;
//   }
//   type key = keyof typeof room.memory;
//   // 内存中没有 id 就说明没有该建筑
//   if (!room.memory[memoryKey as key]) return "";

//   // 从 id 获取建筑并缓存
//   const target = Game.getObjectById(room.memory[memoryKey as key]);

//   // 如果保存的 id 失效的话，就移除缓存
//   if (!target) {
//     delete room.memory[memoryKey as key];
//     return undefined;
//   }

//   // 否则就暂存对象并返回
//   room[privateKey] = target;
//   return target;
// };

/**
 * Room 快捷访问
 *
 * 提供对房间内资源的快捷访问方式，如：W1N1.nuker、W1N1.sources 等
 * 包括唯一型建筑（Nuker、Factory ...）和自然资源（Source、Mineral ...）
 */

export default class RoomShortcut extends Room {
  /**
   * Mineral 访问器
   *
   * 读取房间内存中的 mineralId 重建 Mineral 对象。
   * 如果没有该字段的话会自行搜索并保存至房间内存
   */
  public get mineral(): Mineral | null {
    if (this._mineral) return this._mineral;

    // 如果内存中存有 id 的话就读取并返回
    // mineral 不会过期，所以不需要进行处理
    if (this.memory.mineralId) {
      const res = Game.getObjectById(this.memory.mineralId as Id<Mineral>);
      if (res) {
        this._mineral = res;
      }
      return this._mineral;
    }

    // 没有 id 就进行搜索
    const mineral = this.find(FIND_MINERALS)[0];
    if (!mineral) {
      this.log(`异常访问，房间内没有找到 mineral`, "roomBase", "yellow");
      return null;
    }

    // 缓存数据并返回
    this.memory.mineralId = mineral.id;
    this._mineral = mineral;
    return this._mineral;
  }

  /**
   * Source 访问器
   *
   * 工作机制同上 mineral 访问器
   */
  public get sources(): Source[] | null {
    if (this._sources) return this._sources;

    // 如果内存中存有 id 的话就读取并返回
    // source 不会过期，所以不需要进行处理
    if (this.memory.sourceIds) {
      const res = this.memory.sourceIds
        .map(id => {
          const source = Game.getObjectById(id as Id<Source>);
          if (source) {
            return source;
          }
          return false;
        })
        .filter(s => s) as Source[];
      if (res.length) {
        this._sources = res;
      }
      return this._sources;
    }

    // 没有 id 就进行搜索
    const sources = this.find(FIND_SOURCES);
    if (sources.length <= 0) {
      this.log(`异常访问，房间内没有找到 source`, "roomBase", "yellow");
      return null;
    }

    // 缓存数据并返回
    this.memory.sourceIds = sources.map(s => s.id);
    this._sources = sources;
    return this._sources;
  }

  /**
   * source 旁的 container 访问器
   * 只会检查内存中是否存在对应 id，有的话就获取 container 实例，没有的话则不会主动搜索
   * 内存中的对应 id 由新建 container 的 harvester 角色上传
   */
  public get sourceContainers(): StructureContainer[] | null {
    if (this._sourceContainers) return this._sourceContainers;

    // 内存中没有 id 就说明没有 container
    if (!this.memory.sourceContainersIds) return [];

    // container 有可能会消失，每次获取时都要把废弃的 id 移除出内存
    const abandonedIdIndex: number[] = [];

    const targets = this.memory.sourceContainersIds
      .map((containerId, index) => {
        // 遍历 id，获取 container 实例
        const container = Game.getObjectById(containerId as Id<StructureContainer>);
        if (container) return container;

        abandonedIdIndex.push(index);
        return false;
      })
      // 去除所有为 false 的结果
      .filter(s => s) as StructureContainer[];

    // 移除失效的 id
    abandonedIdIndex.forEach(index => this.memory.sourceContainersIds.splice(index, 1));

    if (this.memory.sourceContainersIds.length <= 0) {
      this.memory.sourceContainersIds = [];
    }

    // 暂存对象并返回
    this._sourceContainers = targets;
    return this._sourceContainers;
  }

  // public get factory(): StructureFactory | null {
  //   return getStructure<StructureFactory>(this, "factory", "factoryId");
  // }

  //   public get powerSpawn(): StructurePowerSpawn | null {
  //     return getStructure<StructurePowerSpawn>(this, "powerSpawn", "powerSpawnId");
  //   }

  //   public get nuker(): StructureNuker | null {
  //     return getStructure<StructureNuker>(this, "nuker", "nukerId");
  //   }

  //   public get observer(): StructureObserver | null {
  //     return getStructure<StructureObserver>(this, "observer", "observerId");
  //   }

  //   public get centerLink(): StructureLink | null {
  //     return getStructure<StructureLink>(this, "centerLink", "centerLinkId");
  //   }

  //   public get extractor(): StructureExtractor | null {
  //     return getStructure<StructureExtractor>(this, "extractor", "extractorId");
  //   }
}
