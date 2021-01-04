import CreepExtension from "./extension";
import { assignPrototype } from "../../utils/utils";

/**
 * 挂载 creep 拓展
 */
export default (): void => {
  assignPrototype(Creep.prototype, CreepExtension.prototype);
};
