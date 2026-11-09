// The emoji bottom bar was replaced by the icon tab bar. This re-export keeps
// any old <BottomNav /> import working. Delete this file once nothing imports it:
//   grep -rn "bottom-nav\|BottomNav" app components
export { TabBar as BottomNav } from "@/components/tab-bar";