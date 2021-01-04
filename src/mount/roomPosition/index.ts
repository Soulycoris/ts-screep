import RoomPostionExtension from "./extension";
import { assignPrototype } from "../../utils/utils";

/**
 * 挂载 RoomPosition 拓展
 */
export default (): void => {
  assignPrototype(RoomPosition.prototype, RoomPostionExtension.prototype);
};
