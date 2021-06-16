import advancedRoles from "./advanced";
import baseRoles from "./base";
// import remoteRoles from "./remote";
// import warRoles from "./war";

const creepWork: CreepWork = {
  ...baseRoles,
  ...advancedRoles
  // ...warRoles,
  // ...remoteRoles
};
/**
 * 导出所有的角色
 */
export default creepWork;
