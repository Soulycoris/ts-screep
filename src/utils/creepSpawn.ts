// import { bodyConfigs, creepDefaultMemory } from "./setting";
import { creepApi } from "./creepController";
import { getCreepCount } from "./utils";
// import roles from "role";
// 孵化数量
const ROOM = "W1N7";

export const creepSpawn = (): void => {
  if (Game.time % 5) return;

  // energyAvailable = Game.rooms[ROOM].energyAvailable;
  const harvesters = getCreepCount("harvester");
  const builders = getCreepCount("builder");
  const fillers = getCreepCount("filler");
  const upgraders = getCreepCount("upgrader");
  // if (!global.hasExtension) {
  const sources = Game.rooms[ROOM].sources;
  const storage = Game.rooms[ROOM].storage;
  const sourceContainers = Game.rooms[ROOM].sourceContainers;
  if (sources !== null && harvesters < 2) {
    sources.forEach((item, index) => {
      creepApi.add(
        `${ROOM} harvester${index}`,
        "harvester",
        {
          sourceId: item.id
        },
        ROOM
      );
    });
  }
  if (sourceContainers !== null) {
    let storageId: Id<StructureStorage>;
    if (storage && storage.store[RESOURCE_ENERGY] > 100000) {
      storageId = storage.id;
    }
    if (fillers < 1) {
      sourceContainers.forEach((item, index) => {
        creepApi.add(`${ROOM} filler${index}`, "filler", { sourceId: item.id }, ROOM);
      });
    }
    if (upgraders < 1) {
      sourceContainers.forEach((item, index) => {
        creepApi.add(`${ROOM} upgrader${2 * index}`, "upgrader", { sourceId: storageId ? storageId : item.id }, ROOM);
        creepApi.add(
          `${ROOM} upgrader${2 * index + 1}`,
          "upgrader",
          { sourceId: storageId ? storageId : item.id },
          ROOM
        );
      });
    }
    if (builders < 1) {
      sourceContainers.forEach((item, index) => {
        creepApi.add(`${ROOM} builder${index}`, "builder", { sourceId: storageId ? storageId : item.id }, ROOM);
      });
    }
  }
  // }
};
