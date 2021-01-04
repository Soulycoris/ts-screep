// import Console from "./console";
// import CreepControl from "./creepControl";
import Extension from "./extension";
import Shortcut from "./shortcut";
import { assignPrototype } from "../../utils/utils";

// 定义好挂载顺序
// const plugins = [Shortcut, Extension, Console, CreepControl];
const plugins = [Shortcut, Extension];

/**
 * 依次挂载所有的 Room 拓展
 */
export default (): void => {
  plugins.forEach(plugin => assignPrototype(Room.prototype, plugin.prototype));

  //   type Shortcutkey = keyof typeof Shortcut.prototype;
  //   type roomkey = keyof typeof Room.prototype;
  // Object.getOwnPropertyNames(Room.prototype).forEach(key => {
  //   if (key && key !== "constructor") {
  //     console.log(key);
  //   }
  // });
};
