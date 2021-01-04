/**
 * Room 原型拓展
 *
 * 包含了所有自定义的 room 拓展方法
 * 这些方法主要是用于和其他模块代码进行交互
 */

// import { BOOST_RESOURCE, ENERGY_SHARE_LIMIT, ROOM_TRANSFER_TASK } from "../../utils/setting";
import { createRoomLink, log } from "../../utils/utils";
import RoomShortcut from "./shortcut";
import { creepApi } from "../../utils/creepController";
// import { confirmBasePos, findBaseCenterPos, setBaseCenter } from "modules/autoPlanning/planBasePos";
// import { clearStructure, planLayout } from "modules/autoPlanning/planBaseLayout";

export default class RoomExtension extends RoomShortcut {
  /**
   * 全局日志
   *
   * @param content 日志内容
   * @param prefixes 前缀中包含的内容
   * @param color 日志前缀颜色
   * @param notify 是否发送邮件
   */
  public log(content: string, instanceName = "", color: Colors | undefined = undefined, notify = false): void {
    // 为房间名添加超链接
    const roomName = createRoomLink(this.name);
    // 生成前缀并打印日志
    const prefixes = instanceName ? [roomName, instanceName] : [roomName];
    log(content, prefixes, color, notify);
  }
  public init(): OK | ERR_NOT_FOUND {
    // this.sourcesGetter();
    if (this.sources) {
      this.sources.forEach((item, index) => {
        creepApi.add(
          `${this.name} harvester${index}`,
          "harvester",
          {
            sourceId: item.id
          },
          this.name
        );
      });
    }
    return OK;
  }
  /**
   * 添加任务
   *
   * @param task 要提交的任务
   * @param priority 任务优先级位置，默认追加到队列末尾。例：该值为 0 时将无视队列长度直接将任务插入到第一个位置
   * @returns 任务的排队位置, 0 是最前面，负数为添加失败，-1 为已有同种任务,-2 为目标建筑无法容纳任务数量
   */
  public addCenterTask(task: ITransferTask, priority = 0): number {
    if (this.hasCenterTask(task.submit)) return -1;
    const structure = this[task.target];
    if (structure && (structure.store as StoreDefinitionUnlimited).getFreeCapacity(task.resourceType) < task.amount) {
      return -2;
    }

    if (!priority) this.memory.centerTransferTasks.push(task);
    else this.memory.centerTransferTasks.splice(priority, 0, task);

    return this.memory.centerTransferTasks.length - 1;
  }

  /**
   * 向房间中发布 power 请求任务
   * 该方法已集成了 isPowerEnabled 判定，调用该方法之前无需额外添加房间是否启用 power 的逻辑
   *
   * @param task 要添加的 power 任务
   * @param priority 任务优先级位置，默认追加到队列末尾。例：该值为 0 时将无视队列长度直接将任务插入到第一个位置
   * @returns OK 添加成功
   * @returns ERR_NAME_EXISTS 已经有同名任务存在了
   * @returns ERR_INVALID_TARGET 房间控制器未启用 power
   */
  public addPowerTask(task: PowerConstant, priority = 0): OK | ERR_NAME_EXISTS | ERR_INVALID_TARGET {
    // 初始化时添加房间初始化任务（编号 -1）
    if (!this.memory.powerTasks) this.memory.powerTasks = [-1 as PowerConstant];
    if (this.controller && !this.controller.isPowerEnabled) return ERR_INVALID_TARGET;

    // 有相同的就拒绝添加
    if (this.hasPowerTask(task)) return ERR_NAME_EXISTS;

    // 发布任务到队列
    if (!priority) this.memory.powerTasks.push(task);
    // 追加到队列指定位置
    else this.memory.powerTasks.splice(priority, 0, task);

    return OK;
  }

  /**
   * 检查是否已经存在指定任务
   *
   * @param task 要检查的 power 任务
   */
  private hasPowerTask(task: PowerConstant): boolean {
    return this.memory.powerTasks.find(power => power === task) ? true : false;
  }

  /**
   * 获取当前的 power 任务
   */
  public getPowerTask(): PowerConstant | undefined {
    if (!this.memory.powerTasks || this.memory.powerTasks.length <= 0) return undefined;
    else return this.memory.powerTasks[0];
  }

  /**
   * 挂起当前任务
   * 将会把最前面的 power 任务移动到队列末尾
   */
  public hangPowerTask(): void {
    const task = this.memory.powerTasks.shift();
    if (task) {
      this.memory.powerTasks.push(task);
    }
  }

  /**
   * 移除第一个 power 任务
   */
  public deleteCurrentPowerTask(): void {
    this.memory.powerTasks.shift();
  }

  /**
   * 添加禁止通行位置
   *
   * @param creepName 禁止通行点位的注册者
   * @param pos 禁止通行的位置
   */
  public addRestrictedPos(creepName: string, pos: RoomPosition): void {
    if (!this.memory.restrictedPos) this.memory.restrictedPos = {};

    this.memory.restrictedPos[creepName] = this.serializePos(pos);
  }

  /**
   * 获取房间内的禁止通行点位
   */
  public getRestrictedPos(): { [creepName: string]: string } | null {
    if (this.memory.restrictedPos) {
      return this.memory.restrictedPos;
    }
    return null;
  }

  /**
   * 将指定位置从禁止通行点位中移除
   *
   * @param creepName 要是否点位的注册者名称
   */
  public removeRestrictedPos(creepName: string): void {
    if (!this.memory.restrictedPos) this.memory.restrictedPos = {};

    delete this.memory.restrictedPos[creepName];
  }

  /**
   * 将指定位置序列化为字符串
   * 形如: 12/32/E1N2
   *
   * @param pos 要进行压缩的位置
   */
  public serializePos(pos: RoomPosition): string {
    return `${pos.x}/${pos.y}/${pos.roomName}`;
  }

  /**
   * 向生产队列里推送一个生产任务
   *
   * @param taskName config.creep.ts 文件里 creepConfigs 中定义的任务名
   * @returns 当前任务在队列中的排名
   */
  public addSpawnTask(taskName: string): number | ERR_NAME_EXISTS {
    if (!this.memory.spawnList) this.memory.spawnList = [];
    // 先检查下任务是不是已经在队列里了
    if (!this.hasSpawnTask(taskName)) {
      // 任务加入队列
      this.memory.spawnList.push(taskName);
      return this.memory.spawnList.length - 1;
    }
    // 如果已经有的话返回异常
    else return ERR_NAME_EXISTS;
  }

  /**
   * 检查生产队列中是否包含指定任务
   *
   * @param taskName 要检查的任务名
   * @returns true/false 有/没有
   */
  public hasSpawnTask(taskName: string): boolean {
    if (!this.memory.spawnList) this.memory.spawnList = [];
    return this.memory.spawnList.indexOf(taskName) > -1;
  }

  /**
   * 清空任务队列
   * 非测试情况下不要调用！
   */
  public clearSpawnTask(): void {
    this.memory.spawnList = [];
  }

  /**
   * 将当前任务挂起
   * 任务会被移动至队列末尾
   */
  public hangSpawnTask(): void {
    if (this.memory.spawnList) {
      const task = this.memory.spawnList.shift();
      if (task) {
        this.memory.spawnList.push(task);
      }
    }
  }

  /**
   * 将位置序列化字符串转换为位置
   * 位置序列化字符串形如: 12/32/E1N2
   *
   * @param posStr 要进行转换的字符串
   */
  public unserializePos(posStr: string): RoomPosition | undefined {
    // 形如 ["12", "32", "E1N2"]
    const infos = posStr.split("/");

    return infos.length === 3 ? new RoomPosition(Number(infos[0]), Number(infos[1]), infos[2]) : undefined;
  }

  /**
   * 查找房间中的有效能量来源
   */
  public getAvailableSource(): StructureTerminal | StructureStorage | StructureContainer | Source | null {
    // terminal 或 storage 里有能量就优先用
    if (this.terminal && this.terminal.store[RESOURCE_ENERGY] > 10000) return this.terminal;
    if (this.storage && this.storage.store[RESOURCE_ENERGY] > 100000) return this.storage;
    // 如果有 sourceConainer 的话就挑个多的
    if (this.sourceContainers && this.sourceContainers.length > 0)
      return _.max(this.sourceContainers, container => container.store[RESOURCE_ENERGY]);

    // 没有就选边上有空位的 source
    let res;
    if (this.sources) {
      res = this.sources.find(source => {
        const freeCount = source.pos.getFreeSpace().length;
        const harvestCount = source.pos.findInRange(FIND_CREEPS, 1).length;

        return freeCount - harvestCount > 0;
      });
    }
    if (res) {
      return res;
    }
    return null;
  }

  /**
   * 每个建筑同时只能提交一个任务
   *
   * @param submit 提交者的身份
   * @returns 是否有该任务
   */
  public hasCenterTask(submit: CenterStructures | number): boolean {
    if (!this.memory.centerTransferTasks) this.memory.centerTransferTasks = [];

    const task = this.memory.centerTransferTasks.find(item => item.submit === submit);
    return task ? true : false;
  }

  /**
   * 暂时挂起当前任务
   * 会将任务放置在队列末尾
   *
   * @returns 任务的排队位置, 0 是最前面
   */
  public hangCenterTask(): number {
    const task = this.memory.centerTransferTasks.shift();
    if (task) {
      this.memory.centerTransferTasks.push(task);
    }

    return this.memory.centerTransferTasks.length - 1;
  }

  /**
   * 获取中央队列中第一个任务信息
   *
   * @returns 有任务返回任务, 没有返回 null
   */
  public getCenterTask(): ITransferTask | null {
    if (!this.memory.centerTransferTasks) this.memory.centerTransferTasks = [];

    if (this.memory.centerTransferTasks.length <= 0) {
      return null;
    } else {
      return this.memory.centerTransferTasks[0];
    }
  }

  /**
   * 处理任务
   *
   * @param submitId 提交者的 id
   * @param transferAmount 本次转移的数量
   */
  public handleCenterTask(transferAmount: number): void {
    this.memory.centerTransferTasks[0].amount -= transferAmount;
    if (this.memory.centerTransferTasks[0].amount <= 0) {
      this.deleteCurrentCenterTask();
    }
  }

  /**
   * 移除当前中央运输任务
   */
  public deleteCurrentCenterTask(): void {
    this.memory.centerTransferTasks.shift();
  }

  /**
   * 向房间物流任务队列推送新的任务
   *
   * @param task 要添加的任务
   * @param priority 任务优先级位置，默认追加到队列末尾。例：该值为 0 时将无视队列长度直接将任务插入到第一个位置
   * @returns 任务的排队位置, 0 是最前面，-1 为添加失败（已有同种任务）
   */
  public addRoomTransferTask(task: RoomTransferTasks, priority = 0): number {
    return 0;
  }

  /**
   * 是否有相同的房间物流任务
   * 房间物流队列中一种任务只允许同时存在一个
   *
   * @param taskType 任务类型
   */
  public hasRoomTransferTask(taskType: string): boolean {
    return false;
  }

  /**
   * 获取当前的房间物流任务
   */
  public getRoomTransferTask(): RoomTransferTasks | null {
    return null;
  }

  /**
   * 更新 labIn 任务信息
   * @param resourceType 要更新的资源 id
   * @param amount 要更新成的数量
   */
  public handleLabInTask(resourceType: ResourceConstant, amount: number): boolean {
    return false;
  }

  /**
   * 移除当前处理的房间物流任务
   * 并统计至 Memory.stats
   */
  public deleteCurrentRoomTransferTask(): void {
    const finishedTask = this.memory.transferTasks.shift();

    // // 先兜底
    if (!Memory.stats) Memory.stats = { rooms: {} };
    if (!Memory.stats.roomTaskNumber) Memory.stats.roomTaskNumber = {};
    if (finishedTask) {
      // 如果这个任务之前已经有过记录的话就增 1
      if (Memory.stats.roomTaskNumber[finishedTask.type]) {
        Memory.stats.roomTaskNumber[finishedTask.type] += 1;
      } else {
        // 没有就设为 1
        Memory.stats.roomTaskNumber[finishedTask.type] = 1;
      }
    }
  }

  /**
   * 在本房间中查找可以放置基地的位置
   * 会将可选位置保存至房间内存
   *
   * @returns 可以放置基地的中心点
   */
  public findBaseCenterPos(): RoomPosition[] {
    return [];
  }

  /**
   * 确定基地选址
   * 从给定的位置中挑选一个最优的作为基地中心点，如果没有提供的话就从 memory.centerCandidates 中挑选
   * 挑选完成后会自动将其设置为中心点
   *
   * @param targetPos 待选的中心点数组
   */
  public confirmBaseCenter(targetPos: RoomPosition[] = []): RoomPosition | ERR_NOT_FOUND {
    return ERR_NOT_FOUND;
  }

  /**
   * 设置基地中心
   * @param pos 中心点位
   */
  public setBaseCenter(pos: RoomPosition): OK | ERR_INVALID_ARGS {
    return ERR_INVALID_ARGS;
    // setBaseCenter(this, pos);
  }

  /**
   * 执行自动建筑规划
   */
  public planLayout(): string {
    // const result = planLayout(this);
    // if (result === OK) return `自动规划完成`;
    // else if (result === ERR_NOT_OWNER) return `自动规划失败，房间没有控制权限`;
    // else return `未找到基地中心点位，请执行 Game.rooms.${this.name}.setcenter 以启用自动规划`;
    return "";
  }

  /**
   * 向其他房间请求资源共享
   *
   * @param resourceType 请求的资源类型
   * @param amount 请求的数量
   */
  public shareRequest(resourceType: ResourceConstant, amount: number): boolean {
    return false;
  }

  /**
   * 将本房间添加至资源来源表中
   *
   * @param resourceType 添加到的资源类型
   */
  public shareAddSource(resourceType: ResourceConstant): boolean {
    if (!(resourceType in Memory.resourceSourceMap)) Memory.resourceSourceMap[resourceType] = [];

    const alreadyRegister = Memory.resourceSourceMap[resourceType].find(name => name === this.name);
    // 如果已经被添加过了就返回 false
    if (alreadyRegister) return false;

    Memory.resourceSourceMap[resourceType].push(this.name);
    return true;
  }

  /**
   * 从资源来源表中移除本房间房间
   *
   * @param resourceType 从哪种资源类型中移除
   */
  public shareRemoveSource(resourceType: ResourceConstant): void {
    return;
  }

  /**
   * 向本房间添加资源共享任务
   *
   * @param targetRoom 资源发送到的房间
   * @param resourceType 共享资源类型
   * @param amount 共享资源数量
   * @returns 是否成功添加
   */
  public shareAdd(targetRoom: string, resourceType: ResourceConstant, amount: number): boolean {
    return true;
  }

  /**
   * 根据资源类型查找来源房间
   *
   * @param resourceType 要查找的资源类型
   * @param amount 请求的数量
   * @returns 找到的目标房间，没找到返回 null
   */
  private shareGetSource(resourceType: ResourceConstant, amount: number): Room | null {
    // 兜底
    return null;
  }

  // 移除不必要的建筑
  public clearStructure(): OK | ERR_NOT_FOUND {
    // return clearStructure(this);
    return ERR_NOT_FOUND;
  }

  /**
   * 切换为战争状态
   * 需要提前插好名为 [房间名 + Boost] 的旗帜，并保证其周围有足够数量的 lab
   *
   * @param boostType 以什么形式启动战争状态
   * @returns ERR_NAME_EXISTS 已经处于战争状态
   * @returns ERR_NOT_FOUND 未找到强化旗帜
   * @returns ERR_INVALID_TARGET 强化旗帜附近的lab数量不足
   */
  public startWar(boostType: BoostType): OK | ERR_NAME_EXISTS | ERR_NOT_FOUND | ERR_INVALID_TARGET {
    return OK;
  }

  /**
   * 强化指定 creep
   *
   * @param creep 要进行强化的 creep，该 creep 应站在指定好的强化位置上
   * @returns ERR_NOT_FOUND 未找到boost任务
   * @returns ERR_BUSY boost尚未准备完成
   * @returns ERR_NOT_IN_RANGE creep不在强化位置上
   */
  public boostCreep(creep: Creep): OK | ERR_NOT_FOUND | ERR_BUSY | ERR_NOT_IN_RANGE {
    return ERR_NOT_IN_RANGE;
  }

  /**
   * 解除战争状态
   * 会同步取消 boost 进程
   */
  public stopWar(): OK | ERR_NOT_FOUND {
    return OK;
  }

  /**
   * 拓展新的外矿
   *
   * @param remoteRoomName 要拓展的外矿房间名
   * @param targetId 能量搬到哪个建筑里
   * @returns ERR_INVALID_TARGET targetId 找不到对应的建筑
   * @returns ERR_NOT_FOUND 没有找到足够的 source 旗帜
   */
  public addRemote(remoteRoomName: string, targetId: string): OK | ERR_INVALID_TARGET | ERR_NOT_FOUND {
    // target 建筑一定要有
    return OK;
  }

  /**
   * 移除外矿
   *
   * @param remoteRoomName 要移除的外矿
   * @param removeFlag 是否移除外矿的 source 旗帜
   */
  public removeRemote(remoteRoomName: string, removeFlag = false): OK | ERR_NOT_FOUND {
    // 兜底
    return OK;
  }

  /**
   * 占领新房间
   * 本方法只会发布占领单位，等到占领成功后 claimer 会自己发布支援单位
   *
   * @param targetRoomName 要占领的目标房间
   * @param signText 新房间的签名
   */
  public claimRoom(targetRoomName: string, signText = ""): OK {
    return OK;
  }

  /**
   * 为本房间添加新的 source container
   * 会触发 creep 发布
   *
   * @param container 要登记的 container
   */
  public registerContainer(container: StructureContainer): OK {
    // 把 container 添加到房间基础服务
    if (!this.memory.sourceContainersIds) this.memory.sourceContainersIds = [];
    // 去重，防止推入了多个相同的 container
    this.memory.sourceContainersIds = _.uniq([...this.memory.sourceContainersIds, container.id]);

    // 触发对应的 creep 发布规划
    this.releaseCreep("filler");
    this.releaseCreep("upgrader");

    return OK;
  }
}
